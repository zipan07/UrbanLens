// Project real administrative rings once per camera frame; animate only the thin SVG stroke.
const ns='http://www.w3.org/2000/svg';
export function districtRings(collection,name){return (collection?.features||[]).filter(f=>!name||f.properties?.name===name).flatMap(f=>f.geometry.type==='Polygon'?f.geometry.coordinates:f.geometry.type==='MultiPolygon'?f.geometry.coordinates.flat():[]);}
export function projectBoundary(ring,project){return ring.map((p,i)=>{const q=project(p),x=Array.isArray(q)?q[0]:q.x,y=Array.isArray(q)?q[1]:q.y;return Number.isFinite(x)&&Number.isFinite(y)?`${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`:'';}).join('')+'Z';}
export function installDistrictFlow(map,boundaries){
 const area=document.querySelector('.map-workspace'),svg=document.createElementNS(ns,'svg');svg.classList.add('district-flow');svg.setAttribute('aria-hidden','true');svg.setAttribute('hidden','');area.append(svg);
 let rings=[],paths=[],frame=0;
 function draw(){frame=0;if(!rings.length)return;svg.setAttribute('viewBox',`0 0 ${area.clientWidth} ${area.clientHeight}`);rings.forEach((ring,i)=>{const d=projectBoundary(ring,p=>map.project(p));for(const path of paths[i])path.setAttribute('d',d);});}
 const queue=()=>{if(!frame&&rings.length)frame=requestAnimationFrame(draw);};
 function highlight(name){rings=districtRings(boundaries,name);svg.replaceChildren();paths=[];svg.toggleAttribute('hidden',!rings.length);svg.dataset.region=name||'两区全域';for(const ring of rings){const group=['glow','edge','stream'].map(kind=>{const path=document.createElementNS(ns,'path');path.setAttribute('class','district-flow-'+kind);path.setAttribute('pathLength','1000');path.setAttribute('vector-effect','non-scaling-stroke');svg.append(path);return path;});paths.push(group);}queue();}
 const visibility=()=>svg.classList.toggle('is-paused',document.hidden);document.addEventListener('visibilitychange',visibility);
 const observer=new ResizeObserver(queue);observer.observe(area);map.on('load',queue);map.on('move',queue);map.on('resize',queue);map.on('style.load',queue);
 function destroy(){cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);for(const event of ['load','move','resize','style.load'])map.off(event,queue);svg.remove();}
 map.on('remove',destroy);return {highlight,destroy};
}

// Geographic 2D fallback for browsers without WebGL. Uses the same real data and style.
import {inGeometry} from './geo.js';
const RAD=Math.PI/180;
const mercator=([lng,lat])=>[(lng+180)/360,(1-Math.asinh(Math.tan(lat*RAD))/Math.PI)/2];
const inverse=([x,y])=>[x*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y)))/RAD];
const reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const value=(v,p,z,g)=>{
 if(!Array.isArray(v))return v;const [op,...a]=v,E=x=>value(x,p,z,g);
 if(op==='get')return p[a[0]];if(op==='literal')return a[0];if(op==='zoom')return z;if(op==='geometry-type')return g.type.replace('Multi','');
 if(op==='==')return E(a[0])===E(a[1]);if(op==='!=')return E(a[0])!==E(a[1]);if(op==='in')return E(a[1]).includes(E(a[0]));if(op==='all')return a.every(E);if(op==='*')return E(a[0])*E(a[1]);if(op==='coalesce')return a.map(E).find(x=>x!==null&&x!==undefined);
 if(op==='match'){const input=E(a[0]);for(let i=1;i<a.length-1;i+=2)if(a[i]===input||Array.isArray(a[i])&&a[i].includes(input))return E(a[i+1]);return E(a.at(-1));}
 if(op==='step'){const n=E(a[0]);let result=E(a[1]);for(let i=2;i<a.length;i+=2){if(n<a[i])break;result=E(a[i+1]);}return result;}
 if(op==='interpolate'){const n=E(a[1]);if(n<=a[2])return E(a[3]);for(let i=4;i<a.length;i+=2)if(n<=a[i]){const t=(n-a[i-2])/(a[i]-a[i-2]);return E(a[i-1])*(1-t)+E(a[i+1])*t;}return E(a.at(-1));}
 return v;
};
export class CanvasAtlas {
 constructor({container,style,center,zoom,bearing=0,bounds=[118.584,31.867,119.24,32.248],minZoom=9}){
  this.fallback=true;this.bounds=bounds;this.minZoom=minZoom;this.maxZoom=19;this.visibleCache=new Map();this.container=document.getElementById(container);this.container.replaceChildren();this.canvas=document.createElement('canvas');this.canvas.style.cssText='width:100%;height:100%;display:block;touch-action:none';this.canvas.tabIndex=0;this.canvas.setAttribute('role','img');this.container.append(this.canvas);this.ctx=this.canvas.getContext('2d');if(!this.ctx)throw Error('Canvas 2D unavailable');
  this.style=style;this.center=mercator(center);this.zoom=zoom;this.bearing=bearing;this.events=new Map();this.geometryCache=new WeakMap();this.pointers=new Map();this.loaded=false;this.doubleEnabled=true;this.frame=0;
  this.touchZoomRotate={enable(){}};this.touchPitch={enable(){}};this.doubleClickZoom={enable:()=>this.doubleEnabled=true,disable:()=>this.doubleEnabled=false};
  this.observer=new ResizeObserver(()=>this.drawSoon());this.observer.observe(this.container);this.bind();this.drawSoon();
 }
 on(name,fn){const a=this.events.get(name)||[];a.push(fn);this.events.set(name,a);return this;}
 off(name,fn){this.events.set(name,(this.events.get(name)||[]).filter(f=>f!==fn));return this;}
 once(name,fn){const wrap=(...a)=>{this.events.set(name,(this.events.get(name)||[]).filter(f=>f!==wrap));fn(...a);};return this.on(name,wrap);}
 emit(name,event){for(const fn of [...(this.events.get(name)||[])])fn(event);}
 getCanvas(){return this.canvas;}getContainer(){return this.container;}getCenter(){const [lng,lat]=inverse(this.center);return {lng,lat};}getPitch(){return 0;}getBearing(){return this.bearing;}getZoom(){return this.zoom;}
 getMinZoom(){return this.minZoom;}getMaxZoom(){return this.maxZoom;}
 getLayer(id){return this.style.layers.find(l=>l.id===id);}getSource(id){const s=this.style.sources[id];return s?{setData:data=>{s.data=data;this.visibleCache.clear();this.drawSoon();}}:null;}
 getLayoutProperty(id,key){return this.getLayer(id)?.layout?.[key];}setLayoutProperty(id,key,v){const l=this.getLayer(id);if(l){l.layout??={};l.layout[key]=v;}this.drawSoon();}
 addControl(){}setTerrain(){}setPitch(){this.emit('pitchend');}
 setPaintProperty(id,key,v){const l=this.getLayer(id);if(l)l.paint[key]=v;this.drawSoon();}
 setStyle(style){this.style=style;this.visibleCache.clear();requestAnimationFrame(()=>{this.emit('style.load');this.drawSoon();});}
 resize(){this.drawSoon();}triggerRepaint(){this.drawSoon();}
 beginMove(){if(!this.moving){this.moving=true;this.emit('movestart');}}
 endMove(){if(this.moving){this.moving=false;this.emit('moveend');}}
 stop(){if(this.cameraFrame)cancelAnimationFrame(this.cameraFrame);this.cameraFrame=0;this.cameraAnimation=null;clearTimeout(this.wheelEnd);this.wheelEnd=null;this.endMove();return this;}
 isMoving(){return !!this.moving;}
 jumpTo(options){return this.easeTo({...options,duration:0});}
 easeTo(options={}){
  const supplied=options.center,coords=Array.isArray(supplied)?supplied:supplied?[supplied.lng,supplied.lat]:null;
  if(coords&&(!coords.every(Number.isFinite)||coords.length!==2)||options.zoom!==undefined&&!Number.isFinite(options.zoom)||options.bearing!==undefined&&!Number.isFinite(options.bearing))return this;
  const from={center:[...this.center],zoom:this.zoom,bearing:this.bearing},target=coords?mercator([coords[0],clamp(coords[1],-85.051129,85.051129)]):[...this.center];
  const zoom=clamp(options.zoom??this.zoom,this.minZoom,this.maxZoom),bearing=this.bearing+(((options.bearing??this.bearing)-this.bearing+540)%360+360)%360-180;
  const duration=options.animate===false||reducedMotion()?0:clamp(Number.isFinite(options.duration)?options.duration:300,0,2000),started=performance.now();
  this.stop();const animation={};this.cameraAnimation=animation;this.beginMove();
  const around=options.around?(Array.isArray(options.around)?options.around:[options.around.lng,options.around.lat]):null,anchor=around?this.project(around):null;
  const apply=t=>{const eased=options.easing?options.easing(t):t*t*(3-2*t);this.center=from.center.map((v,i)=>v+(target[i]-v)*eased);this.zoom=from.zoom+(zoom-from.zoom)*eased;this.bearing=from.bearing+(bearing-from.bearing)*eased;if(anchor){const a=mercator(around),b=mercator(this.unproject(anchor));this.center=[this.center[0]+a[0]-b[0],this.center[1]+a[1]-b[1]];}this.constrain();this.emit('move');this.drawSoon();};
  const finish=()=>{this.cameraFrame=0;this.cameraAnimation=null;this.emit('pitchend');this.endMove();};
  if(!duration){apply(1);finish();return this;}
  const frame=now=>{if(this.cameraAnimation!==animation)return;const t=clamp((now-started)/duration,0,1);apply(t);if(this.cameraAnimation!==animation)return;if(t<1)this.cameraFrame=requestAnimationFrame(frame);else finish();};
  this.cameraFrame=requestAnimationFrame(frame);return this;
 }
 panBy(offset,options={}){return this.easeTo({...options,center:this.unproject([this.width/2+offset[0],this.height/2+offset[1]])});}
 flyTo(options){return this.easeTo(options);}zoomIn(){return this.easeTo({zoom:this.zoom+.6,duration:220});}zoomOut(){return this.easeTo({zoom:this.zoom-.6,duration:220});}
 fitBounds([a,b],options={}){if(![...a,...b].every(Number.isFinite))return this;const p=mercator(a),q=mercator(b),pad=typeof options.padding==='number'?{top:options.padding,right:options.padding,bottom:options.padding,left:options.padding}:options.padding||{},left=pad.left??30,right=pad.right??30,top=pad.top??30,bottom=pad.bottom??30,w=Math.max(80,this.container.clientWidth-left-right),h=Math.max(80,this.container.clientHeight-top-bottom),zoom=clamp(Math.log2(Math.min(w/Math.max(Math.abs(q[0]-p[0]),1e-12),h/Math.max(Math.abs(q[1]-p[1]),1e-12))/512),this.minZoom,this.maxZoom),scale=512*2**zoom,center=inverse([(p[0]+q[0])/2+(right-left)/(2*scale),(p[1]+q[1])/2+(bottom-top)/(2*scale)]);return this.easeTo({...options,center,zoom,bearing:options.bearing??0});}
 constrain(){const c=inverse(this.center);c[0]=Math.max(this.bounds[0]-.1,Math.min(this.bounds[2]+.1,c[0]));c[1]=Math.max(this.bounds[1]-.1,Math.min(this.bounds[3]+.1,c[1]));this.center=mercator(c);}
 projectWorld([x,y]){const s=512*2**this.zoom,angle=-this.bearing*RAD,dx=(x-this.center[0])*s,dy=(y-this.center[1])*s;return [this.width/2+dx*Math.cos(angle)-dy*Math.sin(angle),this.height/2+dx*Math.sin(angle)+dy*Math.cos(angle)];}
 project(lnglat){return this.projectWorld(mercator(lnglat));}
 unproject([x,y]){const s=512*2**this.zoom,angle=this.bearing*RAD,dx=x-this.width/2,dy=y-this.height/2;return inverse([this.center[0]+(dx*Math.cos(angle)-dy*Math.sin(angle))/s,this.center[1]+(dx*Math.sin(angle)+dy*Math.cos(angle))/s]);}
 shape(g){let cached=this.geometryCache.get(g);if(cached)return cached;const lines=g.type==='Polygon'?g.coordinates:g.type==='MultiPolygon'?g.coordinates.flat():g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:g.type==='Point'?[[g.coordinates]]:[];const paths=lines.map(l=>l.map(mercator)),coords=paths.flat(),b=coords.reduce((a,c)=>[Math.min(a[0],c[0]),Math.min(a[1],c[1]),Math.max(a[2],c[0]),Math.max(a[3],c[1])],[Infinity,Infinity,-Infinity,-Infinity]);cached={paths,b};this.geometryCache.set(g,cached);return cached;}
 visible(f){const {b}=this.shape(f.geometry),corners=[[b[0],b[1]],[b[0],b[3]],[b[2],b[1]],[b[2],b[3]]].map(p=>this.projectWorld(p));return !corners.every(p=>p[0]<-80)&&!corners.every(p=>p[0]>this.width+80)&&!corners.every(p=>p[1]<-80)&&!corners.every(p=>p[1]>this.height+80);}
 path(f){const ctx=this.ctx;ctx.beginPath();for(const ring of this.shape(f.geometry).paths){ring.forEach((c,i)=>{const [x,y]=this.projectWorld(c);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});if(f.geometry.type.includes('Polygon'))ctx.closePath();}}
 drawSoon(){if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.draw();});}
 draw(){this.width=this.container.clientWidth;this.height=this.container.clientHeight;if(!this.width||!this.height)return;const dpr=Math.min(devicePixelRatio||1,2);if(this.canvas.width!==Math.round(this.width*dpr)||this.canvas.height!==Math.round(this.height*dpr)){this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);}const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,this.width,this.height);ctx.lineCap='round';ctx.lineJoin='round';const occupied=[];
  for(const l of this.style.layers){if(l.layout?.visibility==='none'||l.minzoom>this.zoom||l.maxzoom<=this.zoom||!['background','fill','line','circle','symbol'].includes(l.type))continue;const paint=l.paint;
   if(l.type==='background'){ctx.fillStyle=paint['background-color'];ctx.fillRect(0,0,this.width,this.height);continue;}
   const features=this.visibleFeatures(l.source);
   for(const f of features){if(!this.visible(f)||l.filter&&!value(l.filter,f.properties,this.zoom,f.geometry))continue;const E=v=>value(v,f.properties,this.zoom,f.geometry),g=f.geometry,p=f.properties;
    if(l.type==='fill'&&g.type.includes('Polygon')){this.path(f);ctx.fillStyle=E(paint['fill-color']);ctx.globalAlpha=E(paint['fill-opacity']??1);ctx.fill('evenodd');}
    if(l.type==='line'&&g.type!=='Point'){this.path(f);ctx.strokeStyle=E(paint['line-color']);ctx.lineWidth=E(paint['line-width']??1);ctx.globalAlpha=E(paint['line-opacity']??1);ctx.setLineDash((paint['line-dasharray']||[]).map(x=>x*ctx.lineWidth));ctx.stroke();ctx.setLineDash([]);}
    if(l.type==='circle'&&g.type==='Point'){const [x,y]=this.project(g.coordinates);ctx.beginPath();ctx.arc(x,y,E(paint['circle-radius']||3),0,Math.PI*2);ctx.globalAlpha=E(paint['circle-opacity']??1);ctx.fillStyle=E(paint['circle-color']);ctx.fill();ctx.strokeStyle=E(paint['circle-stroke-color']||'transparent');ctx.lineWidth=E(paint['circle-stroke-width']||0);if(ctx.lineWidth)ctx.stroke();}
    if(l.type==='symbol'){const text=E(l.layout['text-field']);if(!text)continue;const {b,paths}=this.shape(g),point=g.type==='Point'?this.project(g.coordinates):this.projectWorld([(b[0]+b[2])/2,(b[1]+b[3])/2]);let [x,y]=point;const size=E(l.layout['text-size']||11);ctx.font=`${size}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif`;const width=ctx.measureText(text).width;if(width>this.width*.45)continue;y-=g.type==='Point'?10:0;const box=[x-width/2-5,y-size-3,x+width/2+5,y+4];if(occupied.some(r=>box[0]<r[2]&&box[2]>r[0]&&box[1]<r[3]&&box[3]>r[1]))continue;occupied.push(box);ctx.globalAlpha=E(paint['text-opacity']??.95);ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.lineWidth=3;ctx.strokeStyle=E(paint['text-halo-color']);ctx.strokeText(text,x,y);ctx.fillStyle=E(paint['text-color']);ctx.fillText(text,x,y);}
    ctx.globalAlpha=1;
   }
  }
  this.emit('render');if(!this.loaded){this.loaded=true;this.emit('load');}
 }
 visibleFeatures(source){
  const key=[this.center[0],this.center[1],this.zoom,this.bearing,this.width,this.height].join('|');if(this.visibleKey!==key){this.visibleKey=key;this.visibleCache.clear();}if(this.visibleCache.has(source))return this.visibleCache.get(source);
  const corners=[[-80,-80],[this.width+80,-80],[this.width+80,this.height+80],[-80,this.height+80]].map(p=>mercator(this.unproject(p))),b=corners.reduce((a,c)=>[Math.min(a[0],c[0]),Math.min(a[1],c[1]),Math.max(a[2],c[0]),Math.max(a[3],c[1])],[Infinity,Infinity,-Infinity,-Infinity]);
  const items=(this.style.sources[source]?.data?.features||[]).filter(f=>{const q=this.shape(f.geometry).b;return q[0]<=b[2]&&q[2]>=b[0]&&q[1]<=b[3]&&q[3]>=b[1];});this.visibleCache.set(source,items);return items;
 }
 queryRenderedFeatures(point,options={}){const pt=Array.isArray(point)?[(point[0][0]+point[1][0])/2,(point[0][1]+point[1][1])/2]:[point.x,point.y],lnglat=this.unproject(pt),hits=[];
  for(const id of options.layers||[]){const layer=this.getLayer(id);if(!layer||layer.layout?.visibility==='none'||layer.minzoom>this.zoom)continue;const features=this.visibleFeatures(layer.source);for(const f of features){if(layer.filter&&!value(layer.filter,f.properties,this.zoom,f.geometry)||!this.visible(f))continue;const g=f.geometry;let hit=false;if(g.type.includes('Polygon'))hit=inGeometry(lnglat,g);else if(g.type==='Point'){const p=this.project(g.coordinates);hit=Math.hypot(pt[0]-p[0],pt[1]-p[1])<9;}else for(const ring of this.shape(g).paths){for(let i=1;i<ring.length;i++){const a=this.projectWorld(ring[i-1]),b=this.projectWorld(ring[i]),dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((pt[0]-a[0])*dx+(pt[1]-a[1])*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(pt[0]-a[0]-t*dx,pt[1]-a[1]-t*dy)<5){hit=true;break;}}if(hit)break;}if(hit){hits.push(f);if(hits.length>12)return hits;}}}return hits;
 }
 bind(){const canvas=this.canvas,point=e=>{const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
  const frame=()=>{const a=[...this.pointers.values()];return a.length>1?{center:[(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2],distance:Math.hypot(a[1][0]-a[0][0],a[1][1]-a[0][1]),angle:Math.atan2(a[1][1]-a[0][1],a[1][0]-a[0][0])}:{center:a[0]};};
  canvas.addEventListener('pointerdown',e=>{this.stop();if(e.button!==0&&e.pointerType!=='touch')return;canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,point(e));this.previous=frame();this.startPoint=point(e);this.moved=this.pointers.size>1;});
  canvas.addEventListener('pointermove',e=>{const p=point(e);if(!this.pointers.has(e.pointerId)){this.emit('mousemove',{point:{x:p[0],y:p[1]}});return;}const before=this.previous;this.pointers.set(e.pointerId,p);const after=frame();if(Math.hypot(p[0]-this.startPoint[0],p[1]-this.startPoint[1])>4)this.moved=true;if(before?.center&&after.center){this.beginMove();const a=mercator(this.unproject(before.center));if(before.distance&&after.distance){this.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.zoom+Math.log2(after.distance/before.distance)));this.bearing-=((after.angle-before.angle+Math.PI*3)%(Math.PI*2)-Math.PI)/RAD;}const b=mercator(this.unproject(after.center));this.center=[this.center[0]+a[0]-b[0],this.center[1]+a[1]-b[1]];this.constrain();this.emit('move');this.drawSoon();}this.previous=after;});
  canvas.addEventListener('pointerup',e=>{const p=point(e),click=this.pointers.has(e.pointerId)&&!this.moved&&this.pointers.size===1;this.pointers.delete(e.pointerId);this.previous=this.pointers.size?frame():null;if(!this.pointers.size)this.endMove();if(click){const [lng,lat]=this.unproject(p);this.emit('click',{point:{x:p[0],y:p[1]},lngLat:{lng,lat}});}});
  const cancelPointer=e=>{this.pointers.delete(e.pointerId);this.previous=this.pointers.size?frame():null;this.moved=true;if(!this.pointers.size)this.endMove();};
  canvas.addEventListener('pointercancel',cancelPointer);canvas.addEventListener('lostpointercapture',cancelPointer);
  canvas.addEventListener('wheel',e=>{e.preventDefault();if(!Number.isFinite(e.deltaY))return;this.stop();this.beginMove();const p=point(e),a=mercator(this.unproject(p)),factor=e.deltaMode===1?16:e.deltaMode===2?this.height:1;this.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.zoom-e.deltaY*factor*(e.ctrlKey||Math.abs(e.deltaY)<20?.006:.012)));const b=mercator(this.unproject(p));this.center=[this.center[0]+a[0]-b[0],this.center[1]+a[1]-b[1]];this.constrain();this.emit('move');this.drawSoon();this.wheelEnd=setTimeout(()=>{this.wheelEnd=null;this.endMove();},120);},{passive:false});
  canvas.addEventListener('dblclick',()=>{if(this.doubleEnabled)this.zoomIn();});
  canvas.addEventListener('keydown',e=>{if(['+','=','-','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(e.key)){this.stop();if(e.key==='Escape')return;e.preventDefault();if(e.key==='+'||e.key==='=')this.zoomIn();else if(e.key==='-')this.zoomOut();else{const d={ArrowLeft:[-60,0],ArrowRight:[60,0],ArrowUp:[0,-60],ArrowDown:[0,60]}[e.key];this.easeTo({center:this.unproject([this.width/2+d[0],this.height/2+d[1]]),duration:180});}}});
 }
}

// Motion is presentational: persisted runs and calculation rules stay in their owners.
const reduced=()=>typeof matchMedia!=='function'||matchMedia('(prefers-reduced-motion: reduce)').matches;
const frames=new WeakMap();
const ease='cubic-bezier(.22,.7,.2,1)';
export function captureMetrics(root){
 const values=new Map();
 if(!root||root.closest('[hidden]'))return values;
 for(const el of root.querySelectorAll('[data-metric]'))values.set(el.dataset.metric,{value:Number(el.textContent)});
 const polygon=root.querySelector('.radar-value');if(polygon)values.set('radar',polygon.getAttribute('points'));
 for(const el of root.querySelectorAll('[data-motion-key]'))values.set('position:'+el.dataset.motionKey,el.getBoundingClientRect());
 return values;
}
export function animateMetrics(root,before=new Map()){
 if(!root)return;cancelAnimationFrame(frames.get(root));
 if(reduced()||root.closest('[hidden]')||document.hidden)return;
 const numbers=[...root.querySelectorAll('[data-metric]')].map(el=>({el,to:Number(el.textContent),from:before.get(el.dataset.metric)?.value})).filter(x=>Number.isFinite(x.to)&&Number.isFinite(x.from)&&x.from!==x.to);
 const polygon=root.querySelector('.radar-value'),startPoints=before.get('radar'),endPoints=polygon?.getAttribute('points');
 const parse=s=>s?.trim().split(/[\s,]+/).map(Number),a=parse(startPoints),b=parse(endPoints);
 const morph=polygon&&a?.length===b?.length&&a.every(Number.isFinite)&&b.every(Number.isFinite);
 for(const el of root.querySelectorAll('[data-motion-key]')){const from=before.get('position:'+el.dataset.motionKey),to=el.getBoundingClientRect();if(from&&to.width&&Math.abs(from.top-to.top)+Math.abs(from.left-to.left)>2)el.animate([{translate:`${from.left-to.left}px ${from.top-to.top}px`},{translate:'0 0'}],{duration:440,easing:ease});}
 for(const bar of root.querySelectorAll('.dimension-fill,.compare-bars i>b'))bar.animate([{transform:'scaleX(.82)',opacity:.65},{transform:'scaleX(1)',opacity:1}],{duration:440,easing:ease});
 if(!numbers.length&&!morph)return;
 const start=performance.now();
 const finish=()=>{numbers.forEach(x=>{x.el.textContent=String(x.to);});if(morph){polygon.setAttribute('points',endPoints);root.querySelectorAll('.value-radar circle').forEach((dot,i)=>{dot.setAttribute('cx',b[i*2]);dot.setAttribute('cy',b[i*2+1]);});}};
 function tick(now){if(!root.isConnected||root.closest('[hidden]')||reduced()||document.hidden){finish();return;}const t=Math.min(1,(now-start)/440),p=1-(1-t)**3;for(const x of numbers)x.el.textContent=t===1?String(x.to):String(Math.round((x.from+(x.to-x.from)*p)*10)/10);if(morph){const pts=a.map((v,i)=>v+(b[i]-v)*p);polygon.setAttribute('points',pts.reduce((out,v,i)=>out+(i?(i%2?',':' '):'')+v,''));root.querySelectorAll('.value-radar circle').forEach((dot,i)=>{dot.setAttribute('cx',pts[i*2]);dot.setAttribute('cy',pts[i*2+1]);});}if(t<1)frames.set(root,requestAnimationFrame(tick));else finish();}
 frames.set(root,requestAnimationFrame(tick));
}
let selectionAnimations=[];
export function revealSelection(origin){
 selectionAnimations.forEach(a=>a.cancel());selectionAnimations=[];
 const root=document.querySelector('#value-detail'),title=root?.querySelector('.unit-title');
 if(!title||reduced())return;
 const heading=title.querySelector('h2'),to=heading.getBoundingClientRect();
 // Keep the actual heading in place; no duplicated text or delayed accessibility tree.
 const dx=origin&&Math.abs(origin.left-to.left)<500?origin.left-to.left:0;
 const dy=origin?Math.max(-56,Math.min(56,origin.top-to.top)):12;
 selectionAnimations.push(heading.animate([{translate:`${dx}px ${dy}px`,opacity:.45},{translate:'0 0',opacity:1}],{duration:520,easing:ease}));
 selectionAnimations.push(title.animate([{borderColor:'#8ca7c4',background:'#edf4fc'},{borderColor:'#e2e7ee',background:'transparent'}],{duration:700,easing:ease}));
}
export function installRefinedControls(){
 const area=document.querySelector('.map-workspace'),tools=area?.querySelector('.map-tools');if(!tools)return;
 const button=document.createElement('button');button.id='map-settings-toggle';button.className='tool-button';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','map-settings-panel');button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M8 4v6m8 4v6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span>视图</span>';tools.append(button);const fullscreen=document.querySelector('#presentation-toggle');if(fullscreen){fullscreen.className='tool-button';tools.append(fullscreen);}
 const panel=document.createElement('section');panel.id='map-settings-panel';panel.className='map-settings-panel';panel.setAttribute('aria-label','地图视图设置');panel.hidden=true;
 panel.innerHTML='<div class="map-settings-heading"><div><strong>地图视图</strong><small>方向、主题与保存的视角</small></div><button aria-label="关闭视图设置">×</button></div>';
 area.append(panel);
 for(const selector of ['.rotation-dock','.map-bottom','.view-memory']){const el=area.querySelector(selector);if(el)panel.append(el);}
 const set=on=>{panel.hidden=!on;button.setAttribute('aria-expanded',String(on));if(on){document.querySelector('#layers-popover').hidden=true;document.querySelector('#layers-toggle').setAttribute('aria-expanded','false');}};
 button.onclick=()=>set(panel.hidden);panel.querySelector('button').onclick=()=>{set(false);button.focus();};
 document.querySelector('#layers-toggle').addEventListener('click',()=>set(false));
 document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!button.contains(e.target))set(false);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){const restore=panel.contains(document.activeElement);set(false);if(restore)button.focus();}});
 document.addEventListener('urbanlens:home',()=>set(false));
}

export function installReadingView(map){
 const button=document.querySelector('#reading-toggle'),panel=document.querySelector('#inspector');if(!button||!panel)return;
 const workspace=document.querySelector('.workspace'),mapArea=document.querySelector('.map-workspace');let resizeTimer;
 const capture=()=>{if(document.body.classList.contains('phone-ui'))return;const width=workspace.clientWidth,viewport=window.innerWidth,preferred=viewport>=1600?454:viewport<=850?336:viewport<=1080?365:viewport<=1360?404:424;workspace.style.setProperty('--reading-map-width',Math.max(0,width-preferred)+'px');};
 capture();window.addEventListener('resize',capture);new ResizeObserver(capture).observe(workspace);
 const set=on=>{capture();document.body.classList.toggle('reading-wide',on);button.setAttribute('aria-expanded',String(on));button.setAttribute('aria-label',on?'返回地图':'展开评估阅读视图');button.title=on?'向右展开地图':'向左收起地图 · 展开评估';button.innerHTML=on?'→<span>返回地图</span>':'‹';if(on){panel.classList.add('is-open');document.querySelector('#mobile-panel').setAttribute('aria-expanded','true');if(document.body.classList.contains('is-presenting')){document.body.classList.add('present-panel');document.querySelector('#presentation-panel').setAttribute('aria-pressed','true');}}clearTimeout(resizeTimer);const immediate=document.body.classList.contains('phone-ui')||matchMedia('(prefers-reduced-motion: reduce)').matches;resizeTimer=setTimeout(()=>map.resize?.(),immediate?0:1020);};
 mapArea.addEventListener('transitionend',e=>{if(e.propertyName==='margin-left')map.resize?.();});
 const sync=()=>{document.querySelector('.workspace').style.setProperty('--reading-edge',panel.getBoundingClientRect().width+'px');};
 const observer=new ResizeObserver(sync);observer.observe(panel);sync();button.addEventListener('click',()=>set(!document.body.classList.contains('reading-wide')));
 document.addEventListener('urbanlens:home',()=>set(false));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('reading-wide')&&!document.querySelector('dialog[open]'))set(false);});
 document.addEventListener('urbanlens:reading-close',()=>set(false));
 document.querySelector('#close-panel').addEventListener('click',()=>set(false));
}
export function revealAssessment(root){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const animations=[];let delay=0;
 const cards=[...root.querySelectorAll('.stage-intro,.score-section,.analysis-card,.budget-card,.evidence-table,.constraint-grid,.dimension-list')];
 for(const card of cards){animations.push(card.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:Math.min(delay,900),fill:'backwards'}));delay+=85;}
 for(const p of root.querySelectorAll('.analysis-card p,.stage-intro p')){
  if(p.childElementCount)continue;const text=p.textContent;p.textContent='';const pieces=Array.from(text).join('').match(/.{1,8}/gu)||[];
  pieces.forEach((part,i)=>{const span=document.createElement('span');span.textContent=part;p.append(span);animations.push(span.animate([{opacity:0},{opacity:1}],{duration:90,delay:Math.min(i*24,1400),fill:'backwards'}));});
 }
 const skip=root.querySelector('[data-reveal-skip]');if(skip){skip.hidden=false;skip.onclick=()=>{animations.forEach(a=>a.finish());skip.hidden=true;};Promise.allSettled(animations.map(a=>a.finished)).then(()=>{skip.hidden=true;});}
}

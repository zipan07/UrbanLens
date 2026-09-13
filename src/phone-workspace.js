export const PHONE_QUERY='(max-width:740px), (max-width:1100px) and (max-height:600px) and (pointer:coarse)';
export const PHONE_TOOLS=['.map-search','.map-tools','#layers-popover','.district-control','.map-navigation','.view-dock','.view-memory','.rotation-dock','.map-bottom','#population-legend','#presentation-bar'];
export function installPhoneWorkspace({map,studio,openPanel}){
 const media=matchMedia(PHONE_QUERY),body=document.body,$=s=>document.querySelector(s),moved=new Map();let enabled=false,frame=0;
 const dock=document.createElement('nav');dock.className='phone-dock phone-only';dock.setAttribute('aria-label','手机主导航');
 dock.innerHTML='<button data-phone="map" aria-pressed="true">⌖<span>地图</span></button><button data-phone="assessment" aria-pressed="false">▤<span>评估</span></button><button data-phone="tools" aria-expanded="false" aria-controls="phone-tools-panel">⚙<span>工具</span></button><button data-phone="menu" aria-expanded="false" aria-controls="phone-navigation">☰<span>菜单</span></button>';
 $('.shell').insertBefore(dock,$('.statusbar'));
 const header=document.createElement('button');header.className='phone-header-toggle phone-only';header.type='button';header.setAttribute('aria-label','展开顶部操作');header.setAttribute('aria-expanded','false');header.textContent='⌄';$('.topbar').insertBefore(header,$('.top-actions'));
 const panel=document.createElement('section');panel.id='phone-tools-panel';panel.className='phone-only phone-tools-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','手机地图工具');
 panel.innerHTML='<div class="phone-tools-heading"><strong>地图工具</strong><button aria-label="关闭地图工具">×</button></div><div class="phone-tools-content"></div>';
 $('.map-workspace').append(panel);$('.nav-rail').id='phone-navigation';
 const content=panel.querySelector('.phone-tools-content');
 function controls(){if(!enabled)return;for(const selector of PHONE_TOOLS){const el=$(selector);if(!el||content.contains(el))continue;const marker=document.createComment('phone-control-position');el.before(marker);moved.set(el,marker);content.append(el);}}
 function size(){if(!enabled)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{body.style.setProperty('--phone-header-height',$('.topbar').getBoundingClientRect().height+'px');map.resize?.();});}
 function tools(open){panel.hidden=!open;body.classList.toggle('phone-tools-open',open);dock.querySelector('[data-phone="tools"]').setAttribute('aria-expanded',String(open));if(open){menu(false);document.dispatchEvent(new Event('urbanlens:reading-close'));openPanel(false);controls();}size();}
 function menu(open){body.classList.toggle('phone-menu-open',open);body.classList.toggle('phone-header-open',open);dock.querySelector('[data-phone="menu"]').setAttribute('aria-expanded',String(open));header.setAttribute('aria-expanded',String(open));header.setAttribute('aria-label',open?'收起顶部操作':'展开顶部操作');header.textContent=open?'⌃':'⌄';if(open)tools(false);size();}
 function mapOnly(){document.dispatchEvent(new Event('urbanlens:reading-close'));openPanel(false);tools(false);menu(false);}
 function update(){if(!enabled)return;const reading=$('#inspector').classList.contains('is-open')||body.classList.contains('reading-wide');if(body.classList.contains('phone-reading')!==reading)body.classList.toggle('phone-reading',reading);dock.querySelector('[data-phone="map"]').setAttribute('aria-pressed',String(!reading&&!body.classList.contains('phone-tools-open')));dock.querySelector('[data-phone="assessment"]').setAttribute('aria-pressed',String(reading));}
 function sync(){const next=media.matches;if(next===enabled){size();return;}enabled=next;body.classList.toggle('phone-ui',enabled);
  if(enabled){controls();mapOnly();update();}else{panel.hidden=true;for(const [el,marker]of moved){marker.replaceWith(el);}moved.clear();for(const name of ['phone-menu-open','phone-header-open','phone-tools-open','phone-reading'])body.classList.remove(name);body.style.removeProperty('--phone-header-height');cancelAnimationFrame(frame);requestAnimationFrame(()=>map.resize?.());}size();
 }
 dock.addEventListener('click',e=>{const action=e.target.closest('[data-phone]')?.dataset.phone;if(action==='map')mapOnly();if(action==='assessment'){tools(false);menu(false);const s=studio();if(s)s.adapter.tab('value');else openPanel(true);}if(action==='tools')tools(panel.hidden);if(action==='menu')menu(!body.classList.contains('phone-menu-open'));update();});
 header.addEventListener('click',()=>menu(!body.classList.contains('phone-header-open')));panel.querySelector('button').addEventListener('click',()=>tools(false));
 $('.nav-rail').addEventListener('click',e=>{if(enabled&&e.target.closest('button,a'))menu(false);});
 $('.top-actions').addEventListener('click',e=>{if(enabled&&e.target.closest('button'))menu(false);});
 panel.addEventListener('click',e=>{if(!enabled)return;const b=e.target.closest('button');if(b&&(b.matches('[data-view],[data-theme],[data-mode]')||b.id==='measure'))tools(false);});
 document.addEventListener('urbanlens:home',()=>{if(enabled)requestAnimationFrame(mapOnly);});
 document.addEventListener('keydown',e=>{if(enabled&&e.key==='Escape'){tools(false);menu(false);}});
 new MutationObserver(()=>{if(enabled){controls();update();}}).observe($('.workspace'),{childList:true,subtree:true});
 new MutationObserver(update).observe($('#inspector'),{attributes:true,attributeFilter:['class']});
 let bodyState='';new MutationObserver(()=>{if(!enabled)return;const next=['is-presenting','reading-wide','is-drawing'].map(c=>body.classList.contains(c)).join();if(next===bodyState)return;bodyState=next;if(body.classList.contains('is-drawing')){tools(false);menu(false);}update();size();}).observe(body,{attributes:true,attributeFilter:['class']});
 new ResizeObserver(size).observe($('.topbar'));media.addEventListener('change',sync);window.addEventListener('resize',size);sync();
 return {sync};
}

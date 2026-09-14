export function installReadingView(map){
 const button=document.querySelector('#reading-toggle'),panel=document.querySelector('#inspector');if(!button||!panel)return;
 const workspace=document.querySelector('.workspace'),mapArea=document.querySelector('.map-workspace');let resizeTimer;let preferredRatio=null;try{const n=Number(localStorage.getItem('urbanlens:split-ratio'));if(n>.1&&n<.9)preferredRatio=n;}catch{}
 const separator=document.createElement('div');separator.id='workspace-splitter';separator.tabIndex=0;separator.setAttribute('role','separator');separator.setAttribute('aria-orientation','vertical');separator.setAttribute('aria-label','调整地图与文字区域宽度');separator.setAttribute('aria-controls','map inspector');separator.title='拖动调整宽度 · 双击恢复默认 · 方向键微调';separator.innerHTML='<span aria-hidden="true"></span>';workspace.append(separator);
 const capture=()=>{if(document.body.classList.contains('phone-ui'))return;const width=workspace.clientWidth;if(!width)return;const viewport=window.innerWidth,preferred=viewport>=1600?454:viewport<=850?336:viewport<=1080?365:viewport<=1360?404:424;const min=Math.min(220,width*.35),max=Math.max(min,width-320),mapWidth=preferredRatio===null?Math.max(min,width-preferred):Math.max(min,Math.min(max,width*preferredRatio));workspace.style.setProperty('--reading-map-width',mapWidth+'px');separator.setAttribute('aria-valuemin',String(Math.round(min/width*100)));separator.setAttribute('aria-valuemax',String(Math.round(max/width*100)));separator.setAttribute('aria-valuenow',String(Math.round(mapWidth/width*100)));separator.setAttribute('aria-valuetext',`地图 ${Math.round(mapWidth/width*100)}%，文字 ${Math.round((1-mapWidth/width)*100)}%`);};
 capture();window.addEventListener('resize',capture);new ResizeObserver(capture).observe(workspace);
 const set=on=>{capture();document.body.classList.toggle('reading-wide',on);button.setAttribute('aria-expanded',String(on));button.setAttribute('aria-label',on?'返回地图':'展开评估阅读视图');button.title=on?'向右展开地图':'向左收起地图 · 展开评估';button.innerHTML=on?'→<span>返回地图</span>':'‹';if(on){panel.classList.add('is-open');document.querySelector('#mobile-panel').setAttribute('aria-expanded','true');if(document.body.classList.contains('is-presenting')){document.body.classList.add('present-panel');document.querySelector('#presentation-panel').setAttribute('aria-pressed','true');}}clearTimeout(resizeTimer);const immediate=document.body.classList.contains('phone-ui')||matchMedia('(prefers-reduced-motion: reduce)').matches;resizeTimer=setTimeout(()=>map.resize?.(),immediate?0:1020);};
 mapArea.addEventListener('transitionend',e=>{if(e.propertyName==='margin-left')map.resize?.();});
 const sync=()=>{document.querySelector('.workspace').style.setProperty('--reading-edge',panel.getBoundingClientRect().width+'px');};
 const observer=new ResizeObserver(sync);observer.observe(panel);sync();button.addEventListener('click',()=>set(!document.body.classList.contains('reading-wide')));
 document.addEventListener('urbanlens:home',()=>set(false));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('reading-wide')&&!document.querySelector('dialog[open]'))set(false);});
 document.addEventListener('urbanlens:reading-close',()=>set(false));
 let dragging=false,frame=0;
 const resize=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;map.resize?.();});};
 const store=()=>{try{if(preferredRatio===null)localStorage.removeItem('urbanlens:split-ratio');else localStorage.setItem('urbanlens:split-ratio',String(preferredRatio));}catch{}};
 const adjust=x=>{const r=workspace.getBoundingClientRect(),width=r.width;preferredRatio=Math.max(Math.min(220,width*.35),Math.min(Math.max(220,width-320),x-r.left))/width;capture();resize();};
 const finish=()=>{if(!dragging)return;dragging=false;document.body.classList.remove('is-resizing-workspace');store();resize();};
 separator.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();dragging=true;document.body.classList.add('is-resizing-workspace');separator.setPointerCapture(e.pointerId);});
 separator.addEventListener('pointermove',e=>{if(dragging)adjust(e.clientX);});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])separator.addEventListener(name,finish);window.addEventListener('blur',finish);
 separator.addEventListener('dblclick',()=>{preferredRatio=null;store();capture();resize();});
 separator.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const r=workspace.getBoundingClientRect(),current=parseFloat(workspace.style.getPropertyValue('--reading-map-width'));adjust(r.left+(e.key==='Home'?220:e.key==='End'?r.width-320:current+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?64:24)));store();});
}
export function revealAssessment(root,{progressive=false}={}){
 if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!root.animate&&typeof root.querySelector('.score-section')?.animate!=='function')return ()=>{};
 const animations=[],timers=[];let numberFrame=0,stopped=false;
 if(!progressive){root.querySelectorAll('.stage-intro,.score-section,.analysis-card,.budget-card,.evidence-table,.constraint-grid,.dimension-list').forEach((card,i)=>{animations.push(card.animate([{opacity:.35,translate:'0 10px'},{opacity:1,translate:'0 0'}],{duration:360,delay:Math.min(i*45,180),easing:'cubic-bezier(.22,.7,.2,1)',fill:'backwards'}));});return ()=>animations.forEach(a=>a.cancel());}
 const stages=[...root.querySelectorAll('.assessment-dashboard,.analysis-card,.assessment-insight-block,.budget-card')];if(!stages.length)return ()=>{};
 const bar=document.createElement('div');bar.className='assessment-release';bar.innerHTML='<span role="status" aria-live="polite">评估结果已生成，正在展开总览</span><button type="button">立即显示全部</button><progress max="'+stages.length+'" value="0" aria-label="评估结果展示进度"></progress>';
 const score=root.querySelector('.assessment-dashboard');score.before(bar);
 for(const stage of stages)stage.hidden=true;
 const progress=bar.querySelector('progress'),status=bar.querySelector('[role=status]');
 const finish=()=>{if(stopped)return;stopped=true;timers.forEach(clearTimeout);cancelAnimationFrame(numberFrame);animations.forEach(a=>a.cancel());for(const stage of stages){stage.hidden=false;stage.querySelectorAll('[data-final-number]').forEach(el=>{el.textContent=el.dataset.finalNumber;delete el.dataset.finalNumber;});}progress.value=stages.length;status.textContent='评估总览、依据、路径与行动清单已全部展开';const skip=bar.querySelector('button');skip.textContent='全部已显示';skip.disabled=true;};
 const show=(stage,index)=>{if(stopped||!root.isConnected||root.closest('[hidden]')){finish();return;}stage.hidden=false;progress.value=index+1;status.textContent=index===0?'正在展开分数与五维结果':index<=4?'正在展开更新重点与建议':index<stages.length-1?'正在展开证据、路径与行动清单':'正在展开资金情景';
 animations.push(stage.animate([{opacity:0,translate:'0 14px'},{opacity:1,translate:'0 0'}],{duration:520,easing:'cubic-bezier(.22,.7,.2,1)'}));
 if(index===0){const values=[...stage.querySelectorAll('[data-metric]')].map(el=>({el,value:Number(el.textContent)})).filter(x=>Number.isFinite(x.value));const start=performance.now();for(const x of values){x.el.dataset.finalNumber=String(x.value);x.el.textContent='0';}const tick=now=>{if(stopped)return;const t=Math.min(1,(now-start)/850);for(const x of values)x.el.textContent=t===1?String(x.value):String(Math.round(x.value*(1-(1-t)**3)*10)/10);if(t<1)numberFrame=requestAnimationFrame(tick);};numberFrame=requestAnimationFrame(tick);}
 if(index===stages.length-1)timers.push(setTimeout(finish,540));};
 stages.forEach((stage,i)=>{if(i===0)show(stage,i);else timers.push(setTimeout(()=>show(stage,i),i*560));});
 bar.querySelector('button').onclick=finish;
 const preference=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),onMotion=e=>{if(e.matches)finish();},onVisibility=()=>{if(document.hidden)finish();};preference?.addEventListener?.('change',onMotion);document.addEventListener('visibilitychange',onVisibility);
 return ()=>{finish();preference?.removeEventListener?.('change',onMotion);document.removeEventListener('visibilitychange',onVisibility);};
}

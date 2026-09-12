const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installStudioShell({map,manifest,studio,toast,tab,openPanel}){
 const $=s=>document.querySelector(s),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let presenting=false,orbitFrame=0,lastTime=0,previousFocus=null;
 const commandDialog=$('#command-dialog'),helpDialog=$('#controls-dialog');
 const stopOrbit=()=>{cancelAnimationFrame(orbitFrame);orbitFrame=0;lastTime=0;$('#orbit-toggle').setAttribute('aria-pressed','false');$('#orbit-toggle').textContent='环绕播放';};
 const resize=()=>{map.resize?.();map.triggerRepaint();};
 function presentation(on){stopOrbit();presenting=on;document.body.classList.toggle('is-presenting',on);$('#presentation-toggle').setAttribute('aria-pressed',String(on));$('#presentation-bar').hidden=!on;$('#presentation-toggle').textContent=on?'退出路演':'路演模式';if(on){openPanel(false);$('#exit-presentation').focus();}else{document.body.classList.remove('present-panel');$('#presentation-panel').setAttribute('aria-pressed','false');$('#presentation-toggle').focus();}requestAnimationFrame(resize);}
 function focusView(view){stopOrbit();if(view==='unit'){const s=studio();if(s){const panelShown=document.body.classList.contains('present-panel');s.select(s.current().id);if(presenting&&!panelShown)openPanel(false);}return;}const choices={city:{center:[118.814,32.061],zoom:13.35,bearing:-20,pitch:48},lake:{center:[118.797,32.074],zoom:14.7,bearing:-28,pitch:56},campus:{center:[118.7986,32.0568],zoom:16,bearing:24,pitch:58}};const c=choices[view];if(!c)return;map.flyTo({...c,pitch:map.fallback?0:c.pitch,duration:reduced?0:1500});$('#view-caption').textContent=({city:'玄武全域',lake:'玄武湖畔',campus:'四牌楼片区'})[view];}
 function orbit(){if(orbitFrame){stopOrbit();return;}if(reduced){toast('已启用减少动态效果；可使用视角按钮或旋转控件。');return;}$('#orbit-toggle').setAttribute('aria-pressed','true');$('#orbit-toggle').textContent='暂停环绕';function frame(t){if(lastTime)(map.jumpTo?map.jumpTo.bind(map):map.easeTo.bind(map))({bearing:map.getBearing()+Math.min(t-lastTime,50)*.004,duration:0});lastTime=t;orbitFrame=requestAnimationFrame(frame);}orbitFrame=requestAnimationFrame(frame);}
 const controls=[
  {name:'用地研究',detail:'研究清单与五维评估',key:'研究 评估 assessment',run:()=>studio()?.setView('list')},
  {name:'交互对话',detail:'读取当前对象与来源',key:'对话 助手 chat',run:()=>studio()?.setView('chat')},
  {name:'比较清单',detail:'查看2–3个研究单元',key:'比较 compare',run:()=>studio()?.compare()},
  {name:'报告中心',detail:'评估报告与版本记录',key:'报告 导出 report',run:()=>studio()?.reports()},
  {name:'市场与案例',detail:'历史成交和公开案例',key:'案例 市场 market',run:()=>studio()?.market()},
  {name:'数据目录',detail:'空间资料与台账导入',key:'数据 导入 data',run:()=>tab('data')},
  {name:'玄武全域',detail:'回到城市尺度',key:'全城 地图 city',run:()=>focusView('city')},
  {name:'玄武湖畔',detail:'湖岸空间视角',key:'湖 水体 lake',run:()=>focusView('lake')},
  {name:'路演模式',detail:'展开画布并使用视角预设',key:'路演 展示 present',run:()=>presentation(!presenting)},
  {name:'操作指南',detail:'鼠标、触控板和键盘',key:'帮助 旋转 help',run:()=>helpDialog.showModal()}
 ];
 let matches=[];
 function renderCommands(){const q=$('#command-search').value.trim().toLowerCase(),units=(studio()?.units||[]).map(u=>({name:u.properties.name,detail:u.id+' · '+u.properties.research_type,key:u.id+' '+u.properties.name,run:()=>studio().select(u.id)}));matches=[...controls,...units].filter(c=>(c.name+' '+c.key).toLowerCase().includes(q));$('#command-results').innerHTML=matches.length?matches.map((c,i)=>`<button data-command-index="${i}"><span class="command-symbol">${i<controls.length?'↗':'⌖'}</span><span><strong>${esc(c.name)}</strong><small>${esc(c.detail)}</small></span><kbd>↵</kbd></button>`).join(''):'<p class="command-empty">没有匹配操作，试试“报告”“玄武湖”或单元编号。</p>';}
 function commands(){previousFocus=document.activeElement;$('#command-search').value='';renderCommands();commandDialog.showModal();$('#command-search').focus();}
 $('#command-open').onclick=commands;$('#command-close').onclick=()=>commandDialog.close();commandDialog.addEventListener('close',()=>previousFocus?.focus?.());$('#command-search').oninput=renderCommands;
 $('#command-results').onclick=e=>{const b=e.target.closest('[data-command-index]');if(!b)return;commandDialog.close();matches[Number(b.dataset.commandIndex)]?.run();};
 $('#command-search').onkeydown=e=>{if(e.key==='Enter'&&matches.length){e.preventDefault();commandDialog.close();matches[0].run();}else if(e.key==='ArrowDown'){e.preventDefault();$('#command-results button')?.focus();}};
 commandDialog.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp'].includes(e.key)||e.target===$('#command-search'))return;const buttons=[...$('#command-results').querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(i>=0){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();}});
 $('#controls-open').onclick=()=>helpDialog.showModal();$('#controls-close').onclick=()=>helpDialog.close();
 $('#presentation-toggle').onclick=()=>presentation(!presenting);$('#exit-presentation').onclick=()=>presentation(false);$('#orbit-toggle').onclick=orbit;
 $('#presentation-panel').onclick=()=>{const show=!document.body.classList.contains('present-panel');document.body.classList.toggle('present-panel',show);$('#presentation-panel').setAttribute('aria-pressed',String(show));openPanel(show);requestAnimationFrame(resize);};
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>focusView(b.dataset.view));
 for(const [id,delta]of [['rotate-left',-15],['rotate-right',15]])$('#'+id).onclick=()=>{stopOrbit();map.easeTo({bearing:map.getBearing()+delta,duration:reduced?0:280});};
 $('#save-view').onclick=()=>{try{const c=map.getCenter();localStorage.setItem('urbanlens:camera08',JSON.stringify({center:[c.lng,c.lat],zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()}));$('#restore-view').disabled=false;toast('当前视角已保存到本机。');}catch{toast('当前浏览器无法保存视角。');}};
 $('#restore-view').onclick=()=>{try{const c=JSON.parse(localStorage.getItem('urbanlens:camera08'));if(!Array.isArray(c?.center)||c.center.length!==2||![...c.center,c.zoom,c.bearing,c.pitch].every(Number.isFinite)||c.center[0]<118.6||c.center[0]>119.08||c.center[1]<31.9||c.center[1]>32.25)throw Error();stopOrbit();map.flyTo({...c,zoom:Math.max(10.5,Math.min(19,c.zoom)),pitch:map.fallback?0:Math.max(0,Math.min(70,c.pitch)),duration:reduced?0:900});toast('已恢复保存的视角。');}catch{toast('尚无有效的本机视角，请先保存。');}};
 try{$('#restore-view').disabled=!localStorage.getItem('urbanlens:camera08');}catch{}
 function camera(){const raw=((map.getBearing()%360)+360)%360,bearing=Math.round(raw)%360;$('#bearing-value').textContent=String(bearing).padStart(3,'0')+'°';$('#pitch-readout').textContent=Math.round(map.getPitch())+'°';}map.on('move',camera);camera();
 const canvas=map.getCanvas();for(const event of ['pointerdown','wheel','gesturestart','keydown'])canvas.addEventListener(event,stopOrbit,{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)stopOrbit();});
 window.addEventListener('keydown',e=>{const editing=e.target.closest?.('input,textarea,select,[contenteditable=true]');if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();e.stopPropagation();commandDialog.open?commandDialog.close():commands();return;}if(e.key==='Escape'&&commandDialog.open){e.preventDefault();e.stopPropagation();commandDialog.close();return;}if(e.key==='Escape'&&document.querySelector('dialog[open]')){e.stopPropagation();return;}if(e.key==='Escape'&&presenting&&!document.querySelector('dialog[open]')){e.preventDefault();e.stopPropagation();presentation(false);return;}if(editing||document.querySelector('dialog[open]')||e.metaKey||e.ctrlKey||e.altKey)return;if(e.key==='?'){e.preventDefault();helpDialog.showModal();}if(e.key.toLowerCase()==='q'||e.key.toLowerCase()==='e'){e.preventDefault();$('#'+(e.key.toLowerCase()==='q'?'rotate-left':'rotate-right')).click();}},true);
 // A small identity cue stays visible while the rest of the interface yields to the map.
 $('#roadshow-credit').textContent=manifest.creator||'制作者：东南大学建筑学院 蔡子攀';
 return {presentation,stopOrbit};
}

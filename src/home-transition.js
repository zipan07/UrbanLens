export function installHomeTransition(onHome){
 const links=document.querySelectorAll('[data-home-link]');if(!links.length)return;
 let running=false;
 links.forEach(link=>link.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();if(running)return;running=true;
  const icon=link.querySelector('img'),rect=icon.getBoundingClientRect(),overlay=icon.cloneNode();
  overlay.className='home-reveal-mark';overlay.alt='';overlay.setAttribute('aria-hidden','true');
  Object.assign(overlay.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
  document.body.append(overlay);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dx=innerWidth/2-rect.left-rect.width/2,dy=innerHeight/2-rect.top-rect.height/2,scale=Math.hypot(innerWidth,innerHeight)*2/rect.width;
  try{onHome();const animation=overlay.animate(reduced?[{opacity:.45},{opacity:0}]:[
   {transform:'translate(0,0) rotate(0deg) scale(1)',opacity:.96,offset:0},
   {transform:`translate(${dx*.6}px,${dy*.6}px) rotate(150deg) scale(${scale*.23})`,opacity:.55,offset:.5},
   {transform:`translate(${dx}px,${dy}px) rotate(360deg) scale(${scale})`,opacity:0,offset:1}
  ],{duration:reduced?120:1000,easing:'cubic-bezier(.22,.65,.3,1)',fill:'forwards'});
  animation.finished.catch(()=>{}).finally(()=>{overlay.remove();running=false;});
  }catch(error){overlay.remove();running=false;throw error;}
 }));
}

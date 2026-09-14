// Retarget one renderer-owned animation; wheel events never jump the camera.
export function installSmoothZoom(map,{onInteraction}={}){
 const canvas=map.getCanvas(),host=map.getContainer();let target=null,last=0;
 const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 map.scrollZoom?.disable();
 function step(delta,around){
  const now=performance.now(),from=map.getZoom();
  if(target===null||now-last>260)target=from;
  target=clamp(target+delta,map.getMinZoom?.()??10.5,map.getMaxZoom?.()??19);
  target=clamp(target,from-1.8,from+1.8);last=now;
  const difference=target-from;
  // Interpolate visible scale, rather than apply large discrete wheel steps.
  const easing=Math.abs(difference)<.0001?t=>t:t=>Math.log2(1+(2**difference-1)*t)/difference;
  onInteraction?.();map.easeTo({zoom:target,...(around?{around}:{}),duration:reduced()?0:200,easing});
 }
 function wheel(e){
  if(e.altKey||e.metaKey||!Number.isFinite(e.deltaY)||!e.deltaY||e.target!==canvas)return;
  e.preventDefault();e.stopImmediatePropagation();
  const factor=e.deltaMode===1?16:e.deltaMode===2?host.clientHeight:1;
  const amount=clamp(e.deltaY*factor,-160,160),r=canvas.getBoundingClientRect();
  step(-amount*(e.ctrlKey?.009:Math.abs(e.deltaY)<20?.005:.0055),map.unproject([e.clientX-r.left,e.clientY-r.top]));
 }
 const reset=()=>{target=null;};
 host.addEventListener('wheel',wheel,{capture:true,passive:false});
 host.addEventListener('pointerdown',reset,true);
 function destroy(){host.removeEventListener('wheel',wheel,true);host.removeEventListener('pointerdown',reset,true);map.off?.('remove',destroy);}
 map.on?.('remove',destroy);return {step,destroy};
}

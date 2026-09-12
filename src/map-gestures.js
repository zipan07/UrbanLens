/** Desktop additions to MapLibre's native touchscreen / right-drag controls.
 * Safari exposes macOS trackpad rotation as GestureEvent; Chromium and Firefox
 * do not expose that rotation. Alt + two-finger scroll is the explicit fallback.
 * No plain wheel event is repurposed, so ordinary map scrolling and pinch zoom
 * remain with the renderer. The Canvas renderer uses the same camera adapter.
 */
export function installMapGestures(map, {platform, maxTouchPoints, onInteraction} = {}) {
 const container=map.getContainer(),canvas=map.getCanvas();
 const doc=container.ownerDocument,win=doc.defaultView;
 const nav=win.navigator||{};
 const isMac=/Mac/i.test(platform??nav.userAgentData?.platform??nav.platform??'')&&(maxTouchPoints??nav.maxTouchPoints??0)===0;
 const listeners=[];
 let drag=null,gesture=null,destroyed=false;
 const listen=(target,type,fn,options={capture:true,passive:false})=>{target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));};
 const consume=e=>{if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();};
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 const camera=options=>{if(map.jumpTo)map.jumpTo(options);else map.easeTo({...options,duration:0});};
 const begin=kind=>{map.stop?.();onInteraction?.(kind);};
 const endDrag=()=>{if(!drag)return;const {pointerId,cursor}=drag;drag=null;canvas.style.cursor=cursor;try{if(canvas.hasPointerCapture?.(pointerId))canvas.releasePointerCapture(pointerId);}catch{/* Detached canvas or cancelled pointer. */}};
 const cancel=()=>{endDrag();gesture=null;};
 const middleDown=e=>{
  if(e.button!==1||e.pointerType==='touch'||e.pointerType==='pen')return;
  consume(e);cancel();begin('middle-rotate');
  drag={pointerId:e.pointerId,x:e.clientX,y:e.clientY,bearing:map.getBearing(),pitch:map.getPitch(),cursor:canvas.style.cursor};
  canvas.style.cursor='grabbing';try{canvas.setPointerCapture(e.pointerId);}catch{/* Window listeners also handle release outside the map. */}
 };
 const middleMove=e=>{
  if(!drag||e.pointerId!==drag.pointerId)return;
  consume(e);if((e.buttons&4)===0){endDrag();return;}
  const options={bearing:drag.bearing+(e.clientX-drag.x)*.4};
  // Keep a 2D view flat; dragging up/down orbits the pitch of an existing 3D view.
  if(drag.pitch>0&&!map.fallback)options.pitch=clamp(drag.pitch-(e.clientY-drag.y)*.3,map.getMinPitch?.()??0,map.getMaxPitch?.()??70);
  camera(options);
 };
 const middleUp=e=>{if(drag&&e.pointerId===drag.pointerId){consume(e);endDrag();}};
 listen(container,'pointerdown',middleDown);
 listen(win,'pointermove',middleMove);
 listen(win,'pointerup',middleUp);
 listen(win,'pointercancel',middleUp);
 listen(canvas,'lostpointercapture',e=>{if(drag?.pointerId===e.pointerId)endDrag();});
 // Also suppress compatibility mouse events and Windows' middle autoscroll.
 for(const type of ['mousedown','auxclick'])listen(container,type,e=>{if(e.button===1)consume(e);});
 listen(win,'blur',cancel);
 listen(doc,'visibilitychange',()=>{if(doc.hidden)cancel();});
 if(isMac){
  listen(container,'gesturestart',e=>{
   if(!Number.isFinite(e.rotation)||!Number.isFinite(e.scale)||e.scale<=0)return;
   consume(e);cancel();begin('trackpad-rotate');
   gesture={bearing:map.getBearing(),zoom:map.getZoom(),rotation:e.rotation,scale:e.scale};
  });
  listen(win,'gesturechange',e=>{
   if(!gesture)return;consume(e);
   if(!Number.isFinite(e.rotation)||!Number.isFinite(e.scale)||e.scale<=0)return;
   camera({bearing:gesture.bearing-(e.rotation-gesture.rotation),zoom:clamp(gesture.zoom+Math.log2(e.scale/gesture.scale),map.getMinZoom?.()??10.5,map.getMaxZoom?.()??19)});
  });
  listen(win,'gestureend',e=>{if(gesture){consume(e);gesture=null;}});
 }
 listen(container,'wheel',e=>{
  // WebKit can produce wheel events alongside GestureEvents; avoid zooming twice.
  if(gesture){consume(e);return;}
  if(!e.altKey||e.ctrlKey||e.metaKey)return;
  const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
  if(!Number.isFinite(delta)||delta===0)return;
  consume(e);begin('modified-scroll-rotate');
  const factor=e.deltaMode===1?16:e.deltaMode===2?container.clientHeight:1;
  camera({bearing:map.getBearing()+clamp(delta*factor,-120,120)*.35});
 });
 function destroy(){if(destroyed)return;destroyed=true;cancel();for(const remove of listeners)remove();map.off?.('remove',destroy);}
 map.on?.('remove',destroy);
 return {destroy,isMac,nativeTrackpadRotation:isMac&&('ongesturestart' in win||'GestureEvent' in win)};
}

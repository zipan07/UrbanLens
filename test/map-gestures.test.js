import test from 'node:test';
import assert from 'node:assert/strict';
import {installMapGestures} from '../src/map-gestures.js';
class Target extends EventTarget {
 constructor(){super();this.style={cursor:'crosshair'};this.clientHeight=800;this.captured=null;}
 setPointerCapture(id){this.captured=id;}
 hasPointerCapture(id){return this.captured===id;}
 releasePointerCapture(){this.captured=null;}
}
function setup({platform='Win32',maxTouchPoints=0,fallback=false,pitch=40}={}){
 const win=new Target(),doc=new Target(),container=new Target(),canvas=new Target(),calls=[],events=new Map();
 win.navigator={platform,maxTouchPoints};doc.defaultView=win;container.ownerDocument=doc;
 const state={bearing:10,zoom:14,pitch};
 const map={fallback,getContainer:()=>container,getCanvas:()=>canvas,getBearing:()=>state.bearing,getZoom:()=>state.zoom,getPitch:()=>state.pitch,panBy:(offset,options)=>calls.push({offset,...options}),getMinZoom:()=>10.5,getMaxZoom:()=>19,getMinPitch:()=>0,getMaxPitch:()=>70,stop(){},on:(n,f)=>events.set(n,f),off:n=>events.delete(n)};
 map[fallback?'easeTo':'jumpTo']=o=>{calls.push(o);Object.assign(state,o);};
 const controls=installMapGestures(map);
 const fire=(target,type,props={})=>{const e=new Event(type,{cancelable:true});if(type==='pointerdown'&&target===container)Object.defineProperty(e,'target',{value:canvas});for(const [k,v]of Object.entries(props))Object.defineProperty(e,k,{value:v});target.dispatchEvent(e);return e;};
 return {win,doc,container,canvas,calls,events,state,controls,fire};
}
test('middle drag pans the map, captures pointer, releases outside map and restores cursor',()=>{
 const x=setup();assert.equal(x.fire(x.container,'pointerdown',{button:1,pointerType:'mouse',pointerId:4,clientX:100,clientY:100}).defaultPrevented,true);
 assert.equal(x.canvas.captured,4);
 x.fire(x.win,'pointermove',{pointerId:4,buttons:4,clientX:150,clientY:0});assert.deepEqual(x.calls.at(-1),{offset:[-50,100],duration:0});assert.equal(x.state.bearing,10);assert.equal(x.state.pitch,40);
 x.fire(x.win,'pointerup',{pointerId:4});assert.equal(x.canvas.captured,null);assert.equal(x.canvas.style.cursor,'crosshair');
 x.fire(x.win,'pointermove',{pointerId:4,buttons:4,clientX:200,clientY:0});assert.equal(x.calls.length,1);
});
test('2D rotation stays flat and Canvas uses immediate compatible camera updates',()=>{
 for(const options of [{pitch:0},{fallback:true}]){const x=setup(options);x.fire(x.container,'pointerdown',{button:2,pointerId:1,clientX:0,clientY:0});x.fire(x.win,'pointermove',{pointerId:1,buttons:2,clientX:-50,clientY:100});assert.equal(x.calls[0].bearing,4);assert.equal(x.calls[0].pitch,undefined);if(options.fallback)assert.equal(x.calls[0].duration,0);}
});
test('ordinary pan, touchscreen touches, plain scroll and ctrl-pinch remain with native handlers',()=>{
 const x=setup({platform:'MacIntel'});
 for(const props of [{button:0,pointerType:'mouse'},{button:0,pointerType:'touch'},{button:1,pointerType:'pen'}])assert.equal(x.fire(x.container,'pointerdown',props).defaultPrevented,false);
 for(const props of [{deltaY:10},{deltaY:-2,ctrlKey:true},{deltaY:5,altKey:true,ctrlKey:true}])assert.equal(x.fire(x.container,'wheel',props).defaultPrevented,false);
 assert.equal(x.calls.length,0);
});
test('cumulative native macOS gestures combine rotation and zoom once; their wheel duplicates are swallowed',()=>{
 const x=setup({platform:'MacIntel'});
 x.fire(x.container,'gesturestart',{rotation:0,scale:1});x.fire(x.win,'gesturechange',{rotation:30,scale:2});
 assert.deepEqual(x.calls[0],{bearing:-20,zoom:15});x.fire(x.win,'gesturechange',{rotation:45,scale:4});assert.deepEqual(x.calls[1],{bearing:-35,zoom:16});
 assert.equal(x.fire(x.container,'wheel',{deltaY:-10,ctrlKey:true}).defaultPrevented,true);assert.equal(x.calls.length,2);
 x.fire(x.win,'gestureend');assert.equal(x.fire(x.container,'wheel',{deltaY:-10,ctrlKey:true}).defaultPrevented,false);
});
test('iPad desktop user agent does not double-handle touchscreen gesture events',()=>{
 const x=setup({platform:'MacIntel',maxTouchPoints:5});assert.equal(x.controls.isMac,false);assert.equal(x.fire(x.container,'gesturestart',{rotation:0,scale:1}).defaultPrevented,false);x.fire(x.win,'gesturechange',{rotation:40,scale:2});assert.equal(x.calls.length,0);
});
test('explicit Alt scroll rotates with bounded line/page deltas; malformed native events cannot poison camera',()=>{
 const x=setup({platform:'MacIntel'});assert.equal(x.fire(x.container,'wheel',{altKey:true,deltaX:20,deltaY:1,deltaMode:0}).defaultPrevented,true);assert.equal(x.state.bearing,17);
 x.fire(x.container,'wheel',{altKey:true,deltaX:0,deltaY:100,deltaMode:2});assert.equal(x.state.bearing,59);
 x.fire(x.container,'gesturestart',{rotation:0,scale:1});x.fire(x.win,'gesturechange',{rotation:NaN,scale:0});assert.equal(x.calls.length,2);
});
test('middle autoscroll blocked, unrelated pointers ignored, lost buttons/blur/cancel terminate and teardown removes listeners',()=>{
 const x=setup({platform:'MacIntel'});for(const type of ['mousedown','auxclick'])assert.equal(x.fire(x.canvas,type,{button:1}).defaultPrevented,true);
 const down=()=>x.fire(x.container,'pointerdown',{button:1,pointerId:1,clientX:0,clientY:0});
 down();x.fire(x.win,'pointermove',{pointerId:2,buttons:4,clientX:100,clientY:0});assert.equal(x.calls.length,0);
 x.fire(x.win,'pointermove',{pointerId:1,buttons:0});assert.equal(x.canvas.captured,null);
 down();x.fire(x.win,'blur');assert.equal(x.canvas.captured,null);
 down();x.fire(x.win,'pointercancel',{pointerId:1});assert.equal(x.canvas.captured,null);
 down();x.events.get('remove')();assert.equal(x.canvas.captured,null);assert.equal(x.events.has('remove'),false);
 assert.equal(x.fire(x.container,'pointerdown',{button:1}).defaultPrevented,false);assert.equal(x.fire(x.container,'gesturestart',{rotation:0,scale:1}).defaultPrevented,false);x.controls.destroy();
});

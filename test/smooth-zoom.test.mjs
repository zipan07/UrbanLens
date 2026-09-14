import test from 'node:test';
import assert from 'node:assert/strict';
import {installSmoothZoom} from '../src/smooth-zoom.js';
test('wheel zoom accumulates, preserves cursor anchor and interpolates scale continuously',()=>{
 const host=new EventTarget(),canvas=new EventTarget(),calls=[];let disabled=false;
 canvas.getBoundingClientRect=()=>({left:20,top:30});
 const map={getCanvas:()=>canvas,getContainer:()=>host,getZoom:()=>14,getMinZoom:()=>10.5,getMaxZoom:()=>19,unproject:p=>p,scrollZoom:{disable(){disabled=true;}},easeTo:o=>calls.push(o)};
 const control=installSmoothZoom(map);assert.equal(disabled,true);
 const fire=()=>{const e=new Event('wheel',{cancelable:true});Object.defineProperties(e,{target:{value:canvas},deltaY:{value:-100},deltaMode:{value:0},clientX:{value:100},clientY:{value:120}});host.dispatchEvent(e);assert.equal(e.defaultPrevented,true);};
 fire();assert.equal(calls.length,1);assert.deepEqual(calls[0].around,[80,90]);assert.equal(calls[0].duration,200);assert(Math.abs(calls[0].zoom-14.55)<1e-8);
 const d=calls[0].zoom-14;assert(Math.abs(2**(calls[0].easing(.5)*d)-(1+2**d)/2)<1e-8);
 fire();assert(Math.abs(calls[1].zoom-15.1)<1e-8);host.dispatchEvent(new Event('pointerdown'));fire();assert(Math.abs(calls[2].zoom-14.55)<1e-8);
 control.destroy();const before=calls.length;host.dispatchEvent(new Event('wheel'));assert.equal(calls.length,before);
});

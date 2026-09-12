import test from 'node:test';
import assert from 'node:assert/strict';
import {CanvasAtlas} from '../src/canvas-atlas.js';

function camera(t){
 const frames=new Map();let next=0,time=0,reduced=false;
 t.mock.method(globalThis.performance,'now',()=>time);
 const replace=(key,value)=>{const original=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else delete globalThis[key];});};
 replace('requestAnimationFrame',fn=>{frames.set(++next,fn);return next;});
 replace('cancelAnimationFrame',id=>frames.delete(id));
 replace('matchMedia',()=>({matches:reduced}));
 const map=Object.assign(Object.create(CanvasAtlas.prototype),{events:new Map(),center:[(118.81+180)/360,(1-Math.asinh(Math.tan(32.06*Math.PI/180))/Math.PI)/2],zoom:14,bearing:170,minZoom:10.5,maxZoom:19,bounds:[118.6,31.9,119.08,32.25],container:{clientWidth:1000,clientHeight:700},width:1000,height:700,drawSoon(){}});
 const emitted=[];for(const name of ['movestart','move','moveend'])map.on(name,()=>emitted.push(name));
 const step=ms=>{time+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(time));};
 return {map,emitted,frames,step,reduce:()=>{reduced=true;}};
}

test('Canvas flights interpolate, rotate over the short arc and finish once',t=>{
 const x=camera(t),start=x.map.getCenter();x.map.flyTo({center:[118.86,32.1],zoom:16,bearing:-170,duration:600});
 assert.deepEqual(x.map.getCenter(),start);assert.equal(x.map.isMoving(),true);
 x.step(300);assert(Math.abs(x.map.getCenter().lng-118.835)<1e-8);assert.equal(x.map.zoom,15);assert.equal(x.map.bearing,180);
 x.step(300);assert(Math.abs(x.map.getCenter().lng-118.86)<1e-8);assert.equal(x.map.zoom,16);assert.equal(x.map.bearing,190);assert.equal(x.map.isMoving(),false);assert.equal(x.frames.size,0);
 assert.equal(x.emitted.filter(e=>e==='movestart').length,1);assert.equal(x.emitted.filter(e=>e==='moveend').length,1);
});

test('interruption preserves the current camera and a replacement flight cannot resume an old one',t=>{
 const x=camera(t);x.map.flyTo({center:[118.86,32.1],zoom:16,duration:600});x.step(200);const atStop=x.map.getCenter();x.map.stop();x.step(1000);
 assert.deepEqual(x.map.getCenter(),atStop);assert.equal(x.map.isMoving(),false);assert.equal(x.frames.size,0);
 x.map.flyTo({center:[118.9,32.12],zoom:17,duration:600});x.step(100);x.map.flyTo({center:[118.8,32.05],zoom:15,duration:500});x.step(500);x.step(1000);
 assert(Math.abs(x.map.getCenter().lng-118.8)<1e-8);assert.equal(x.map.zoom,15);assert.equal(x.frames.size,0);
});

test('reduced motion, immediate gesture updates and invalid cameras never start a queued flight',t=>{
 const x=camera(t);x.reduce();x.map.flyTo({center:[118.83,32.08],zoom:16,duration:700});assert.equal(x.frames.size,0);assert.equal(x.map.zoom,16);
 x.map.jumpTo({bearing:175});assert.equal(x.map.bearing,175);assert.equal(x.frames.size,0);
 const before=x.map.getCenter();x.map.easeTo({center:[NaN,32]});x.map.easeTo({zoom:Infinity});x.map.easeTo({bearing:NaN});assert.deepEqual(x.map.getCenter(),before);assert.equal(x.map.zoom,16);assert.equal(x.frames.size,0);
});

test('fitBounds moves from current position and retains asymmetric padding',t=>{
 const x=camera(t),start=x.map.getCenter();x.map.fitBounds([[118.78,32.02],[118.85,32.09]],{padding:{left:250,right:50,top:40,bottom:40},duration:500});
 assert.deepEqual(x.map.getCenter(),start);x.step(500);
 const midpoint=x.map.project([118.815,(32.02+32.09)/2]);assert(Math.abs(midpoint[0]-600)<1e-7);assert(Math.abs(midpoint[1]-350)<1);
 x.map.fitBounds([[118.81,32.06],[118.81,32.06]],{duration:0});assert(Number.isFinite(x.map.zoom));assert.equal(x.map.zoom,19);
});

test('pointer, wheel and keyboard input interrupt a Canvas flight before handling the new gesture',t=>{
 const x=camera(t),canvas=new EventTarget();Object.assign(canvas,{getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){}});x.map.canvas=canvas;x.map.pointers=new Map();x.map.bind();
 const fire=(type,props)=>{const event=new Event(type,{cancelable:true});Object.assign(event,props);canvas.dispatchEvent(event);};
 x.map.flyTo({center:[118.86,32.1],duration:600});x.step(150);const start=x.map.getCenter();
 fire('pointerdown',{button:0,pointerType:'mouse',pointerId:1,clientX:500,clientY:350});x.step(1000);assert.deepEqual(x.map.getCenter(),start);assert.equal(x.frames.size,0);
 fire('pointerup',{pointerId:1,clientX:500,clientY:350});
 x.map.flyTo({zoom:17,duration:600});x.step(150);const before=x.map.zoom;fire('wheel',{clientX:500,clientY:350,deltaY:20,deltaMode:0});assert(x.map.zoom<before);assert.equal(x.frames.size,0);x.map.stop();
 x.map.flyTo({zoom:18,duration:600});x.step(150);fire('keydown',{key:'Escape'});assert.equal(x.frames.size,0);assert.equal(x.map.isMoving(),false);
});

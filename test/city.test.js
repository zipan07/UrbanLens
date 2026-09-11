import test from 'node:test';
import assert from 'node:assert/strict';
import {createCity,project,unproject,contains,WIDTH,HEIGHT,riverX} from '../dist/city-data.js';
import {parcels} from '../dist/domain.js';
import {CityView} from '../dist/city-view.js';
const city=createCity(parcels);
test('fictional city is repeatable and maps all twelve assessment parcels exactly once',()=>{
 assert.deepEqual(createCity(parcels),city);assert.equal(city.plots.length,12);assert.deepEqual(new Set(city.plots.map(p=>p.id)),new Set(parcels.map(p=>p.id)));assert.ok(city.buildings.length>600);assert.equal(new Set(city.buildings.map(b=>b.id)).size,city.buildings.length);
});
test('buildings stay inside land blocks, outside parks, water and road reserves',()=>{
 for(const b of city.buildings){assert.ok(b.height>0&&Number.isFinite(b.height));const block=city.blocks.find(x=>x.id===b.blockId);for(const p of b.points){assert.ok(p[0]>0&&p[0]<WIDTH&&p[1]>0&&p[1]<HEIGHT);assert.ok(Math.abs(p[0]-riverX(p[1]))>135);assert.ok(contains(p,block.points));assert.ok(!city.parks.some(park=>contains(p,park.points)));}}
});
test('ground projection inverts across bearings, scales and pitches',()=>{
 for(const bearing of [-2,-.25,0,1.7])for(const pitch of [Math.PI/6,Math.PI/3,Math.PI/2])for(const scale of [.04,.3,2]){const c={x:2800,y:1700,w:900,h:640,bearing,pitch,scale};for(const p of [[0,0],[6000,4200],[1900,1500]]){const roundtrip=unproject(project(p,c),c);assert.ok(Math.abs(roundtrip[0]-p[0])<1e-8);assert.ok(Math.abs(roundtrip[1]-p[1])<1e-8);}}
});
test('height moves roofs upwards in 3D and collapses exactly in 2D',()=>{
 const c={x:0,y:0,w:900,h:600,bearing:0,pitch:Math.PI/3,scale:1};assert.equal(project([0,0,0],c)[1]-project([0,0,100],c)[1],50);c.pitch=Math.PI/2;assert.ok(Math.abs(project([0,0,0],c)[1]-project([0,0,100],c)[1])<1e-10);
});
test('renderer executes both modes and layer states; building and parcel picking stay linked',()=>{
 const nodes=new Map();const node=()=>({value:'60',style:{},hidden:false,addEventListener(){},setAttribute(){},classList:{toggle(){return false;}}});
 globalThis.document={querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll(){return [];}};
 globalThis.window={devicePixelRatio:1};globalThis.ResizeObserver=class{observe(){}};globalThis.requestAnimationFrame=()=>1;
 const ctx=new Proxy({}, {get:(t,p)=>t[p]??(()=>{}),set:(t,p,v)=>(t[p]=v,true)});
 const canvas={...node(),parentElement:{},getContext:()=>ctx,getBoundingClientRect:()=>({width:900,height:640})};let selected;
 const view=new CityView(canvas,parcels,id=>selected=id);view.update({selected:'UL-001',visible:new Set(parcels.map(p=>p.id)),results:new Map()});view.draw();assert.ok(view.hits.length>600);
 view.setMode('2d');view.focus('UL-001');view.draw();const b=city.buildings.find(b=>b.parcelId==='UL-001'),a=b.points[0],z=b.points[2];view.pick(project([(a[0]+z[0])/2,(a[1]+z[1])/2],view.camera));assert.equal(selected,'UL-001');
 view.layers.plots=false;view.draw();view.pick(project([(a[0]+z[0])/2,(a[1]+z[1])/2],view.camera));assert.equal(view.inspected,b.id);
 for(const key of Object.keys(view.layers))view.layers[key]=false;view.draw();assert.equal(view.hits.length,0);
 delete globalThis.document;delete globalThis.window;delete globalThis.ResizeObserver;delete globalThis.requestAnimationFrame;
});

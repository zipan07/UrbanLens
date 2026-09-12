import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateStyleMin} from '@maplibre/maplibre-gl-style-spec';
import {heightOf,distanceMeters,inGeometry,validateImport,coordinates} from '../src/geo.js';
import {makeStyle} from '../src/atlas-style.js';
const data=Object.fromEntries(['boundary','land','water','roads','buildings','pois'].map(k=>[k,JSON.parse(fs.readFileSync(new URL(`../dist/data/${k}.geojson`,import.meta.url)))]));
const boundary=data.boundary.features[0].geometry;
test('Xuanwu is real geographic data, includes SEU and Xuanwu Lake, not local virtual coordinates',()=>{
 assert.equal(data.boundary.features[0].properties.osm_id,'relation/2138698');
 assert(inGeometry([118.7986,32.0568],boundary));assert(!inGeometry([116.4,39.9],boundary));
 assert(data.pois.features.some(f=>f.properties.name==='玄武湖'));
 assert(data.pois.features.some(f=>f.properties.name==='东南大学(四牌楼校区)'));
 for(const collection of Object.values(data))for(const f of collection.features)for(const c of coordinates(f.geometry)){assert(c.every(Number.isFinite));assert(c[0]>118&&c[0]<120);assert(c[1]>31&&c[1]<33);}
});
test('height provenance distinguishes supplied meters, feet, estimated levels, unknown and invalid values',()=>{
 assert.deepEqual([heightOf({height:'30 m'}) .height_m,heightOf({height:'100ft'}).height_m],[30,30.48]);
 assert.equal(heightOf({'building:levels':'5'}).height_m,15);
 assert.equal(heightOf({height:'12;24'}).height_m,null);
 assert.equal(heightOf({height:'-3'}).height_m,null);
 assert.equal(heightOf({height:'2000'}).height_m,null);
 assert.equal(heightOf({'building:levels':'99x'}).height_source,'unknown');
 assert.equal(heightOf({}).render_height,12);assert.equal(heightOf({}).height_m,null);
});
test('data heights preserve unknowns and exclude subterranean structures from surface rendering',()=>{
 for(const f of data.buildings.features){const p=f.properties;assert(!(Number(p.layer)<0));if(p.height_source==='unknown')assert.equal(p.height_m,null);else assert(p.height_m>0);assert(p.render_base<=p.render_height);}
});
test('all map themes and dimensions satisfy the MapLibre style specification',()=>{
 for(const theme of ['day','night','ink'])for(const mode of ['2d','3d']){const style=makeStyle(data,{theme,mode},'https://example.org/UrbanLens/');assert.deepEqual(validateStyleMin(style).map(e=>e.message),[]);if(mode==='2d')assert.equal(style.layers.find(l=>l.id==='building-3d').paint['fill-extrusion-height'],0);}
});
test('distance is geographic meters and zero remains zero',()=>{
 assert.equal(distanceMeters([118.8,32],[118.8,32]),0);
 assert(Math.abs(distanceMeters([118.8,32],[118.8,32.01])-1111.95)<.1);
});
const valid=()=>({type:'FeatureCollection',features:[{type:'Feature',properties:{parcel_id:'R1',name:'导入格式测试'},geometry:{type:'Polygon',coordinates:[[[118.8,32.055],[118.801,32.055],[118.801,32.056],[118.8,32.055]]]}}]});
test('imports reject incomplete, duplicate, nongeographic and out of district batches atomically',()=>{
 const input=valid();assert.equal(validateImport(input,boundary).features.length,1);assert(!input.features[0].properties.category);
 const duplicate=valid();duplicate.features.push(structuredClone(duplicate.features[0]));assert.throws(()=>validateImport(duplicate,boundary),/重复/);
 const open=valid();open.features[0].geometry.coordinates[0].pop();assert.throws(()=>validateImport(open,boundary),/至少|闭合/);
 const projected=valid();projected.features[0].geometry.coordinates[0][0]=[500000,3540000];assert.throws(()=>validateImport(projected,boundary),/坐标/);
 const wrong=valid();wrong.crs={};assert.throws(()=>validateImport(wrong,boundary),/WGS84/);
});

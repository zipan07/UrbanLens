import test from 'node:test';
import assert from 'node:assert/strict';
import {objectDetails,geometryLength,pickMapObjects} from '../src/map-details.js';

test('road details measure only the selected segment and preserve unknown attributes',()=>{
 const f={type:'Feature',properties:{category:'road',name:'测试路',osm_id:'way/123',highway:'primary',division_code:'320106',district_name:'鼓楼区'},geometry:{type:'LineString',coordinates:[[118.8,32],[118.8,32.01]]}};
 assert(Math.abs(geometryLength(f.geometry)-1111.95)<.1);
 const d=objectDetails(f,{snapshotAt:'2026-09-12T00:00:00Z'});
 assert.equal(d.facts.find(([k])=>k==='车道数')[1],'未收录');assert(d.note.includes('非整条道路'));assert.equal(d.url,'https://www.openstreetmap.org/way/123');
});
test('building details never turn schematic height into a measurement',()=>{
 const d=objectDetails({properties:{category:'building',height_m:null,levels:null,render_height:12,osm_id:'javascript:alert(1)'},geometry:{type:'Polygon',coordinates:[[[118.8,32],[118.8001,32],[118.8001,32.0001],[118.8,32.0001],[118.8,32]]]}},{});
 assert.equal(d.facts.find(([k])=>k==='建筑高度')[1],'未收录');assert.equal(d.url,null);assert(d.facts.find(([k])=>k==='轮廓投影面积')[1].endsWith('m²'));
});
test('overlapping research polygons do not mask buildings, road segments or imported parcels',()=>{
 const building={properties:{category:'building',osm_id:'way/1'}},road={properties:{category:'road',osm_id:'way/2'}},research={properties:{category:'research',unit_id:'GL-R01',osm_id:'way/1'}};
 const layers={'building-3d':[building],'building-footprints':[building],roads:[road],'research-fill':[research]},map={getLayer:id=>layers[id],queryRenderedFeatures:(_,o)=>layers[o.layers[0]]};
 assert.deepEqual(pickMapObjects(map,{x:20,y:30},f=>f),[building,road,research]);
});

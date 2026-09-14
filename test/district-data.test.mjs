import {districtRings,projectBoundary} from '../src/district-flow.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {mergeDistrict,mergeServices} from '../src/district-data.js';
import {inGeometry,coordinates} from '../src/geo.js';
const pack=JSON.parse(fs.readFileSync('dist/packed/gulou.json')),bytes=gunzipSync(Buffer.from(pack.parts.map(n=>fs.readFileSync('dist/packed/'+n,'utf8')).join(''),'base64')),extra=JSON.parse(bytes);
test('Gulou snapshot is complete at the packaged byte level and preserves geographic height provenance',()=>{
 assert.equal(bytes.length,pack.bytes);assert.equal(extra.data.boundary.features[0].properties.osm_id,'relation/2139790');assert.equal(extra.manifest.divisionCode,'320106');
 assert.ok(extra.data.buildings.features.length>7000);assert.ok(extra.data.services.features.length>600);
 for(const f of extra.data.buildings.features){assert.ok(coordinates(f.geometry).every(c=>c.every(Number.isFinite)));assert.ok(f.properties.render_height>0);if(f.properties.height_source==='unknown')assert.equal(f.properties.height_m,null);}
 assert.ok(extra.data.pois.features.some(f=>/南京大学/.test(f.properties.name)));
});
test('two-district merge deduplicates shared objects and includes Gulou drawing coordinates',()=>{
 const data=Object.fromEntries(['boundary','buildings','land','water','roads','pois'].map(k=>[k,JSON.parse(fs.readFileSync('dist/data/'+k+'.geojson'))]));const base=JSON.parse(fs.readFileSync('dist/data/manifest.json'));
 const merged=mergeDistrict(data,base,extra);assert.ok(inGeometry([118.75,32.07],merged.geometry));assert.ok(inGeometry([118.7986,32.0568],merged.geometry));assert.ok(!inGeometry([116.4,39.9],merged.geometry));
 for(const group of Object.values(data))assert.equal(new Set(group.features.map(f=>f.properties.osm_id)).size,group.features.length);
 assert.equal(merged.manifest.counts.buildings,data.buildings.features.length);assert.equal(Object.values(merged.manifest.heights).reduce((a,b)=>a+b),data.buildings.features.length);
 const s=extra.data.services,mergedServices=mergeServices(s,s);assert.equal(mergedServices.features.length,s.features.length);
});

test('saved assessment data includes Gulou services and accepts a Gulou project boundary',async()=>{
 const {loadStudyData}=await import('../server/district-data.js');
 const {previewImport}=await import('../src/project-import.js');
 const {analyzeUnit}=await import('../src/value-domain.js');
 const base=await loadStudyData(p=>JSON.parse(fs.readFileSync('dist/'+p)),p=>fs.readFileSync('dist/'+p,'utf8'));
 const feature={type:'Feature',properties:{parcel_id:'GL-QA',name:'鼓楼检查范围',district:'鼓楼区'},geometry:{type:'Polygon',coordinates:[[[118.749,32.069],[118.752,32.069],[118.752,32.072],[118.749,32.072],[118.749,32.069]]]}};
 const preview=previewImport({kind:'geojson',text:JSON.stringify({type:'FeatureCollection',features:[feature]})},{units:[],uploaded:{}},base.boundary);
 assert.equal(preview.canCommit,true);assert.equal(preview.candidate.units.length,1);
 assert.ok(base.services.features.some(f=>f.properties.district==='鼓楼区'));
 const analysis=analyzeUnit(preview.candidate.units[0],base.data,base.services);
 assert.ok(analysis);assert.ok(base.data.buildings.features.length>10000);
});

test('flow highlight follows the selected real boundary including all polygon rings',()=>{const x=JSON.parse(fs.readFileSync('dist/data/boundary.geojson'));const collection={features:[...x.features,...extra.data.boundary.features]};assert.equal(districtRings(collection,'不存在').length,0);for(const name of ['玄武区','鼓楼区']){const rings=districtRings(collection,name);assert.ok(rings.length>0);const path=projectBoundary(rings[0],p=>({x:p[0]*10,y:p[1]*10}));assert.ok(path.startsWith('M'));assert.ok(path.endsWith('Z'));assert.ok(!path.includes('NaN'));}assert.equal(districtRings(collection,null).length,districtRings(collection,'玄武区').length+districtRings(collection,'鼓楼区').length);});

import test from 'node:test';
import assert from 'node:assert/strict';
import {assessUrbanContext,geometryAreaM2,geometryIntersectionAreaM2,validateHousingSamples,parseHousingRows,HOUSING_FIELDS} from '../src/urban-context.js';

const ring=(x=118.8,y=32.04,w=.01,h=.01)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
const polygon=(...rings)=>({type:'Polygon',coordinates:rings});
const unit=g=>({id:'CUSTOM-a',properties:{name:'test'},geometry:g});
const grid=(features,metadata={})=>({type:'FeatureCollection',metadata:{source:'测试人口格网',date:'2020-01-01',url:'https://example.org/pop',...metadata},features});
const cell=(g,night=1000,day=2000)=>({type:'Feature',geometry:g,properties:{night,day}});
const sample=(id,kind='sale',basis='asking',overrides={})=>({id,name:id,lng:118.802,lat:32.042,kind,basis,price:kind==='sale'?300:6000,area_m2:100,source:'用户提供的住宅房源',url:'https://example.org/housing/'+id,date:'2026-09-01',...overrides});
const close=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);

test('exact overlap assigns population to tiny unit even when it excludes cell centroid',()=>{
 const full=polygon(ring()),small=polygon(ring(118.8,32.04,.001,.001));
 close(geometryIntersectionAreaM2(small,full)/geometryAreaM2(full),.01,1e-8);
 const r=assessUrbanContext(unit(small),{populationGrid:grid([cell(full)]),mode:'observed'});
 close(r.population.night,10);close(r.population.day,20);assert.equal(r.population.coverage,100);assert.equal(r.score,null);assert.equal(r.housing.sale.unitPrice,null);
});

test('polygon holes remove population; disconnected multipolygons sum exact intersections',()=>{
 const full=polygon(ring()),hole=ring(118.8025,32.0425,.005,.005),donut=polygon(ring(),hole),multipolygon={type:'MultiPolygon',coordinates:[[ring(118.8,32.04,.0025,.005)],[ring(118.805,32.045,.0025,.005)]]};
 close(geometryIntersectionAreaM2(donut,full)/geometryAreaM2(full),.75,1e-8);
 close(geometryIntersectionAreaM2(multipolygon,full)/geometryAreaM2(full),.25,1e-8);
 const r=assessUrbanContext(unit(full),{populationGrid:grid([cell(donut,750,1500)]),mode:'observed'});
 close(r.population.night,750);assert.equal(r.population.coverage,75);assert.equal(r.population.score,null);
 const holeOnly=polygon(hole);close(geometryIntersectionAreaM2(holeOnly,donut),0,.00001);
});

test('concave clipping and reversed ring winding preserve area',()=>{
 const p=polygon([[118.8,32.04],[118.81,32.04],[118.81,32.045],[118.805,32.045],[118.805,32.05],[118.8,32.05],[118.8,32.04]]),q=polygon(ring(118.804,32.044,.004,.004));
 close(geometryIntersectionAreaM2(p,q)/geometryAreaM2(polygon(ring())),.07,1e-8);
 close(geometryIntersectionAreaM2(polygon([...p.coordinates[0]].reverse()),q),geometryIntersectionAreaM2(p,q),1e-5);
});

test('population grid supports MultiPolygon and holes, with zero-valued cells valid',()=>{
 const a=polygon(ring()),m={type:'MultiPolygon',coordinates:[[ring(118.8,32.04,.005,.01)],[ring(118.805,32.04,.005,.01)]]};
 const r=assessUrbanContext(unit(a),{populationGrid:grid([cell(m,0,0)]),mode:'observed',housing:[sample('s'),sample('r','rent')]});
 assert.equal(r.population.night,0);assert.equal(r.population.day,0);assert.equal(r.population.score,0);assert.equal(r.score,25);
});

test('simulation fills missing data deterministically and cannot masquerade as Beike data',()=>{
 const u=unit(polygon(ring())),a=assessUrbanContext(u),b=assessUrbanContext(structuredClone(u));
 assert.deepEqual(a,b);assert.ok(a.score>=0&&a.score<=100);assert.equal(a.simulation,true);assert.equal(a.housing.sale.count,0);assert.equal(a.housing.sale.source,'UrbanLens 稳定模拟情景（非贝壳数据）');assert.equal(a.population.detail.day.simulated,true);
 const c=assessUrbanContext({...u,id:'different'});assert.equal(c.population.day,a.population.day);
});

test('hybrid fills only absent area, retains observed count, and strict mode excludes simulated daytime',()=>{
 const u=unit(polygon(ring())),half=polygon(ring(118.8,32.04,.005,.01)),a=assessUrbanContext(u,{populationGrid:grid([cell(half,500,1000)]),mode:'hybrid'});
 assert.equal(a.population.detail.night.coverage,50);assert.ok(a.population.night>500);close(a.population.detail.night.filledAreaM2,geometryAreaM2(half),.1);
 const g=grid([cell(u.geometry)],{daySimulated:true,daySource:'情景昼间分布'}),strict=assessUrbanContext(u,{populationGrid:g,mode:'observed',housing:[sample('s'),sample('r','rent')]});
 assert.equal(strict.population.day,2000);assert.equal(strict.population.simulated,true);assert.equal(strict.population.score,null);assert.equal(strict.score,null);
 assert.notEqual(assessUrbanContext(u,{populationGrid:g,mode:'hybrid'}).score,null);
});

test('mixed housing kinds and pricing bases stay separate and use medians',()=>{
 const u=unit(polygon(ring())),housing=[sample('s1','sale','asking',{price:200}),sample('s2','sale','asking',{price:500}),sample('s3','sale','asking',{price:300}),sample('deal','sale','transaction',{price:100}),sample('r1','rent','asking',{price:4000}),sample('r2','rent','asking',{price:6000}),sample('rdeal','rent','transaction',{price:3000})];
 const a=assessUrbanContext(u,{housing}),b=assessUrbanContext(u,{housing,basis:'transaction'});
 assert.equal(a.housing.sale.unitPrice,30000);assert.equal(a.housing.sale.count,3);assert.equal(a.housing.rent.unitPrice,50);assert.equal(a.housing.rent.count,2);assert.equal(b.housing.sale.unitPrice,10000);assert.equal(b.housing.rent.unitPrice,30);
 assert.equal(a.housing.sale.simulated,false);assert.equal(a.housing.sale.samples[0].status,'user-supplied-unverified');
});

test('housing selects within-unit before near-boundary and does not use centroid distance',()=>{
 const u=unit(polygon(ring(118.8,32.04,.03,.003))),housing=[sample('nearEnd','sale','asking',{lng:118.831,lat:32.041,price:250}),sample('distant','sale','asking',{lng:118.85,lat:32.041,price:900})];
 const near=assessUrbanContext(u,{housing});assert.equal(near.housing.sale.count,1);assert.equal(near.housing.sale.scope,'within-600m');assert.equal(near.housing.sale.unitPrice,25000);
 const inside=assessUrbanContext(u,{housing:[...housing,sample('inside','sale','asking',{lng:118.801,lat:32.041,price:400})]});assert.equal(inside.housing.sale.count,1);assert.equal(inside.housing.sale.scope,'within-unit');assert.equal(inside.housing.sale.unitPrice,40000);
});

test('same listing on different dates only contributes the latest observation',()=>{
 const a=sample('old','sale','asking',{url:'https://example.org/item',price:300,date:'2026-07-01'}),b=sample('new','sale','asking',{url:'https://example.org/item',price:400,date:'2026-09-01'}),r=assessUrbanContext(unit(polygon(ring())),{housing:[a,b]});
 assert.equal(r.housing.sale.count,1);assert.equal(r.housing.sale.unitPrice,40000);assert.equal(r.housing.sale.samples[0].id,'new');
});

test('sample validation rejects invalid units, coordinates, dates, links and duplicates atomically',()=>{
 const bad=[{area_m2:0},{price:-1},{lng:121},{lat:null},{date:'2026-02-30'},{date:'2027-01-01'},{url:'http://example.org/a'},{url:'https://user:password@example.org/a'},{kind:'land'},{basis:'estimate'},{source:''},{price:true}];
 for(const row of bad)assert.throws(()=>validateHousingSamples([sample('good'),sample('bad','sale','asking',row)]),/整批未导入/);
 assert.throws(()=>validateHousingSamples([sample('a'),sample('a')]),/编号重复/);
 assert.throws(()=>validateHousingSamples([sample('a','sale','asking',{url:'https://example.org/item?utm_source=a'}),sample('b','sale','asking',{url:'https://example.org/item?utm_source=b'})]),/样本重复/);
});

test('CSV round-trip handles quoted commas and calculates sale and rental units',()=>{
 const row=sample('a','sale','asking',{name:'住宅,样本'}),encode=v=>'"'+String(v).replaceAll('"','""')+'"',text=HOUSING_FIELDS.map(encode).join(',')+'\r\n'+HOUSING_FIELDS.map(k=>encode(row[k])).join(',');
 const result=parseHousingRows(text);assert.equal(result[0].name,'住宅,样本');assert.equal(result[0].unitPrice,30000);assert.equal(validateHousingSamples([sample('rent','rent')])[0].unitPrice,60);
 assert.throws(()=>parseHousingRows(text+'\r\nshort,row'),/列数错误/);
});

test('formula computes known density and housing values; observed absence never modifies base score',()=>{
 const g=polygon(ring()),area=geometryAreaM2(g),r=assessUrbanContext(unit(g),{populationGrid:grid([cell(g,10000*area/1e6,10000*area/1e6)]),housing:[sample('s'),sample('r','rent')],mode:'observed'});
 assert.equal(r.population.nightDensity,10000);assert.equal(r.population.score,50);assert.equal(r.housing.score,50);assert.equal(r.score,50);assert.equal(r.simulation,false);assert.equal('total' in r,false);
 assert.equal(assessUrbanContext(unit(g),{mode:'uploaded'}).score,null);
});

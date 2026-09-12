import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultFilters,filterUnits,unitUse,unitDistrict,intersectsViewport} from '../src/value-filters.js';

const ring=(w,s,e,n)=>[[w,s],[e,s],[e,n],[w,n],[w,s]];
const polygon=(...rings)=>({type:'Polygon',coordinates:rings});
const unit=(id,properties={},geometry=polygon(ring(0,0,4,4)))=>({type:'Feature',id,properties:{name:id,...properties},geometry});
const units=[unit('A',{name:'锁金社区',research_type:'居住社区',landuse:'residential'}),unit('B',{name:'居住范围',research_type:'居住社区',use:'居住用地',district:'秦淮区'}),unit('C',{name:'商业研究',research_type:'商业文旅',landuse:'retail'},polygon(ring(20,20,24,24))),unit('IMPORT-1',{name:'导入单元',category:'imported',use:'工业用地'})];
const analyses=new Map([['A',{area:10000,nearest:{transit:{distance:0}}}],['B',{area:20000,nearest:{transit:{distance:null}}}],['C',{area:null,nearest:{transit:{distance:600}}}],['IMPORT-1',{area:5000,nearest:{transit:{distance:500}}}]]);
const results={A:{coverage:100,fingerprint:'a'},B:{coverage:20,fingerprint:'b-new'},C:{coverage:20,fingerprint:'c'},'IMPORT-1':{coverage:100,fingerprint:'import'}};
const runs={A:{fingerprint:'a'},B:{fingerprint:'b-old'}};
const context={analyses,resultFor:u=>results[u.id],runFor:u=>runs[u.id],viewport:[1,1,2,2]};
const selected=(filter,options={})=>filterUnits(units,{...context,...options,filter}).map(u=>u.id);

test('query, research category, district, use, area, status, completeness and viewport compose',()=>{
 assert.deepEqual(selected({query:' 锁金 ',type:'居住社区',district:'玄武区',use:'居住用地',minArea:9000,maxArea:11000,status:'done',completeness:'complete',maxTransit:500,inView:true}),['A']);
 assert.deepEqual(selected({type:'居住社区',district:'秦淮区',completeness:'missing'}),['B']);
 assert.deepEqual(selected({query:'import-1',use:'工业用地',maxArea:5000,inView:true}),['IMPORT-1']);
 assert.deepEqual(selected({minArea:15000,maxArea:10000}),[]);
 assert.deepEqual(selected({minArea:'invalid'}),[]);
});

test('missing distances and areas never become zero or satisfy numeric limits',()=>{
 assert.deepEqual(selected({maxTransit:0}),['A']);
 assert.deepEqual(selected({maxTransit:600}),['A','C','IMPORT-1']);
 assert.deepEqual(selected({minArea:0}),['A','B','IMPORT-1']);
 const zero=unit('ZERO'),numeric=new Map([['ZERO',{area:0,nearest:{transit:{distance:0}}}]]);
 assert.deepEqual(filterUnits([zero],{analyses:numeric,filter:{minArea:0,maxArea:0,maxTransit:0}}),[zero]);
 assert.deepEqual(filterUnits([zero],{analyses:new Map([['ZERO',{area:'',nearest:{transit:{distance:''}}}]]),filter:{maxArea:0,maxTransit:0}}),[]);
});

test('assessment state and missing data are independent, including stale runs',()=>{
 assert.deepEqual(selected({status:'done'}),['A']);
 assert.deepEqual(selected({status:'stale'}),['B']);
 assert.deepEqual(selected({status:'todo'}),['C','IMPORT-1']);
 assert.deepEqual(selected({status:'todo',completeness:'complete'}),['IMPORT-1']);
 assert.deepEqual(selected({status:'todo',completeness:'missing'}),['C']);
 assert.deepEqual(selected({completeness:'missing'}),['B','C']);
 assert.deepEqual(selected({status:'stale',completeness:'complete'}),[]);
 assert.deepEqual(selected({completeness:'missing'},{resultFor:()=>undefined}),units.map(u=>u.id));
});

test('use labels reflect source tags, retain custom imported labels and never infer study category',()=>{
 assert.equal(unitUse(unit('1',{landuse:'commercial',research_type:'产业空间'})),'商业用地');
 assert.equal(unitUse(unit('2',{amenity:'university',research_type:'校园周边'})),'高等教育');
 assert.equal(unitUse(unit('3',{use:' 商住混合 '})),'商住混合');
 assert.equal(unitUse(unit('4',{use:'待补充',research_type:'商业文旅'})),'未提供');
 assert.equal(unitUse(unit('5',{landuse:'orchard'})),'orchard');
 assert.equal(unitDistrict(unit('6',{district:'鼓楼'})),'鼓楼区');
 assert.equal(unitDistrict(unit('7',{district:'秦淮区'}),'玄武区'),'秦淮区');
 assert.equal(unitDistrict(unit('8',{category:'imported'}),'玄武区'),'玄武区');
 assert.equal(unitDistrict(unit('9'),''),'未提供');
});

test('viewport includes crossed polygons and enclosing polygons, not just centers or vertices',()=>{
 const view=[0,0,10,10];
 assert(intersectsViewport(polygon(ring(-5,4,15,6)),view));
 assert(intersectsViewport(polygon(ring(-5,-5,15,15)),view));
 assert(intersectsViewport(polygon(ring(2,2,3,3)),view));
 assert(intersectsViewport(polygon(ring(10,3,12,5)),view));
 assert(!intersectsViewport(polygon([[8,15],[15,8],[15,15],[8,15]]),view));
 assert(!intersectsViewport(polygon(ring(11,11,15,15)),view));
});

test('viewport wholly in a polygon hole is excluded, while its boundary and multipolygon part are visible',()=>{
 const hollow=polygon(ring(-10,-10,20,20),ring(-1,-1,11,11));
 assert(!intersectsViewport(hollow,[0,0,10,10]));
 assert(intersectsViewport(hollow,[0,0,12,10]));
 assert(intersectsViewport({type:'MultiPolygon',coordinates:[hollow.coordinates,[ring(2,2,3,3)]]},[0,0,10,10]));
 assert(!intersectsViewport({type:'MultiPolygon',coordinates:[hollow.coordinates,[ring(30,30,40,40)]]},[0,0,10,10]));
});

test('current view is optional and missing viewport fails closed only when requested',()=>{
 assert.deepEqual(selected({}, {viewport:null}),units.map(u=>u.id));
 assert.deepEqual(selected({inView:true},{viewport:null}),[]);
 assert.deepEqual(selected({inView:true}),['A','B','IMPORT-1']);
 assert(!intersectsViewport(null,[0,0,1,1]));
 assert(!intersectsViewport(units[0].geometry,[0,0,NaN,1]));
});

test('reset restores the complete selection without mutating units or analyses',()=>{
 const previous=JSON.stringify({units,analyses:[...analyses]});
 const filter={...defaultFilters(),query:'商业',inView:true,status:'done'};
 assert.deepEqual(selected(filter),[]);
 assert.deepEqual(selected(defaultFilters()),units.map(u=>u.id));
 assert.equal(JSON.stringify({units,analyses:[...analyses]}),previous);
 const next=defaultFilters();next.query='modified';assert.equal(defaultFilters().query,'');
});

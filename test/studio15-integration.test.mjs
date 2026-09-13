import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=process.env.URBANLENS_TEST_ROOT||resolve(import.meta.dirname,'..');
const {computeAssessment,compareRuns,normalizeAuxiliary,answerQuestion}=await import(join(root,'src/value-domain.js'));
const {geometryAreaM2,HOUSING_FIELDS,validateHousingSamples}=await import(join(root,'src/urban-context.js'));
const {previewImport,resolveImport,encodeCSV}=await import(join(root,'src/project-import.js'));
const {historyComparable}=await import(join(root,'src/comparison-workspace.js'));
const {projectAPI}=await import(join(root,'server/projects.js'));
const geometry={type:'Polygon',coordinates:[[[118.8,32.04],[118.81,32.04],[118.81,32.05],[118.8,32.05],[118.8,32.04]]]};
const unit={id:'XW-R01',properties:{name:'固定手算范围'},geometry};
const analysis={area:1000,nearest:{transit:{distance:0}},counts:{},geometryDate:'2026-09-01',spatialDate:'2026-09-02',nearby:[]};
const uploaded={[unit.id]:{buildingArea:0,vacancy:0,industry:'符合',condition:1,source:'独立验收样本',date:'2026-09-03'}};
const grid={type:'FeatureCollection',metadata:{version:'QA-GRID-1',source:'验收人口',date:'2026-09-01'},features:[{type:'Feature',geometry,properties:{night:geometryAreaM2(geometry)/100,day:geometryAreaM2(geometry)/100}}]};
const sample=(id,kind='sale',overrides={})=>({id,name:id,lng:118.802,lat:32.042,kind,basis:'asking',price:kind==='sale'?300:6000,area_m2:100,source:'用户提供住宅样本',url:'https://example.org/listing/'+id,date:'2026-09-01',...overrides});
const housing=[sample('s'),sample('r','rent')],aux={enabled:true,weight:.2,basis:'asking'},off={...aux,enabled:false};
const calculate=(extra={})=>computeAssessment(unit,analysis,{mode:'uploaded',uploaded,populationGrid:grid,housing,auxiliary:aux,...extra});
const housingCSV=rows=>encodeCSV([HOUSING_FIELDS,...rows.map(r=>HOUSING_FIELDS.map(k=>r[k]))]);

test('Studio15 manual weighted total keeps 24-point base and combines 50-point context at 20%',()=>{
 const r=calculate();assert.equal(r.baseTotal,24);assert.equal(r.auxiliary.score,50);assert.equal(r.auxiliary.effectiveWeight,.2);assert.equal(r.total,29.2);assert.deepEqual(r.scores,[0,100,20,0,0]);
});
test('Studio15 disabled context and zero weight preserve legacy score; missing context falls back to base',()=>{
 const legacy=calculate({populationGrid:null,housing:[],auxiliary:undefined}),disabled=calculate({auxiliary:off}),zero=calculate({auxiliary:{...aux,weight:0}}),missing=calculate({populationGrid:null,housing:[]});
 for(const r of [legacy,disabled,zero,missing])assert.equal(r.total,24);
 assert.equal(missing.auxiliary.score,null);assert.equal(missing.auxiliary.effectiveWeight,0);assert.equal(compareRuns([legacy,disabled]).ranked.length,2);assert.equal(compareRuns([legacy,zero]).ranked.length,2);
 assert.notEqual(disabled.fingerprint,calculate().fingerprint);
});
test('Studio15 rejects differing context rules and preserves historical legacy/disabled compatibility',()=>{
 const a=calculate(),b=calculate({auxiliary:{...aux,weight:.3}}),legacy=calculate({populationGrid:null,housing:[],auxiliary:undefined}),disabled=calculate({auxiliary:off});
 assert.equal(compareRuns([a,b]).ranked.length,0);assert.equal(compareRuns([a,legacy]).ranked.length,0);
 assert.equal(historyComparable([legacy,disabled]),true);assert.equal(historyComparable([legacy,a]),false);assert.equal(historyComparable([a,b]),false);
});
test('Studio15 rejects forged or malformed auxiliary configuration',()=>{
 for(const p of [{...aux,weight:31},{...aux,weight:.31},{...aux,weight:-.1},{...aux,weight:'0.2'},{...aux,enabled:'yes'},{...aux,basis:'estimated'},null])assert.throws(()=>normalizeAuxiliary(p));
 assert.deepEqual(normalizeAuxiliary({...aux,score:100,effectiveWeight:1}),aux);
});
test('Studio15 housing preflight normalizes units, requires explicit conflict choices, keeps old evidence',()=>{
 const data={units:[unit],uploaded:{},housing:[]},first=previewImport({kind:'housing',text:housingCSV(housing)},data,geometry);assert.equal(first.canCommit,true,JSON.stringify(first.errors));assert.equal(first.added,2);
 const v1=resolveImport(first);assert.equal(v1.housing[0].unitPrice,30000);assert.equal(v1.housing[1].unitPrice,60);assert.deepEqual(data.housing,[]);
 const second=previewImport({kind:'housing',text:housingCSV([sample('s','sale',{price:400})])},v1,geometry);assert.equal(second.conflicts.length,1);assert.throws(()=>resolveImport(second),/逐项/);
 const keep=resolveImport(second,{s:'existing'}),incoming=resolveImport(second,{s:'incoming'});assert.equal(keep.housing.find(s=>s.id==='s').unitPrice,30000);assert.equal(incoming.housing.find(s=>s.id==='s').unitPrice,40000);assert.equal(second.conflicts[0].old.price,300);assert.equal(second.conflicts[0].incoming.price,400);
});
test('Studio15 mapped housing import and invalid fields block the whole import',()=>{
 const names=HOUSING_FIELDS.map(k=>'mapped_'+k),mapping=Object.fromEntries(HOUSING_FIELDS.map((k,i)=>[k,names[i]])),p=previewImport({kind:'housing',text:encodeCSV([names,HOUSING_FIELDS.map(k=>sample('s')[k])]),mapping},{units:[unit],uploaded:{}},geometry);assert.equal(p.canCommit,true);assert.equal(p.candidate.housing[0].unitPrice,30000);
 for(const row of [{price:-1},{area_m2:0},{lng:121},{date:'2026-02-30'},{basis:'market'},{url:'http://example.org/a'}]){const bad=previewImport({kind:'housing',text:housingCSV([sample('good'),sample('bad','sale',row)])},{units:[unit],uploaded:{},housing:[]},geometry);assert.equal(bad.canCommit,false);assert.throws(()=>resolveImport(bad));}
 const duplicate=previewImport({kind:'housing',text:housingCSV([sample('s'),sample('s')])},{units:[unit],uploaded:{},housing:[]},geometry);assert.equal(duplicate.canCommit,false);
});
test('Studio15 question answers quote the same saved composite result',()=>{
 const r={...calculate(),id:'RUN-QA'},answer=answerQuestion('解释当前评估评分',{units:[unit],analyses:new Map([[unit.id,analysis]]),selectedId:unit.id,mode:'uploaded',profile:'balanced',uploaded,populationGrid:grid,housing,auxiliary:aux,runs:[r],evidence:{market:[],documents:[]}});
 assert.match(answer.text,/RUN-QA/);assert.match(answer.text,/29\.2/);
});

class D1{constructor(db){this.db=db;}prepare(sql){const db=this.db;return {values:[],bind(...v){this.values=v;return this;},async first(){return db.prepare(sql).get(...this.values)||null;},async all(){return {results:db.prepare(sql).all(...this.values)};},async run(){const r=db.prepare(sql).run(...this.values);return {success:true,meta:{changes:Number(r.changes)}};}};}async batch(qs){this.db.exec('BEGIN');try{const r=[];for(const q of qs)r.push(await q.run());this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}}
test('Studio15 server uses project housing, enforces permissions, and restores immutable housing/run versions',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(join(root,'drizzle/0000_young_doorman.sql'),'utf8'));const blobs=new Map(),env={DB:new D1(db),BUCKET:{async put(k,v){blobs.set(k,v);},async get(k){if(!blobs.has(k))return null;const value=blobs.get(k);return {body:value,json:async()=>JSON.parse(value)};}},ASSETS:{async fetch(req){try{return new Response(readFileSync(join(root,'dist',new URL(req.url).pathname)),{headers:{'Content-Type':'application/json'}});}catch{return new Response('',{status:404});}}}};
 const call=async(user,path,value)=>{const r=await projectAPI(new Request('https://urban.test/api/'+path,{method:value?'POST':'GET',headers:{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test',...(value?{'Content-Type':'application/json',Origin:'https://urban.test'}:{})},body:value?JSON.stringify(value):undefined}),env);return {status:r.status,value:await r.json()};};
 try{
 const created=await call('owner','projects',{name:'住宅辅助验收',description:'test',template:'xuanwu'});assert.equal(created.status,201);const pid=created.value.id,route='projects/'+pid,get=async()=> (await call('owner',route)).value;
 await call('viewer','me');let p=await get();assert.equal((await call('owner',route+'/members',{revision:p.project.revision,userId:'viewer',role:'viewer'})).status,200);p=await get();
 const payload={revision:p.project.revision,kind:'housing',name:'housing.csv',text:housingCSV(housing)};
 assert.equal((await call('viewer',route+'/imports/preflight',payload)).status,403);assert.equal((await call('foreign',route)).status,404);
 const pre=await call('owner',route+'/imports/preflight',payload);assert.equal(pre.status,200);assert.equal(pre.value.canCommit,true,JSON.stringify(pre));
 assert.equal((await call('viewer',route+'/imports/commit',{revision:p.project.revision,token:pre.value.token,decisions:{}})).status,403);
 assert.equal((await call('owner',route+'/imports/commit',{revision:p.project.revision,token:pre.value.token,decisions:{}})).status,200);p=await get();assert.equal(p.project.data_version,2);assert.deepEqual(p.data.housing,validateHousingSamples(housing));
 const request={revision:p.project.revision,unitIds:['XW-R01'],mode:'hybrid',profile:'balanced',auxiliary:{...aux,score:100,effectiveWeight:1},housing:[sample('forged','sale',{price:1})],total:100};
 assert.equal((await call('viewer',route+'/evaluate',request)).status,403);assert.equal((await call('foreign',route+'/evaluate',request)).status,404);
 assert.equal((await call('owner',route+'/evaluate',{...request,auxiliary:{...aux,weight:.31}})).status,400);
 const evaluated=await call('owner',route+'/evaluate',request);assert.equal(evaluated.status,200,JSON.stringify(evaluated));const run=evaluated.value.runs[0];assert.equal(run.projectDataVersion,2);assert.equal(run.auxiliary.effectiveWeight,.2);assert.equal(run.total,Math.round((run.baseTotal*.8+run.auxiliary.score*.2)*10)/10);assert.equal(run.auxiliary.housing.sale.samples.some(s=>s.id==='forged'),false);
 p=await get();const report=await call('owner',route+'/reports',{revision:p.project.revision,model:{run:{...run,total:100},sections:[],mapImage:'data:image/png;base64,aA=='}});assert.notEqual(report.status,200,'client may not forge canonical saved run');
 p=await get();assert.equal((await call('viewer',route+'/restore',{revision:p.project.revision,version:1})).status,403);assert.equal((await call('owner',route+'/restore',{revision:p.project.revision,version:1})).status,200);const restored=await get();assert.equal(restored.project.data_version,3);assert.deepEqual(restored.data.housing,[]);assert.deepEqual(restored.runs,[run]);
 const old=await call('owner',route+'/versions/2');assert.deepEqual(old.value.data.housing,validateHousingSamples(housing));assert.equal((await call('foreign',route+'/versions/2')).status,404);
 }finally{db.close();}
});

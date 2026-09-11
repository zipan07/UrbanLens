import test from 'node:test';
import assert from 'node:assert/strict';
import {touchFrame,touchDelta} from '../dist/gestures.js';
import {retrieve,evidenceAnswer,PROJECT_ID} from '../dist/knowledge.js';
import {handleRequest} from '../server/worker.js';
test('two-finger motion combines rotation, scaling, translation and angle wrapping',()=>{
 const a=touchFrame([[0,0],[100,0]]),b=touchFrame([[20,10],[20,210]]),d=touchDelta(a,b);assert.equal(d.scale,2);assert.ok(Math.abs(d.rotation-Math.PI/2)<1e-10);assert.deepEqual(b.center,[20,110]);assert.ok(Math.abs(touchDelta({distance:1,angle:Math.PI-.01},{distance:1,angle:-Math.PI+.01}).rotation-.02)<1e-8);
});
const context={projectId:PROJECT_ID,parcelId:'UL-001',scope:'parcel',compared:[],evaluated:[]};
test('retrieval stays within explicit scope and retains source details',()=>{
 const sources=retrieve('地块空置率和面积',context);assert.ok(sources.some(x=>x.text.includes('18500')));assert.ok(sources.every(x=>!x.parcelId||x.parcelId==='UL-001'));assert.ok(evidenceAnswer('UL-002的面积',context).answer.includes('范围之外'));assert.equal(evidenceAnswer('明天的天气',context).sources.length,0);
});
test('backend requires server credentials and app authentication without calling model',async()=>{
 let called=false;const fetcher=async()=>{called=true;};const request=()=>new Request('https://example.test/ask',{method:'POST',body:'{}'});
 assert.equal((await handleRequest(request(),{},fetcher)).status,503);assert.equal((await handleRequest(request(),{DEEPSEEK_API_KEY:'test-key',URBANLENS_ACCESS_TOKEN:'test-access'},fetcher)).status,401);assert.equal(called,false);
});
test('backend uses canonical evidence and rejects fabricated citation identifiers',async()=>{
 const env={DEEPSEEK_API_KEY:'test-key',URBANLENS_ACCESS_TOKEN:'test-access'};
 const request=()=>new Request('https://example.test/ask',{method:'POST',headers:{Authorization:'Bearer test-access','Content-Type':'application/json'},body:JSON.stringify({...context,question:'这个地块的面积是多少？',score:999999})});
 let content;const fetcher=async(url,init)=>{content=JSON.parse(init.body);return Response.json({choices:[{message:{content:JSON.stringify({answer:'演示台账记录土地面积18500平方米。[S1]',citations:['S1']})}}]});};
 assert.equal((await handleRequest(request(),env,fetcher)).status,200);assert.ok(content.messages[1].content.includes('18500'));assert.ok(!content.messages[1].content.includes('999999'));
 const fake=async()=>Response.json({choices:[{message:{content:'{"answer":"没有依据 [S99]","citations":["S99"]}'}}]});assert.equal((await handleRequest(request(),env,fake)).status,502);
});

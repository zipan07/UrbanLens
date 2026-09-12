import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CloudTransport, CLOUD_ORIGIN, PAGES_ORIGIN, apiPath, decodeResponse, attachmentBlob} from '../src/cloud-transport.js';

test('path grammar rejects traversal, URLs, encodings and unrelated endpoints', () => {
  assert.equal(apiPath('me'), '/api/me');
  assert.equal(apiPath('/api/projects/p-123/artifacts/a_1'), '/api/projects/p-123/artifacts/a_1');
  for (const p of ['/api/projects/../me','projects/%2e%2e/me','projects\\me','https://evil.example/api/me','//evil/api/me','projects?x=1','projects#x','me/extra','admin']) assert.throws(() => apiPath(p));
});
test('decode preserves API status and never returns login HTML', async () => {
  await assert.rejects(decodeResponse(Response.json({error:'禁止修改'},{status:403})), e => e.status === 403 && e.message === '禁止修改');
  await assert.rejects(decodeResponse(new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}})), e => e.code === 'INVALID_RESPONSE');
});
test('attachment bytes and Unicode filename survive data-only transfer', async () => {
  const bytes=Uint8Array.from([0,1,2,127,128,255]);
  const result=await decodeResponse(new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':"attachment; filename*=UTF-8''%E8%AF%81%E6%8D%AE.pdf",'Set-Cookie':'NEVER_TRANSFER=secret'}}));
  assert.deepEqual(Object.keys(result).sort(),['base64','binary','mime','name']);
  assert.equal(result.name,'证据.pdf');
  assert.deepEqual(new Uint8Array(await attachmentBlob(result).arrayBuffer()),bytes);
});
test('client only accepts consent and responses from exact source, origin and nonce', async () => {
  const listeners = new Map(), sent=[];
  const popup={closed:false,focus(){},close(){this.closed=true},postMessage(message,origin){sent.push({message,origin})}};
  globalThis.location={origin:PAGES_ORIGIN};
  globalThis.window={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type),open:(url)=>{assert.match(url,/connect\.html#nonce=[a-f0-9]{64}$/);return popup}};
  const client=new CloudTransport({requestTimeout:500,connectTimeout:1000});
  await assert.rejects(client.request('me'),e=>e.code==='BRIDGE_CONNECT_REQUIRED');
  const connecting=client.connect(), message=listeners.get('message');
  const ready={type:'urbanlens-cloud-v1:ready',channel:client.channel};
  message({origin:'https://evil.example',source:popup,data:ready}); assert.equal(client.connected,false);
  message({origin:CLOUD_ORIGIN,source:{},data:ready}); assert.equal(client.connected,false);
  message({origin:CLOUD_ORIGIN,source:popup,data:{...ready,channel:'wrong'}}); assert.equal(client.connected,false);
  message({origin:CLOUD_ORIGIN,source:popup,data:ready}); await connecting; assert.equal(client.connected,true);
  const request=client.request('projects/p/state',{revision:1},'POST');
  const rpc=sent[0]; assert.equal(rpc.origin,CLOUD_ORIGIN); assert.equal(rpc.message.path,'/api/projects/p/state');
  const result={type:'urbanlens-cloud-v1:result',channel:client.channel,id:rpc.message.id,ok:true,value:{revision:2}};
  message({origin:PAGES_ORIGIN,source:popup,data:result}); assert.equal(client.pending.size,1);
  message({origin:CLOUD_ORIGIN,source:popup,data:result}); assert.deepEqual(await request,{revision:2});
  client.destroy(); assert.equal(popup.closed,true); assert.equal(listeners.size,0);
});
test('server requires user consent and rejects forged messages, replay and path traversal', async () => {
  const source=(await readFile(new URL('../src/cloud-connect.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
  const handlers={},elements={},sent=[],calls=[];
  const opener={postMessage:(m,o)=>sent.push({m,o})};
  const nonce='a'.repeat(64);
  const document={querySelector:id=>elements[id]||=( {disabled:false,hidden:true,textContent:'',addEventListener(type,fn){this[type]=fn}} )};
  const window={opener,addEventListener:(type,fn)=>handlers[type]=fn};
  const fetch=async(path,options)=>{calls.push({path,options});return Response.json(path==='/api/me'?{user:{id:'u1'}}:{ok:true});};
  const execute=new Function('PAGES_ORIGIN','apiPath','decodeResponse','window','document','location','fetch',source);
  execute(PAGES_ORIGIN,apiPath,decodeResponse,window,document,{hash:'#nonce='+nonce},fetch);
  let n=1;
  const request=(extra={})=>({origin:PAGES_ORIGIN,source:opener,data:{type:'urbanlens-cloud-v1:request',channel:nonce,id:'00000000-0000-4000-a000-'+String(n++).padStart(12,'0'),path:'/api/projects',method:'GET'},...extra});
  await handlers.message(request()); assert.equal(calls.length,0);
  await elements['#connect-button'].click(); assert.equal(calls.length,1); assert.equal(sent[0].m.type,'urbanlens-cloud-v1:ready'); assert.equal(sent[0].o,PAGES_ORIGIN);
  await handlers.message(request({origin:'https://evil.example'}));
  await handlers.message(request({source:{}}));
  const wrong=request();wrong.data.channel='b'.repeat(64);await handlers.message(wrong);assert.equal(calls.length,1);
  const traversal=request();traversal.data.path='/api/projects/../me';await handlers.message(traversal);assert.equal(calls.length,1);
  const valid=request();await handlers.message(valid);assert.equal(calls.length,2);assert.equal(calls[1].path,'/api/projects');assert.equal(calls[1].options.credentials,'same-origin');assert.equal(calls[1].options.redirect,'error');
  await handlers.message(valid);assert.equal(calls.length,2);
  elements['#disconnect-button'].click();await handlers.message(request());assert.equal(calls.length,2);
});

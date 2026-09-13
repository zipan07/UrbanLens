import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {packedBytes} from '../src/packed-data.js';
const html=fs.readFileSync('dist/index.html','utf8');
test('HTML loads the bootstrap for its exact runtime build',()=>{
 const hash=html.match(/name="urbanlens-runtime" content="([a-f0-9]+)"/)?.[1];assert.ok(hash);
 assert.ok(html.includes(`src="./atlas.js?v=${hash}"`));
 const manifest=JSON.parse(fs.readFileSync('dist/packed/atlas.json'));assert.ok(manifest.parts.every(p=>p.startsWith(`atlas-${hash}-`)));
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const file of ['src/atlas-app.js','src/studio-shell.js'])for(const m of fs.readFileSync(file,'utf8').matchAll(/\$\('#([^']+)'\)\.onclick\s*=/g))assert.ok(ids.has(m[1]),`${file} binds missing #${m[1]}`);
});
test('runtime manifest revalidates the HTML build and reconstructs current code',async()=>{
 const originals={fetch:globalThis.fetch,document:globalThis.document,location:globalThis.location};const requests=[];
 const hash=html.match(/name="urbanlens-runtime" content="([a-f0-9]+)"/)[1];
 globalThis.location={href:'https://example.org/UrbanLens/'};globalThis.document={querySelector:()=>({content:hash})};
 globalThis.fetch=async(url,options)=>{requests.push({url:String(url),cache:options.cache});const b=fs.readFileSync('dist/'+new URL(url).pathname.replace('/UrbanLens/',''));return {ok:true,json:async()=>JSON.parse(b),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
 try{const bytes=await packedBytes('atlas');assert.equal(requests[0].cache,'no-cache');assert.equal(new URL(requests[0].url).searchParams.get('v'),hash);const text=new TextDecoder().decode(bytes);const manifest=JSON.parse(fs.readFileSync('dist/packed/atlas.json'));assert.equal(text,manifest.parts.map(p=>fs.readFileSync('dist/packed/'+p,'utf8')).join('')); assert.ok(!text.includes('#realism-quick'));assert.ok(!text.includes('#study-hud'));}finally{Object.assign(globalThis,originals);}
});

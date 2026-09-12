import {gunzipSync} from 'fflate';
export async function packedBytes(name){
 const base=new URL('./packed/',location.href),signal=AbortSignal.timeout(30000);
 const read=async url=>{const r=await fetch(url,{signal});if(!r.ok)throw Error(`资源加载失败 ${r.status}`);return r;};
 const manifest=await (await read(new URL(name+'.json?v=10.0',base))).json();
 const chunks=await Promise.all(manifest.parts.map(async part=>new Uint8Array(await (await read(new URL(part,base))).arrayBuffer())));
 const bytes=new Uint8Array(chunks.reduce((sum,c)=>sum+c.length,0));let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 const raw=manifest.encoding==='utf-8'?bytes:gunzipSync(bytes);if(raw.length!==manifest.bytes)throw Error('资源校验失败');return raw;
}

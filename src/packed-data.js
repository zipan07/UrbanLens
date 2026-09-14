import {gunzipSync} from 'fflate';
export async function packedBytes(name){
 const base=new URL('./packed/',location.href),signal=AbortSignal.timeout(30000);
 const read=async (url,cache='default')=>{const r=await fetch(url,{signal,cache});if(!r.ok)throw Error(`资源加载失败 ${r.status}`);return r;};
 const version=name==='atlas'?(document.querySelector('meta[name="urbanlens-runtime"]')?.content||'16.2.1'):'10.1';
 const manifest=await (await read(new URL(name+'.json?v='+version,base),'no-cache')).json();
 const chunks=await Promise.all(manifest.parts.map(async part=>new Uint8Array(await (await read(new URL(part,base))).arrayBuffer())));
 const bytes=new Uint8Array(chunks.reduce((sum,c)=>sum+c.length,0));let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 const compressed=manifest.encoding==='gzip-base64'?Uint8Array.from(atob(new TextDecoder().decode(bytes)),c=>c.charCodeAt(0)):bytes;
 const raw=manifest.encoding==='utf-8'?bytes:gunzipSync(compressed);if(raw.length!==manifest.bytes)throw Error('资源校验失败');return raw;
}

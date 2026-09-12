import {readFileSync,writeFileSync,mkdirSync,readdirSync,unlinkSync,existsSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const dir='dist/packed';mkdirSync(dir,{recursive:true});
// Small immutable parts make connector uploads bounded and reproducible.
const servicesPath='dist/data/services.geojson';
if(!existsSync(servicesPath)){const m=JSON.parse(readFileSync(dir+'/services.json'));writeFileSync(servicesPath,gunzipSync(Buffer.concat(m.parts.map(p=>readFileSync(dir+'/'+p)))));}
async function pack(name,bytes){const compressed=gzipSync(bytes,{level:9}),parts=[],hash=createHash('sha256').update(compressed).digest('hex').slice(0,12),size=98304;for(const file of readdirSync(dir).filter(f=>f.startsWith(name+'-')))unlinkSync(dir+'/'+file);for(let i=0;i<compressed.length;i+=size){const file=name+'-'+hash+'-'+String(i/size+1).padStart(2,'0')+'.bin';writeFileSync(dir+'/'+file,compressed.subarray(i,i+size));parts.push(file);}writeFileSync(dir+'/'+name+'.json',JSON.stringify({encoding:'gzip',parts,bytes:bytes.length,compressedBytes:compressed.length}));}
for(const name of ['boundary','buildings','roads','land','water','pois']){const path=`dist/data/${name}.geojson`;if(!existsSync(path)){const m=JSON.parse(readFileSync(dir+'/'+name+'.json'));writeFileSync(path,gunzipSync(Buffer.concat(m.parts.map(p=>readFileSync(dir+'/'+p)))));}await pack(name,readFileSync(path));}
const result=await build({entryPoints:['src/atlas-app.js'],bundle:true,minify:true,format:'esm',target:'es2022',write:false,legalComments:'eof'});
await pack('atlas',result.outputFiles[0].contents);await pack('services',readFileSync(servicesPath));
await build({entryPoints:['src/atlas-bootstrap.js'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/atlas.js',legalComments:'eof'});

import {readFileSync,writeFileSync,mkdirSync,readdirSync,unlinkSync,existsSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {build} from 'esbuild';
const dir='dist/packed';mkdirSync(dir,{recursive:true});
// Small immutable parts make connector uploads bounded and reproducible.
const servicesPath='dist/data/services.geojson';
if(!existsSync(servicesPath)){const m=JSON.parse(readFileSync(dir+'/services.json'));writeFileSync(servicesPath,gunzipSync(Buffer.concat(m.parts.map(p=>readFileSync(dir+'/'+p)))));}
async function pack(name,bytes){const compressed=gzipSync(bytes,{level:9}),parts=[];for(const file of readdirSync(dir).filter(f=>f.startsWith(name+'-')))unlinkSync(dir+'/'+file);for(let i=0;i<compressed.length;i+=32768){const file=name+'-'+String(i/32768+1).padStart(2,'0')+'.bin';writeFileSync(dir+'/'+file,compressed.subarray(i,i+32768));parts.push(file);}writeFileSync(dir+'/'+name+'.json',JSON.stringify({encoding:'gzip',parts,bytes:bytes.length}));}
const result=await build({entryPoints:['src/atlas-app.js'],bundle:true,minify:true,format:'esm',target:'es2022',write:false,legalComments:'eof'});
await pack('atlas',result.outputFiles[0].contents);await pack('services',readFileSync(servicesPath));
await build({entryPoints:['src/atlas-bootstrap.js'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/atlas.js',legalComments:'eof'});

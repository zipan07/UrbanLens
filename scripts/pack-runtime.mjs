import {readFileSync,writeFileSync,mkdirSync,readdirSync,unlinkSync,existsSync,cpSync,rmSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
const dir='dist/packed';mkdirSync(dir,{recursive:true});
// Small immutable parts make connector uploads bounded and reproducible.
const servicesPath='dist/data/services.geojson';
if(!existsSync(servicesPath)){const m=JSON.parse(readFileSync(dir+'/services.json'));writeFileSync(servicesPath,gunzipSync(Buffer.concat(m.parts.map(p=>readFileSync(dir+'/'+p)))));}
async function pack(name,bytes){const compressed=gzipSync(bytes,{level:9}),parts=[];for(const file of readdirSync(dir).filter(f=>f.startsWith(name+'-')))unlinkSync(dir+'/'+file);for(let i=0;i<compressed.length;i+=32768){const file=name+'-'+String(i/32768+1).padStart(2,'0')+'.bin';writeFileSync(dir+'/'+file,compressed.subarray(i,i+32768));parts.push(file);}writeFileSync(dir+'/'+name+'.json',JSON.stringify({encoding:'gzip',parts,bytes:bytes.length}));}
const result=await build({entryPoints:['src/atlas-app.js'],bundle:true,minify:true,format:'esm',target:'es2022',write:false,legalComments:'eof'});
// Publish frontend code as inspectable UTF-8 text. Spatial datasets remain the
// existing Xuanwu release; no new map data is included in this visual update.
const runtime=result.outputFiles[0].text,hash=createHash('sha256').update(runtime).digest('hex').slice(0,12),parts=[];
for(const file of readdirSync(dir).filter(f=>f.startsWith('atlas-')))unlinkSync(dir+'/'+file);
for(let i=0;i<runtime.length;i+=90000){const file=`atlas-${hash}-${String(parts.length+1).padStart(2,'0')}.txt`;writeFileSync(dir+'/'+file,runtime.slice(i,i+90000));parts.push(file);}
writeFileSync(dir+'/atlas.json',JSON.stringify({encoding:'utf-8',parts,bytes:Buffer.byteLength(runtime)}));
await build({entryPoints:['src/atlas-bootstrap.js'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/atlas.js',legalComments:'eof'});

await build({entryPoints:['src/cloud-connect.js'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/connect.js'});

// The same map UI is served by the authenticated project Worker.
await build({entryPoints:['server/projects.js'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/server/index.js',legalComments:'eof'});
rmSync('dist/client',{recursive:true,force:true});mkdirSync('dist/client',{recursive:true});
for(const file of readdirSync('dist'))if(!['client','server','.openai'].includes(file))cpSync('dist/'+file,'dist/client/'+file,{recursive:true});
rmSync('dist/.openai',{recursive:true,force:true});
if(existsSync('.openai/hosting.json')){mkdirSync('dist/.openai',{recursive:true});cpSync('.openai/hosting.json','dist/.openai/hosting.json');cpSync('drizzle','dist/.openai/drizzle',{recursive:true});}

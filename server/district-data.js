import {gunzipSync} from 'fflate';
import {mergeDistrict,mergeServices} from '../src/district-data.js';
// Saved and browser assessments share the same district snapshots.
export async function loadStudyData(readJSON,readText){
 const keys=['boundary','buildings','land','water','roads','pois'];
 const [manifest,services,populationGrid,...layers]=await Promise.all([readJSON('data/manifest.json'),readJSON('data/services.geojson'),readJSON('data/population-grid.geojson'),...keys.map(k=>readJSON(`data/${k}.geojson`))]);
 const extras=await Promise.all(['gulou','qinhuai'].map(async name=>{const pack=await readJSON(`packed/${name}.json`);const encoded=(await Promise.all(pack.parts.map(p=>readText('packed/'+p)))).join('');const bytes=gunzipSync(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)));if(bytes.length!==pack.bytes)throw Error('城区资料校验失败');return JSON.parse(new TextDecoder().decode(bytes));}));
 const data=Object.fromEntries(keys.map((k,i)=>[k,layers[i]]));let current=manifest,mergedServices=services,boundary;
 for(const extra of extras){const merged=mergeDistrict(data,current,extra);current=merged.manifest;boundary=merged.geometry;mergedServices=mergeServices(mergedServices,extra.data.services);}
 return {data:{...data,populationGrid},services:mergedServices,boundary};
}

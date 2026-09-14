import {gunzipSync} from 'fflate';
import {mergeDistrict,mergeServices} from '../src/district-data.js';

// Use the same versioned spatial snapshot for saved and browser-only assessments.
export async function loadStudyData(readJSON,readText){
 const keys=['boundary','buildings','land','water','roads','pois'];
 const [manifest,pack,services,populationGrid,...layers]=await Promise.all([
  readJSON('data/manifest.json'),readJSON('packed/gulou.json'),
  readJSON('data/services.geojson'),readJSON('data/population-grid.geojson'),
  ...keys.map(k=>readJSON(`data/${k}.geojson`))
 ]);
 const encoded=(await Promise.all(pack.parts.map(p=>readText('packed/'+p)))).join('');
 const bytes=gunzipSync(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)));
 if(bytes.length!==pack.bytes)throw Error('鼓楼区资料校验失败');
 const extra=JSON.parse(new TextDecoder().decode(bytes));
 const data=Object.fromEntries(keys.map((k,i)=>[k,layers[i]]));
 const merged=mergeDistrict(data,manifest,extra);
 return {data:{...data,populationGrid},services:mergeServices(services,extra.data.services),boundary:merged.geometry};
}

import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import osm from 'osmtogeojson';
import {centerOf,inGeometry,distanceMeters} from '../src/geo.js';
const folder=process.argv[2]||'dist/data/qinhuai',rawFile=process.argv[3];
const keys=['boundary','buildings','roads','land','water','pois'];
const data=Object.fromEntries(keys.map(k=>[k,JSON.parse(fs.readFileSync(`${folder}/${k}.geojson`))]));
const manifest=JSON.parse(fs.readFileSync(`${folder}/manifest.json`));
manifest.queryEndpoint='https://www.openstreetmap.org/api/0.6/map.json';manifest.snapshotAt=manifest.downloadedAt;manifest.scopeNote+=' 获取时间为快照日期；OSM API 返回相交道路、建筑及关联对象，未闭合的跨范围关系已排除。';
const boundary=data.boundary.features[0].geometry,raw=JSON.parse(fs.readFileSync(rawFile));
const category=p=>p.railway==='station'||p.highway==='bus_stop'||p.amenity==='bus_station'?'transit':['school','university','college','kindergarten','library'].includes(p.amenity)?'education':['hospital','clinic','doctors','pharmacy','dentist'].includes(p.amenity)?'health':p.leisure==='park'?'park':p.historic?'heritage':p.shop||['restaurant','cafe','fast_food','marketplace','bank','post_office','community_centre','social_facility'].includes(p.amenity)?'daily':null;
const points=[];
for(const f of osm(raw,{flatProperties:true}).features){const p=f.properties,c=category(p);if(!c||!f.geometry||p.tainted||p.disused==='yes'||p.abandoned==='yes'||p.proposed==='yes'||p.construction||p.railway==='construction'||p.access==='no')continue;const xy=centerOf(f.geometry);if(!inGeometry(xy,boundary))continue;
 const prior=p.name&&points.find(g=>g.properties.name===p.name&&g.properties.category===c&&distanceMeters(g.geometry.coordinates,xy)<=80);if(prior){prior.properties.related_osm_ids.push(f.id);continue;}
 points.push({type:'Feature',id:f.id,geometry:{type:'Point',coordinates:xy},properties:{osm_id:f.id,name:p.name||'未命名设施',named:!!p.name,category:c,kind:p.amenity||p.shop||p.railway||p.highway||p.leisure||p.historic,location_method:'OSM 节点或对象外包框中心，非入口',source_date:manifest.snapshotAt,related_osm_ids:[f.id],district:'秦淮区'}});
}
data.services={type:'FeatureCollection',metadata:{source:manifest.queryEndpoint,snapshotAt:manifest.snapshotAt,license:'ODbL 1.0',note:'秦淮区中心点落区筛选；非设施普查。同类同名80米以内合并。'},features:points};
const packageData={manifest,data};const bytes=Buffer.from(JSON.stringify(packageData)),compressed=gzipSync(bytes),base64=compressed.toString('base64'),hash=createHash('sha256').update(bytes).digest('hex').slice(0,12),parts=[];
for(let i=0;i<base64.length;i+=90000){const name=`qinhuai-${hash}-${String(parts.length+1).padStart(2,'0')}.txt`;fs.writeFileSync('dist/packed/'+name,base64.slice(i,i+90000));parts.push(name);}
fs.writeFileSync('dist/packed/qinhuai.json',JSON.stringify({encoding:'gzip-base64',bytes:bytes.length,parts}));
fs.writeFileSync('dist/data/qinhuai-manifest.json',JSON.stringify({...manifest,services:points.length,pack:'../packed/qinhuai.json'},null,2));
console.log(JSON.stringify({counts:manifest.counts,services:points.length,bytes:bytes.length,compressed:compressed.length,parts:parts.length}));

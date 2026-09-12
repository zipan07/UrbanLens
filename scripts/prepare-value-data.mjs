import fs from 'node:fs';
import {centerOf,inGeometry,distanceMeters} from '../src/geo.js';

const raw=JSON.parse(fs.readFileSync(process.argv[2]||'/tmp/xuanwu-services-raw.json'));
if(raw.remark||!raw.elements?.length)throw Error('Overpass response incomplete');
const category=p=>p.railway==='station'||p.highway==='bus_stop'||p.amenity==='bus_station'?'transit':
 ['school','university','college','kindergarten','library'].includes(p.amenity)?'education':
 ['hospital','clinic','doctors','pharmacy','dentist'].includes(p.amenity)?'health':
 p.leisure==='park'?'park':p.historic?'heritage':
 p.shop||['restaurant','cafe','fast_food','marketplace','bank','post_office','community_centre','social_facility'].includes(p.amenity)?'daily':null;
const groupNames={transit:'交通点位',education:'教育设施',health:'医疗服务',park:'公园',heritage:'历史要素',daily:'生活服务'};
const features=[],excluded={inactive:0,irrelevant:0,noCoordinate:0};
for(const e of raw.elements){const p=e.tags||{},c=category(p);
 if(!c){excluded.irrelevant++;continue;}
 if(p.disused==='yes'||p.abandoned==='yes'||p.proposed==='yes'||p.construction||p.railway==='construction'||p.access==='no'){excluded.inactive++;continue;}
 const xy=e.lon!==undefined?[e.lon,e.lat]:e.center?[e.center.lon,e.center.lat]:null;
 if(!xy){excluded.noCoordinate++;continue;}
 features.push({type:'Feature',id:`${e.type}/${e.id}`,geometry:{type:'Point',coordinates:xy},properties:{osm_id:`${e.type}/${e.id}`,name:p.name||`未命名${groupNames[c]}`,named:!!p.name,category:c,kind:p.amenity||p.shop||p.railway||p.highway||p.leisure||p.historic,location_method:e.type==='node'?'OSM 节点':'OSM 对象包围盒中心，非入口',access:p.access||'未标注',source_date:raw.osm3s.timestamp_osm_base,...(p.name?{original_name:p.name}:{})}});
}
// Same name and class within 80m are one mapped location. Preserve all object IDs.
const grouped=[];
for(const f of features.sort((a,b)=>a.id.localeCompare(b.id))){const prior=f.properties.named&&grouped.find(g=>g.properties.name===f.properties.name&&g.properties.category===f.properties.category&&distanceMeters(g.geometry.coordinates,f.geometry.coordinates)<=80);
 if(prior){prior.properties.related_osm_ids.push(f.id);continue;}
 f.properties.related_osm_ids=[f.id];grouped.push(f);
}
const meta={version:'SERVICES-07',snapshotAt:raw.osm3s.timestamp_osm_base,downloadedAt:'2026-09-12',source:'OpenStreetMap / Overpass',url:'https://www.openstreetmap.org/copyright',license:'ODbL 1.0',attribution:'© OpenStreetMap contributors',queryBounds:[118.76,32.00,118.92,32.125],scope:'玄武区及邻近矩形范围，含跨区配套；非设施普查。分类相同且同名、相距80m以内的对象合并，保留原始ID；不同名称的同址设施可能仍重复。地铁、公交等交通点位不代表运营时刻核验。',rawCount:raw.elements.length,classifiedCount:features.length,count:grouped.length,excluded,counts:Object.fromEntries(Object.keys(groupNames).map(k=>[k,grouped.filter(f=>f.properties.category===k).length]))};
fs.writeFileSync('dist/data/services.geojson',JSON.stringify({type:'FeatureCollection',metadata:meta,features:grouped}));
const land=JSON.parse(fs.readFileSync('dist/data/land.geojson')),boundary=JSON.parse(fs.readFileSync('dist/data/boundary.geojson')).features[0].geometry;
const choices=[['way/685028159','产业空间','存量园区的利用效率与周边配套'],['way/857492847','商业文旅','文化消费场景与公共空间'],['way/1079491117','居住社区','社区服务与使用状况'],['way/1022153766','居住社区','居住环境与设施补充'],['way/1367615824','产业空间','研发载体与交通联系'],['way/1367615823','产业空间','产业空间的功能适配'],['way/1418964177','商业文旅','文化设施与复合利用'],['relation/16272607','校园周边','校园与城市服务联系']];
const units=choices.map(([id,type,story],i)=>{const f=land.features.find(x=>x.properties.osm_id===id);if(!f||!inGeometry(centerOf(f.geometry),boundary))throw Error(`Research unit outside district: ${id}`);return {...structuredClone(f),id:`XW-R${String(i+1).padStart(2,'0')}`,properties:{...f.properties,unit_id:`XW-R${String(i+1).padStart(2,'0')}`,research_type:type,story,category:'research',boundary_source:'OSM 用地轮廓选作研究单元，不是地籍或官方更新单元',source_date:land.metadata.snapshotAt,source_url:`https://www.openstreetmap.org/${id}`}};});
fs.writeFileSync('dist/data/research-units.geojson',JSON.stringify({type:'FeatureCollection',metadata:{version:'XW-RESEARCH-07',source:'OpenStreetMap polygons selected for interface research',snapshotAt:land.metadata.snapshotAt,license:'ODbL 1.0',attribution:'© OpenStreetMap contributors',note:'选取真实空间对象用于展示流程，不表明这些对象被认定为低效、闲置或拟更新。演示业务台账另行标识。'},features:units}));
console.log(JSON.stringify({services:meta,researchUnits:units.map(f=>[f.id,f.properties.name])},null,2));

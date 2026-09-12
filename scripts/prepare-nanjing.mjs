import fs from 'node:fs';
import osm from 'osmtogeojson';
import {heightOf,centerOf,boundsOf,inGeometry,distanceMeters} from '../src/geo.js';
import {projectedArea} from '../src/value-domain.js';

const rawDir=process.argv[2]||'/tmp/nanjing-raw';
const output='dist/data';
const districts=[
  {divisionCode:'320106',name:'鼓楼区',osmId:'relation/2139790',prefix:'GL'},
  {divisionCode:'320102',name:'玄武区',osmId:'relation/2138698',prefix:'XW'},
  {divisionCode:'320104',name:'秦淮区',osmId:'relation/2140011',prefix:'QH'},
  {divisionCode:'320114',name:'雨花台区',osmId:'relation/2139830',prefix:'YH'},
  {divisionCode:'320105',name:'建邺区',osmId:'relation/2139809',prefix:'JY'},
  {divisionCode:'320113',name:'栖霞区',osmId:'relation/2140010',prefix:'QX'},
];
const load=key=>{
  const raw=JSON.parse(fs.readFileSync(`${rawDir}/nanjing-${key}-raw.json`));
  if(raw.remark||!raw.elements?.length)throw Error(`Incomplete ${key} response: ${raw.remark||'no elements'}`);
  return raw;
};
const boundaryRaw=load('boundary');
const boundaryFeatures=osm(boundaryRaw,{flatProperties:true}).features;
for(const district of districts){
  district.feature=boundaryFeatures.find(f=>f.id===district.osmId);
  if(!district.feature||district.feature.properties.tainted||!['Polygon','MultiPolygon'].includes(district.feature.geometry?.type))throw Error(`Invalid boundary ${district.name}`);
  district.bbox=boundsOf(district.feature.geometry);
}
const oldManifest=JSON.parse(fs.readFileSync(`${output}/manifest.json`));
const oldUnits=JSON.parse(fs.readFileSync(`${output}/research-units.geojson`));
const rawObjects=new Map(),memberships=new Map(),snapshots=[];
for(const district of districts){
  const raw=load(district.divisionCode);
  snapshots.push({divisionCode:district.divisionCode,name:district.name,snapshotAt:raw.osm3s.timestamp_osm_base,areaSnapshotAt:raw.osm3s.timestamp_areas_base,rawCount:raw.elements.length});
  for(const element of raw.elements){
    const id=`${element.type}/${element.id}`;
    if(!memberships.has(id))memberships.set(id,new Set());
    memberships.get(id).add(district.divisionCode);
    rawObjects.set(id,element);
  }
}
const converted=osm({version:0.6,elements:[...rawObjects.values()]},{flatProperties:true}).features;
const snapshotTimes=snapshots.map(s=>s.snapshotAt).sort();
const snapshotAt=snapshotTimes[0];
const meta={source:'OpenStreetMap',attribution:'© OpenStreetMap contributors',license:'ODbL 1.0',licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/',snapshotAt,snapshotRange:[snapshotTimes[0],snapshotTimes.at(-1)],districts:districts.map(d=>({name:d.name,divisionCode:d.divisionCode})),scope:'Six Nanjing district area queries; complete intersecting OSM objects, deduplicated by object ID; not a cadastral survey'};
const collection=(features,extra={})=>({type:'FeatureCollection',metadata:{...meta,...extra},features});
const insideBounds=(xy,b)=>xy[0]>=b[0]&&xy[0]<=b[2]&&xy[1]>=b[1]&&xy[1]<=b[3];
function districtFields(id,geometry){
  const xy=centerOf(geometry);
  let owner=districts.find(d=>insideBounds(xy,d.bbox)&&inGeometry(xy,d.feature.geometry));
  const queryCodes=[...(memberships.get(id)||[])];
  const method=owner?'对象包围盒中心落区（非权属归属）':'范围检索相交，中心不在六区内';
  if(!owner)owner=districts.find(d=>queryCodes.includes(d.divisionCode));
  return {district_name:owner?.name||'六区周边',division_code:owner?.divisionCode||'',district_method:method,query_district_codes:queryCodes};
}
const kept=['name','name:en','name:zh','building','building:part','height','min_height','building:levels','building:material','roof:shape','roof:colour','landuse','natural','leisure','amenity','shop','tourism','historic','railway','highway','waterway','bridge','tunnel','layer','ele','place','source','start_date','surface','lanes','maxspeed','oneway','width','operator','access','wheelchair','opening_hours','addr:street','addr:housenumber','addr:district'];
function feature(f,extra={}){
  const p=f.properties;
  return {...f,properties:{...Object.fromEntries(kept.filter(k=>p[k]!==undefined).map(k=>[k,p[k]])),osm_id:f.id,label:(p['name:zh']||p.name||'').replace(/[^\p{Script=Han}]/gu,''),...districtFields(f.id,f.geometry),...extra}};
}
const groups={buildings:[],land:[],roads:[],water:[],pois:[]};
const skipped={underground:0,invalid:0};
for(const f of converted){
  if(!f.geometry||f.properties.tainted){skipped.invalid++;continue;}
  const p=f.properties,polygon=['Polygon','MultiPolygon'].includes(f.geometry.type),line=['LineString','MultiLineString'].includes(f.geometry.type);
  const underground=p.location==='underground'||p.indoor==='yes'||Number(p.layer)<0||Number(p.level)<0;
  if(polygon&&(p.building||p['building:part'])&&p.building!=='no'){
    if(underground)skipped.underground++;
    else groups.buildings.push(feature(f,{category:'building',...heightOf(p)}));
  }
  if(polygon&&!underground){
    if(p.natural==='water'||p.waterway==='riverbank')groups.water.push(feature(f,{category:'water'}));
    else if(p.landuse||p.leisure||['wood','scrub','grassland','wetland'].includes(p.natural)||['university','school','hospital'].includes(p.amenity)){
      const kind=p.landuse||p.leisure||p.natural||p.amenity;
      const category=['forest','wood','scrub','grass','grassland','meadow','orchard','park','garden','nature_reserve','recreation_ground','village_green','wetland'].includes(kind)?'green':['school','university','hospital','religious','cemetery'].includes(kind)?'civic':['commercial','retail'].includes(kind)?'commercial':['industrial','construction','brownfield','railway'].includes(kind)?'industrial':kind==='residential'?'residential':'other';
      groups.land.push(feature(f,{category,kind}));
    }
  }
  if(line&&(p.highway||p.railway||p.waterway))groups.roads.push(feature(f,{category:p.railway?'rail':p.waterway?'waterway':'road',road_class:['motorway','trunk','primary','motorway_link','trunk_link','primary_link'].includes(p.highway)?'major':['secondary','tertiary','secondary_link','tertiary_link'].includes(p.highway)?'secondary':['footway','path','steps','cycleway','pedestrian','bridleway'].includes(p.highway)?'path':'local',underground}));
  if(p.name&&!line&&(p.amenity||p.shop||p.tourism||p.historic||p.railway==='station'||p.natural==='peak'||p.place||p.natural==='water'||p.leisure==='park')){
    const category=p.railway==='station'||p.amenity==='bus_station'?'transport':['school','university','college','kindergarten','library'].includes(p.amenity)?'education':['hospital','clinic','pharmacy','doctors'].includes(p.amenity)?'health':p.tourism||p.historic||p.amenity==='place_of_worship'?'culture':p.natural||p.leisure==='park'?'nature':p.place?'place':'service';
    groups.pois.push({...feature(f,{category,original_geometry:f.geometry.type}),geometry:{type:'Point',coordinates:centerOf(f.geometry)}});
  }
}
const boundaries=districts.map(d=>({...d.feature,properties:{osm_id:d.osmId,name:d.name,'name:en':d.feature.properties['name:en'],label:d.name,category:'boundary',division_code:d.divisionCode,district_name:d.name}}));
const serviceCategory=p=>p.railway==='station'||p.highway==='bus_stop'||p.amenity==='bus_station'?'transit':['school','university','college','kindergarten','library'].includes(p.amenity)?'education':['hospital','clinic','doctors','pharmacy','dentist'].includes(p.amenity)?'health':p.leisure==='park'?'park':p.historic?'heritage':p.shop||['restaurant','cafe','fast_food','marketplace','bank','post_office','community_centre','social_facility'].includes(p.amenity)?'daily':null;
const serviceNames={transit:'交通点位',education:'教育设施',health:'医疗服务',park:'公园',heritage:'历史要素',daily:'生活服务'};
const serviceCandidates=[],excluded={inactive:0,irrelevant:0,noCoordinate:0};
for(const f of converted){
  const p=f.properties,c=serviceCategory(p);
  if(!c){excluded.irrelevant++;continue;}
  if(p.disused==='yes'||p.abandoned==='yes'||p.proposed==='yes'||p.construction||p.railway==='construction'||p.access==='no'){excluded.inactive++;continue;}
  if(!f.geometry||p.tainted){excluded.noCoordinate++;continue;}
  const xy=centerOf(f.geometry);
  serviceCandidates.push({type:'Feature',id:f.id,geometry:{type:'Point',coordinates:xy},properties:{osm_id:f.id,name:p.name||`未命名${serviceNames[c]}`,named:!!p.name,category:c,kind:p.amenity||p.shop||p.railway||p.highway||p.leisure||p.historic,location_method:f.geometry.type==='Point'?'OSM 节点':'OSM 对象包围盒中心，非入口',access:p.access||'未标注',source_date:snapshotAt,...districtFields(f.id,f.geometry),...(p.name?{original_name:p.name}:{})}});
}
const services=[],serviceBuckets=new Map();
for(const f of serviceCandidates.sort((a,b)=>a.id.localeCompare(b.id))){
  const key=f.properties.name+'|'+f.properties.category;
  const candidates=serviceBuckets.get(key)||[];
  const prior=f.properties.named&&candidates.find(g=>distanceMeters(g.geometry.coordinates,f.geometry.coordinates)<=80);
  if(prior){prior.properties.related_osm_ids.push(f.id);continue;}
  f.properties.related_osm_ids=[f.id];services.push(f);candidates.push(f);serviceBuckets.set(key,candidates);
}

// Existing Xuanwu units keep their stable IDs. Other districts use genuine,
// named urban land polygons; deterministic selection covers multiple use types.
const units=[],used=new Set();
const researchType={residential:['居住社区','居住环境与社区设施补充'],commercial:['商业文旅','商业空间与公共服务联系'],industrial:['产业空间','产业载体与交通、生活配套'],civic:['校园周边','公共设施与城市服务联系'],green:['公共空间','公共空间与周边功能联系']};
// These are display examples, not findings of underuse or an official project list.
const preferredUnits={
  '320106':['way/995812178','way/192946046','way/1015768055','way/88779953'],
  '320104':['relation/2137425','way/1500975796','relation/2137443','way/447816548'],
  '320114':['way/148399858','way/717443901','relation/18799428','relation/20609188'],
  '320105':['relation/19578015','way/759960749','way/1024275471','way/1078364003'],
  '320113':['way/155445035','way/991480590','way/1006913861','relation/8910104'],
};
function addUnit(f,d,index,existing){
  const id=existing?.id||`${d.prefix}-R${String(index).padStart(2,'0')}`;
  const [type,story]=/科技园|研发中心|产业园|创业园/.test(f.properties.name||'')?researchType.industrial:researchType[f.properties.category]||['综合片区','空间用途与周边设施联系'];
  units.push({...structuredClone(f),id,properties:{...f.properties,unit_id:id,research_type:existing?.properties.research_type||type,story:existing?.properties.story||story,category:'research',boundary_source:'OSM 用地轮廓选作研究单元，不是地籍或官方更新单元',source_date:snapshotAt,source_url:`https://www.openstreetmap.org/${f.properties.osm_id}`}});
  used.add(f.properties.osm_id);
}
for(const d of districts){
  const choices=groups.land.filter(f=>f.properties.division_code===d.divisionCode&&inGeometry(centerOf(f.geometry),d.feature.geometry));
  if(d.divisionCode==='320102'){
    for(const old of oldUnits.features.filter(f=>String(f.id).startsWith('XW-'))){const f=choices.find(f=>f.properties.osm_id===old.properties.osm_id);if(f)addUnit(f,d,units.length+1,old);}
  }else{
    const candidates=choices.filter(f=>{const area=projectedArea(f.geometry);return f.properties.name&&f.properties.name.length<=45&&researchType[f.properties.category]&&area>1000&&area<2e6;}).sort((a,b)=>a.properties.osm_id.localeCompare(b.properties.osm_id));
    let i=1;
    for(const id of preferredUnits[d.divisionCode]){
      const f=candidates.find(f=>f.properties.osm_id===id);
      if(!f)throw Error(`Research example absent or outside area limits: ${d.name} ${id}`);
      addUnit(f,d,i++);
    }
    if(i<5)throw Error(`Insufficient genuine named research polygons for ${d.name}`);
  }
}
const originalLandmarkIds=['relation/2138994','relation/16272607','way/62353727','way/319055520','way/319998727','relation/18303735','way/380923041','way/88507214'];
const existingLandmarks=oldManifest.landmarks.filter(l=>originalLandmarkIds.includes(l.id)&&converted.some(f=>f.id===l.id));
const landmarkIds={
  '320106':['way/140809508','way/88779953'],
  '320104':['way/590937998','way/318052307'],
  '320114':['way/121887178','way/62381499'],
  '320105':['way/94496398','way/883813030'],
  '320113':['way/1243073749','way/89910837'],
};
const landmarks=[...existingLandmarks];
for(const [code,ids]of Object.entries(landmarkIds)){
  for(const id of ids){const f=converted.find(f=>f.id===id);if(!f)throw Error(`Missing landmark ${id}`);landmarks.push({id:f.id,name:f.properties.name,center:centerOf(f.geometry),bbox:boundsOf(f.geometry),divisionCode:code,districtName:districts.find(d=>d.divisionCode===code).name});}
}
const heights=groups.buildings.reduce((o,f)=>(o[f.properties.height_source]++,o),{osm:0,levels:0,unknown:0});
const fullBbox=districts.reduce((b,d)=>[Math.min(b[0],d.bbox[0]),Math.min(b[1],d.bbox[1]),Math.max(b[2],d.bbox[2]),Math.max(b[3],d.bbox[3])],[Infinity,Infinity,-Infinity,-Infinity]);
const districtManifest=districts.map(d=>({name:d.name,divisionCode:d.divisionCode,osmId:d.osmId,bbox:d.bbox,center:centerOf(d.feature.geometry),counts:{...Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.filter(f=>f.properties.division_code===d.divisionCode).length])),services:services.filter(f=>f.properties.division_code===d.divisionCode).length,researchUnits:units.filter(f=>f.properties.division_code===d.divisionCode).length},snapshotAt:snapshots.find(s=>s.divisionCode===d.divisionCode).snapshotAt,sourceUrl:`https://www.openstreetmap.org/${d.osmId}`}));
const manifest={...oldManifest,version:'NANJING-09',title:'南京市核心城区 · 六区',divisionCode:'320100',divisionCodes:districts.map(d=>d.divisionCode),districts:districtManifest,snapshotAt,snapshotRange:meta.snapshotRange,areaSnapshotAt:snapshots.map(s=>s.areaSnapshotAt).filter(Boolean).sort()[0],downloadedAt:new Date().toISOString().slice(0,10),boundary:{osmIds:districts.map(d=>d.osmId),bbox:fullBbox},counts:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),heights,skipped,landmarks,sourceUrl:'https://www.openstreetmap.org/copyright',queryEndpoint:'https://overpass-api.de/api/interpreter',sourceSnapshots:snapshots,scopeNote:'南京鼓楼、玄武、秦淮、雨花台、建邺、栖霞六区 OSM 范围检索；包含与区界相交的完整对象并按 OSM ID 去重，未裁切到区界。数量为开放地图快照收录量，非城区普查总量。',districtNote:'分区标签优先按对象包围盒中心落区，中心不在六区时按检索相交区记录；不是权属、地籍或精确面积归属。',researchUnitCount:units.length,serviceCount:services.length,terrainNote:'同站 DEM 仍仅覆盖原玄武区及邻近范围；六区扩展使用真实平面数据，未补充的区域不宣称已接入精确地形。'};
fs.mkdirSync(output,{recursive:true});
for(const [key,features]of Object.entries({...groups,boundary:boundaries}))fs.writeFileSync(`${output}/${key}.geojson`,JSON.stringify(collection(features)));
fs.writeFileSync(`${output}/manifest.json`,JSON.stringify(manifest,null,2));
fs.writeFileSync(`${output}/services.geojson`,JSON.stringify(collection(services,{version:'NANJING-SERVICES-09',downloadedAt:manifest.downloadedAt,source:'OpenStreetMap / Overpass',url:'https://www.openstreetmap.org/copyright',queryBounds:fullBbox,scope:'南京六区 OSM 范围检索，包含相交对象；非设施普查。分类相同、同名且80m以内的对象合并并保留ID；不同名称的同址设施可能仍重复。交通点位未核验运营时刻。',rawCount:rawObjects.size,classifiedCount:serviceCandidates.length,count:services.length,excluded,counts:Object.fromEntries(Object.keys(serviceNames).map(k=>[k,services.filter(f=>f.properties.category===k).length]))})));
fs.writeFileSync(`${output}/research-units.geojson`,JSON.stringify(collection(units,{version:'NJ-RESEARCH-09',source:'OpenStreetMap polygons selected for interface research',note:'选取真实空间对象用于展示流程，不表明这些对象被认定为低效、闲置或拟更新。演示业务台账另行标识。'})));
const evidence=JSON.parse(fs.readFileSync(`${output}/value-evidence.json`));
evidence.scope='南京六区空间研究；现有公开更新案例与两笔历史土地成交参考仍以玄武区为主，不代表六区市场或政策资料已全面接入。原文摘要不是宗地条件或正式估价依据。';
evidence.coverage={spatialDistricts:districts.map(d=>d.name),documentFocus:'玄武区及南京市级公开材料',marketDistricts:['玄武区'],marketCount:evidence.market.length,expandedAt:manifest.downloadedAt};
fs.writeFileSync(`${output}/value-evidence.json`,JSON.stringify(evidence,null,2));
console.log(JSON.stringify({counts:manifest.counts,heights,districts:districtManifest,services:services.length,researchUnits:units.map(f=>({id:f.id,name:f.properties.name,district:f.properties.district_name,source:f.properties.osm_id})),skipped,landmarks:landmarks.map(f=>f.name)},null,2));

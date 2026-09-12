import fs from 'node:fs';
import osm from 'osmtogeojson';
import {heightOf,centerOf,boundsOf} from '../src/geo.js';

const rawDir=process.argv[2]||'/tmp';
const load=name=>JSON.parse(fs.readFileSync(`${rawDir}/xuanwu-${name}-raw.json`));
const boundary=osm(load('boundary'),{flatProperties:true}).features.find(f=>f.id==='relation/2138698');
if(!boundary)throw new Error('玄武区行政边界缺失');
const raw=load('features');if(raw.remark)throw new Error(raw.remark);
const extra=load('nodes');if(extra.remark)throw new Error(extra.remark);
const converted=osm({...raw,elements:[...raw.elements,...extra.elements]},{flatProperties:true});
const fc=features=>({type:'FeatureCollection',metadata:{source:'OpenStreetMap',attribution:'© OpenStreetMap contributors',license:'ODbL 1.0',licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/',snapshotAt:raw.osm3s.timestamp_osm_base,scope:'Xuanwu District area query; complete intersecting objects; not a cadastral survey'},features});
const groups={buildings:[],land:[],roads:[],water:[],pois:[]};
const seen=new Set(),skipped={underground:0,invalid:0};
const props=p=>Object.fromEntries(['name','name:en','building','building:part','height','min_height','building:levels','building:material','roof:shape','roof:colour','landuse','natural','leisure','amenity','tourism','historic','railway','highway','waterway','bridge','tunnel','layer','ele','place','source','start_date'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));
function feature(f,extra={}){const p=f.properties;return {...f,properties:{...props(p),osm_id:f.id,label:(p.name||'').replace(/[^\p{Script=Han}]/gu,''),...extra}};}
for(const f of converted.features){
  if(seen.has(f.id))continue;seen.add(f.id);
  if(!f.geometry||f.properties.tainted){skipped.invalid++;continue;}
  const p=f.properties,polygon=['Polygon','MultiPolygon'].includes(f.geometry.type),line=['LineString','MultiLineString'].includes(f.geometry.type);
  const underground=p.location==='underground'||p.indoor==='yes'||Number(p.layer)<0||Number(p.level)<0;
  if(polygon&&(p.building||p['building:part'])&&p.building!=='no'){
    if(underground){skipped.underground++;}
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
  if(p.name&&!line&&(p.amenity||p.tourism||p.historic||p.railway==='station'||p.natural==='peak'||p.place||p.natural==='water'||p.leisure==='park')){
    const category=p.railway==='station'||p.amenity==='bus_station'?'transport':['school','university','college','kindergarten','library'].includes(p.amenity)?'education':['hospital','clinic','pharmacy','doctors'].includes(p.amenity)?'health':p.tourism||p.historic||p.amenity==='place_of_worship'?'culture':p.natural||p.leisure==='park'?'nature':p.place?'place':'service';
    groups.pois.push({...feature(f,{category}),geometry:{type:'Point',coordinates:centerOf(f.geometry)},properties:{...feature(f,{category}).properties,original_geometry:f.geometry.type}});
  }
}
const ids=['relation/2138994','relation/16272607','way/62353727','way/319055520','way/319998727','relation/18303735','way/380923041','way/88507214'];
const landmarks=ids.map(id=>{const f=converted.features.find(f=>f.id===id);if(!f)throw new Error(`Missing landmark ${id}`);return {id,name:f.properties.name,center:centerOf(f.geometry),bbox:boundsOf(f.geometry)};});
const b=feature(boundary,{category:'boundary',division_code:'320102'});
const out='dist/data';fs.mkdirSync(out,{recursive:true});
for(const [name,features]of Object.entries({...groups,boundary:[b]}))fs.writeFileSync(`${out}/${name}.geojson`,JSON.stringify(fc(features)));
const h=groups.buildings.reduce((o,f)=>(o[f.properties.height_source]++,o),{osm:0,levels:0,unknown:0});
const manifest={version:'XUANWU-06',title:'南京市玄武区',divisionCode:'320102',coordinateSystem:'WGS84 / EPSG:4326',snapshotAt:raw.osm3s.timestamp_osm_base,areaSnapshotAt:raw.osm3s.timestamp_areas_base,downloadedAt:'2026-09-11',boundary:{osmId:boundary.id,bbox:boundsOf(boundary.geometry)},counts:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),heights:h,skipped,landmarks,license:'ODbL 1.0',attribution:'© OpenStreetMap contributors',sourceUrl:'https://www.openstreetmap.org/relation/2138698',queryEndpoint:'https://overpass-api.de/api/interpreter',scopeNote:'OSM 玄武区范围检索，包含与区界相交的完整对象；数量是本次快照收录量，不是城区普查总量。',heightNote:'height 为 OSM 标注，未经测绘复核；building:levels × 3 m 为推算；无高度记录时仅显示 12 m 示意体量，可关闭。所有显示高度均不参与真实用地评估。',missing:['权属与宗地台账','法定规划条件与控制线','建筑调查与安全鉴定','空置率与运营调查','授权正射影像与实景三维模型'],creator:'制作者：蔡子攀｜东南大学建筑学院 · 东南大学城市规划设计研究院'};
fs.writeFileSync(`${out}/manifest.json`,JSON.stringify(manifest,null,2));console.log(JSON.stringify({counts:manifest.counts,heights:h,skipped,landmarks:landmarks.map(x=>x.name)},null,2));

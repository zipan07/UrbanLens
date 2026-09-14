import {boundsOf} from './geo.js';
export function mergeDistrict(data,manifest,extra){
 const prior=manifest.districts||[{name:'玄武区',code:manifest.divisionCode,bbox:manifest.boundary.bbox,snapshotAt:manifest.snapshotAt}];
 const name=extra.manifest.title.replace('南京市','');
 const districts=[...prior.filter(d=>d.name!==name),{name,code:extra.manifest.divisionCode,bbox:extra.manifest.boundary.bbox,snapshotAt:extra.manifest.snapshotAt}];
 const scope=districts.map(d=>d.name).join('、');
 for(const key of ['boundary','buildings','land','water','roads','pois']){const seen=new Set(data[key].features.map(f=>f.properties.osm_id));data[key]={...data[key],metadata:{...data[key].metadata,scope:`南京${scope}开放地图快照`,districtSnapshots:districts.map(d=>d.snapshotAt)},features:[...data[key].features,...extra.data[key].features.filter(f=>!seen.has(f.properties.osm_id))]};}
 const geometry={type:'MultiPolygon',coordinates:data.boundary.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates)};
 const heights=data.buildings.features.reduce((o,f)=>(o[f.properties.height_source]++,o),{osm:0,levels:0,unknown:0});
 return {geometry,manifest:{...manifest,title:'南京市 · '+scope,divisionCode:districts.map(d=>d.code).join(' / '),districts,landmarks:[...manifest.landmarks,...extra.manifest.landmarks],boundary:{...manifest.boundary,bbox:boundsOf(geometry)},counts:Object.fromEntries(['buildings','land','water','roads','pois'].map(k=>[k,data[k].features.length])),heights,scopeNote:districts.map(d=>`${d.name} ${d.snapshotAt}`).join('；')+'。各区要素按 OSM ID 去重；保留与区界相交的完整对象，非普查、地籍或官方更新名单。'}};
}
export function mergeServices(current,extra){const ids=new Set(current.features.flatMap(f=>f.properties.related_osm_ids||[f.id]));return {...current,metadata:{...current.metadata,scope:'南京已收录城区开放设施参考点',districtSnapshots:[...(current.metadata.districtSnapshots||[current.metadata.snapshotAt]),extra.metadata.snapshotAt]},features:[...current.features,...extra.features.filter(f=>!(f.properties.related_osm_ids||[f.id]).some(id=>ids.has(id)))]};}

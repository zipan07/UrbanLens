import {boundsOf} from './geo.js';
export function mergeDistrict(data,manifest,extra){
 for(const key of ['boundary','buildings','land','water','roads','pois']){const seen=new Set(data[key].features.map(f=>f.properties.osm_id));data[key]={...data[key],metadata:{...data[key].metadata,scope:'南京玄武区与鼓楼区开放地图快照',districtSnapshots:[manifest.snapshotAt,extra.manifest.snapshotAt]},features:[...data[key].features,...extra.data[key].features.filter(f=>!seen.has(f.properties.osm_id))]};}
 const geometry={type:'MultiPolygon',coordinates:data.boundary.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates)};
 const districts=[{name:'玄武区',bbox:manifest.boundary.bbox,snapshotAt:manifest.snapshotAt},{name:'鼓楼区',bbox:extra.manifest.boundary.bbox,snapshotAt:extra.manifest.snapshotAt}];
 const heights=data.buildings.features.reduce((o,f)=>(o[f.properties.height_source]++,o),{osm:0,levels:0,unknown:0});
 return {geometry,manifest:{...manifest,title:'南京市 · 玄武区与鼓楼区',divisionCode:'320102 / 320106',districts,landmarks:[...manifest.landmarks,...extra.manifest.landmarks],boundary:{...manifest.boundary,bbox:boundsOf(geometry)},counts:Object.fromEntries(['buildings','land','water','roads','pois'].map(k=>[k,data[k].features.length])),heights,scopeNote:`玄武区 ${manifest.snapshotAt}；鼓楼区 ${extra.manifest.snapshotAt}。两区要素按 OSM ID 去重；保留与区界相交的完整对象，非普查、地籍或官方更新名单。`}};
}
export function mergeServices(current,extra){const ids=new Set(current.features.flatMap(f=>f.properties.related_osm_ids||[f.id]));return {...current,metadata:{...current.metadata,scope:'玄武区及周边、鼓楼区开放设施参考点',districtSnapshots:[current.metadata.snapshotAt,extra.metadata.snapshotAt]},features:[...current.features,...extra.features.filter(f=>!f.properties.related_osm_ids.some(id=>ids.has(id)))]};}
export function installDistrictChooser(map,manifest){
 const group=document.createElement('div');group.className='district-control';group.innerHTML='<label for="district-browse">浏览范围</label><select id="district-browse"><option value="0">玄武区</option><option value="1">鼓楼区</option><option value="all">两区全域</option></select>';
 document.querySelector('.map-workspace').append(group);
 group.querySelector('select').addEventListener('change',e=>{const b=e.target.value==='all'?manifest.boundary.bbox:manifest.districts[Number(e.target.value)].bbox;map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:45,pitch:map.fallback?0:map.getPitch(),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1000});});
}

import {centerOf,distanceMeters} from './geo.js';
import {projectedArea} from './value-domain.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:1});
const kinds={building:'建筑',road:'道路',rail:'轨道',waterway:'水系',research:'研究地块',imported:'导入地块',residential:'居住用地',commercial:'商业用地',industrial:'工业用地',green:'绿地',civic:'公共服务用地',other:'用地',water:'水体',education:'教育设施',health:'医疗设施',transport:'交通设施',nature:'自然空间',place:'地名',culture:'文化设施',service:'服务设施'};
const roads={motorway:'高速公路',trunk:'快速路 / 干道',primary:'主要道路',secondary:'次要道路',tertiary:'三级道路',residential:'居住区道路',service:'服务道路',unclassified:'未分级道路',pedestrian:'步行街',footway:'步道',path:'小径',cycleway:'自行车道',steps:'阶梯'};

export function geometryLength(g){const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];return lines.reduce((n,l)=>n+l.slice(1).reduce((s,c,i)=>s+distanceMeters(l[i],c),0),0);}
export function objectDetails(f,manifest={}){
 const p=f.properties||{},kind=kinds[p.category]||'空间对象',id=p.unit_id||p.parcel_id||p.osm_id||f.id||'未编号',c=centerOf(f.geometry),facts=[];
 facts.push(['所在行政区',p.district_name||'区界附近 / 待核对']);
 if(p.category==='building'){
  facts.push(['建筑高度',p.height_m==null?'未收录':number(p.height_m)+' m · '+(p.height_source==='levels'?'楼层推算':'OSM 标注')],['楼层',p.levels==null?'未收录':number(p.levels)+' 层']);
 }
 if(f.geometry.type.includes('Polygon')){const area=projectedArea(f.geometry);facts.push([p.category==='building'?'轮廓投影面积':'范围投影面积',area==null?'无法计算':number(area)+' m²']);}
 if(['road','rail','waterway'].includes(p.category)){
  const meters=geometryLength(f.geometry);facts.push(['本对象分段长度',meters>=1000?number(meters/1000)+' km':number(meters)+' m']);
  if(p.category==='road')facts.push(['道路类型',roads[p.highway]||p.highway||'未收录'],['车道数',p.lanes??'未收录'],['限速标注',p.maxspeed??'未收录'],['通行方向',p.oneway==='yes'?'单向':p.oneway==='-1'?'逆向单行':p.oneway==='no'?'双向':'未收录']);
  if(p.category==='rail')facts.push(['轨道类型',p.railway||'未收录']);
 }
 if(p.research_type)facts.push(['研究类型',p.research_type]);
 if(p.landuse||p.amenity)facts.push(['OSM 用途标签',p.landuse||p.amenity]);
 facts.push(['数据日期',p.category==='imported'&&!p.source_date?'本次会话':String(p.source_date||manifest.snapshotAt||'未收录').slice(0,10)],['资料来源',p.category==='imported'?'用户导入 / 未复核':'OpenStreetMap']);
 const note=p.category==='imported'?'用户本机导入范围，来源、拓扑、面积及权属均待核实。':p.category==='building'?'面积来自开放轮廓；缺失高度的12 m示意体量不作为事实。':f.geometry.type.includes('LineString')?'长度仅为选中 OSM 分段，非整条道路。缺失标签保留未知。':f.geometry.type.includes('Polygon')?'开放地图轮廓，不是登记宗地或法定更新边界；面积为投影计算参考。':'点位为开放地图参考位置，不保证入口和开放状态。';
 return {kind,id,name:p.name||'未命名'+kind,facts,note,coordinates:c.map(x=>x.toFixed(6)).join(', ')+' · WGS84',url:/^(way|relation|node)\/\d+$/.test(p.osm_id||'')?'https://www.openstreetmap.org/'+p.osm_id:null};
}

// Query each visible layer independently: renderer draw order must not let a
// research polygon hide a building or a road at the same screen location.
export function pickMapObjects(map,point,resolve){
 const layers=['building-3d','building-footprints','roads','tunnels','rail','waterways','research-fill','imported-fill','poi-dots','station-dots','land','water'];
 const hits=[],seen=new Set();
 for(const layer of layers){if(!map.getLayer(layer))continue;for(const hit of map.queryRenderedFeatures([[point.x-3,point.y-3],[point.x+3,point.y+3]],{layers:[layer]})){
  const f=resolve(hit,layer);if(!f)continue;const p=f.properties,key=p.unit_id?'research:'+p.unit_id:p.parcel_id?'imported:'+p.parcel_id:p.category+':'+p.osm_id;
  if(seen.has(key))continue;seen.add(key);hits.push(f);
 }}return hits;
}

export function installMapDetails({map,manifest,pick,highlight,inspect,focus,download,toast,isReady}){
 const canvas=map.getCanvas(),host=map.getContainer().parentElement,popup=document.createElement('section');
 popup.id='map-details';popup.className='map-details';popup.hidden=true;popup.setAttribute('role','dialog');popup.setAttribute('aria-label','地图对象详情');popup.setAttribute('aria-modal','false');host.append(popup);
 let objects=[],index=0,anchor=null,touch=null,longTimer=null,longFired=false,mouseDown=null;
 const close=()=>{popup.hidden=true;};
 function position(){if(popup.hidden||!anchor)return;const p=map.project(anchor),x=Array.isArray(p)?p[0]:p.x,y=Array.isArray(p)?p[1]:p.y,w=host.clientWidth,h=host.clientHeight;
  popup.style.maxHeight=Math.max(120,h-24)+'px';const pw=popup.offsetWidth,ph=popup.offsetHeight;
  const left=Math.max(12,Math.min(x+18,w-pw-12)),top=Math.max(12,Math.min(y-ph/2,h-ph-12));
  popup.style.left=left+'px';popup.style.top=top+'px';popup.style.transformOrigin=Math.max(0,Math.min(pw,x-left))+'px '+Math.max(0,Math.min(ph,y-top))+'px';
 }
 function render(){const f=objects[index],d=objectDetails(f,manifest);highlight(f);
  popup.innerHTML=`<div class="map-details-head"><span>${esc(d.kind)} <small>SPATIAL RECORD</small></span><button data-detail="close" aria-label="关闭地图详情">×</button></div><h2>${esc(d.name)}</h2><p class="map-details-id">${esc(d.id)}</p>${objects.length>1?`<label class="map-details-switch">此处有 ${objects.length} 个对象<select aria-label="切换此处地图对象">${objects.map((o,i)=>`<option value="${i}" ${i===index?'selected':''}>${esc(kinds[o.properties.category]||'空间对象')} · ${esc(o.properties.name||o.properties.osm_id||o.id)}</option>`).join('')}</select></label>`:''}<dl>${d.facts.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="map-details-note">${esc(d.note)}</p><p class="map-details-coordinates">${esc(d.coordinates)}</p><div class="map-details-actions"><button data-detail="inspect">完整档案 ↗</button><button data-detail="focus">定位</button><button data-detail="export">导出</button></div>${d.url?`<a href="${d.url}" target="_blank" rel="noopener" class="map-details-source">OpenStreetMap 原始对象 ↗</a>`:''}`;
  position();
 }
 function show(point,lngLat){if(!isReady())return;objects=pick(point);if(!objects.length){close();toast('此处没有可查询的空间对象，请放大后选中建筑、道路或用地轮廓。');return;}index=0;anchor=Array.isArray(lngLat)?lngLat:[lngLat.lng,lngLat.lat];popup.hidden=false;render();popup.querySelector('[data-detail="close"]').focus({preventScroll:true});}
 popup.addEventListener('click',e=>{const a=e.target.closest('[data-detail]')?.dataset.detail,f=objects[index];if(a==='close'){close();canvas.focus({preventScroll:true});}if(a==='inspect'){inspect(f);close();}if(a==='focus'){close();focus(f);}if(a==='export')download(f);});
 popup.addEventListener('change',e=>{if(e.target.matches('select')){index=Number(e.target.value);render();popup.querySelector('select')?.focus({preventScroll:true});}});
 const point=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 canvas.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();if(longFired||mouseDown?.moved)return;const p=point(e);show(p,map.unproject([p.x,p.y]));});
 canvas.addEventListener('pointerdown',e=>{if(e.button===2)mouseDown={x:e.clientX,y:e.clientY,moved:false};if(e.pointerType!=='touch')return;if(touch){clearTimeout(longTimer);touch=null;return;}touch={id:e.pointerId,x:e.clientX,y:e.clientY};longFired=false;longTimer=setTimeout(()=>{if(!touch)return;const p=point(e);longFired=true;show(p,map.unproject([p.x,p.y]));},600);},{passive:true});
 canvas.addEventListener('pointermove',e=>{if(mouseDown&&(e.buttons&2)&&Math.hypot(e.clientX-mouseDown.x,e.clientY-mouseDown.y)>5){mouseDown.moved=true;close();}if(touch?.id===e.pointerId&&Math.hypot(e.clientX-touch.x,e.clientY-touch.y)>8){clearTimeout(longTimer);touch=null;}},{passive:true});
 const end=()=>{clearTimeout(longTimer);touch=null;};window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
 canvas.addEventListener('click',e=>{if(longFired){e.stopImmediatePropagation();longFired=false;}},true);
 canvas.addEventListener('keydown',e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const p={x:canvas.clientWidth/2,y:canvas.clientHeight/2};show(p,map.unproject([p.x,p.y]));}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!popup.hidden){e.preventDefault();e.stopImmediatePropagation();close();canvas.focus({preventScroll:true});}},true);
 document.addEventListener('pointerdown',e=>{if(!popup.contains(e.target)&&e.target!==canvas)close();});
 map.on('move',position);window.addEventListener('resize',position);
 return {show,close,consumeLongPress:()=>{if(!longFired)return false;longFired=false;return true;}};
}

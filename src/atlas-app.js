import {installMapDetails,pickMapObjects} from './map-details.js';
import {installMapGestures} from './map-gestures.js';
import {installStudioShell} from './studio-shell.js';
import {packedBytes} from './packed-data.js';
import maplibregl from 'maplibre-gl';
import {makeStyle} from './atlas-style.js';
import {installLocalFonts} from './local-fonts.js';
import {CanvasAtlas} from './canvas-atlas.js';
import {ValueStudio} from './value-studio.js';
import {EMPTY,centerOf,boundsOf,distanceMeters,validateImport} from './geo.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n).toLocaleString('zh-CN');
const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const base=new URL('.',location.href).href;
const state={theme:'day',mode:'3d',terrain:true,schematic:true,layers:{},selected:null,imported:EMPTY(),measure:[],measuring:false,ready:false};
const labels={building:'建筑 / 建筑部件',green:'绿地',water:'水体',civic:'公共服务用地',commercial:'商业用地',residential:'居住用地',industrial:'工业等用地',other:'开放地图用地',road:'道路',rail:'轨道',waterway:'水系',education:'教育设施',health:'医疗设施',transport:'交通设施',culture:'文化与游览',nature:'自然空间',place:'地名',service:'服务设施',boundary:'行政边界',imported:'研究范围 / 未复核'};
let map,manifest,data,studio,shellUI,detailsUI,objects=[],byId=new Map(),toastTimer,loadTimer;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
function openPanel(open=true){$('#inspector').classList.toggle('is-open',open);$('#mobile-panel').setAttribute('aria-expanded',String(open));if(document.body.classList.contains('is-presenting')){document.body.classList.toggle('present-panel',open);$('#presentation-panel').setAttribute('aria-pressed',String(open));requestAnimationFrame(()=>map?.resize?.());}}
function tab(name,open=true){if(!['value','overview','object','data'].includes(name))return;for(const t of ['value','overview','object','data']){$(`#panel-${t}`).hidden=t!==name;$(`#tab-${t}`).setAttribute('aria-selected',String(t===name));}$$('.rail-link[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));if(open)openPanel();$('.inspector-scroll').scrollTop=0;}
function fail(message){clearTimeout(loadTimer);$('#map-loading').hidden=true;$('#map-failure').hidden=false;$('#map-error').textContent=message;$('#load-status').textContent='地图未就绪 · 资料目录仍可查看';}
async function json(path){if(path==='data/services.geojson')return JSON.parse(new TextDecoder().decode(await packedBytes('services')));const r=await fetch(`${base}${path}?v=6`,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`数据文件加载失败（${r.status}）：${path}`);return r.json();}
function sourceData(id,geo){map?.getSource(id)?.setData(geo);}
function ready(action){if(!state.ready){toast('地图仍在加载，请稍后操作。');return;}action();}
function updateCamera(){if(!map)return;const c=map.getCenter(),p=Math.round(map.getPitch());$('#camera-status').textContent=`${p>1?'3D':'2D'} · ${c.lng.toFixed(4)}° E / ${c.lat.toFixed(4)}° N`;$('#pitch-value').value=`${p}°`;$('#pitch').value=p;$('#compass').style.transform=`rotate(${-map.getBearing()}deg)`;$('.map-title').style.opacity=map.getZoom()>15.5?'.25':'1';state.mode=p>1?'3d':'2d';$$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));}
function refreshStateSources(){sourceData('selected',state.selected?{type:'FeatureCollection',features:[state.selected]}:EMPTY());sourceData('imported',state.imported);updateMeasure();studio?.mapLayers();}
function applyStyle(){if(!map||!data)return;detailsUI?.close();state.ready=false;$('#export-map').disabled=true;map.setStyle(makeStyle(data,state,base),{diff:false});map.once('style.load',()=>{refreshStateSources();state.ready=true;$('#export-map').disabled=false;updateCamera();});}
function focusFeature(f){if(!map||!state.ready)return;const c=centerOf(f.geometry),b=boundsOf(f.geometry),span=Math.max(b[2]-b[0],b[3]-b[1]);const zoom=span>.025?13.8:span>.009?14.7:span>.003?15.7:17.1;map.flyTo({center:c,zoom,pitch:state.mode==='3d'?55:0,bearing:map.getBearing(),duration:reduced?0:1500,essential:false});}
function select(f,{fly=false}={}){
 state.selected=f;sourceData('selected',{type:'FeatureCollection',features:[f]});renderObject(f);tab('object');if(fly)focusFeature(f);
 $('#search-results').hidden=true;
}
function renderObject(f){
 const p=f.properties,c=centerOf(f.geometry),kind=labels[p.category]||'空间对象',height=p.height_source==='osm'?`${p.height_m} m · OSM 标注`:p.height_source==='levels'?`${p.height_m} m · 楼层 × 3 m 推算`:p.category==='building'?'未收录真实高度':'不适用';
 const facts=[['对象类型',kind],['坐标参考','WGS84 / EPSG:4326'],['定位参考点',`${c[0].toFixed(6)} E<br>${c[1].toFixed(6)} N`],...(p.category==='building'?[['高度记录',height],['楼层记录',p.levels?`${p.levels} 层 · OSM`:'未收录']]:[]),['资料来源',p.category==='imported'?'用户本机导入':'OpenStreetMap'],['快照日期',p.category==='imported'?'本次会话':manifest.snapshotAt.slice(0,10)]];
 const note=p.category==='building'?p.height_source==='unknown'?'该对象没有高度记录。开启示意体量时仅用 12 m 表达空间位置，关闭后保留真实轮廓。':'高度来自开放地图标注或楼层推算，未经专业测绘核验，不能用于容积率或安全判断。':p.category==='imported'?'仅完成格式、编号和坐标范围预检；拓扑、来源授权、面积、权属及规划条件尚待核实。':'对象位置与标签来自开放地图。面状对象的定位参考点取包围盒中心，可能不在实际入口或面内。';
 $('#panel-object').innerHTML=`<div class="object-header"><span class="object-kind">${esc(kind)} / SPATIAL RECORD</span><h2>${esc(p.name||'未命名'+kind)}</h2><span class="object-id">${esc(p.osm_id||p.parcel_id||f.id)}</span><button id="locate-selected" class="outline-button object-locate">${icon('focus')} 定位此处</button></div><dl class="object-facts">${facts.map(([k,v])=>`<div><dt>${k}</dt><dd>${k==='定位参考点'?v:esc(v)}</dd></div>`).join('')}</dl><div class="object-note"><strong>数据说明</strong>${esc(note)}</div>${p.osm_id?`<a class="object-link" href="https://www.openstreetmap.org/${esc(p.osm_id)}" target="_blank" rel="noopener"><span>打开 OSM 原始对象</span>↗</a>`:''}<details class="object-tags"><summary>查看原始标签与渲染字段</summary><dl>${Object.entries(p).filter(([k])=>k!=='label').map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v??'未收录')}</dd>`).join('')}</dl></details><div class="object-actions"><button id="download-object" class="outline-button">导出对象 GeoJSON</button><button data-tab="data" class="outline-button">数据覆盖情况</button></div><div class="quality-note">未接入真实宗地及调查台账；此对象不自动视为更新地块，不生成真实更新评分。</div>`;
}
function renderCatalog(){const m=manifest,c=m.counts,h=m.heights,total=c.buildings;
 $('#district-stats').innerHTML=[['建筑与部件',c.buildings,'个'],['道路 / 轨道 / 水系线',c.roads,'段'],['具名设施与地名',c.pois,'处'],['用地与绿地面',c.land,'个']].map(([name,num,unit])=>`<div><strong>${fmt(num)}</strong><small>${unit}</small><span>${name}</span></div>`).join('');
 const en=['LAKE & ISLANDS','CAMPUS & CITY','HISTORY & MEMORY','TEMPLE & CITY WALL','ART & CULTURE','MOUNTAIN & HERITAGE','HERITAGE & LANDSCAPE','RAILWAY GATEWAY'];
 $('#landmarks').innerHTML=m.landmarks.map((p,i)=>`<button class="landmark" data-place="${esc(p.id)}"><span class="place-glyph">${String(i+1).padStart(2,'0')}</span><span><strong>${esc(p.name.replace('东南大学(四牌楼校区)','东南大学 · 四牌楼').replace('南京站（南站房）','南京站'))}</strong><small>${en[i]}</small></span>${icon('arrow')}</button>`).join('');
 const rows=[['boundary','行政区边界',1,'OSM relation / 320102','#5e7d5c'],['buildings','地上建筑与建筑部件',c.buildings,'轮廓、标签、可用高度','#c5ae82'],['roads','道路、轨道与线状水系',c.roads,'路网分段；含相交区界对象','#c2b5a0'],['land','用地与绿地',c.land,'开放地图分类，非法定用地性质','#adc297'],['water','湖泊与水体',c.water,'面状水体及岸线','#8fbac5'],['pois','具名设施与地名',c.pois,'标签转为点位；非完整设施普查','#b7a2c3']];
 const coverage=[['OSM 高度标注',h.osm,'#c5ae82'],['楼层 × 3 m 推算',h.levels,'#97bfc6'],['高度缺失',h.unknown,'#d9d4c9']];
 $('#catalog').innerHTML=`<div class="catalog-header"><div class="section-eyebrow">EVIDENCE BEFORE INSIGHT</div><h2>每一层，都有来处。</h2><p>真实开放数据作为空间参考，业务结论建立在经过核实的项目台账之上。</p></div><div class="catalog-meta">数据快照 ${esc(m.snapshotAt)}<br>坐标 ${m.coordinateSystem}<br>许可 ODbL 1.0 · © OpenStreetMap contributors<br>${esc(m.scopeNote)}</div>${rows.map(([file,name,count,desc,color])=>`<div class="catalog-row"><i style="--c:${color}"></i><span>${name}<small>${desc}</small></span><b>${fmt(count)}</b><a href="./data/${file}.geojson" download="UrbanLens-Xuanwu-${file}.geojson" aria-label="下载${name}" title="下载 GeoJSON">↓</a></div>`).join('')}<div class="catalog-row"><i style="--c:#92a777"></i><span>地形高程<small>Mapzen / USGS / NOAA · 12 张区域 DEM 瓦片<br>真实地形网格，非测绘级；原始采集年份不一</small></span><a href="./data/terrain/metadata.json" download aria-label="下载地形元数据">↓</a></div><div class="height-coverage"><h3>建筑高度覆盖情况</h3><div class="coverage-bar" aria-hidden="true">${coverage.map(([,n,c])=>`<i style="width:${n/total*100}%;--c:${c}"></i>`).join('')}</div><div class="coverage-labels">${coverage.map(([name,n])=>`<div><span>${name}</span><b>${fmt(n)} · ${(n/total*100).toFixed(1)}%</b></div>`).join('')}</div><p class="quality-note">${esc(m.heightNote)}</p></div><div class="missing-data"><h3>真实评估仍需补齐</h3><ul>${m.missing.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><a class="object-link" href="./data/manifest.json" download>下载数据清单与来源记录 <span>↓</span></a>`;
}
function miniMap(){const g=data.boundary.features[0].geometry,b=boundsOf(g),cos=Math.cos((b[1]+b[3])/2*Math.PI/180),scale=Math.min(245/((b[2]-b[0])*cos),102/(b[3]-b[1])),project=([x,y])=>[142+(x-(b[0]+b[2])/2)*cos*scale,61-(y-(b[1]+b[3])/2)*scale];
 const path=geo=>{const ps=geo.type==='Polygon'?[geo.coordinates]:geo.type==='MultiPolygon'?geo.coordinates:[];return ps.map(p=>p.map(r=>r.map((c,i)=>`${i?'L':'M'}${project(c).map(x=>x.toFixed(1)).join(',')}`).join('')+'Z').join('')).join('');};
 $('#district-mini').innerHTML=`<svg viewBox="0 0 285 125" aria-hidden="true"><defs><pattern id="mini-grid" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M18 0H0V18" fill="none" stroke="#e8ecdf" stroke-width=".6"/></pattern><clipPath id="mini-boundary"><path d="${path(g)}"/></clipPath></defs><rect width="285" height="125" fill="url(#mini-grid)"/><path d="${path(g)}" fill="#dce6cb" stroke="#94ac80" stroke-width=".8"/><g clip-path="url(#mini-boundary)">${data.water.features.map(f=>`<path d="${path(f.geometry)}" fill="#a2c4bd"/>`).join('')}</g><path d="${path(g)}" fill="none" stroke="#94ac80" stroke-width=".7"/></svg>`;
}
function search(){const q=$('#place-search').value.trim().toLowerCase();$('#clear-search').hidden=!q;$('#search-results').hidden=!q;if(!q)return;
 const found=objects.filter(f=>(f.properties.name||'').toLowerCase().includes(q)||(f.properties.osm_id||'').includes(q));
 const unique=[...new Map(found.map(f=>[`${f.properties.name}|${f.properties.category}`,f])).values()].slice(0,18);
 $('#search-results').innerHTML=unique.length?unique.map(f=>`<button data-feature="${esc(f.properties.osm_id)}"><i>⌖</i><span>${esc(f.properties.name)}<small>${esc(labels[f.properties.category]||'空间对象')} · ${esc(f.properties.osm_id)}</small></span>↗</button>`).join(''):'<p>本次快照中没有匹配结果。可尝试“玄武湖”“东南大学”“中山路”；未收录不代表不存在。</p>';
}
function updateMeasure(){const points=state.measure,features=points.map((c,i)=>({type:'Feature',properties:{index:i},geometry:{type:'Point',coordinates:c}}));if(points.length>1)features.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:points}});sourceData('measure',{type:'FeatureCollection',features});const meters=points.slice(1).reduce((s,p,i)=>s+distanceMeters(points[i],p),0);$('#measure-value').textContent=points.length?`${meters>=1000?(meters/1000).toFixed(2)+' km':meters.toFixed(0)+' m'} · ${points.length} 个点`:'点击地图开始测距';}
function download(name,content,type='application/geo+json'){const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function exportMap(){if(!state.ready||!map)return;$('#export-map').disabled=true;try{
 await new Promise(resolve=>{map.once('render',resolve);map.triggerRepaint();});
 const original=map.getCanvas(),canvas=document.createElement('canvas'),ratio=original.width/map.getContainer().clientWidth,width=original.width/ratio;
 const captions=['UrbanLens · 南京市玄武区 / '+(state.mode==='3d'?'3D 空间视图':'2D 空间视图'),`OSM 快照 ${manifest.snapshotAt}`,`高度：OSM 标注 / 楼层推算 / ${state.schematic?'12m 缺失示意':'缺失不拉伸'}`,'© OpenStreetMap contributors · ODbL | Terrain: Mapzen / USGS / NOAA','非测绘及法定规划成果','制作者：东南大学建筑学院 蔡子攀'];
 const ctx=canvas.getContext('2d');ctx.font='12px sans-serif';const lines=[];
 for(const text of captions){let line='';for(const char of text){if(ctx.measureText(line+char).width>width-40&&line){lines.push(line);line='';}line+=char;}if(line)lines.push(line);}
 canvas.width=original.width;canvas.height=original.height+Math.ceil((lines.length*19+30)*ratio);ctx.drawImage(original,0,0);ctx.scale(ratio,ratio);ctx.fillStyle='#f8faf1';ctx.fillRect(0,original.height/ratio,width,canvas.height/ratio);ctx.fillStyle='#29483e';ctx.font='12px sans-serif';lines.forEach((line,i)=>ctx.fillText(line,20,original.height/ratio+23+i*19));
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('生成图片失败');download('UrbanLens-Xuanwu-'+state.mode+'.png',blob);toast('地图已导出，包含数据说明与制作者署名。');
 }catch(e){toast('导出失败，请待地图加载完成后重试。');console.error(e);}finally{$('#export-map').disabled=!state.ready;}}
async function start(){loadTimer=setTimeout(()=>fail('数据加载较慢。请检查网络后重试；已取得的数据可在资料目录中查看。'),45000);
 try{
  manifest=await json('data/manifest.json');renderCatalog();
  const keys=['boundary','land','water','roads','buildings','pois'];const loaded=await Promise.all(keys.map(k=>json(`data/${k}.geojson`)));data=Object.fromEntries(keys.map((k,i)=>[k,loaded[i]]));
  objects=[...data.buildings.features,...data.pois.features,...data.land.features,...data.water.features,...data.roads.features];byId=new Map(objects.slice().reverse().map(f=>[f.properties.osm_id,f]));miniMap();$('#place-search').disabled=false;
  installLocalFonts(maplibregl);maplibregl.setWorkerCount(2);
  try{map=new maplibregl.Map({container:'map',style:makeStyle(data,state,base),center:[118.814,32.057],zoom:14.2,pitch:52,bearing:-22,minZoom:10.5,maxZoom:19,maxPitch:70,maxBounds:[[118.60,31.90],[119.08,32.25]],renderWorldCopies:false,attributionControl:false,localIdeographFontFamily:'-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',canvasContextAttributes:{antialias:true,preserveDrawingBuffer:true},fadeDuration:150});}
  catch(renderError){console.warn('WebGL unavailable; using geographic Canvas 2D.',renderError.message);state.mode='2d';state.terrain=false;$('#terrain-toggle').checked=false;$('#terrain-toggle').disabled=true;$('#pitch').disabled=true;const button=$('[data-mode="3d"]');button.disabled=true;button.title='当前浏览器未启用图形加速，已使用真实地图的 2D 兼容模式。';map=new CanvasAtlas({container:'map',style:makeStyle(data,state,base),center:[118.811,32.059],zoom:13.4,bounds:manifest.boundary.bbox,minZoom:10.5});$('.interaction-help').textContent='2D 兼容 · 右键详情 · 中键旋转 · Mac ⌥ 滑动';}
  map.touchZoomRotate.enable();map.touchPitch.enable();installMapGestures(map,{onInteraction:()=>shellUI?.stopOrbit()});shellUI=installStudioShell({map,manifest,studio:()=>studio,toast,tab,openPanel});map.addControl(new maplibregl.ScaleControl({maxWidth:80,unit:'metric'}),'bottom-left');
  map.on('load',()=>{clearTimeout(loadTimer);state.ready=true;$('#map-loading').hidden=true;$('#map-failure').hidden=true;$('#export-map').disabled=false;$('#load-status').textContent=`${map.fallback?'2D 兼容模式 · ':''}OSM ${manifest.snapshotAt.slice(0,10)} · ${fmt(manifest.counts.buildings)} 个建筑与部件`;map.getCanvas().setAttribute('aria-label','玄武区地图。单击选中，右键或长按查看详情。方向键平移，加减键缩放。');updateCamera();studio?.mapLayers();});
  Promise.all([json('data/services.geojson'),json('data/research-units.geojson'),json('data/value-evidence.json')]).then(([services,units,evidence])=>{
   studio=new ValueStudio({data,services,units,evidence,adapter:{tab,openPanel,toast,download,focus:focusFeature,layers:items=>{for(const [id,geo]of Object.entries(items))sourceData(id,geo);}}});$('#study-hud').hidden=false;
  }).catch(e=>{$('#panel-value').innerHTML='<div class="empty-state"><h2>研究资料暂未载入</h2><p>请刷新重试；地图与原始资料仍可使用。</p></div>';console.error(e);});
  map.on('move',updateCamera);
  map.on('pitchend',()=>{if(!state.ready)return;map.setPaintProperty('building-3d','fill-extrusion-height',state.mode==='2d'?0:state.schematic?['get','render_height']:['coalesce',['get','height_m'],0]);map.setPaintProperty('building-3d','fill-extrusion-base',state.mode==='2d'?0:['get','render_base']);if(state.terrain)map.setTerrain(state.mode==='3d'?{source:'dem',exaggeration:1}:null);});
  map.on('error',e=>{console.warn('Atlas map:',e.error?.message||e.error);if(e.sourceId==='dem'||e.sourceId==='hillshade'){if(state.terrain){state.terrain=false;$('#terrain-toggle').checked=false;map.setTerrain(null);toast('地形数据暂不可用，已保留平面底图与建筑。');}}});
  map.on('webglcontextlost',()=>{state.ready=false;$('#export-map').disabled=true;fail('图形渲染中断，请重新载入地图；数据文件与对象档案仍可查看。');});
  const layerSources={'building-3d':'buildings','building-footprints':'buildings',roads:'roads',tunnels:'roads',rail:'roads',waterways:'roads','poi-dots':'pois','station-dots':'pois',land:'land',water:'water'},indexes=Object.fromEntries(Object.keys(data).map(k=>[k,new Map(data[k].features.map(f=>[f.properties.osm_id,f]))]));
  const resolveHit=(hit,layer)=>layer==='research-fill'?studio?.units.find(f=>f.id===hit.properties.unit_id):layer==='imported-fill'?state.imported.features.find(f=>f.properties.parcel_id===hit.properties.parcel_id):indexes[layerSources[layer]]?.get(hit.properties.osm_id);
  const pick=point=>pickMapObjects(map,point,resolveHit);
  detailsUI=installMapDetails({map,manifest,pick,isReady:()=>state.ready&&!state.measuring,toast,
   highlight:f=>{state.selected=f;renderObject(f);sourceData('selected',{type:'FeatureCollection',features:[f]});},
   inspect:f=>f.properties.unit_id&&studio?studio.select(f.properties.unit_id,{fly:false}):select(f),focus:focusFeature,
   download:f=>download('UrbanLens-Nanjing-object.geojson',JSON.stringify({...f,metadata:{snapshotAt:manifest.snapshotAt,attribution:manifest.attribution,license:manifest.license}},null,2))});
  map.on('click',e=>{if(!state.ready||detailsUI.consumeLongPress())return;detailsUI.close();if(state.measuring){state.measure.push([e.lngLat.lng,e.lngLat.lat]);updateMeasure();return;}
   const hits=pick(e.point),f=hits[0];if(f){if(f.properties.unit_id&&studio)studio.select(f.properties.unit_id,{fly:false});else select(f);}
  });
  map.on('mousemove',e=>{if(!state.ready)return;const hit=map.queryRenderedFeatures(e.point,{layers:['research-fill','building-3d','poi-dots','station-dots','imported-fill']})[0],label=$('#map-hover-label');map.getCanvas().style.cursor=state.measuring?'crosshair':hit?'pointer':'';const name=hit?.properties.name;label.hidden=!name||state.measuring;if(name&&!state.measuring){label.textContent=name;label.style.left=Math.max(8,Math.min(e.point.x+16,map.getContainer().clientWidth-228))+'px';label.style.top=Math.max(10,e.point.y-43)+'px';}});
  map.getCanvas().addEventListener('pointerleave',()=>$('#map-hover-label').hidden=true);
 }catch(e){console.error(e);fail(e.name==='TimeoutError'?'网络响应超时，请重新载入地图。':e.message?.startsWith('数据文件')?e.message:'地图暂时无法启动。请刷新页面或使用支持 WebGL 的浏览器；数据目录仍可查看。');}
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.tab)tab(b.dataset.tab);
 if(b.dataset.place){const f=byId.get(b.dataset.place);if(f)select(f,{fly:true});else toast('该对象尚在加载。');}
 if(b.dataset.feature){const f=byId.get(b.dataset.feature);if(f)select(f,{fly:true});}
 if(b.dataset.mode)ready(()=>{state.mode=b.dataset.mode;map.easeTo({pitch:state.mode==='2d'?0:55,bearing:map.getBearing(),duration:reduced?0:800});});
 if(b.dataset.theme)ready(()=>{state.theme=b.dataset.theme;document.body.classList.toggle('night',state.theme==='night');$$('[data-theme]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});applyStyle();});
 if(b.id==='locate-selected'&&state.selected)ready(()=>{focusFeature(state.selected);if(innerWidth<=720)openPanel(false);});
 if(b.id==='download-object'&&state.selected)download('UrbanLens-Xuanwu-object.geojson',JSON.stringify({...state.selected,metadata:{snapshotAt:manifest.snapshotAt,attribution:manifest.attribution,license:manifest.license,creator:manifest.creator}},null,2));
});
$('#place-search').addEventListener('input',search);$('#place-search').addEventListener('keydown',e=>{if(e.key==='Escape')$('#search-results').hidden=true;if(e.key==='Enter')$('#search-results button')?.click();});
$('#clear-search').onclick=()=>{$('#place-search').value='';search();$('#place-search').focus();};
$('#layers-toggle').onclick=()=>{const open=$('#layers-popover').hidden;$('#layers-popover').hidden=!open;$('#layers-toggle').setAttribute('aria-expanded',String(open));};
$$('[data-layer]').forEach(input=>input.addEventListener('change',()=>{state.layers[input.dataset.layer]=input.checked;if(state.ready)applyStyle();}));
$('#terrain-toggle').onchange=e=>{state.terrain=e.target.checked;if(state.ready)map.setTerrain(state.terrain&&state.mode==='3d'?{source:'dem',exaggeration:1}:null);};
$('#schematic-toggle').onchange=e=>{state.schematic=e.target.checked;if(state.ready)map.setPaintProperty('building-3d','fill-extrusion-height',state.mode==='2d'?0:state.schematic?['get','render_height']:['coalesce',['get','height_m'],0]);};
$('#pitch').oninput=e=>ready(()=>map.setPitch(Number(e.target.value)));
$('#north').onclick=()=>ready(()=>map.easeTo({bearing:0,duration:reduced?0:600}));$('#zoom-in').onclick=()=>ready(()=>map.zoomIn());$('#zoom-out').onclick=()=>ready(()=>map.zoomOut());
$('#overview').onclick=()=>ready(()=>{const b=manifest.boundary.bbox;map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:{top:80,bottom:70,left:30,right:30},pitch:0,bearing:0,duration:reduced?0:1300});});
$('#measure').onclick=()=>ready(()=>{state.measuring=!state.measuring;$('#measure').setAttribute('aria-pressed',String(state.measuring));$('#measurement').hidden=!state.measuring;map.getCanvas().style.cursor=state.measuring?'crosshair':'';if(state.measuring)map.doubleClickZoom.disable();else map.doubleClickZoom.enable();});
$('#clear-measure').onclick=()=>{state.measure=[];updateMeasure();};
$('#about').onclick=()=>$('#about-dialog').showModal();$('#close-about').onclick=()=>$('#about-dialog').close();$('#retry').onclick=()=>location.reload();$('#export-map').onclick=exportMap;
$('#mobile-panel').onclick=()=>openPanel(!$('#inspector').classList.contains('is-open'));$('#close-panel').onclick=()=>openPanel(false);
$('#geo-import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(!data)throw new Error('请先等待城区数据载入。');if(file.size>20*1024*1024)throw new Error('文件超过20 MB。');const incoming=validateImport(JSON.parse(await file.text()),data.boundary.features[0].geometry);studio?.addImported(incoming);state.imported=incoming;sourceData('imported',incoming);$('#import-status').textContent=`已载入 ${incoming.features.length} 条研究范围，仅格式与坐标预检通过。拓扑和权属待核实；已接入研究画像，可关联CSV台账。刷新后范围清除。`;$('#remove-import').hidden=false;select(incoming.features[0],{fly:true});if(studio)tab('value');toast('研究范围已载入本机预览，未上传。');}catch(err){$('#import-status').textContent=`导入失败：${err.message} 原有范围保留。`;}finally{e.target.value='';}};
$('#remove-import').onclick=()=>{studio?.removeImported();state.imported=EMPTY();sourceData('imported',state.imported);if(state.selected?.properties.category==='imported'){state.selected=null;sourceData('selected',EMPTY());$('#panel-object').innerHTML='<div class="object-empty"><h2>研究范围已移除</h2><p>点击地图查看其他空间对象。</p></div>';}$('#remove-import').hidden=true;$('#import-status').textContent='已移除本次导入。可载入新的研究范围。';};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#layers-popover').hidden=true;$('#layers-toggle').setAttribute('aria-expanded','false');$('#search-results').hidden=true;openPanel(false);}});
$$('.inspector-tabs [role=tab]').forEach((b,i)=>b.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=$$('.inspector-tabs [role=tab]')[(i+(e.key==='ArrowRight'?1:3))%4];next.click();next.focus();}}));
start();

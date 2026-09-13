// Visual estimates stay separate from recorded height_m and assessment inputs.
export const BUILDING_APPEARANCE_VERSION='BUILDING-VISUAL-01';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const positive=n=>n!==null&&n!==undefined&&String(n).trim()!==''&&Number.isFinite(Number(n))&&Number(n)>0;
export function buildingHash(value){let h=2166136261;for(const c of String(value)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function buildingBounds(g){const c=[];const visit=a=>typeof a?.[0]==='number'?c.push(a):Array.isArray(a)&&a.forEach(visit);visit(g?.coordinates);return c.length?c.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]):null;}
function geometryFacts(g){const bounds=buildingBounds(g);if(!bounds)return {bounds:null,center:[118.8,32.05],area:0};const center=[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2],sx=111195*Math.cos(center[1]*Math.PI/180),sy=111195;
 const ringArea=r=>Math.abs(r.slice(1).reduce((sum,p,i)=>sum+(r[i][0]-center[0])*(p[1]-center[1])-(p[0]-center[0])*(r[i][1]-center[1]),0)*sx*sy/2);
 const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
 return {bounds,center,area:polygons.reduce((s,p)=>s+Math.max(0,ringArea(p[0])-p.slice(1).reduce((a,r)=>a+ringArea(r),0)),0)};
}
function recordedHeight(p){if(positive(p.height_m)&&Number(p.height_m)<=700&&p.height_source!=='unknown')return {height:Number(p.height_m),source:p.height_source==='levels'?'levels':'osm'};
 const m=String(p.height??'').trim().match(/^(\d+(?:\.\d+)?)\s*(m|米|ft|feet|')?$/i),height=m?Number(m[1])*(/ft|feet|'/i.test(m[2]||'')?.3048:1):null;
 if(height>0&&height<=700)return {height,source:'osm'};const raw=p['building:levels']??p.levels;return positive(raw)&&Number(raw)<=150?{height:Number(raw)*3,source:'levels'}:null;
}
function kindOf(p,area){const type=String(p.building||p['building:part']||''),name=String(p.name||'');
 if(p.historic||/大礼堂|旧址|寺|祠|明孝陵|亭|gatehouse|pavilion/.test(name+' '+type))return 'heritage';
 if(/train_station|transportation/.test(type))return 'station';
 if(/office|commercial|retail|hotel/.test(type)||/大厦|饭店|广场|金融/.test(name))return 'commercial';
 if(/industrial|warehouse|greenhouse|roof|shed|garage/.test(type))return 'industrial';
 if(/university|school|college|hospital|public|hall/.test(type)||/library|arts_centre|museum|school|university|hospital/.test(String(p.amenity||p.tourism||'')))return 'civic';
 if(/apartments|residential|dormitory/.test(type))return 'residential';
 if(/house|hut/.test(type)||area<110)return 'lowrise';
 return area>3000?'civic':'mixed';
}
const palettes={residential:['#d6cbbc','#c3cbd0','#d4d7cc','#c9b9ab'],lowrise:['#d8c7b0','#c8b8a5','#d3cdbd'],civic:['#d5d7ce','#c6d0d2','#d9d0bd'],commercial:['#a5bbc4','#b8c7c9','#b8b6b5','#c8cccb'],industrial:['#b7c4c8','#c1c4bd','#aaaeb4'],heritage:['#d8c8ae','#c7b69c','#d8d1ba'],station:['#bbcbd0','#cbd3d2'],mixed:['#cdcac2','#c0c8c6','#cbbfb1','#c4c9ce']};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const mix=(hex,target,ratio)=>'#'+rgb(hex).map((c,i)=>Math.round(c*(1-ratio)+rgb(target)[i]*ratio).toString(16).padStart(2,'0')).join('');
const landmarks=[
 {match:'东南大学大礼堂',height:25,roof:'dome',roofColor:'#62877c',color:'#d7cdb7',facade:'classical'},
 {match:'南京图书馆',height:30,roof:'flat',roofColor:'#9eaeb1',color:'#d6d5c7',facade:'curtain'},
 {match:'南京站',height:28,roof:'flat',roofColor:'#a4b7bd',color:'#c6d0cd',facade:'curtain'},
 {match:'江苏省美术馆',height:24,roof:'flat',roofColor:'#a6aeb0',color:'#d4d1c5',facade:'stone'},
 {match:'孟芳图书馆',height:14,roof:'gabled',roofColor:'#71847c',color:'#d6c6ad',facade:'classical'},
 {match:'明孝陵博物馆',height:12,roof:'gabled',roofColor:'#626c69',color:'#d7d1c1',facade:'classical'}
];
export function estimateBuildingAppearance(feature,{nearbyHeights=[]}={}){const p=feature.properties||{},facts=geometryFacts(feature.geometry),kind=kindOf(p,facts.area),key=p.osm_id||feature.id||JSON.stringify(feature.geometry),seed=buildingHash(key),block=buildingHash(`${Math.floor(facts.center[0]*370)}:${Math.floor(facts.center[1]*444)}:${kind}`),known=recordedHeight(p),landmark=landmarks.find(x=>String(p.name||'').includes(x.match));
 const floorM=kind==='industrial'?4.8:kind==='civic'||kind==='station'?4:3.1;
 const ranges={lowrise:[1,3],heritage:[2,4],station:[4,7],industrial:[1,3],civic:[3,7],commercial:[7,22],residential:facts.area>750?[8,20]:[5,12],mixed:facts.area<300?[3,6]:[5,11]},[min,max]=ranges[kind];
 let floors=clamp(min+block%(max-min+1)+(seed%3-1),min,max),height=floors*floorM,method='建筑类别、轮廓面积与约 250m 街区规则推算';
 const nearby=nearbyHeights.filter(n=>Number.isFinite(n)&&n>0&&n<200).sort((a,b)=>a-b);
 if(nearby.length>=3&&!landmark){const median=nearby[Math.floor(nearby.length/2)];height=clamp(.65*height+.35*median,min*floorM,max*floorM);method+='，结合附近已标注建筑高度';}
 if(landmark&&!known){height=landmark.height;method='地标展示体量假设；未经实测复核';}
 height=known?.height??Math.round(height*10)/10;floors=positive(p['building:levels']??p.levels)?Number(p['building:levels']??p.levels):Math.max(1,Math.round(height/floorM));
 const palette=palettes[kind],wall=landmark?.color||palette[seed%palette.length],explicitRoof=String(p['roof:shape']||''),roof=explicitRoof==='flat'?'flat':['gabled','hipped','half-hipped','pyramidal'].includes(explicitRoof)?'gabled':explicitRoof==='dome'?'dome':landmark?.roof||(['lowrise','heritage'].includes(kind)||kind==='residential'&&height<26&&seed%3!==0?'gabled':'flat');
 const roofColors=['#8d7568','#747d7e','#758a83','#a48b75'];let roofColor=landmark?.roofColor||roofColors[seed%roofColors.length];if(/^#[0-9a-f]{6}$/i.test(p['roof:colour']||''))roofColor=p['roof:colour'];else if(/green|绿/i.test(p['roof:colour']||''))roofColor='#6f8b7d';
 return {render_height:height,render_height_source:known?.source||'estimated',render_base:clamp(Number(p.render_base)||0,0,height),height_estimate_method:known?'':method,appearance_version:BUILDING_APPEARANCE_VERSION,appearance_kind:kind,appearance_day:wall,appearance_night:mix(wall,'#284257',.55),appearance_ink:mix(wall,'#ddd8c8',.6),roof_form:roof,roof_source:explicitRoof?'OSM 标签':'程序化示意',roof_color:roofColor,facade_kind:landmark?.facade||(kind==='commercial'||kind==='station'?'curtain':kind==='heritage'?'classical':kind==='industrial'?'industrial':'windows'),facade_source:'程序化材质示意；非实景贴图',visual_landmark:landmark?.match||'',render_floors:floors};
}
export function prepareBuildingAppearance(collection){const entries=(collection.features||[]).map(f=>({f,facts:geometryFacts(f.geometry),known:recordedHeight(f.properties||{})})),grid=new Map();
 for(const e of entries){if(!e.known)continue;const key=`${Math.floor(e.facts.center[0]*220)},${Math.floor(e.facts.center[1]*260)}`,list=grid.get(key)||[];list.push(e);grid.set(key,list);}
 return {...collection,metadata:{...collection.metadata,visualHeightVersion:BUILDING_APPEARANCE_VERSION,visualHeightNote:'原始 height_m / height_source 保留；render_height 缺失值按建筑类别、轮廓与邻近高度确定性推算，仅用于地图展示。'},features:entries.map(({f,facts})=>{const x=Math.floor(facts.center[0]*220),y=Math.floor(facts.center[1]*260),nearby=[];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const e of grid.get(`${x+dx},${y+dy}`)||[]){const distance=Math.hypot((e.facts.center[0]-facts.center[0])*94000,(e.facts.center[1]-facts.center[1])*111195);if(distance<=450&&e.f!==f)nearby.push(e.known.height);}return {...f,properties:{...f.properties,...estimateBuildingAppearance(f,{nearbyHeights:nearby})}};})};
}

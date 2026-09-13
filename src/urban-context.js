import earcut from 'earcut';

export const URBAN_CONTEXT_VERSION='URBAN-CONTEXT-01';
export const HOUSING_FIELDS=['id','name','lng','lat','kind','basis','price','area_m2','source','url','date'];
const AS_OF='2026-09-13',RAD=Math.PI/180,R=6371008.8,COS=Math.cos(32.05*RAD),CACHE=new WeakMap();
const finite=n=>typeof n==='number'&&Number.isFinite(n),round=(n,d=1)=>Number(n.toFixed(d));
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const project=p=>[(p[0]-118.8)*RAD*R*COS,(p[1]-32.05)*RAD*R];
const bounds=points=>points.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
const overlaps=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
const signedArea=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
function geometry(g){
 if(!g||!['Polygon','MultiPolygon'].includes(g.type))throw Error('人口统计需要有效的面状研究范围');
 if(CACHE.has(g))return CACHE.get(g);
 const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates,triangles=[],rings=[];let area=0;
 if(!Array.isArray(polys)||!polys.length)throw Error('研究范围为空');
 for(const poly of polys){
  if(!Array.isArray(poly)||!poly.length)throw Error('研究范围缺少外环');
  const flat=[],holes=[],localRings=[];
  for(const [i,ring] of poly.entries()){
   if(!Array.isArray(ring)||ring.length<4)throw Error('研究范围需要闭合边界');
   if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw Error('研究范围需要闭合边界');
   const pts=ring.slice(0,-1).map(p=>{if(!Array.isArray(p)||!finite(p[0])||!finite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90)throw Error('研究范围坐标无效');return project(p);});
   if(i)holes.push(flat.length/2);pts.forEach(p=>flat.push(...p));localRings.push(pts);
  }
  const index=earcut(flat,holes,2);
  for(let i=0;i<index.length;i+=3){const points=index.slice(i,i+3).map(j=>[flat[2*j],flat[2*j+1]]);let a=signedArea(points);if(a<0)points.reverse();a=Math.abs(a);if(a>1e-8){triangles.push({points,bounds:bounds(points),area:a});area+=a;}}
  rings.push(localRings);
 }
 const value={triangles,area,bounds:bounds(triangles.flatMap(t=>t.points)),rings};CACHE.set(g,value);return value;
}
function clipConvex(subject,clip){
 let output=subject;
 for(let i=0;i<clip.length&&output.length;i++){
  const a=clip[i],b=clip[(i+1)%clip.length],input=output;output=[];
  let prev=input.at(-1),pd=cross(a,b,prev);
  for(const cur of input){const cd=cross(a,b,cur),pin=pd>=-1e-8,cin=cd>=-1e-8;
   if(pin!==cin){const denominator=pd-cd;if(Math.abs(denominator)>1e-15){const t=pd/denominator;output.push([prev[0]+t*(cur[0]-prev[0]),prev[1]+t*(cur[1]-prev[1])]);}}
   if(cin)output.push(cur);prev=cur;pd=cd;
  }
 }
 return output.length>=3?Math.abs(signedArea(output)):0;
}
function intersect(a,b){
 if(!a.area||!b.area||!overlaps(a.bounds,b.bounds))return 0;
 let area=0;for(const x of a.triangles)for(const y of b.triangles)if(overlaps(x.bounds,y.bounds))area+=clipConvex(x.points,y.points);
 return Math.max(0,Math.min(area,a.area,b.area));
}
export function geometryAreaM2(g){return geometry(g).area;}
export function geometryIntersectionAreaM2(a,b){return intersect(geometry(a),geometry(b));}
function insideRing(p,r){let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function pointDistance(point,g){
 const p=project(point);if(g.rings.some(poly=>insideRing(p,poly[0])&&!poly.slice(1).some(r=>insideRing(p,r))))return 0;
 let distance=Infinity;for(const poly of g.rings)for(const ring of poly)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len)):0;distance=Math.min(distance,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));}return distance;
}
function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
function canonicalURL(value){let url;try{url=new URL(value);}catch{throw Error('来源链接应为完整 HTTPS 地址');}if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.')||value.length>2000)throw Error('来源链接应为不含账号的完整 HTTPS 地址');url.hash='';for(const key of [...url.searchParams.keys()])if(/^utm_|^spm$/i.test(key))url.searchParams.delete(key);return url.href;}
export function validateHousingSamples(rows,{asOf=new Date().toISOString().slice(0,10)}={}){
 if(!validDate(asOf))throw Error('统计日期无效');if(!Array.isArray(rows)||rows.length>2000)throw Error('住宅样本每批最多 2,000 条');
 const ids=new Set(),listings=new Set();
 return rows.map((raw,i)=>{try{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('样本格式无效');
  const string=(key,max)=>{const s=String(raw[key]??'').trim();if(!s||s.length>max)throw Error(key+' 为空或过长');return s;};
  const numeric=(key,min,max)=>{const v=raw[key];if(v===null||v===undefined||v===''||typeof v==='boolean'||typeof v==='object')throw Error(key+' 需要数字');const n=Number(v);if(!finite(n)||n<min||n>max)throw Error(key+' 超出范围');return n;};
  const id=string('id',100),name=string('name',200),kind=string('kind',20),basis=string('basis',20);
  if(['__proto__','constructor','prototype'].includes(id))throw Error('编号不可使用保留名称');if(ids.has(id))throw Error('编号重复 '+id);ids.add(id);
  if(!['sale','rent'].includes(kind)||!['asking','transaction'].includes(basis))throw Error('kind 应为 sale/rent，basis 应为 asking/transaction');
  const lng=numeric('lng',118.65,119.02),lat=numeric('lat',31.9,32.2),area_m2=numeric('area_m2',1,10000),price=numeric('price',.01,kind==='sale'?1e6:1e7),source=string('source',300),url=canonicalURL(string('url',2000)),date=string('date',10);
  if(!validDate(date)||date>asOf)throw Error('日期需要有效且不晚于统计日期的 YYYY-MM-DD');
  const listing=[url,kind,basis,date].join('|');if(listings.has(listing))throw Error('相同链接、口径及日期的样本重复');listings.add(listing);
  const unitPrice=price*(kind==='sale'?10000:1)/area_m2;if(unitPrice>1e6)throw Error('住宅单价超过校验上限，请核对总价单位');
  return {id,name,lng,lat,kind,basis,price,area_m2,source,url,date,unitPrice:round(unitPrice,4),status:'user-supplied-unverified'};
 }catch(e){throw Error(`第 ${i+1} 条住宅样本：${e.message}。整批未导入。`);}});
}
function csv(text){
 if(typeof text!=='string'||text.length>4*1024*1024)throw Error('住宅 CSV 限 4 MB');
 const rows=[];let row=[],cell='',quoted=false;const s=text.replace(/^\uFEFF/,'');
 for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else throw Error('CSV 引号格式错误');}else if(!quoted&&[',','\n','\r'].includes(c)){row.push(cell);cell='';if(c!==','){if(row.some(x=>x.trim()))rows.push(row);row=[];if(c==='\r'&&s[i+1]==='\n')i++;}}else cell+=c;}
 if(quoted)throw Error('CSV 引号未闭合');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
export function parseHousingRows(input,options={}){
 if(Array.isArray(input)&&(!input.length||!Array.isArray(input[0])))return validateHousingSamples(input,options);
 const rows=typeof input==='string'?csv(input):input;if(!Array.isArray(rows)||!rows.length)throw Error('住宅 CSV 为空');
 const [first,...body]=rows,head=first.map(x=>String(x).trim());if(new Set(head).size!==head.length||HOUSING_FIELDS.some(k=>!head.includes(k)))throw Error('住宅 CSV 表头需包含 '+HOUSING_FIELDS.join(', '));
 if(!body.length)throw Error('请提供至少一条住宅样本');
 return validateHousingSamples(body.map((r,i)=>{if(!Array.isArray(r)||r.length!==head.length)throw Error(`住宅 CSV 第 ${i+2} 行列数错误`);return Object.fromEntries(head.map((k,j)=>[k,r[j]]));}),options);
}
const seed=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0)/4294967295;};
const unique=a=>[...new Set(a.filter(Boolean))];
const median=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),n=b.length;return n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2;};
const cap=n=>Math.max(0,Math.min(1,n));
const simulationSource='UrbanLens 稳定模拟情景（非贝壳数据）';
function populationFor(g,grid,mode,salt,asOf){
 const metadata=grid?.metadata||{},maySimulate=['hybrid','demo'].includes(mode),cells=Array.isArray(grid?.features)?grid.features:[],values={night:0,day:0},covered={night:0,day:0},simArea={night:0,day:0},sources={night:[],day:[]},dates={night:[],day:[]},urls={night:[],day:[]};let cellCount=0,coveredArea=0;
 for(const f of cells){if(!['Polygon','MultiPolygon'].includes(f?.geometry?.type))continue;const cell=geometry(f.geometry),intersection=intersect(g,cell);if(intersection<1e-6||cell.area<=0)continue;cellCount++;coveredArea+=intersection;
  const p=f.properties||{},weight=intersection/cell.area;
  for(const key of ['night','day']){if(!finite(p[key])||p[key]<0)continue;values[key]+=p[key]*weight;covered[key]+=intersection;
   if(p[key+'Simulated']??metadata[key+'Simulated']??p.simulated??metadata.simulated??false)simArea[key]+=intersection;
   sources[key].push(p[key+'Source']||metadata[key+'Source']||p.source||metadata.source||'项目人口格网');dates[key].push(p[key+'Date']||metadata[key+'Date']||p.date||metadata.date);urls[key].push(p[key+'Url']||metadata[key+'Url']||p.url||metadata.url);
  }
 }
 const detail={},limits=[];
 for(const key of ['night','day']){
  const missing=Math.max(0,g.area-covered[key]),fallbackDensity=(key==='night'?5000:6500)+seed(salt+'|'+key)* (key==='night'?16000:25500),filled=maySimulate&&missing>Math.max(.01,g.area*.000001);
  if(filled){values[key]+=missing/1e6*fallbackDensity;simArea[key]+=missing;sources[key].push('UrbanLens 稳定人口情景模拟');dates[key].push(asOf);}
  const total=covered[key]>0||filled?values[key]:null,coverage=g.area>0?cap(covered[key]/g.area)*100:0;
  detail[key]={count:total===null?null:round(total),density:total===null?null:round(total/(g.area/1e6)),coverage:round(coverage),simulated:simArea[key]>.000001,filledAreaM2:filled?round(missing):0,source:unique(sources[key]).join('；')||'未接入',sources:unique(sources[key]),urls:unique(urls[key]),dates:unique(dates[key]).sort(),date:unique(dates[key]).sort().at(-1)||null,complete:filled||coverage>=99.999};
 }
 if(coveredArea>g.area*1.00001)limits.push('人口格网可能相互重叠，需先检查拓扑；当前辅助分不合成');
 const eligible=detail.day.complete&&detail.night.complete&&(maySimulate||(!detail.day.simulated&&!detail.night.simulated))&&coveredArea<=g.area*1.00001;
 const densityMean=detail.day.count===null||detail.night.count===null?null:(values.day+values.night)/2/(g.area/1e6);
 const score=eligible&&densityMean!==null?cap(densityMean/20000)*100:null;
 return {night:detail.night.count,day:detail.day.count,nightDensity:detail.night.density,dayDensity:detail.day.density,score:score===null?null:round(score),areaM2:round(g.area),coverage:round(Math.min(detail.night.coverage,detail.day.coverage)),cellCount,simulated:detail.night.simulated||detail.day.simulated,detail,source:unique([...detail.night.sources,...detail.day.sources]).join('；')||'未接入',url:unique([...detail.night.urls,...detail.day.urls])[0]||null,date:unique([...detail.night.dates,...detail.day.dates]).sort().at(-1)||null,version:grid?.version||metadata.version||null,method:'格网人数 × 与研究范围相交面积 / 格网面积；扣除孔洞。南京局部等距近似投影，格内均匀分配；密度按完整研究范围面积计算。',limitations:limits};
}
function housingFor(g,rows,basis,mode,salt,asOf){
 const maySimulate=['hybrid','demo'].includes(mode),groups={},near=rows.map(s=>({...s,distanceM:pointDistance([s.lng,s.lat],g)})).filter(s=>s.distanceM<=600.000001);
 for(const kind of ['sale','rent']){groups[kind]={};for(const b of ['asking','transaction']){
  const candidates=near.filter(s=>s.kind===kind&&s.basis===b),inside=candidates.filter(s=>s.distanceM<.01),selected=inside.length?inside:candidates;
  // A listing updated on several dates contributes its latest record once.
  const byListing=new Map();for(const s of selected){const old=byListing.get(s.url);if(!old||s.date>old.date)byListing.set(s.url,s);}
  const samples=[...byListing.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(s=>({...s,distanceM:round(s.distanceM)})),unitPrice=median(samples.map(s=>s.unitPrice)),dates=unique(samples.map(s=>s.date)).sort();
  groups[kind][b]={unitPrice:unitPrice===null?null:round(unitPrice,2),count:samples.length,simulated:false,samples,source:unique(samples.map(s=>s.source)).join('；')||'未接入项目住宅样本',date:dates.at(-1)||null,dateRange:dates.length?[dates[0],dates.at(-1)]:[],basis:b,kind,unit:kind==='sale'?'元/m²':'元/m²/月',scope:inside.length?'within-unit':samples.length?'within-600m':'none',status:'user-supplied-unverified'};
 }}
 const selected={};for(const kind of ['sale','rent']){selected[kind]=structuredClone(groups[kind][basis]);if(selected[kind].unitPrice===null&&maySimulate)Object.assign(selected[kind],{unitPrice:kind==='sale'?Math.round(25000+seed(salt+'|'+kind+'|'+basis)*33000):round(35+seed(salt+'|'+kind+'|'+basis)*60,2),simulated:true,source:simulationSource,date:asOf,scope:'simulated',status:'simulated'});}
 const score=selected.sale.unitPrice!==null&&selected.rent.unitPrice!==null?(cap(selected.sale.unitPrice/60000)+cap(selected.rent.unitPrice/120))*50:null;
 return {...selected,basis,groups,score:score===null?null:round(score),simulated:selected.sale.simulated||selected.rent.simulated,method:'优先采用片区内样本，否则采用距片区边界 600m 内样本；售租及挂牌成交分别取中位数，同一链接取最近记录。',limitations:['用户提供的样本尚未核实，来源名称不证明平台认证；挂牌价不等于成交价。','样本未做楼龄、户型、装修或楼层调整，反映已收录样本，不代表完整市场。']};
}
export function assessUrbanContext(unit,{populationGrid=null,housing=[],mode='hybrid',basis='asking',asOf=AS_OF}={}){
 if(!['hybrid','demo','observed','uploaded'].includes(mode))throw Error('辅助评估数据口径无效');if(!['asking','transaction'].includes(basis))throw Error('住宅价格口径无效');if(!validDate(asOf))throw Error('统计日期无效');
 const g=geometry(unit?.geometry);if(g.area<=0)throw Error('研究范围面积为零，无法计算人口密度');
 const salt=JSON.stringify([URBAN_CONTEXT_VERSION,unit.geometry]),population=populationFor(g,populationGrid,mode,salt,asOf),market=housingFor(g,validateHousingSamples(housing,{asOf}),basis,mode,salt,asOf);
 const score=population.score===null||market.score===null?null:round((population.score+market.score)/2);
 return {version:URBAN_CONTEXT_VERSION,score,asOf,mode,basis,population,housing:market,simulation:population.simulated||market.simulated,rule:{version:URBAN_CONTEXT_VERSION,formula:'人口分 = min((昼间密度 + 夜间密度) / 2 / 20000, 1) × 100；市场分 = [min(住宅售单价 / 60000, 1) + min(住宅租单价 / 120, 1)] × 50；辅助分 = (人口分 + 市场分) / 2。',thresholds:{density:20000,saleUnit:60000,rentUnit:120},status:'试验规则，未校准'},limitations:[...population.limitations,...market.limitations,'人口与住宅市场强度仅作为研究辅助，不表示地价、投资收益或更新优先级；人口分布和昼夜变化为代理或情景，非手机信令实测。']};
}

import proj4 from 'proj4';
import {evaluate as evaluateLegacy, DIMENSIONS} from '../dist/domain.js';
import {centerOf,boundsOf,inGeometry,distanceMeters} from './geo.js';

export {DIMENSIONS};
export const VALUE_VERSION='VALUE-07';
export const CREATOR='制作者：东南大学建筑学院 蔡子攀';
export const PROFILES={balanced:{name:'均衡观察',weights:[.2,.2,.2,.2,.2]},public:{name:'公共改善',weights:[.35,.15,.1,.25,.15]},efficiency:{name:'存量增效',weights:[.15,.35,.15,.1,.25]}};
export const MODE_NAMES={observed:'公开数据',demo:'完整演示台账',uploaded:'用户台账待核实'};
export const SERVICE_NAMES={transit:'交通点位',education:'教育设施',health:'医疗服务',park:'公园',daily:'生活服务',heritage:'历史要素'};
const utm=proj4('EPSG:4326','+proj=utm +zone=50 +datum=WGS84 +units=m +no_defs');
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const rounded=n=>Math.round(n*10)/10;
export function projectedArea(g){
 const ringArea=r=>{const xy=r.map(p=>utm.forward(p.slice(0,2)));const [ox,oy]=xy[0];let a=0;for(let i=0,j=xy.length-1;i<xy.length;j=i++)a+=(xy[j][0]-ox)*(xy[i][1]-oy)-(xy[i][0]-ox)*(xy[j][1]-oy);return Math.abs(a)/2;};
 const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
 const area=polygons.reduce((n,p)=>n+Math.max(0,ringArea(p[0])-p.slice(1).reduce((s,r)=>s+ringArea(r),0)),0);
 return area>0?area:null;
}
export function referencePoint(g){const c=centerOf(g);if(inGeometry(c,g))return c;const b=boundsOf(g);for(let n=3;n<=21;n+=2)for(let y=1;y<n;y++)for(let x=1;x<n;x++){const p=[b[0]+(b[2]-b[0])*x/n,b[1]+(b[3]-b[1])*y/n];if(inGeometry(p,g))return p;}return (g.type==='Polygon'?g.coordinates[0][0]:g.coordinates[0][0][0]).slice(0,2);}
export function analyzeUnit(unit,data,services){
 const point=referencePoint(unit.geometry),area=projectedArea(unit.geometry);
 const nearby=services.features.map(f=>({...f,distance:distanceMeters(point,f.geometry.coordinates)})).sort((a,b)=>a.distance-b.distance);
 const nearest=Object.fromEntries(Object.keys(SERVICE_NAMES).map(k=>[k,nearby.find(f=>f.properties.category===k)||null]));
 const counts=Object.fromEntries(Object.keys(SERVICE_NAMES).map(k=>[k,nearby.filter(f=>f.distance<=600&&f.properties.category===k).length]));
 const buildings=data.buildings.features.filter(f=>!f.properties['building:part']&&inGeometry(centerOf(f.geometry),unit.geometry));
 return {point,area:area===null?null:Math.round(area),nearest,counts,nearby:nearby.filter(f=>f.distance<=600),buildingCount:buildings.length,heightKnown:buildings.filter(f=>f.properties.height_m!==null).length,spatialDate:services.metadata.snapshotAt,geometryDate:unit.properties.source_date||data.land.metadata.snapshotAt,method:'面积：WGS84 / UTM 50N（EPSG:32650）投影平面面积；区位：面内参考点至设施参考点的球面直线距离；600m为演示观察半径，非步行可达性或法定服务标准。'};
}
const demoRows=[{far:1.05,vacancy:48,industry:'待调整',condition:3},{far:1.8,vacancy:18,industry:'符合',condition:2},{far:1.55,vacancy:9,industry:'符合',condition:3},{far:1.25,vacancy:32,industry:'待调整',condition:4},{far:2.1,vacancy:14,industry:'符合',condition:2},{far:.95,vacancy:56,industry:'待调整',condition:3},{far:1.35,vacancy:null,industry:'待核实',condition:null},{far:1.65,vacancy:0,industry:'符合',condition:1}];
export function businessInput(unit,analysis,mode='observed',uploaded={}){
 let record={buildingArea:null,vacancy:null,industry:'待核实',condition:null,source:'未接入调查台账',date:null};
 if(mode==='demo'){const row=demoRows[(Number(unit.id.match(/\d+$/)?.[0]||1)-1)%demoRows.length];record={buildingArea:analysis.area?Math.round(analysis.area*row.far):null,vacancy:row.vacancy,industry:row.industry,condition:row.condition,source:'UrbanLens 虚构业务台账，仅演示流程；不描述该真实对象的经营、质量或空置情况',date:'2026-09-12'};}
 if(mode==='uploaded'&&uploaded[unit.id])record={...uploaded[unit.id]};
 return {id:unit.id,name:unit.properties.name,area:analysis.area,distance:analysis.nearest.transit?.distance??null,...record,dataVersion:VALUE_VERSION+' / '+mode};
}
export function fingerprint(input,profile,analysis){const s=JSON.stringify([input,profile,analysis.geometryDate,analysis.spatialDate,analysis.counts]);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16);}
export function computeAssessment(unit,analysis,{mode='observed',profile='balanced',uploaded={}}={}){
 if(!PROFILES[profile]||!MODE_NAMES[mode])throw Error('无效的评估口径');
 const input=businessInput(unit,analysis,mode,uploaded),legacy=evaluateLegacy(input),weights=PROFILES[profile].weights;
 const scores=legacy.scores,coverage=rounded(weights.reduce((s,w,i)=>s+(scores[i]===null?0:w),0)*100);
 const total=scores.every(n=>n!==null)?rounded(scores.reduce((s,n,i)=>s+n*weights[i],0)):null;
 const fieldSources=[{id:'spatial',title:'交通直线距离',date:analysis.spatialDate,source:'OSM 设施点位与研究轮廓',url:'https://www.openstreetmap.org/copyright'},{id:'business',title:MODE_NAMES[mode],date:input.date,source:input.source}];
 const raw=[input.distance===null?'缺失':`${Math.round(input.distance)} m`,legacy.ratio===null?'缺失':legacy.ratio.toFixed(2),input.industry,input.condition===null?'缺失':`${input.condition} 级`,input.vacancy===null?'缺失':`${input.vacancy}%`];
 const methods=['min(100, 交通直线距离 ÷ 15)','max(0, min(100, (2 − 容积率) ÷ 2 × 100))；2 为演示基准','符合 = 20；待调整 = 80；待核实 = 缺失','演示等级 1–4 线性映射为 0–100；不等于安全鉴定','使用状态得分 = 空置率（%）'];
 const dimensions=DIMENSIONS.map((name,i)=>({name,raw:raw[i],score:scores[i],weight:weights[i],method:methods[i],status:scores[i]===null?'资料不足':i===0?'开放数据计算':mode==='demo'?'虚构演示':mode==='uploaded'?'用户填报待核实':'资料不足',sourceId:i===0?'spatial':'business',date:i===0?analysis.spatialDate:input.date}));
 return {unitId:unit.id,name:unit.properties.name,mode,profile,ruleVersion:`DEMO-VALUE-07-${profile}`,ruleStatus:'演示规则，未获业务核准',dataVersion:input.dataVersion,geometryDate:analysis.geometryDate,spatialDate:analysis.spatialDate,input,ratio:legacy.ratio,scores,coverage,total,dimensions,missing:dimensions.filter(d=>d.score===null).map(d=>d.name),fingerprint:fingerprint(input,profile,analysis),sources:fieldSources,limitations:['研究轮廓不是地籍宗地或官方更新边界','综合分仅为更新研究关注度，不表示地价、投资回报或实施可行性','权属、法定规划条件、建筑安全与经营台账尚未核验','开放设施点位覆盖不完整，未检索到不代表不存在']};
}
export function createRun(unit,analysis,options){const result=computeAssessment(unit,analysis,options);return {...structuredClone(result),id:`RUN-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,createdAt:new Date().toISOString(),review:{status:'未复核',note:'',name:'',date:null}};}
export function compareRuns(runs){
 if(runs.length<2||runs.length>3)return {ranked:[],reason:'请选择 2–3 个研究单元。'};
 if(new Set(runs.map(r=>r.mode)).size!==1)return {ranked:[],reason:'数据口径不同，暂不排序。'};
 if(new Set(runs.map(r=>r.ruleVersion)).size!==1)return {ranked:[],reason:'规则版本不同，请统一规则重算。'};
 if(new Set(runs.map(r=>JSON.stringify([r.geometryDate,r.spatialDate,r.input.date]))).size!==1)return {ranked:[],reason:'数据时点不同，只比较原始指标，暂不排序。'};
 if(runs.some(r=>r.total===null))return {ranked:[],reason:'数据不完整，暂不排序；可比较原始指标与缺失项。'};
 return {ranked:[...runs].sort((a,b)=>b.total-a.total),reason:'同口径更新研究关注度排序；不代表投资或更新实施优先级。'};
}
export function capacityScenario(area,currentBuilding,params){
 const {far,retain,publicShare}=params;
 if(!finite(area)||area<=0||!finite(far)||far<.1||far>6||!finite(retain)||retain<0||retain>100||!finite(publicShare)||publicShare<0||publicShare>80)throw Error('情景参数超出范围');
 const target=Math.round(area*far),publicArea=Math.round(area*publicShare/100);
 const retained=finite(currentBuilding)&&currentBuilding>=0?Math.round(currentBuilding*retain/100):null;
 return {target,publicArea,retained,additional:retained===null?null:Math.max(0,target-retained),excess:retained!==null&&retained>target,note:'参数化容量演示；容积率、保留比例和公共空间比例均为用户假设，不是获批指标或可建面积结论。未计入退界、高度、日照、消防及结构约束。'};
}
export function marketMeasures(record){const {area_m2,far_max,start_wan,deal_wan}=record;return {floorPrice:area_m2>0&&far_max>0&&deal_wan>=0?Math.round(deal_wan*10000/(area_m2*far_max)):null,premium:start_wan>0?rounded((deal_wan/start_wan-1)*100):null};}
export function parseBusinessCSV(text,unitIds){
 if(typeof text!=='string'||text.length>20*1024*1024)throw Error('CSV 超过20 MB');
 const rows=[];let row=[],cell='',quoted=false;const s=text.replace(/^\uFEFF/,'');
 for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else throw Error('CSV 引号格式错误');}else if(!quoted&&(c===','||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!==','){if(row.some(x=>x.trim()))rows.push(row);row=[];if(c==='\r'&&s[i+1]==='\n')i++;}}else cell+=c;}
 if(quoted)throw Error('CSV 引号未闭合');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 const header=rows.shift()?.map(x=>x.trim());const required=['parcel_id','building_area_m2','vacancy_pct','industry','condition','source','date'];
 if(!header||new Set(header).size!==header.length||required.some(k=>!header.includes(k)))throw Error('表头需包含 parcel_id, building_area_m2, vacancy_pct, industry, condition, source, date');
 if(!rows.length||rows.length>1000)throw Error('请导入 1–1,000 条属性');
 const accepted={},errors=[];
 for(let i=0;i<rows.length;i++){
  try{if(rows[i].length!==header.length)throw Error('列数与表头不一致');const p=Object.fromEntries(header.map((k,j)=>[k,rows[i][j].trim()])),id=p.parcel_id;
   if(!unitIds.includes(id))throw Error(`无对应研究边界 ${id}`);if(accepted[id])throw Error(`编号重复 ${id}`);
   const num=(v,name,max)=>{if(!v||v.toLowerCase()==='null')return null;const n=Number(v);if(!Number.isFinite(n)||n<0||n>max)throw Error(`${name} 超出范围`);return n;};
   const buildingArea=num(p.building_area_m2,'建筑面积',1e8),vacancy=num(p.vacancy_pct,'空置率',100),condition=num(p.condition,'等级',4);
   if(condition!==null&&(!Number.isInteger(condition)||condition<1))throw Error('等级应为1–4或留空');
   if(p.industry&&!['符合','待调整','待核实'].includes(p.industry))throw Error('产业字段应为符合、待调整或待核实');
   if(!p.source||p.source.length>300)throw Error('请补充来源，最长300字');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Date.parse(p.date))||new Date(p.date).toISOString().slice(0,10)!==p.date)throw Error('日期应为有效的 YYYY-MM-DD');
   accepted[id]={buildingArea,vacancy,condition,industry:p.industry||'待核实',source:p.source,date:p.date};
  }catch(e){errors.push(`第 ${i+2} 行：${e.message}`);}
 }
 if(errors.length)throw Error(errors.slice(0,8).join('；')+'。整批未导入。');return accepted;
}

export function answerQuestion(question,{units,analyses,selectedId,compared=[],scope='unit',mode='observed',profile='balanced',uploaded={},runs=[],evidence}){
 const clean=String(question).trim().slice(0,1200),selected=units.find(u=>u.id===selectedId);
 const inScope=scope==='project'?units:scope==='compare'?units.filter(u=>compared.includes(u.id)):[selected].filter(Boolean);
 const source=(id,title,text,url,date)=>({id,title,text,url,date});
 if(scope==='compare'&&inScope.length<2)return {text:'请先选择 2–3 个研究单元，再用比较清单提问。',sources:[],actions:[]};
 const explicit=clean.match(/XW-R\d{2,}|UL-\d{3}/gi)||[];
 const namedOut=units.some(u=>clean.includes(u.properties.name)&&!inScope.includes(u));
 if(explicit.some(id=>!inScope.some(u=>u.id===id.toUpperCase()))||namedOut)return {text:'问题涉及当前范围之外的对象。请切换到“比较清单”或“整个研究项目”，再明确选择需要比较的对象。旧版 UL 地块请打开历史样例。',sources:[],actions:[]};
 const sources=[],actions=[];const add=s=>{sources.push(s);return ` [${s.id}]`;};
 const policy=/政策|案例|百子亭|印刷厂|红山片区|长江路|更新规划|保护/.test(clean);
 if(/地价|成交|市场|多少钱|价值.*元|楼面价|估价/.test(clean)){
  const text=evidence.market.map((m,i)=>{const calc=marketMeasures(m);return `${m.id}（${m.date}）：${m.area_m2} m²，容积率上限 ${m.far_max}，成交 ${m.deal_wan} 万元；按面积×容积率上限折算楼面地价约 ${calc.floorPrice} 元/m²。${add(source('M'+(i+1),m.title,m.note,m.url,m.date))}`;}).join('\n\n');
  return {text:text+'\n\n这两笔不同年份、不同用途与位置的交易只作市场背景，不能直接套用于当前研究单元。缺少权属、规划条件、完整可比成交和时点修正，当前不输出该单元的市场价值。原站正文暂不可达，成交字段经官方检索索引核对。',sources,actions:[{type:'market',label:'打开市场与案例'}]};
 }
 if(policy){const words=clean.match(/百子亭|印刷厂|红山|长江路|锁金|规划|保护/g)||[];const docs=evidence.documents.map(d=>({d,n:words.filter(w=>(d.title+d.summary).includes(w)).length})).sort((a,b)=>b.n-a.n).slice(0,3);return {text:docs.map(({d},i)=>d.title+'\n'+d.summary+add(source('P'+(i+1),d.title,d.summary,d.url,d.date))).join('\n\n')+'\n\n上述资料是片区政策和公开项目参考，不证明当前所选轮廓位于法定控制线内，也不替代项目审批。资料反映各自发布时点。',sources,actions:[{type:'market',label:'查看完整资料卡'}]};}
 if(/筛选|找出|找一下|寻找/.test(clean)){const type=clean.includes('居住')?'居住社区':clean.includes('产业')?'产业空间':clean.includes('商业')?'商业文旅':'';const maxTransit=/600|六百/.test(clean)?600:/500|五百/.test(clean)?500:null;return {text:`已整理可编辑筛选条件：${type||'全部类型'}${maxTransit?'；交通点位直线距离 ≤ '+maxTransit+' m':''}。点击按钮后应用。距离来自开放地图，不等于步行时间。`,sources:[],actions:[{type:'filter',label:'应用筛选条件',filter:{type,maxTransit}}]};}
 if(!selected)return {text:'请先选择研究单元。',sources:[],actions:[]};
 if(/^(运行|开始|重新).*(评估|分析)/.test(clean))return {text:'将使用当前数据口径与权重配置生成一份可追溯的评估快照。',sources:[],actions:[{type:'evaluate',label:'运行当前评估'}]};
 if(/导出|报告/.test(clean))return {text:'报告引用确定的评估运行，保留数据口径、规则、缺失项和复核状态。请先运行评估，再预览与导出。',sources:[],actions:[{type:'report',label:'打开报告预览'}]};
 if(/加入.*比较/.test(clean))return {text:'可将当前研究单元加入最多3个对象的比较清单。',sources:[],actions:[{type:'compare-add',label:'加入比较清单'}]};
 if(!/评估|评分|价值|关注|为什么|如何|建议|现状|面积|容积|空置|建筑|产业|数据|来源|缺|资料|补|交通|地铁|公交|教育|医疗|公园|配套|距离|比较|差异|地块|单元|规则|权属/.test(clean))return {text:'当前资料没有支持这个问题的依据。我可以解释所选单元的空间条件、五维评估、缺失资料、比较差异及已收录更新案例。',sources:[],actions:[]};
 const parts=[];
 for(const [i,u] of inScope.entries()){
  const a=analyses.get(u.id),r=computeAssessment(u,a,{mode,profile,uploaded});
  const saved=[...runs].reverse().find(x=>x.unitId===u.id&&x.fingerprint===r.fingerprint);
  const sid='U'+(i+1);add(source(sid,u.properties.name+' / '+u.id,`${a.method}\n边界日期 ${a.geometryDate}；设施日期 ${a.spatialDate}。业务来源：${r.input.source}；日期 ${r.input.date||'缺失'}。`,u.properties.source_url,a.spatialDate));
  let text=`${u.properties.name}（${u.id}）· ${MODE_NAMES[mode]}\n`;
  if(/交通|地铁|公交|教育|医疗|公园|配套|距离/.test(clean)){text+=Object.entries(a.nearest).map(([k,f])=>`${SERVICE_NAMES[k]}：${f?f.properties.name+'，参考点直线距离约 '+Math.round(f.distance)+' m':'未收录'}`).join('\n');text+='\n600 m 内收录 '+Object.values(a.counts).reduce((s,n)=>s+n,0)+' 个设施参考点；未核实实际入口和开放状态。';}
  else if(/缺|补|权属|资料/.test(clean)){text+=`当前五维有效覆盖率 ${r.coverage}%。缺失：${r.missing.join('、')||'演示指标字段齐全'}。真实权属、规划条件、计容建筑面积、经营与空置调查、建筑安全鉴定仍需补充。完整演示台账不是实测事实。`;}
  else {text+=`研究轮廓投影面积 ${a.area?.toLocaleString('zh-CN')||'不可算'} m²。${saved?'已保存运行 '+saved.id:'尚无当前口径运行；下列为即时校算'}。\n${r.dimensions.map(d=>`${d.name}：${d.raw} → ${d.score===null?'资料不足':d.score+' 分'}（${d.status}）`).join('\n')}\n${r.total===null?'资料不全，不合成综合分':'演示更新研究关注度 '+r.total+' / 100'}；覆盖率 ${r.coverage}%。`;}
  parts.push(text+` [${sid}]`);
 }
 if(inScope.length>1){const c=compareRuns(inScope.map(u=>computeAssessment(u,analyses.get(u.id),{mode,profile,uploaded})));parts.push(c.reason+(c.ranked.length?'\n'+c.ranked.map(r=>r.name+'：'+r.total).join('；'):''));actions.push({type:'compare',label:'打开比较视图'});}
 const rule=source('R1',`演示规则 DEMO-VALUE-07-${profile}`,`五维权重依次为 ${PROFILES[profile].weights.map(n=>n*100+'%').join(' / ')}。各指标映射沿用旧版 DEMO-0.1；全部有效才合成更新研究关注度；高分不等于土地市场价值、投资回报或实施条件。`,null,'2026-09-12');
 parts.push(rule.text+add(rule));if(/为什么|解释|规则|评分|价值|关注/.test(clean))actions.push({type:'evidence',label:'展开指标与计算依据'});
 return {text:parts.join('\n\n'),sources,actions};
}

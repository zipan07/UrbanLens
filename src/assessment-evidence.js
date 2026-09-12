export const FIELD_DEFS=[['area','研究面积','m²'],['distance','交通直线距离','m'],['buildingArea','建筑面积','m²'],['industry','产业标签','类别'],['condition','建筑调查等级','级'],['vacancy','空置率','%']];
export const VALIDITY={valid:'有效',missing:'缺失',invalid:'无效',conflict:'来源冲突',expired:'已过期'};
export const CONSTRAINTS={planning:'规划',title:'权属',safety:'安全'};
export const CONSTRAINT_STATUS={unknown:'资料不足',issue:'发现事项',checked:'已核对资料中未发现事项'};
export function evidenceSnapshot(input,analysis,record={},context={}){
 const fields=FIELD_DEFS.map(([key,label,unit])=>{const spatial=['area','distance'].includes(key),stored=record.fields?.[key],value=input[key]??null,basis={mode:spatial?'spatial':context.mode,value,source:spatial?null:input.source,date:key==='area'?analysis.geometryDate:spatial?analysis.spatialDate:input.date,geometry:context.geometry},m=stored&&JSON.stringify(stored.basis)===JSON.stringify(basis)?stored:{};
  const missing=value===null||value==='待核实',invalid=!missing&&(key==='industry'?!['符合','待调整'].includes(value):!Number.isFinite(value)||value<0||key==='area'&&value===0||key==='condition'&&(!Number.isInteger(value)||value<1||value>4)||key==='vacancy'&&value>100);
  return {key,label,value,unit,source:m.source||(spatial?'OSM 开放地图 / 研究轮廓':input.source),date:m.date||(key==='area'?analysis.geometryDate:spatial?analysis.spatialDate:input.date),validity:missing?'missing':invalid?'invalid':m.validity||'valid',verification:m.verification||'unverified',reason:m.reason||'',refs:m.refs||[],recordVersion:record.recordVersion||1};});
 const constraints=Object.entries(CONSTRAINTS).map(([category,label])=>({category,label,status:'unknown',summary:'',refs:[],date:null,...(record.geometry===context.geometry?record.constraints?.[category]:{}),recordVersion:record.recordVersion||1}));
 return {fields,constraints};
}
export function ruleSnapshot(profile,weights){return {version:`DEMO-VALUE-07-${profile}`,status:'demo',scope:'玄武区研究轮廓；更新研究流程演示',direction:'高分表示研究关注度',weights:[...weights],formal:false,limitations:'非地价、实施优先级、法定规划或安全结论'};}
export function searchDocumentPages(query,documents){
 const terms=String(query).toLowerCase().replace(/请|帮我|查找|查询|搜索|检索|附件|文档|文件|资料|关于|内容|什么|哪些|有哪些|的|吗|？|\?/g,' ').match(/[\p{Script=Han}]+|[a-z0-9]+/gu)||[];
 if(!terms.length)return [];
 const hits=[];for(const doc of documents)for(const page of doc.pages||[]){const text=page.text.toLowerCase();if(!terms.every(t=>text.includes(t)))continue;const index=Math.max(0,text.indexOf(terms[0])-60);hits.push({documentId:doc.id,attachmentId:doc.attachmentId,page:page.page,title:doc.name,text:page.text.slice(index,index+700),date:doc.sourceDate,extraction:doc.extraction});}
 return hits.slice(0,5);
}

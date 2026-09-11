export const RULE_VERSION = 'DEMO-0.1';
export const DATA_VERSION = 'SAMPLE-2026-09-11';
export const DIMENSIONS = ['空间布局', '利用效率', '产业导向', '建筑状况', '使用状态'];
const rows = [
  ['UL-001','滨河机械厂','工业',18500,14800,62,420,'待调整',4,90,145,155,110],
  ['UL-002','南岸仓储园','工业',22600,20340,38,680,'符合',3,270,145,155,110],
  ['UL-003','光华商业中心','商业',12600,26460,28,180,'符合',2,450,145,125,110],
  ['UL-004','机电配套基地','工业',15900,11130,null,890,'待调整',null,110,280,170,110],
  ['UL-005','河畔生活街区','居住',16800,36960,8,320,'符合',2,305,280,150,110],
  ['UL-006','城东创意工坊','工业',11200,15680,16,260,'符合',2,485,280,110,110],
  ['UL-007','旧城纺织厂','工业',24100,14460,76,1100,'待调整',4,80,420,180,120],
  ['UL-008','社区公共服务站','公共服务',6200,5580,0,150,'符合',1,290,420,120,120],
  ['UL-009','东岸科创园','工业',20400,24480,23,500,'符合',2,730,170,155,105],
  ['UL-010','滨水商务楼','商业',9700,26190,45,360,'待核实',3,765,305,140,105],
  ['UL-011','河东居住组团','居住',19200,49920,12,410,'符合',2,745,445,165,110],
  ['UL-012','南部物流场站','工业',27600,11040,83,1250,'待调整',4,470,565,170,110],
];
export const parcels = rows.map(([id,name,use,area,buildingArea,vacancy,distance,industry,condition,x,y,w,h])=>({id,name,use,area,buildingArea,vacancy,distance,industry,condition,x,y,w,h,source:`演示地块台账 / ${id}`,date:'2026-09-11',dataVersion:DATA_VERSION}));
export function evaluate(p){
  const valid=(v)=>typeof v==='number'&&Number.isFinite(v);
  const ratio=valid(p.area)&&p.area>0&&valid(p.buildingArea)&&p.buildingArea>=0?p.buildingArea/p.area:null;
  const scores=[valid(p.distance)&&p.distance>=0?Math.min(100,p.distance/15):null,ratio===null?null:Math.max(0,Math.min(100,(2-ratio)/2*100)),p.industry==='符合'?20:p.industry==='待调整'?80:null,valid(p.condition)&&Number.isInteger(p.condition)&&p.condition>=1&&p.condition<=4?(p.condition-1)/3*100:null,valid(p.vacancy)&&p.vacancy>=0&&p.vacancy<=100?p.vacancy:null];
  const validCount=scores.filter(v=>v!==null).length;
  return {parcelId:p.id,ruleVersion:RULE_VERSION,dataVersion:p.dataVersion,ratio,scores:scores.map(v=>v===null?null:Math.round(v*10)/10),coverage:validCount*20,total:validCount===5?Math.round(scores.reduce((a,b)=>a+b,0)/5*10)/10:null,missing:DIMENSIONS.filter((_,i)=>scores[i]===null)};
}
export function filterParcels(query='',use=''){const q=query.trim().toLowerCase();return parcels.filter(p=>(!use||p.use===use)&&(!q||`${p.id} ${p.name}`.toLowerCase().includes(q)));}
export function explanation(p,result,question){
  if(/补充|缺|资料/.test(question)){const r=result||evaluate(p);return r.missing.length?`需补充：${r.missing.join('、')}相关资料。缺失数据未按0分处理，综合分暂不输出。\n来源：${p.source}；数据版本 ${p.dataVersion}。`:`演示指标字段齐全。实际业务还需核验规划条件、权属资料、建筑调查与数据时点；字段齐全不代表已具备实施条件。\n来源：${p.source}。`;}
  if(!/关注|评分|依据|为什么|空置|容积率|评估/.test(question))return '当前演示助手支持关注度解释、评分依据和缺失资料查询。该问题未被演示逻辑覆盖，无法给出有依据的回答。';
  if(!result)return '该地块尚未运行评估。请先点击“运行评估”，再查看计算结果及依据。';
  if(/空置/.test(question))return p.vacancy===null?`空置率缺失，需补充调查资料。来源：${p.source}。`:`演示空置率为 ${p.vacancy}%，使用状态关注度得分为 ${result.scores[4]}。这是虚构台账值，不能作为真实调查结论。来源：${p.source}。`;
  if(/容积率/.test(question))return result.ratio===null?'建筑面积或土地面积无效，无法计算容积率。':`现状容积率 = ${p.buildingArea.toLocaleString()} ÷ ${p.area.toLocaleString()} = ${result.ratio.toFixed(2)}。来源：${p.source}。`;
  const ranked=result.scores.map((score,i)=>({score,name:DIMENSIONS[i]})).filter(x=>x.score!==null).sort((a,b)=>b.score-a.score);
  return `${result.total===null?'资料不完整，暂不输出综合分。':`演示更新关注度为 ${result.total.toFixed(1)} / 100。`}\n较高维度：${ranked.slice(0,2).map(x=>`${x.name} ${x.score}分`).join('、')}。分值越高表示越应进一步研究，不表示投资回报或实施可行性。\n规则：${RULE_VERSION}，五个维度各占20%，仅字段完整时合成。来源：${p.source}。`;
}
export function reportMarkdown(p,r){
  if(!r)throw new Error('请先运行当前地块评估');
  return `# UrbanLens 地块评估摘要\n\n城市更新用地智能评估交互系统\n\n> 演示数据与规则 · 未复核 · 非正式评估报告\n\n## 地块概况\n\n- 地块：${p.name}（${p.id}）\n- 现状用途：${p.use}\n- 土地面积：${p.area} 平方米\n- 建筑面积：${p.buildingArea} 平方米\n- 现状容积率：${r.ratio===null?'不可计算':r.ratio.toFixed(2)}\n- 数据日期：${p.date}\n\n## 演示多维评估\n\n| 维度 | 分值 |\n| --- | --- |\n${DIMENSIONS.map((n,i)=>`| ${n} | ${r.scores[i]===null?'缺失':r.scores[i]} |`).join('\n')}\n\n- 数据覆盖率：${r.coverage}%\n- 更新关注度：${r.total===null?'资料不足，暂不输出':r.total+' / 100'}\n\n## 解释与核实事项\n\n${explanation(p,r,'为什么值得关注？')}\n\n${explanation(p,r,'哪些资料需要补充？')}\n\n## 依据与版本\n\n- 来源：${p.source}\n- 数据版本：${r.dataVersion}\n- 规则版本：${r.ruleVersion}\n- 所有地块与数值均为虚构；本原型未核验真实规划、权属和建筑安全信息。\n`;
}

import {parcels,evaluate,DIMENSIONS,RULE_VERSION} from './domain.js';
export const PROJECT_ID='urbanlens-demo';
const policy=[
 {key:'rules',title:'演示评估规则',source:'domain.js / DEMO-0.1',text:'五维等权重，每项20%。空间布局=min(100,直线距离÷15)，并非步行可达性；利用效率=max(0,min(100,(2−容积率)÷2×100))，2是任意演示基准。产业符合20、待调整80、待核实缺失；建筑调查等级1至4映射0至100；使用状态得分等于空置率。全部有效才输出综合分。高分表示研究关注度，不是实施可行性或投资收益。'},
 {key:'quality',title:'缺失值与资料核实',source:'PRD V0.1 §4–5 / 数据质量',text:'缺失值为null，合法0值正常计算。资料不完整不输出综合分。规划条件、权属、建筑安全均未正式核验，未发现约束不代表没有约束。修改事实必须重算，人工意见不得修改计算分值。'},
 {key:'geometry',title:'本页历史虚构城市与台账边界',source:'city-data.js / METRO-05',text:'本页是 Metro 05 历史样例，只有12宗虚构地块；地图是12×8.4公里虚构城市，含不规则街区、河流湖区、建筑、道路、公园与设施。建筑高度、外观和模拟边界不是实测调查数据，不据此计算台账的土地面积、容积率或评分。手机双指可旋转、缩放和平移。'},
 {key:'product',title:'历史样例与当前首页能力',source:'ROADMAP / STUDIO-11',text:'当前页仅为 Metro 05 的12宗虚构地块历史样例，提供地图、档案、联合筛选、确定性演示评分、2至3宗比较、本地来源问答、PNG及Markdown摘要。这里的评估只保留在页面会话内。本页没有真实GIS导入和DOCX；请点击页面顶部“返回 Studio 11 工作台”，首页已有玄武真实开放地图、GeoJSON研究范围导入、CSV台账关联、含地图的DOCX报告及本机历史。全站尚无服务端项目保存、账号权限或正式复核；DeepSeek接入继续暂缓。'},
 {key:'prd',title:'V0.1 产品需求',source:'PRD V0.1 §1–3 / 需求基线',text:'系统面向规划研究与存量用地评估。需求闭环为建立项目与导入数据、地图筛选、一地一档、运行评估、交互解释、地块比较、复核与导出报告。该条是需求目标，不代表全部功能已经交付。'}
];
export function retrieve(question,{parcelId,compared=[],scope='parcel',evaluated=[]}={}){
 const p=parcels.find(p=>p.id===parcelId);if(!p)throw new Error('请选择有效地块');
 const selected=scope==='project'?parcels:scope==='compare'?parcels.filter(p=>compared.includes(p.id)):[p];
 const docs=selected.map(p=>{const r=evaluate(p);return {key:p.id,title:p.name+' / '+p.id,source:p.source+' / '+p.date,parcelId:p.id,text:`${p.name}（${p.id}），现状${p.use}。土地面积${p.area}平方米，建筑面积${p.buildingArea}平方米，容积率${r.ratio}，空置率${p.vacancy===null?'缺失':p.vacancy+'%'}，设施直线距离${p.distance}米，产业标签${p.industry}，建筑调查等级${p.condition??'缺失'}。${evaluated.includes(p.id)?'本会话已运行评估。':'本会话未运行；以下为基于相同台账与规则的即时校算，不是已保存的运行。'}${DIMENSIONS.map((d,i)=>d+':'+(r.scores[i]??'缺失')).join('；')}。覆盖率${r.coverage}%，综合分${r.total??'资料不全，不输出'}。数据版本${p.dataVersion}，规则${RULE_VERSION}。全部为虚构演示数据。`};});
 const tokens=[...new Set((question.toLowerCase().match(/[a-z0-9-]+|[\u4e00-\u9fff]{2}/g)||[]))];
 const corpus=[...docs,...policy];const ranked=corpus.map(d=>({...d,rank:tokens.reduce((n,t)=>n+(d.title+d.text).toLowerCase().includes(t)*2,0)+(d.parcelId?2:0)})).sort((a,b)=>b.rank-a.rank);
 // Scoped parcel facts are never retrieved across an implicit project boundary.
 return ranked.slice(0,scope==='project'?16:8).map((d,i)=>({...d,id:'S'+(i+1)}));
}
export function evidenceAnswer(question,context){
 const sources=retrieve(question,context),facts=sources.filter(s=>s.parcelId),rules=sources.find(s=>s.key==='rules');
 const explicitIds=question.match(/UL-\d{3}/gi)||[];if(explicitIds.some(id=>!facts.some(s=>s.parcelId===id.toUpperCase())))return {answer:'该问题涉及当前问答范围之外的地块。请选择“比较清单”或“整个演示项目”后再提问。',sources:[],mode:'local'};
 if(!/地块|比较|评估|评分|规则|依据|来源|资料|缺失|补充|空置|容积|面积|建筑|产业|城市|地图|平台|功能|项目|规划|权属|为什么|关注|UL-/i.test(question))return {answer:'平台内部资料未提供这个问题的依据。请询问地块事实、评分原因、数据缺口、地块比较或平台功能。',sources:[],mode:'local'};
 const blocks=[];
 if(/平台|功能|PRD|地图|城市|手机/i.test(question)){const docs=sources.filter(s=>['product','geometry','prd'].includes(s.key));for(const d of docs)blocks.push(d.title+'\n'+d.text+' ['+d.id+']');}
 else {if(facts.length>1){const ranked=facts.map(d=>({d,r:evaluate(parcels.find(p=>p.id===d.parcelId))})).filter(x=>x.r.total!==null).sort((a,b)=>b.r.total-a.r.total);blocks.push('同规则综合关注度比较（即时校算）\n'+ranked.map(x=>x.d.title+'：'+x.r.total+' 分 ['+x.d.id+']').join('\n')+'\n资料不完整的地块不参与排序；高分不代表更适合开发。');}for(const d of facts)blocks.push(d.title+'\n'+d.text+' ['+d.id+']');if(rules&&/评估|评分|依据|为什么|关注|比较/.test(question))blocks.push('计算口径\n'+rules.text+' ['+rules.id+']');const q=sources.find(s=>s.key==='quality');if(q)blocks.push('仍需核实\n'+q.text+' ['+q.id+']');}
 const used=sources.filter(s=>blocks.some(b=>b.includes('['+s.id+']')));return {answer:blocks.join('\n\n')||'当前范围尚无可用证据。',sources:used,mode:'local'};
}

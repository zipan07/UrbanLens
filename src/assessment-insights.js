const valid=n=>typeof n==='number'&&Number.isFinite(n);
const round=n=>Math.round(n*10)/10;
const fmt=n=>valid(n)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(n):'未收录';
export function detailedInsights(run){
 const input=run.input||{},spatial=run.analysisSnapshot||{},fields=run.fieldEvidence||[],context=run.studyContext||{};
 const multiplier=1-(run.auxiliary?.effectiveWeight||0);
 const contributions=(run.dimensions||[]).map(d=>({name:d.name,score:d.score,weight:d.weight,status:d.status||'待核实',contribution:valid(d.score)?round(d.score*d.weight*multiplier):null,increase:valid(run.total)&&valid(d.score)?round((Math.min(100,d.score+10)-d.score)*d.weight*multiplier):null}));
 const lead=[...contributions].filter(d=>valid(d.contribution)).sort((a,b)=>b.contribution-a.contribution)[0];
 const simulated=fields.filter(f=>f.kind==='simulated'||run.mode==='demo'&&!['area','distance'].includes(f.key)).length;
 const verified=fields.filter(f=>f.verification==='verified'&&f.validity==='valid'&&f.kind!=='simulated'&&(run.mode!=='demo'||['area','distance'].includes(f.key))).length;
 const missing=fields.filter(f=>f.validity!=='valid').map(f=>f.label);
 const services=Object.entries({education:'教育',health:'医疗',park:'公园',daily:'生活服务'}).filter(([k])=>valid(spatial.counts?.[k])).map(([k,n])=>`${n} ${spatial.counts[k]} 处`).join('、');
 const space=`研究轮廓约 ${fmt(valid(input.area)?input.area/10000:null)} ha；关联 ${fmt(spatial.buildingCount)} 个建筑主体参考对象。${services?'600m 直线观察范围收录 '+services+'。':''}${valid(input.distance)?'最近收录交通点位直线距离约 '+fmt(input.distance)+'m。':''}点位数量反映当前快照，不能直接解释为服务供需平衡；实际步行路线、入口和服务能力需实测。`;
 const constraint=run.constraints?.filter(c=>c.status!=='checked').map(c=>c.label)||[];
 const pathways=[
 {title:'保留修缮',condition:'先确认可保留部分及其使用需求。',action:valid(input.condition)&&input.condition>=3?'依据专项检测确定必要修缮、消防和设备更新的边界，再研究功能置入。':'从设施维护、慢行连通和公共空间改善着手，避免在需求不明时扩大工程。',check:'对比修缮清单、受益人群、使用干扰和后续维护责任。'},
 {title:'小范围试点',condition:valid(input.vacancy)&&input.vacancy>=30?'空置率输入较高，先核对空置的具体位置和持续时间。':'先核对是否存在可用于低成本试点的场地与运营主体。',action:context.type==='商业文旅'?'选择可逆的活动和时段调整，观察居民、游客与商户之间的需求差异。':'选择边界清楚、可退出的空间试点，以使用反馈检验拟议功能。',check:'记录同口径的使用频次、持续使用率、满意度与运营收支，再决定是否扩展。'},
 {title:'综合改造',condition:constraint.length?`需先处理${constraint.join('、')}资料缺口或事项。`:'以已核对约束为基础，进一步核查审批、工程量与资金条件。',action:'将建筑、公共空间、配套与运营分项比较，保留与渐进实施方案同时比选。',check:'明确分期边界、资金来源、运营责任及退出条件；不以关注度分数替代可行性论证。'}
 ];
 const steps=[
 {title:'先核对：把假设转为证据',text:`${missing.length?'优先补齐 '+missing.join('、')+'。':''}${simulated?'本次有 '+simulated+' 项输入含模拟假设，优先以调查台账替换。':'逐项核对来源时点和现场适用性。'}形成范围确认图、建筑与使用调查表以及约束事项清单。`},
 {title:'再比选：比较三条更新路径',text:`${lead?'从“'+lead.name+'”这一主要分数贡献维度切入，':''}使用相同调查范围、服务对象和成本口径比较保留修缮、小范围试点与综合改造，说明每条路径的收益对象及代价。`},
 {title:'后跟踪：用同口径结果决定扩展',text:'在实施前记录使用状态、步行联系、居民反馈和运营基线；试点后用相同方法复测。未达到事先约定目标时，先查明原因并调整方案，避免直接追加建设。'}
 ];
 return {question:context.question||'结合实际使用需求，核对研究范围的改善重点。',space,contributions,lead,verified,simulated,fieldCount:fields.length,missing,pathways,steps,
  contributionNote:'贡献值 = 维度分 × 维度权重 × 基础评估占比。仅解释当前规则的分数构成，不能据此认定实际问题的严重程度。上调影响假设其他分值及辅助分不变，单项分值上限为100；表内逐项四舍五入。缺项时不推算总分变化。',
  evidenceNote:`计算完整性 ${fmt(run.coverage)}% 与资料真实性不同。${verified} 项输入有有效的人工核对记录，${simulated} 项含模拟假设；其余资料仍应核实来源与适用范围。`};
}
export function insightReportSections(run){const d=detailedInsights(run);return [
 {title:'研究问题与空间依据',paragraphs:[d.question,d.space,d.evidenceNote]},
 {title:'分数贡献与敏感性',rows:[['维度','分值','权重','当前贡献','单项上调10分的总分变化'],...d.contributions.map(c=>[c.name,fmt(c.score),fmt(c.weight*100)+'%',fmt(c.contribution),valid(c.increase)?'+'+fmt(c.increase):'缺失'])],paragraphs:[d.contributionNote]},
 {title:'更新路径比选',paragraphs:d.pathways.map(p=>p.title+'：'+p.condition+p.action+p.check)},
 {title:'下一步工作清单',paragraphs:d.steps.map(p=>p.title+'：'+p.text)}
 ];}

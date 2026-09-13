const valid=n=>typeof n==='number'&&Number.isFinite(n);
const fmt=n=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(n);
export function renewalSummary(run){
 const p=run.input||{},dims=(run.dimensions||[]).filter(d=>valid(d.score)),rank=[...dims].sort((a,b)=>b.score-a.score),sim=run.mode==='demo'||(run.simulation?.count||0)>0;
 const context=sim?'本次结果含模拟假设，以下为情景判断，需经现场和台账核实。':'以下依据本次评估快照整理；未核实的资料不能视为已确认事实。';
 const issues=[];
 if(valid(p.vacancy))issues.push(`输入空置率为 ${fmt(p.vacancy)}%，${p.vacancy>=30?'应优先核对闲置空间的面积、成因和可再利用条件':'宜先区分局部空置与正常周转，再判断是否需要空间改造'}`);
 if(valid(p.condition))issues.push(`建筑状况输入为 ${p.condition} 级（演示分级），${p.condition>=3?'建议先安排结构、消防及设备专项核查':'仍需专项检测确认可保留部分，不能据此认定建筑安全'}`);
 if(p.industry==='待调整')issues.push('功能适配输入为“待调整”，需要进一步核对现有业态、规划用途和经营需求');
 if(!issues.length)issues.push('当前经营、空置或建筑状况信息不足，暂不能确认具体低效成因，宜先形成调查清单');
 const constraints=run.constraints||[],unresolved=constraints.filter(c=>c.status!=='checked');
 const potential=rank.length?`五维结果中，“${rank[0].name}”关注度为 ${fmt(rank[0].score)} / 100${rank[1]?`，“${rank[1].name}”为 ${fmt(rank[1].score)} / 100`:''}。高分表示该维度更值得调查或改善，不表示收益更高或已经具备实施条件。`:'现有资料不足以比较五维关注度，应优先补齐缺项再判断更新重点。';
 const actions=[];
 if(valid(p.vacancy)&&p.vacancy>=30)actions.push('先选取可用的闲置空间开展小规模功能试点，再依据实际使用与经营反馈决定扩展范围');
 if(valid(p.distance)&&p.distance>500)actions.push('核查最近交通点位的实际步行路径、过街条件与出入口组织，避免只依据直线距离作出通达性判断');
 if(valid(p.condition)&&p.condition>=3)actions.push('将安全核查与必要修缮置于新增功能之前，并比较保留改造与局部替换方案');
 if(!actions.length)actions.push('优先比较保留修缮、服务补充与空间组织优化等方案，再决定是否需要增加建设量');
 actions.push('分别记录公共服务改善、空间利用和运营表现，先试点、后复核，按效果安排后续投入');
 return {context,cards:[{title:'当前面临的问题',text:issues.join('；')+'。'},{title:'未来更新潜力',text:potential+(valid(p.area)?`研究范围约 ${fmt(p.area/10000)} ha；可释放空间仍取决于权属、规划和建筑条件。`:'')},{title:'建议优化方向',text:actions.join('；')+'。'},{title:'实施与资金准备',text:`${!constraints.length?'尚缺独立约束核查记录，应先补齐规划、权属与安全资料。':unresolved.length?`${unresolved.map(c=>c.label).join('、')}仍有待补资料或待处理事项，宜先完成核查。`:'独立约束的项目内核对记录已形成，实施仍需履行相应审批。'}资金应按调查设计、建筑改造、公共空间、配套及运营准备分项测算。当前缺少经核实的工程量和报价，不能据此给出项目总投资；下方仅提供自定义改造情景计算。`}],missing:run.missing||[]};
}
export function retrofitBudget(buildingArea,share,unitCost,reserve){
 if(!valid(buildingArea)||buildingArea<=0||!valid(share)||share<=0||share>100||!valid(unitCost)||unitCost<=0||!valid(reserve)||reserve<0||reserve>100)return null;
 const area=buildingArea*share/100,base=area*unitCost,total=base*(1+reserve/100);
 return [area,base,total].every(Number.isFinite)?{area,base,reserveAmount:total-base,total}:null;
}

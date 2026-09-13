// Reproducible workflow assumptions. These are never survey observations.
export const SIMULATION_VERSION='XW-SIM-1';
export const SIMULATION_DATE='2026-09-13';
export function simulationSeed(geometry){let h=2166136261;const text=SIMULATION_VERSION+JSON.stringify(geometry);for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return h>>>0;}
export function simulationValues(unit,analysis){
 const seed=simulationSeed(unit.geometry),fraction=n=>((Math.imul(seed^(n*2654435761),1597334677)>>>0)%10000)/10000;
 return {buildingArea:Math.round(analysis.area*(.8+fraction(1)*1.6)),distance:Math.round(150+fraction(2)*1050),industry:fraction(3)<.5?'符合':'待调整',condition:1+Math.floor(fraction(4)*4),vacancy:Math.round(5+fraction(5)*55)};
}
export function validInput(key,value){return key==='industry'?['符合','待调整'].includes(value):typeof value==='number'&&Number.isFinite(value)&&value>=0&&(key!=='area'||value>0)&&(key!=='vacancy'||value<=100)&&(key!=='condition'||Number.isInteger(value)&&value>=1&&value<=4);}
export function simulationSource(key,originalValue=null){return {kind:'simulated',source:'模拟假设 · '+SIMULATION_VERSION,date:SIMULATION_DATE,method:({area:'试算采用当前轮廓的投影面积；原面积依据仍待核实',buildingArea:'范围面积 × 假设容积率（0.8–2.4）',distance:'假设交通距离（150–1,200 m）',industry:'假设产业标签：符合 / 待调整',condition:'假设调查等级（1–4），非安全鉴定',vacancy:'假设空置率（5%–60%）'})[key],originalValue};}
export function completeInput(input,unit,analysis){
 const values=simulationValues(unit,analysis),result={...input,fieldSources:{...input.fieldSources}};
 for(const key of Object.keys(values))if(!validInput(key,result[key])){result.fieldSources[key]=simulationSource(key,result[key]);result[key]=values[key];}
 result.simulation={version:SIMULATION_VERSION,seed:simulationSeed(unit.geometry)};
 return result;
}

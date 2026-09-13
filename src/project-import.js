import {HOUSING_FIELDS,validateHousingSamples} from './urban-context.js';
import {ringSelfIntersects} from './custom-area-geometry.js';
import {parseBusinessCSV,projectedArea} from './value-domain.js';
import {validateImport,boundsOf} from './geo.js';
export const FIELDS=[['parcel_id','地块编号'],['building_area_m2','建筑面积'],['vacancy_pct','空置率'],['industry','产业标签'],['condition','建筑调查等级'],['source','数据来源'],['date','调查日期']];
export function csvRows(text){
 const out=[];let row=[],cell='',quoted=false;const s=text.replace(/^\uFEFF/,'');
 for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else throw Error('CSV 引号格式错误');}else if(!quoted&&[',','\n','\r'].includes(c)){row.push(cell);cell='';if(c!==','){if(row.some(x=>x.trim()))out.push(row);row=[];if(c==='\r'&&s[i+1]==='\n')i++;}}else cell+=c;}
 if(quoted)throw Error('CSV 引号没有闭合');row.push(cell);if(row.some(x=>x.trim()))out.push(row);return out;
}
export const encodeCSV=rows=>rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
export function previewImport({kind,text,mapping={},areaUnit='m2',vacancyUnit='percent'},data,boundary){
 const errors=[],warnings=[],conflicts=[],candidate=structuredClone(data);let count=0,added=0,updated=0,unchanged=0,extent=null;
 try{
  if(typeof text!=='string'||new TextEncoder().encode(text).length>8*1024*1024)throw Error('每批文件限 8 MB');
  if(kind==='csv'){
   const rows=csvRows(text),head=rows.shift()?.map(x=>x.trim());if(!head?.length||new Set(head).size!==head.length)throw Error('表头为空或有重复字段');
   const selected=FIELDS.map(([k])=>mapping[k]||k);if(new Set(selected).size!==selected.length||selected.some(k=>!head.includes(k)))throw Error('请将七个字段分别映射到不同的有效列');
   if(!['m2','ha'].includes(areaUnit)||!['percent','fraction'].includes(vacancyUnit))throw Error('请选择有效单位');
   count=rows.length;const seen=new Set();if(!count||count>1000)throw Error('每批导入 1–1,000 条');
   const accepted={};rows.forEach((r,i)=>{try{
    if(r.length!==head.length)throw Error('列数与表头不一致');
    const vals=selected.map(k=>r[head.indexOf(k)].trim()),id=vals[0];if(['__proto__','constructor','prototype'].includes(id))throw Error('地块编号使用了保留名称');if(seen.has(id))throw Error('编号重复 '+id);seen.add(id);
    if(vals[1]&&areaUnit==='ha')vals[1]=String(Number(vals[1])*10000);if(vals[2]&&vacancyUnit==='fraction')vals[2]=String(Number(vals[2])*100);
    const record=parseBusinessCSV(encodeCSV([FIELDS.map(([k])=>k),vals]),data.units.map(u=>u.id))[id];
    accepted[id]=record;const old=data.uploaded[id];if(!old)added++;else if(JSON.stringify(old)===JSON.stringify(record))unchanged++;else{updated++;conflicts.push({id,fields:Object.keys(record).filter(k=>JSON.stringify(old[k])!==JSON.stringify(record[k])),old,incoming:record});}
   }catch(e){errors.push({row:i+2,message:e.message});}});
   candidate.uploaded={...data.uploaded,...accepted};
  }else if(kind==='housing'){
   const rows=csvRows(text),head=rows.shift()?.map(x=>x.trim()),selected=HOUSING_FIELDS.map(k=>mapping[k]||k);
   if(!head?.length||new Set(head).size!==head.length||new Set(selected).size!==selected.length||selected.some(k=>!head.includes(k)))throw Error('请将住宅样本字段映射到不同的有效列');
   const accepted=validateHousingSamples(rows.map((r,i)=>{if(r.length!==head.length)throw Error(`第 ${i+2} 行列数不一致`);return Object.fromEntries(HOUSING_FIELDS.map((k,j)=>[k,r[head.indexOf(selected[j])].trim()]));}),{asOf:new Date().toISOString().slice(0,10)});if(!accepted.length)throw Error('请提供至少一条住宅样本');
   count=accepted.length;const oldRows=data.housing||[],ids=new Set(accepted.map(r=>r.id));
   for(const record of accepted){const old=oldRows.find(r=>r.id===record.id);if(!old)added++;else if(JSON.stringify(old)===JSON.stringify(record))unchanged++;else{updated++;conflicts.push({id:record.id,fields:Object.keys(record).filter(k=>JSON.stringify(old[k])!==JSON.stringify(record[k])),old,incoming:record});}}
   candidate.housing=[...oldRows.filter(r=>!ids.has(r.id)),...accepted];validateHousingSamples(candidate.housing,{asOf:new Date().toISOString().slice(0,10)});
   warnings.push('售：总价万元；租：月租元。挂牌与成交分别统计；样本为用户提供，尚未独立核实。');
  }else if(kind==='geojson'){
   const input=JSON.parse(text);if(!Array.isArray(input?.features)||input.type!=='FeatureCollection')throw Error('请使用 GeoJSON FeatureCollection');if(input.crs)throw Error('请先转换为 WGS84 并移除 crs');
   count=input.features.length;if(!count||count>1000)throw Error('每批导入 1–1,000 条');const seen=new Set(),features=[];
   input.features.forEach((f,i)=>{try{
    const p=f.properties||{},id=String(p[mapping.parcel_id||'parcel_id']??'').trim();if(['__proto__','constructor','prototype'].includes(id))throw Error('地块编号使用了保留名称');if(seen.has(id))throw Error('编号重复 '+id);seen.add(id);
    const prepared={...f,properties:{...p,parcel_id:id,name:p[mapping.name||'name']||id}};
    const valid=validateImport({type:'FeatureCollection',features:[prepared]},boundary).features[0];const area=projectedArea(valid.geometry);if(!area||area<=0)throw Error('边界退化或面积为零');
    const g=valid.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;
    for(const poly of polys)for(const ring of poly){if(ring.length>3000)throw Error('单环最多 3,000 个点，请先简化边界');if(ringSelfIntersects(ring))throw Error('边界自相交或重叠');}
    const unit={...valid,id,properties:{...valid.properties,unit_id:id,research_type:'用户研究范围',imported:true,source_date:new Date().toISOString().slice(0,10),boundary_source:'用户导入，待核实'}};
    const old=data.units.find(u=>u.id===id);if(!old)added++;else if(JSON.stringify(old.geometry)===JSON.stringify(unit.geometry)&&old.properties.name===unit.properties.name)unchanged++;else{updated++;conflicts.push({id,fields:['geometry','properties'],old,incoming:unit});}
    features.push(unit);const b=boundsOf(g);extent=extent?[Math.min(extent[0],b[0]),Math.min(extent[1],b[1]),Math.max(extent[2],b[2]),Math.max(extent[3],b[3])]:b;
   }catch(e){errors.push({row:i+1,message:e.message});}});
   const ids=new Set(features.map(f=>f.id));candidate.units=[...data.units.filter(f=>!ids.has(f.id)),...features];warnings.push('WGS84 格式、面积和环自交检查通过仍不等于权属或测绘核验；复杂孔洞拓扑需专业复核。');
  }else throw Error('不支持的导入类型');
 }catch(e){errors.push({row:0,message:e.message});}
 return {kind,count,added,updated,unchanged,errors,warnings,conflicts,extent,candidate,units:{area:'m²',vacancy:'%'},canCommit:errors.length===0};
}
export function resolveImport(preview,decisions={}){
 if(!preview.canCommit)throw Error('存在阻断错误，整批未提交');const data=structuredClone(preview.candidate);
 for(const c of preview.conflicts){const choice=decisions[c.id];if(!['incoming','existing'].includes(choice))throw Error('请逐项选择冲突的生效来源');if(choice==='existing'){if(preview.kind==='csv')data.uploaded[c.id]=c.old;else if(preview.kind==='housing')data.housing=data.housing.map(r=>r.id===c.id?c.old:r);else data.units=data.units.map(u=>u.id===c.id?c.old:u);}}
 if(preview.kind==='housing')validateHousingSamples(data.housing,{asOf:new Date().toISOString().slice(0,10)});
 return data;
}

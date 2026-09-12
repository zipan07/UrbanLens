import {boundsOf,inGeometry} from './geo.js';

export const defaultFilters=()=>({query:'',type:'',district:'',use:'',minArea:null,maxArea:null,status:'',completeness:'',maxTransit:null,inView:false});

const USE_NAMES={residential:'居住用地',commercial:'商业用地',retail:'零售商业',industrial:'工业用地',university:'高等教育',college:'高等教育',school:'教育用地',hospital:'医疗用地',park:'公园绿地',recreation_ground:'游憩用地',grass:'草地',forest:'林地',brownfield:'棕地',construction:'建设中用地',railway:'铁路用地',cemetery:'墓地'};
const provided=value=>{const text=String(value??'').trim();return /^(?:待补充|待核实|未提供|未填写|未知|缺失|unknown|n\/a|null|undefined|—|-)?$/i.test(text)?'':text;};

// A research category is a study lens, not evidence of the site's actual use.
export function unitUse(unit){
 const p=unit?.properties||{};
 for(const field of ['use','current_use','landuse','amenity','leisure']){const value=provided(p[field]);if(value)return USE_NAMES[value.toLowerCase()]||value;}
 return '未提供';
}

// The fallback is supplied by the project whose import scope has been validated.
export function unitDistrict(unit,projectDistrict='玄武区'){
 const p=unit?.properties||{},value=provided(p.district)||provided(p['addr:district'])||provided(projectDistrict);
 return /^(鼓楼|玄武|秦淮|雨花台|建邺|栖霞)$/.test(value)?value+'区':value||'未提供';
}

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const hasLimit=value=>value!==null&&value!==undefined&&value!=='';
const pointInside=([x,y],[w,s,e,n])=>x>=w&&x<=e&&y>=s&&y<=n;
const overlap=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];

// Clip against four half-planes. Boundary contact counts as visible, and segments
// crossing the viewport are included even when both endpoints are off screen.
function segmentIntersects(a,b,[w,s,e,n]){
 let start=0,end=1;const dx=b[0]-a[0],dy=b[1]-a[1];
 for(const [p,q] of [[-dx,a[0]-w],[dx,e-a[0]],[-dy,a[1]-s],[dy,n-a[1]]]){
  if(p===0){if(q<0)return false;continue;}
  const ratio=q/p;
  if(p<0)start=Math.max(start,ratio);else end=Math.min(end,ratio);
  if(start>end)return false;
 }
 return true;
}
function lineIntersects(line,viewport){
 if(!line?.length)return false;
 if(line.some(p=>pointInside(p,viewport)))return true;
 return line.some((p,i)=>i>0&&segmentIntersects(line[i-1],p,viewport));
}

/** Geographic intersection with an axis-aligned [west,south,east,north] view. */
export function intersectsViewport(geometry,viewport){
 if(!geometry||!Array.isArray(viewport)||viewport.length!==4||!viewport.every(finite)||viewport[0]>viewport[2]||viewport[1]>viewport[3])return false;
 if(geometry.type==='GeometryCollection')return (geometry.geometries||[]).some(g=>intersectsViewport(g,viewport));
 const bounds=boundsOf(geometry);if(!bounds||!overlap(bounds,viewport))return false;
 if(geometry.type==='Point')return pointInside(geometry.coordinates,viewport);
 if(geometry.type==='MultiPoint')return geometry.coordinates.some(p=>pointInside(p,viewport));
 if(geometry.type==='LineString')return lineIntersects(geometry.coordinates,viewport);
 if(geometry.type==='MultiLineString')return geometry.coordinates.some(line=>lineIntersects(line,viewport));
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
 const [w,s,e,n]=viewport,corners=[[w,s],[e,s],[e,n],[w,n]];
 return polygons.some(rings=>rings.some(ring=>lineIntersects(ring,viewport))||corners.some(p=>inGeometry(p,{type:'Polygon',coordinates:rings})));
}

/** The same selection drives the list and map; all active conditions are ANDed.
 * runFor returns the most recent saved run, including one made under an old
 * fingerprint. This keeps never-run and pending-recalculation states distinct.
 */
export function filterUnits(units,{filter={},analyses=new Map(),resultFor=()=>null,runFor=()=>null,viewport=null,projectDistrict='玄武区'}={}){
 const f={...defaultFilters(),...filter},query=String(f.query||'').trim().toLowerCase();
 if(['minArea','maxArea','maxTransit'].some(key=>hasLimit(f[key])&&!Number.isFinite(Number(f[key]))))return [];
 return units.filter(unit=>{
  const p=unit.properties||{},analysis=analyses.get(unit.id);
  if(query&&!`${unit.id??''} ${p.parcel_id??''} ${p.name??''} ${p.label??''}`.toLowerCase().includes(query))return false;
  if(f.type&&p.research_type!==f.type)return false;
  if(f.district&&unitDistrict(unit,projectDistrict)!==f.district)return false;
  if(f.use&&unitUse(unit)!==f.use)return false;
  const area=analysis?.area;
  if(hasLimit(f.minArea)&&(!finite(area)||area<Number(f.minArea)))return false;
  if(hasLimit(f.maxArea)&&(!finite(area)||area>Number(f.maxArea)))return false;
  const distance=analysis?.nearest?.transit?.distance;
  if(hasLimit(f.maxTransit)&&(!finite(distance)||distance>Number(f.maxTransit)))return false;
  if(f.inView&&!intersectsViewport(unit.geometry,viewport))return false;
  if(f.status||f.completeness){
   const result=resultFor(unit),run=f.status?runFor(unit):null;
   if(f.status){
    const status=run?(run.fingerprint&&run.fingerprint===result?.fingerprint?'done':'stale'):'todo';
    if(f.status!==status)return false;
   }
   const complete=finite(result?.coverage)&&result.coverage>=100;
   if(f.completeness==='complete'&&!complete||f.completeness==='missing'&&complete)return false;
  }
  return true;
 });
}

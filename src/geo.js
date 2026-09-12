// Coordinate math is deliberately independent of the renderer.
export const EMPTY = () => ({type:'FeatureCollection',features:[]});
export function coordinates(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  const out=[]; const walk=c=>{if(Array.isArray(c)&&typeof c[0]==='number')out.push(c);else if(Array.isArray(c))c.forEach(walk);};
  walk(geometry.coordinates); return out;
}
export function boundsOf(geometry) {
  const p=coordinates(geometry); if(!p.length)return null;
  return p.reduce((b,c)=>[Math.min(b[0],c[0]),Math.min(b[1],c[1]),Math.max(b[2],c[0]),Math.max(b[3],c[1])],[Infinity,Infinity,-Infinity,-Infinity]);
}
export function centerOf(geometry) {
  if(geometry.type==='Point')return geometry.coordinates.slice(0,2);
  const b=boundsOf(geometry);return [(b[0]+b[2])/2,(b[1]+b[3])/2];
}
export function inRing([x,y],ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))inside=!inside;
  }return inside;
}
export function inGeometry(point,g) {
  const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  return polygons.some(p=>inRing(point,p[0])&&!p.slice(1).some(r=>inRing(point,r)));
}
export function heightOf(p) {
  const meters=value=>{if(value===undefined||value===null)return null;const s=String(value).trim();const match=s.match(/^(\d+(?:\.\d+)?)\s*(m|米|ft|feet|')?$/i);if(!match)return null;const n=Number(match[1])*(/ft|feet|'/.test(match[2]||'')?.3048:1);return n>0&&n<=700?n:null;};
  const explicit=meters(p.height),levelText=String(p['building:levels']??'');
  const floors=/^\d+(?:\.\d+)?$/.test(levelText)?Number(levelText):null;
  const validFloors=floors>0&&floors<=150?floors:null;
  const h=explicit??(validFloors?validFloors*3:null);
  const base=meters(p.min_height)??0;
  return {height_m:h,levels:validFloors,height_source:explicit?'osm':validFloors?'levels':'unknown',render_height:h??12,render_base:h===null?0:Math.min(base,h)};
}
export function distanceMeters(a,b) {
  const rad=Math.PI/180,dy=(b[1]-a[1])*rad,dx=(b[0]-a[0])*rad;
  const h=Math.sin(dy/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dx/2)**2;
  return 6371008.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function validateImport(input,boundary) {
  if(input?.type!=='FeatureCollection'||!Array.isArray(input.features))throw new Error('请使用 GeoJSON FeatureCollection。');
  if(input.crs)throw new Error('请先转换为 WGS84 经纬度并移除旧式 crs 字段。');
  if(!input.features.length||input.features.length>1000)throw new Error('每批导入 1–1,000 个研究范围。');
  const ids=new Set();let points=0;
  const features=input.features.map((f,i)=>{
    const id=String(f.properties?.parcel_id??'').trim();if(!id||id.length>100)throw new Error(`第 ${i+1} 条缺少有效 parcel_id（最长100字）。`);
    if(ids.has(id))throw new Error(`编号重复：${id}`);ids.add(id);
    const g=f.geometry;if(!['Polygon','MultiPolygon'].includes(g?.type))throw new Error(`${id} 必须是 Polygon / MultiPolygon。`);
    const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
    if(!Array.isArray(polygons)||!polygons.length)throw new Error(`${id} 边界为空。`);
    for(const poly of polygons){if(!Array.isArray(poly)||!poly.length)throw new Error(`${id} 缺少外环。`);for(const ring of poly){
      if(!Array.isArray(ring)||ring.length<4)throw new Error(`${id} 边界至少需要4个闭合坐标。`);
      for(const c of ring){points++;if(points>200000)throw new Error('边界过于复杂，请简化到20万个坐标点以内。');if(!Array.isArray(c)||!Number.isFinite(c[0])||!Number.isFinite(c[1])||c[0]<118.65||c[0]>119.02||c[1]<31.9||c[1]>32.2)throw new Error(`${id} 坐标超出南京研究范围，请核对 WGS84。`);}
      const a=ring[0],b=ring.at(-1);if(a[0]!==b[0]||a[1]!==b[1])throw new Error(`${id} 边界环没有闭合。`);
    }}
    if(!coordinates(g).some(c=>inGeometry(c,boundary)))throw new Error(`${id} 没有位于玄武区内的边界点，请核对研究范围。`);
    return {type:'Feature',id,properties:{parcel_id:id,name:String(f.properties.name||id).slice(0,200),category:'imported',source:'用户导入 / 未复核',use:String(f.properties.use||'待补充').slice(0,100)},geometry:structuredClone(g)};
  });return {type:'FeatureCollection',features};
}

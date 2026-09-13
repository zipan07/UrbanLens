import {ShapeUtils} from 'three/src/extras/ShapeUtils.js';
import {Vector2} from 'three/src/math/Vector2.js';
import {buildingBounds} from './building-appearance.js';

export const REALISM_LAYER_ID='building-realism';
export const REALISM_LIMITS=Object.freeze({buildings:420,vertices:150000,minZoom:13.8});
const WORLD=40030228.88407185,RAD=Math.PI/180;
const mercator=([lng,lat])=>[(lng+180)/360,(1-Math.asinh(Math.tan(lat*RAD))/Math.PI)/2];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const polygons=g=>g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
const rgb=hex=>[1,3,5].map(i=>parseInt(String(hex||'#c3c8c6').slice(i,i+2),16)/255);
const midpoint=(a,b)=>a.map((x,i)=>(x+b[i])/2);
const cross=(a,b,c)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n)||1;return n.map(x=>x/length);};
function clip(points,side,axis,mid){const dot=p=>p[0]*axis[0]+p[1]*axis[1]-mid,out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=dot(a),db=dot(b),ia=side*da>=-1e-8,ib=side*db>=-1e-8;if(ia)out.push(a);if(ia!==ib){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}

/** Meter-based mesh over the original polygon and holes. No replacement boxes. */
export function buildBuildingMesh(features,{origin=[118.81,32.055],theme='day',terrainElevation=()=>0,schematic=true,vertexLimit=REALISM_LIMITS.vertices}={}){
 const originMercator=mercator(origin),unit=1/(WORLD*Math.cos(origin[1]*RAD)),vertices=[],included=[];
 const local=p=>{const m=mercator(p);return [(m[0]-originMercator[0])/unit,(originMercator[1]-m[1])/unit];};
 const emit=(tri,color,kind,uv)=>{if(vertices.length/12+3>vertexLimit)return false;const normal=cross(...tri);for(let i=0;i<3;i++)vertices.push(...tri[i],...normal,...color,...(uv?.[i]||[tri[i][0],tri[i][1]]),kind);return true;};
 for(const f of features){const p=f.properties||{},height=schematic?Number(p.render_height):Number(p.height_m);if(!Number.isFinite(height)||height<=0)continue;const b=buildingBounds(f.geometry);if(!b)continue;const center=[(b[0]+b[2])/2,(b[1]+b[3])/2],ground=Number(terrainElevation(center,f))||0,base=ground+Math.min(Number(p.render_base)||0,height),top=ground+height+.18,wall=rgb(p[`appearance_${theme}`]||p.appearance_day),roofColor=rgb(p.roof_color),facade={windows:1,curtain:2,classical:3,industrial:4,stone:5}[p.facade_kind]||1,start=vertices.length;
  for(const polygon of polygons(f.geometry)){
   const rings=polygon.map(r=>r.slice(0,r.length>1&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1]?-1:undefined).map(local));
   if(rings[0].length<3||rings.flat().length>(p.visual_landmark?2000:500))continue;
   const contour=rings[0].map(c=>new Vector2(...c)),holes=rings.slice(1).map(r=>r.map(c=>new Vector2(...c))),triangles=ShapeUtils.triangulateShape(contour,holes),flat=rings.flat();
   let axis=[1,0],longest=0;for(let i=0;i<rings[0].length;i++){const a=rings[0][i],b=rings[0][(i+1)%rings[0].length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len>longest){longest=len;axis=[dx/len,dy/len];}}
   const across=[-axis[1],axis[0]],range=flat.reduce((r,c)=>{const u=c[0]*axis[0]+c[1]*axis[1],v=c[0]*across[0]+c[1]*across[1];return [Math.min(r[0],u),Math.min(r[1],v),Math.max(r[2],u),Math.max(r[3],v)];},[Infinity,Infinity,-Infinity,-Infinity]),mid=(range[1]+range[3])/2,half=(range[3]-range[1])/2,roofHeight=p.roof_form==='gabled'?clamp(half*.42,1.2,7):p.roof_form==='dome'?clamp(half*.65,4,14):0;
   const roofZ=c=>{if(p.roof_form==='gabled')return top+roofHeight*Math.max(0,1-Math.abs(c[0]*across[0]+c[1]*across[1]-mid)/(half||1));if(p.roof_form==='dome'){const u=(c[0]*axis[0]+c[1]*axis[1]-(range[0]+range[2])/2)/Math.max(1,(range[2]-range[0])*.27),v=(c[0]*across[0]+c[1]*across[1]-mid)/Math.max(1,half*.68);return top+roofHeight*Math.sqrt(Math.max(0,1-u*u-v*v));}return top;};
   for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.15)continue;
    // Split gable-end edges at the ridge so their triangular ends meet the roof.
    const va=a[0]*across[0]+a[1]*across[1]-mid,vb=b[0]*across[0]+b[1]*across[1]-mid,segments=p.roof_form==='gabled'&&va*vb<0?[[a,[a[0]+(b[0]-a[0])*va/(va-vb),a[1]+(b[1]-a[1])*va/(va-vb)]],[[a[0]+(b[0]-a[0])*va/(va-vb),a[1]+(b[1]-a[1])*va/(va-vb)],b]]:[[a,b]];
    for(const [a,b]of segments){const length=Math.hypot(b[0]-a[0],b[1]-a[1]),za=roofZ(a),zb=roofZ(b),points=[[...a,base],[...b,base],[...b,zb],[...a,za]],uv=[[0,0],[length,0],[length,zb-base],[0,za-base]];emit([points[0],points[1],points[2]],wall,facade,[uv[0],uv[1],uv[2]]);emit([points[0],points[2],points[3]],wall,facade,[uv[0],uv[2],uv[3]]);}
   }
   const roofTriangle=(tri,depth=0)=>{if(depth>0){const [a,b,c]=tri,ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);roofTriangle([a,ab,ca],depth-1);roofTriangle([ab,b,bc],depth-1);roofTriangle([ca,bc,c],depth-1);roofTriangle([ab,bc,ca],depth-1);return;}emit(tri.map(c=>[...c,roofZ(c)]),roofColor,0);};
   for(const indices of triangles){const tri=indices.map(i=>flat[i]);if(p.roof_form==='gabled'){for(const side of [-1,1]){const clipped=clip(tri,side,across,mid);for(let i=1;i<clipped.length-1;i++)roofTriangle([clipped[0],clipped[i],clipped[i+1]]);}}else roofTriangle(tri,p.roof_form==='dome'?3:0);}
   if(vertices.length/12>=vertexLimit)break;
  }
  if(vertices.length>start)included.push(p.osm_id||f.id);if(vertices.length/12>=vertexLimit)break;
 }
 return {vertices:new Float32Array(vertices),included,origin:originMercator,unit,stride:12};
}

const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec3 a_color;
layout(location=3) in vec2 a_uv;
layout(location=4) in float a_kind;
uniform mat4 u_matrix;
out vec3 v_color;out vec3 v_normal;out vec2 v_uv;flat out int v_kind;
void main(){v_color=a_color;v_normal=a_normal;v_uv=a_uv;v_kind=int(a_kind+.5);gl_Position=u_matrix*vec4(a_position,1.0);}`;
const FS=`#version 300 es
precision highp float;
in vec3 v_color;in vec3 v_normal;in vec2 v_uv;flat in int v_kind;
uniform float u_night;uniform float u_detail;
out vec4 fragColor;
void main(){vec3 color=v_color;float light=.76+.24*abs(dot(normalize(v_normal),normalize(vec3(-.45,-.65,1.0))));
 if(v_kind>0&&u_detail>.01){vec2 spacing=v_kind==2?vec2(2.4,3.7):v_kind==3?vec2(4.8,4.2):v_kind==4?vec2(5.8,4.8):vec2(3.6,3.1);vec2 cell=fract(v_uv/spacing);vec2 edge=fwidth(v_uv/spacing)*1.2;float left=v_kind==2?.055:.19,right=v_kind==2?.945:.81;float win=smoothstep(left-edge.x,left+edge.x,cell.x)*(1.0-smoothstep(right-edge.x,right+edge.x,cell.x))*smoothstep(.21-edge.y,.21+edge.y,cell.y)*(1.0-smoothstep(.80-edge.y,.80+edge.y,cell.y));
 float random=fract(sin(dot(floor(v_uv/spacing),vec2(12.9898,78.233)))*43758.5453);vec3 glass=mix(vec3(.24,.36,.41),vec3(.54,.69,.73),random*.45);glass=mix(glass,mix(vec3(.12,.23,.29),vec3(.96,.76,.43),step(.63,random)),u_night);color=mix(color,glass,win*u_detail*(v_kind==5?.46:1.0));
 float ledge=1.0-smoothstep(.024,.046,min(cell.y,1.0-cell.y));color*=1.0-ledge*.10*u_detail;
 }else if(v_kind==0){float seam=1.0-smoothstep(.015,.06,min(fract(v_uv.x/1.6),1.0-fract(v_uv.x/1.6)));color*=1.0-seam*.08*u_detail;}
 fragColor=vec4(color*light,1.0);}`;
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error||'建筑材质编译失败');}return s;}
/** Multiply projection by a local East/North/Up meter transform in JS doubles. */
export function localBuildingMatrix(matrix,origin,unit){const out=new Float32Array(16);for(let i=0;i<4;i++){out[i]=matrix[i]*unit;out[4+i]=-matrix[4+i]*unit;out[8+i]=matrix[8+i]*unit;out[12+i]=matrix[i]*origin[0]+matrix[4+i]*origin[1]+matrix[12+i];}return out;}
function customLayer(getState,mesh){return {id:REALISM_LAYER_ID,type:'custom',renderingMode:'3d',mesh,
 onAdd(map,gl){this.map=map;this.gl=gl;let vs,fs;try{vs=shader(gl,gl.VERTEX_SHADER,VS);fs=shader(gl,gl.FRAGMENT_SHADER,FS);this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program)||'建筑材质连接失败');this.buffer=gl.createBuffer();this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);let offset=0;[3,3,3,2,1].forEach((size,i)=>{gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,48,offset*4);offset+=size;});gl.bindVertexArray(null);this.uniforms=Object.fromEntries(['u_matrix','u_night','u_detail'].map(k=>[k,gl.getUniformLocation(this.program,k)]));}catch(e){this.onRemove();throw e;}finally{if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);}},
 render(gl,options){const state=getState();if(!state.realism||state.mode==='2d'||state.layers?.buildings===false||this.map.getPitch()<2||this.map.getZoom()<REALISM_LIMITS.minZoom||!this.program)return;const matrix=options.defaultProjectionData?.mainMatrix;if(!matrix)return;gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-1);gl.uniformMatrix4fv(this.uniforms.u_matrix,false,localBuildingMatrix(matrix,this.mesh.origin,this.mesh.unit));gl.uniform1f(this.uniforms.u_night,state.theme==='night'?1:0);gl.uniform1f(this.uniforms.u_detail,clamp((this.map.getZoom()-13.8)/1.6,0,1));gl.drawArrays(gl.TRIANGLES,0,this.mesh.vertices.length/12);gl.disable(gl.POLYGON_OFFSET_FILL);gl.bindVertexArray(null);},
 onRemove(){const gl=this.gl;if(!gl)return;if(this.vao)gl.deleteVertexArray(this.vao);if(this.buffer)gl.deleteBuffer(this.buffer);if(this.program)gl.deleteProgram(this.program);this.vao=this.buffer=this.program=null;}
};}

export function installBuildingRealism({map,buildings,getState,onError=()=>{}}){
 if(map.fallback)return {sync(){},destroy(){}};let destroyed=false,timer=null,signature='',failed=false;
 const indexed=buildings.features.map(f=>({f,b:buildingBounds(f.geometry)})).filter(x=>x.b);
 function sync(){if(destroyed)return;clearTimeout(timer);timer=null;const state=getState(),active=state.realism&&state.mode!=='2d'&&state.layers?.buildings!==false&&map.getPitch()>=2&&map.getZoom()>=REALISM_LIMITS.minZoom;
  if(!active){if(map.getLayer(REALISM_LAYER_ID))map.removeLayer(REALISM_LAYER_ID);signature='';if(!state.realism)failed=false;return;}
  if(failed||!map.getLayer('building-3d'))return;
  try{const bounds=map.getBounds(),c=map.getCenter(),west=bounds.getWest(),south=bounds.getSouth(),east=bounds.getEast(),north=bounds.getNorth(),selected=indexed.filter(x=>x.b[0]<=east&&x.b[2]>=west&&x.b[1]<=north&&x.b[3]>=south).sort((a,b)=>{const score=x=>Math.hypot(((x.b[0]+x.b[2])/2-c.lng)*.85,(x.b[1]+x.b[3])/2-c.lat)-(x.f.properties.visual_landmark ? .015 : 0);return score(a)-score(b);}).slice(0,REALISM_LIMITS.buildings),key=JSON.stringify([state.theme,state.schematic,state.terrain,selected.map(x=>x.f.properties.osm_id||x.f.id)]);
   if(signature===key&&map.getLayer(REALISM_LAYER_ID)){map.triggerRepaint();return;}
   const mesh=buildBuildingMesh(selected.map(x=>x.f),{theme:state.theme,schematic:state.schematic,terrainElevation:point=>state.terrain?map.queryTerrainElevation(point)||0:0});if(map.getLayer(REALISM_LAYER_ID))map.removeLayer(REALISM_LAYER_ID);map.addLayer(customLayer(getState,mesh),'district-focus');signature=key;map.triggerRepaint();
  }catch(error){failed=true;if(map.getLayer(REALISM_LAYER_ID))map.removeLayer(REALISM_LAYER_ID);onError(error);}
 }
 const queue=()=>{clearTimeout(timer);timer=setTimeout(sync,80);};
 const terrain=event=>{if(event?.sourceId==='dem'&&event.isSourceLoaded){signature='';queue();}};
 const restored=()=>{failed=false;signature='';if(map.getLayer(REALISM_LAYER_ID))map.removeLayer(REALISM_LAYER_ID);queue();};
 const style=()=>{signature='';queue();};
 for(const event of ['moveend','pitchend','terrain'])map.on(event,queue);map.on('style.load',style);map.on('sourcedata',terrain);map.on('webglcontextrestored',restored);
 function destroy(){if(destroyed)return;destroyed=true;clearTimeout(timer);for(const event of ['moveend','pitchend','terrain'])map.off(event,queue);map.off('style.load',style);map.off('sourcedata',terrain);map.off('webglcontextrestored',restored);map.off('remove',destroy);try{if(map.getLayer(REALISM_LAYER_ID))map.removeLayer(REALISM_LAYER_ID);}catch{}}
 map.on('remove',destroy);sync();return {sync,destroy};
}

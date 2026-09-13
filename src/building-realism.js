import {buildingBounds} from './building-appearance.js';
import {buildBuildingMesh,REALISM_LIMITS} from './building-geometry.js';
import {createBuildingAssets,uploadBuildingTextures} from './building-materials.js';
import {BUILDING_VERTEX_SHADER as VS,BUILDING_FRAGMENT_SHADER as FS} from './building-shaders.js';
export {buildBuildingMesh,REALISM_LIMITS};
export const REALISM_LAYER_ID='building-realism';
export const REALISM_PICK_LAYER='building-realism-pick';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error||'建筑材质编译失败');}return s;}
/** Multiply projection by local East/North/Up metre coordinates in JS doubles. */
export function localBuildingMatrix(matrix,origin,unit){const out=new Float32Array(16);for(let i=0;i<4;i++){out[i]=matrix[i]*unit;out[4+i]=-matrix[4+i]*unit;out[8+i]=matrix[8+i]*unit;out[12+i]=matrix[i]*origin[0]+matrix[4+i]*origin[1]+matrix[12+i];}return out;}
function customLayer(getState,mesh,pack){return {id:REALISM_LAYER_ID,type:'custom',renderingMode:'3d',mesh,pack,
 onAdd(map,gl){this.map=map;this.gl=gl;let vs,fs;try{
  vs=shader(gl,gl.VERTEX_SHADER,VS);fs=shader(gl,gl.FRAGMENT_SHADER,FS);this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program)||'建筑材质连接失败');
  this.buffer=gl.createBuffer();this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);let offset=0;[3,3,3,3,1,1,1].forEach((size,i)=>{gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,60,offset*4);offset+=size;});gl.bindVertexArray(null);
  this.uniforms=Object.fromEntries(['u_matrix','u_night','u_ink','u_detail','u_textures','u_view','u_albedo','u_normal','u_rough'].map(k=>[k,gl.getUniformLocation(this.program,k)]));this.update(mesh,pack);
 }catch(e){this.onRemove();throw e;}finally{if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);}},
 update(mesh,pack){this.mesh=mesh;const gl=this.gl;if(!gl)return;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,null);if(!this.textures||this.pack!==pack){for(const t of this.textures||[])gl.deleteTexture(t);this.textures=uploadBuildingTextures(gl,pack);}this.pack=pack;},
 render(gl,options){const state=getState();if(!state.realism||state.mode==='2d'||state.layers?.buildings===false||this.map.getPitch()<2||this.map.getZoom()<REALISM_LIMITS.minZoom||!this.program)return;const matrix=options.defaultProjectionData?.mainMatrix;if(!matrix)return;
  gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-1);
  gl.uniformMatrix4fv(this.uniforms.u_matrix,false,localBuildingMatrix(matrix,this.mesh.origin,this.mesh.unit));gl.uniform1f(this.uniforms.u_night,state.theme==='night'?1:0);gl.uniform1f(this.uniforms.u_ink,state.theme==='ink'?1:0);gl.uniform1f(this.uniforms.u_detail,clamp((this.map.getZoom()-12.4)/2.0,.25,1));gl.uniform1f(this.uniforms.u_textures,this.pack?1:0);
  const pitch=this.map.getPitch()*Math.PI/180,bearing=(this.map.getBearing?.()||0)*Math.PI/180;gl.uniform3f(this.uniforms.u_view,-Math.sin(bearing)*Math.sin(pitch),-Math.cos(bearing)*Math.sin(pitch),Math.cos(pitch));
  this.textures.forEach((t,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D_ARRAY,t);gl.uniform1i(this.uniforms[['u_albedo','u_normal','u_rough'][i]],i);});
  const shadows=this.mesh.shadowVertices||0;if(shadows){gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,shadows);}
  gl.depthMask(true);gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLES,shadows,this.mesh.vertices.length/15-shadows);gl.disable(gl.POLYGON_OFFSET_FILL);gl.bindVertexArray(null);this.textures.forEach((_,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D_ARRAY,null);});gl.activeTexture(gl.TEXTURE0);
 },
 onRemove(){const gl=this.gl;if(!gl)return;for(const t of this.textures||[])gl.deleteTexture(t);if(this.vao)gl.deleteVertexArray(this.vao);if(this.buffer)gl.deleteBuffer(this.buffer);if(this.program)gl.deleteProgram(this.program);this.vao=this.buffer=this.program=this.textures=null;}
};}
export function installBuildingRealism({map,buildings,getState,base=null,onStatus=()=>{},onError=()=>{}}){
 if(map.fallback)return {sync(){},destroy(){}};let destroyed=false,timer=null,signature='',failed=false,pack=null,loading=false,layer=null,originalFilter,filterCaptured=false;
 const indexed=buildings.features.map(f=>({f,b:buildingBounds(f.geometry)})).filter(x=>x.b),assets=base?createBuildingAssets(base,{onStatus}):null;
 const remove=()=>{if(map.getLayer(REALISM_LAYER_ID))map.removeLayer(REALISM_LAYER_ID);if(map.getLayer(REALISM_PICK_LAYER))map.removeLayer(REALISM_PICK_LAYER);if(filterCaptured&&map.getLayer('building-3d'))map.setFilter?.('building-3d',originalFilter||null);layer=null;signature='';};
 function sync(){if(destroyed)return;clearTimeout(timer);timer=null;const state=getState(),active=state.realism&&state.mode!=='2d'&&state.layers?.buildings!==false&&map.getPitch()>=2&&map.getZoom()>=REALISM_LIMITS.minZoom;
  if(!active){remove();if(!state.realism)failed=false;return;}if(failed||!map.getLayer('building-3d'))return;
  if(assets&&!pack&&!loading){loading=true;assets.load().then(result=>{if(destroyed)return;pack=result;loading=false;signature='';sync();}).catch(()=>{loading=false;/* Procedural geometry remains usable if an image request fails. */});}
  try{
   const bounds=map.getBounds(),c=map.getCenter(),west=bounds.getWest(),south=bounds.getSouth(),east=bounds.getEast(),north=bounds.getNorth(),detail=map.getZoom()>=15.2;
   const landmarkIds=new Set(pack?.manifest.landmarks.map(l=>l.osmId)||[]),selected=indexed.filter(x=>x.b[0]<=east&&x.b[2]>=west&&x.b[1]<=north&&x.b[3]>=south).sort((a,b)=>{const score=x=>Math.hypot(((x.b[0]+x.b[2])/2-c.lng)*.85,(x.b[1]+x.b[3])/2-c.lat)-(landmarkIds.has(x.f.properties.osm_id)||x.f.properties.visual_landmark ? .015 : 0);return score(a)-score(b);}).slice(0,REALISM_LIMITS.buildings),key=JSON.stringify([state.theme,state.schematic,state.terrain,detail,!!pack,selected.map(x=>x.f.properties.osm_id||x.f.id).sort(),detail?selected.slice(0,220).map(x=>x.f.properties.osm_id||x.f.id).sort():null]);
   if(signature===key&&map.getLayer(REALISM_LAYER_ID)){map.triggerRepaint();return;}
   // A failed photo falls back to its generic material without a blank photo rectangle.
   const manifest=pack?{...pack.manifest,landmarks:pack.manifest.landmarks.map(l=>{const i=pack.manifest.materials.findIndex(m=>m.id===l.photo);return i>=0&&!pack.maps[i]?.baseColor?{...l,photo:null}:l;})}:null;
   const mesh=buildBuildingMesh(selected.map(x=>x.f),{theme:state.theme,schematic:state.schematic,detail,manifest,terrainElevation:point=>state.terrain?map.queryTerrainElevation?.(point)||0:0});
   if(map.getLayer(REALISM_LAYER_ID)&&layer){layer.update(mesh,pack);}else{layer=customLayer(getState,mesh,pack);map.addLayer(layer,map.getLayer('district-focus')?'district-focus':undefined);}
   // Keep a transparent, queryable extrusion so building picking works on the new mesh.
   if(map.setFilter&&map.getStyle){if(!filterCaptured){originalFilter=map.getFilter?.('building-3d');filterCaptured=true;}const include=['in',['get','osm_id'],['literal',mesh.included]],baseStyle=map.getStyle().layers.find(l=>l.id==='building-3d');if(baseStyle&&!map.getLayer(REALISM_PICK_LAYER))map.addLayer({...baseStyle,id:REALISM_PICK_LAYER,filter:originalFilter?['all',originalFilter,include]:include,paint:{...baseStyle.paint,'fill-extrusion-opacity':0}},REALISM_LAYER_ID);else if(map.getLayer(REALISM_PICK_LAYER)){map.setFilter(REALISM_PICK_LAYER,originalFilter?['all',originalFilter,include]:include);map.setPaintProperty(REALISM_PICK_LAYER,'fill-extrusion-height',baseStyle.paint['fill-extrusion-height']);}map.setFilter('building-3d',originalFilter?['all',originalFilter,['!',include]]:['!',include]);}
   signature=key;map.triggerRepaint();
  }catch(error){failed=true;remove();onError(error);}
 }
 const queue=()=>{clearTimeout(timer);timer=setTimeout(sync,80);};
 const terrain=event=>{if(event?.sourceId==='dem'&&event.isSourceLoaded){signature='';queue();}};
 const restored=()=>{failed=false;remove();queue();};
 const style=()=>{signature='';layer=null;filterCaptured=false;queue();};
 for(const event of ['moveend','pitchend','terrain'])map.on(event,queue);map.on('style.load',style);map.on('sourcedata',terrain);map.on('webglcontextrestored',restored);
 function destroy(){if(destroyed)return;destroyed=true;clearTimeout(timer);assets?.destroy();for(const event of ['moveend','pitchend','terrain'])map.off(event,queue);map.off('style.load',style);map.off('sourcedata',terrain);map.off('webglcontextrestored',restored);map.off('remove',destroy);try{remove();}catch{}}
 map.on('remove',destroy);sync();return {sync,destroy};
}

// Local, attributed assets only. Loading starts when the realism layer is enabled.
export const TEXTURE_SIZE=512;
export function photoTransform(corners){
 if(!Array.isArray(corners)||corners.length!==4||corners.some(p=>!Array.isArray(p)||p.length!==2)||corners.flat().some(x=>!Number.isFinite(x)||x<0||x>1))return null;
 const [p0,p1,p2,p3]=corners,dx1=p1[0]-p2[0],dx2=p3[0]-p2[0],dy1=p1[1]-p2[1],dy2=p3[1]-p2[1],sx=p0[0]-p1[0]+p2[0]-p3[0],sy=p0[1]-p1[1]+p2[1]-p3[1],den=dx1*dy2-dx2*dy1;
 let g=0,h=0;if(Math.abs(sx)+Math.abs(sy)>1e-9){if(Math.abs(den)<1e-10)return null;g=(sx*dy2-dx2*sy)/den;h=(dx1*sy-sx*dy1)/den;}
 const matrix=[p1[0]-p0[0]+g*p1[0],p3[0]-p0[0]+h*p3[0],p0[0],p1[1]-p0[1]+g*p1[1],p3[1]-p0[1]+h*p3[1],p0[1],g,h,1];
 const [a,b,c,d,e,f,i,j,k]=matrix,det=a*(e*k-f*j)-b*(d*k-f*i)+c*(d*j-e*i);return Math.abs(det)>1e-9&&matrix.every(Number.isFinite)?matrix:null;
}
export function transformPhotoUV(matrix,u,v){return matrix?[matrix[0]*u+matrix[1]*v+matrix[2],matrix[3]*u+matrix[4]*v+matrix[5],matrix[6]*u+matrix[7]*v+matrix[8]]:[u,v,1];}
export function materialIndex(manifest){return new Map((manifest?.materials||[]).map((m,i)=>[m.id,{...m,layer:i+1}]));}
export function landmarkIndex(manifest){return new Map((manifest?.landmarks||[]).filter(l=>l.osmId).map(l=>[l.osmId,{...l,transform:photoTransform(l.facadeCorners)}]));}
export function createBuildingAssets(base,{onStatus=()=>{}}={}){
 const albedoSize=globalThis.matchMedia?.('(min-width: 900px) and (pointer: fine)')?.matches&&(globalThis.navigator?.deviceMemory??8)>=8?1024:TEXTURE_SIZE;
 let promise=null,controller=null,disposed=false,bitmaps=[];
 const local=(path)=>{if(typeof path!=='string'||!/^assets\/building-realism\/[a-z0-9._/-]+$/i.test(path)||path.includes('..'))throw Error('建筑贴图路径无效');return new URL(path,base).href;};
 async function load(){if(promise)return promise;disposed=false;controller=new AbortController();promise=(async()=>{
  onStatus({state:'loading'});const response=await fetch(new URL('data/building-materials.json?v=16',base),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])});if(!response.ok)throw Error('建筑材质清单暂不可用');const manifest=await response.json();if(!Array.isArray(manifest.materials)||manifest.materials.length>24)throw Error('建筑材质清单无效');
  const maps=[];let failures=0,next=0;const tasks=manifest.materials.flatMap((m,i)=>['baseColor','normal','roughness'].filter(k=>m.maps?.[k]).map(key=>({index:i,key,path:m.maps[key]})));
  async function worker(){while(next<tasks.length){const t=tasks[next++];try{const r=await fetch(local(t.path),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])});if(!r.ok)throw Error('贴图暂不可用');const image=await createImageBitmap(await r.blob(),{resizeWidth:t.key==='baseColor'?albedoSize:TEXTURE_SIZE,resizeHeight:t.key==='baseColor'?albedoSize:TEXTURE_SIZE,resizeQuality:'high'});if(disposed){image.close();continue;}bitmaps.push(image);maps[t.index]||={};maps[t.index][t.key]=image;}catch(e){if(e.name==='AbortError')throw e;failures++;}}}
  await Promise.all(Array.from({length:4},worker));if(disposed)throw Error('材质加载已取消');const pack={manifest,maps,size:TEXTURE_SIZE,albedoSize,failures};onStatus({state:'ready',landmarks:(manifest.landmarks||[]).filter(l=>maps[manifest.materials.findIndex(m=>m.id===l.photo)]?.baseColor).length,failures,manifest});return pack;
 })().catch(e=>{promise=null;if(!disposed)onStatus({state:'error',message:e.message});throw e;});return promise;}
 return {load,destroy(){disposed=true;controller?.abort();for(const image of bitmaps)image.close();bitmaps=[];promise=null;}};
}
export function uploadBuildingTextures(gl,pack){
 const count=(pack?.manifest.materials.length||0)+1,textures=[],bindings=[['baseColor',[224,222,214,255]],['normal',[128,128,255,255]],['roughness',[190,190,190,255]]];
 const previous=gl.getParameter(gl.TEXTURE_BINDING_2D_ARRAY),flip=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL),premultiply=gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
 try{for(const [key,fallback] of bindings){const size=(key==='baseColor'?pack?.albedoSize:pack?.size)||pack?.size||1,texture=gl.createTexture();textures.push(texture);gl.bindTexture(gl.TEXTURE_2D_ARRAY,texture);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,Math.floor(Math.log2(size))+1,gl.RGBA8,size,size,count);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  const fill=new Uint8Array(size*size*4);for(let i=0;i<fill.length;i+=4)fill.set(fallback,i);
  for(let layer=0;layer<count;layer++)gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,layer,size,size,1,gl.RGBA,gl.UNSIGNED_BYTE,pack?.maps[layer-1]?.[key]||fill);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  const ext=gl.getExtension('EXT_texture_filter_anisotropic');if(ext)gl.texParameterf(gl.TEXTURE_2D_ARRAY,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
 }return textures;}catch(error){for(const t of textures)gl.deleteTexture(t);throw error;}finally{gl.bindTexture(gl.TEXTURE_2D_ARRAY,previous);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,flip);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,premultiply);}
}

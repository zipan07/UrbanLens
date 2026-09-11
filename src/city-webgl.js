import * as THREE from 'three';
import {WIDTH,HEIGHT,USES,riverX,rect} from '../dist/city-data.js';

// All coordinates and materials are fictional. Geometry is not assessment evidence.
const natural={housing:['#e4dac6','#dddfe1','#d4c9b6'],office:['#7399ab','#719fa6','#99adbd'],industry:['#b77c65','#a69180','#c59071'],civic:['#ddcbbc','#e3ddca','#c1bdcc']};
const landColors={housing:'#e4ddd0',office:'#d4e4e7',industry:'#e3d3c9',civic:'#ded8e9'};
const dummy=new THREE.Object3D();
export function cameraFromState(camera,state){
 const {x,y,w,h,scale,bearing,pitch}=state,halfW=w/(2*scale),halfH=h/(2*scale),distance=12000;
 camera.left=-halfW;camera.right=halfW;camera.top=halfH;camera.bottom=-halfH;
 camera.position.set(x+distance*Math.sin(bearing)*Math.cos(pitch),distance*Math.sin(pitch),y+distance*Math.cos(bearing)*Math.cos(pitch));
 // Explicit up vector avoids a singular orientation at exact 2D / 90 degrees.
 camera.up.set(-Math.sin(bearing)*Math.sin(pitch),Math.cos(pitch),-Math.cos(bearing)*Math.sin(pitch));
 camera.lookAt(x,0,y);camera.updateProjectionMatrix();camera.updateMatrixWorld();
}
function facadeMaterial(use){
 const mat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:use==='office'?.27:.85,metalness:use==='office'?.32:.03});
 mat.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 cityPosition; varying vec3 cityNormal;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec4 cityP=vec4(position,1.0);
   #ifdef USE_INSTANCING
   cityP=instanceMatrix*cityP;
   #endif
   cityPosition=(modelMatrix*cityP).xyz;cityNormal=normal;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 cityPosition; varying vec3 cityNormal;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   if(abs(cityNormal.y)<0.5){
    float along=abs(cityNormal.x)>0.5?cityPosition.z:cityPosition.x;
    vec2 cell=fract(vec2(along/${use==='industry'?'7.0':'4.2'},cityPosition.y/${use==='industry'?'4.5':'3.3'}));
    float win=step(${use==='office'?'0.065':'0.19'},cell.x)*step(cell.x,${use==='office'?'0.935':'0.78'})*step(0.2,cell.y)*step(cell.y,0.86);
    float variation=fract(sin(floor(along/4.2)*12.9898+floor(cityPosition.y/3.3)*78.233)*43758.5453);
    vec3 glass=mix(vec3(0.11,0.21,0.27),vec3(0.43,0.64,0.71),variation*.68+clamp(cityPosition.y/150.0,0.0,.3));
    diffuseColor.rgb=mix(diffuseColor.rgb,glass,win*${use==='office'?'0.82':'0.76'});
    ${use==='industry'?'float mortar=step(.92,fract(cityPosition.y/1.0));diffuseColor.rgb*=1.0-mortar*.18;':''}
   }else if(cityNormal.y>0.5){diffuseColor.rgb*=0.72;}
  `);
 };
 mat.customProgramCacheKey=()=>`urbanlens-facade-${use}`;return mat;
}
function gable(){
 const g=new THREE.BufferGeometry();const v=[-.5,0,-.5,.5,0,-.5,0,1,-.5,-.5,0,.5,.5,0,.5,0,1,.5];
 g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3]);g.computeVertexNormals();return g.toNonIndexed();
}
export class RealCityScene {
 constructor(canvas,data){
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.setClearColor('#b7cbd1');this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.22;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.shadowMap.autoUpdate=false;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#b7cbd1');
  // Shape geometry uses negative Z; mirror the model to make map Y grow down-screen.
  this.scene.scale.z=-1;
  this.camera=new THREE.OrthographicCamera(-4000,4000,3000,-3000,1,26000);this.data=data;this.batches=new Map();this.groups={};this.pickables=[];this.buildingRefs=[];this.plotMeshes=[];
  for(const key of ['buildings','land','roads','green','facilities','plots','detail']){const g=new THREE.Group();this.groups[key]=g;this.scene.add(g);}
  this.scene.add(new THREE.HemisphereLight('#dcefff','#968f76',2.2));
  this.sun=new THREE.DirectionalLight('#fff3d8',3.2);this.sun.position.set(-1800,4300,3500);this.sun.target.position.set(2800,0,-2000);this.scene.add(this.sun,this.sun.target);
  this.sun.castShadow=true;Object.assign(this.sun.shadow.camera,{left:-4800,right:4800,top:4800,bottom:-4800,near:1,far:16000});
  this.sun.shadow.mapSize.set(4096,4096);this.sun.shadow.bias=-.00012;this.sun.shadow.normalBias=2;
  this.boxGeo=new THREE.BoxGeometry(1,1,1);this.gableGeo=gable();this.treeGeo=new THREE.IcosahedronGeometry(1,1);
  this.materials=new Map();this.raycaster=new THREE.Raycaster();this.buildTerrain();this.buildArchitecture();this.buildLandscape();this.flush();
  this.renderer.shadowMap.needsUpdate=true;this.scene.updateMatrixWorld(true);
 }
 material(color,roughness=.88){const key=color+roughness;if(!this.materials.has(key))this.materials.set(key,new THREE.MeshStandardMaterial({color,roughness}));return this.materials.get(key);}
 shape(points,color,group='land',height=.1){const s=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y))),geo=new THREE.ShapeGeometry(s);geo.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geo,this.material(color));mesh.position.y=height;mesh.receiveShadow=true;this.groups[group].add(mesh);return mesh;}
 addInstance(key,geometry,material,group,pos,size,rotation=0,item=null,color=null){
  if(!this.batches.has(key))this.batches.set(key,{geometry,material,group,items:[]});
  this.batches.get(key).items.push({pos,size,rotation,item,color});
 }
 box(key,color,group,x,y,z,w,h,d,item=null,rotation=0){this.addInstance(key,this.boxGeo,this.material(color),group,[x,y,z],[w,h,d],rotation,item);}
 flush(){for(const [key,b] of this.batches){const mesh=new THREE.InstancedMesh(b.geometry,b.material,b.items.length);mesh.castShadow=b.group!=='roads'&&b.group!=='land';mesh.receiveShadow=true;mesh.userData.items=b.items;
  b.items.forEach((s,i)=>{dummy.position.set(...s.pos);dummy.scale.set(...s.size);dummy.rotation.set(0,s.rotation,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(s.color)mesh.setColorAt(i,new THREE.Color(s.color));if(s.item&&!s.item.kind)this.buildingRefs.push({mesh,index:i,item:s.item,base:s.color});});
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();this.groups[b.group].add(mesh);if(b.items.some(x=>x.item))this.pickables.push(mesh);
 }this.batches.clear();}
 buildTerrain(){
  const base=new THREE.Mesh(new THREE.BoxGeometry(WIDTH+140,45,HEIGHT+140),this.material('#879a93'));base.position.set(WIDTH/2,-24,-HEIGHT/2);base.receiveShadow=true;this.scene.add(base);
  // City base, parcel paving and asphalt are separate surfaces.
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(WIDTH,HEIGHT),this.material('#d1d8cd'));ground.rotation.x=-Math.PI/2;ground.position.set(WIDTH/2,-.8,-HEIGHT/2);ground.receiveShadow=true;this.scene.add(ground);
  for(const b of this.data.blocks)this.shape(b.points,landColors[b.use],'land',0);
  for(const r of this.data.roads){const [[x,y],[xx,yy]]=r.points;this.shape(x===xx?rect(x-(r.major?17:10),0,r.major?34:20,HEIGHT):rect(0,y-(r.major?17:10),WIDTH,r.major?34:20),'#68787b','roads',.5);
   if(r.major)for(let k=35;k<(x===xx?HEIGHT:WIDTH);k+=70){this.box('road-dashes','#e8e7cc','roads',x===xx?x:k,.7,x===xx?-k:-y,x===xx?1:22,.15,x===xx?22:1);}
  }
  const bank=[],water=[];for(let y=0;y<=HEIGHT;y+=35){bank.push([riverX(y)-197,y]);water.push([riverX(y)-135,y]);}for(let y=HEIGHT;y>=0;y-=35){bank.push([riverX(y)+197,y]);water.push([riverX(y)+135,y]);}
  // Water always occludes roads; green switch controls bank vegetation, not a fake road through the river.
  this.shape(bank,'#a1b88e','green',1.2);const river=this.shape(water,'#4caaa9','green',1.8);river.material=new THREE.MeshStandardMaterial({color:'#409f9f',roughness:.22,metalness:.38});
  for(const y of [900,1800,2700,3600]){const x=riverX(y);this.box('bridge-deck','#a9b3ae','roads',x,7,-y,440,5,36);for(const side of [-1,1])this.box('bridge-edge','#e8dfca','roads',x,10.4,-y+side*17,440,2.2,1.8);for(const dx of [-135,0,135])this.box('bridge-pier','#a1ada5','roads',x+dx,3,-y,10,10,25);}
  for(const p of this.data.parks){this.shape(p.points,'#91b78b','green',.2);const [x,y]=p.points[0];this.shape(rect(x+118,y,12,252),'#dbcfae','green',.4);this.shape(rect(x,y+118,252,12),'#dbcfae','green',.4);}
  for(const p of this.data.plots){const mesh=this.shape(p.points,'#d9ea8a','plots',2.2);mesh.material=new THREE.MeshBasicMaterial({color:'#d9ea8a',transparent:true,opacity:.16,depthWrite:false});mesh.userData.plot=p;this.plotMeshes.push(mesh);
   const lineGeo=new THREE.BufferGeometry().setFromPoints([...p.points,p.points[0]].map(([x,y])=>new THREE.Vector3(x,2.7,-y)));const line=new THREE.Line(lineGeo,new THREE.LineBasicMaterial({color:'#dae88c'}));this.groups.plots.add(line);mesh.userData.line=line;
  }
  // Track line is an explicitly stylized transport overlay, not a measured route.
  const trackGeo=new THREE.BufferGeometry().setFromPoints(this.data.metro.points.map(([x,y])=>new THREE.Vector3(x,12,-y)));const track=new THREE.Line(trackGeo,new THREE.LineDashedMaterial({color:'#8066c9',dashSize:35,gapSize:20}));track.computeLineDistances();this.groups.roads.add(track);
 }
 buildArchitecture(){
  for(const use of Object.keys(USES))this.materials.set(`facade-${use}`,facadeMaterial(use));
  for(const b of this.data.buildings){const [x,y]=b.points[0],w=b.points[1][0]-x,d=b.points[3][1]-y,cx=x+w/2,cz=-y-d/2,h=b.height,col=natural[b.use][b.variant];
   const add=(xx,zz,ww,dd,bottom,hh)=>this.addInstance(`body-${b.use}`,this.boxGeo,this.materials.get(`facade-${b.use}`),'buildings',[xx,bottom+hh/2,zz],[ww,hh,dd],0,b,col);
   if(b.use==='office'){
    add(cx,cz,w,d,0,Math.min(12,h*.18));add(cx,cz,w*.72,d*.73,10,h-10);
    this.box('tower-crown','#8aa4aa','buildings',cx,h+1,cz,w*.76,2,d*.77,b);
    this.box('rooftop-equipment','#b3bbb6','detail',cx,h+4,cz,w*.28,6,d*.2);
   }else if(b.use==='industry'){
    add(cx,cz,w,d,0,h-3);this.addInstance('industrial-roof',this.gableGeo,this.material('#637d86'),'buildings',[cx,h-3,cz],[w,4,d],0,b);
    for(let j=-1;j<=1;j++)this.box('skylights','#a0d1d4','detail',cx+j*w*.25,h+1.2,cz,16,1,d*.65);
   }else if(b.use==='housing'&&b.floors<10){
    add(cx,cz,w,d,0,h-4);this.addInstance('housing-roof',this.gableGeo,this.material(b.variant===0?'#aa6c54':'#7a7f80'),'buildings',[cx,h-4,cz],[w+1,4,d+1],0,b);
   }else if(b.use==='civic'){
    add(cx-w*.24,cz,w*.5,d,0,h);add(cx+w*.25,cz+d*.28,w*.5,d*.44,0,h*.7);
    this.box('civic-roof','#b3b2a2','buildings',cx-w*.24,h+.6,cz,w*.52,1.2,d,b);
   }else{
    add(cx,cz,w,d,0,h);this.box('flat-roof','#9aaca5','buildings',cx,h+.6,cz,w+1,1.2,d+1,b);
    // Balcony slabs provide readable depth when examining the residential district.
    for(let floor=3;floor<b.floors;floor+=3)this.box('balcony','#c6c9bd','detail',cx,floor*3.3,cz+d/2+1,w*.8,.6,4);
   }
   if(b.use!=='industry'&&b.use!=='office')this.box('entry-canopies','#778f91','detail',cx,4,cz+d/2+3,12,.7,6);
  }
 }
 buildLandscape(){
  const tree=(x,y,size,variant)=>{if(Math.abs(x-riverX(y))<148)return;this.box('tree-trunks','#827c62','green',x,size*.32,-y,1.6,size*.65,1.6);this.addInstance(`tree-${variant%3}`,this.treeGeo,this.material(['#4e886c','#719861','#8aab68'][variant%3]),'green',[x,size*.8,-y],[size*.46,size*.57,size*.46]);};
  for(const p of this.data.parks){const [x,y]=p.points[0];for(let i=0;i<5;i++)for(let j=0;j<5;j++){if(i===2||j===2)continue;tree(x+26+i*49,y+28+j*48,14+(i+j)%4*3,i+j);}}
  for(const block of this.data.blocks){const [x,y]=block.points[0];for(let i=0;i<4;i++)tree(x+12+i*64,y+241,13+i%2*3,i);}
  for(let y=30;y<HEIGHT;y+=65)for(const side of [-1,1])tree(riverX(y)+side*168,y,17,Math.floor(y/65));
  // Parked vehicles and station pavilions provide recognizable scale cues.
  for(let y=70;y<HEIGHT;y+=190)for(const x of [900,1800,4500,5400]){if(Math.abs(x-riverX(y))<230)continue;const color=['#d6b370','#f1e8d7','#637986'][Math.floor(y/190)%3];this.box(`car-${color}`,color,'detail',x+11,1.4,-y,3.4,2.8,6.6);this.box('car-glass','#567e8e','detail',x+11,3,-y+.4,2.8,.6,3.5);}
  for(const f of this.data.facilities){this.box('facility-pavilion',f.kind==='M'?'#9c83c5':'#d1b0ad','facilities',f.x,4,-f.y,20,8,15,f);this.box('facility-roof','#ede8d6','facilities',f.x,8.5,-f.y,24,1,19,f);}
 }
 setSize(w,h,pixelRatio){this.renderer.setPixelRatio(pixelRatio);this.renderer.setSize(w,h,false);}
 setLighting(mode){if(this.lighting===mode)return;this.lighting=mode;
  const dusk=mode==='golden';this.sun.color.set(dusk?'#ffd0a3':'#fff3d8');this.sun.intensity=dusk?3.5:3.2;this.sun.position.set(dusk?-1000:-1800,dusk?2300:4300,dusk?1500:3500);this.scene.background.set(dusk?'#c1b9bb':'#b7cbd1');this.renderer.shadowMap.needsUpdate=true;
 }
 render(camera,state){
  cameraFromState(this.camera,camera);
  for(const [key,group] of Object.entries(this.groups))group.visible=key==='detail'?state.layers.buildings&&camera.scale>.24:state.layers[key];
  this.sun.castShadow=state.mode==='3d'&&state.quality!=='standard';
  const sig=[state.selected,state.inspected,state.color,...state.visible].join('|');
  if(sig!==this.colorSignature){this.colorSignature=sig;
   for(const ref of this.buildingRefs){const b=ref.item;let col=ref.base||'#ffffff';if(state.color==='use')col=USES[b.use].color;if(state.color==='height')col=b.height>90?'#ad83cd':b.height>45?'#55a9c0':'#b6cb93';if(b.id===state.inspected)col='#f0d075';ref.mesh.setColorAt(ref.index,new THREE.Color(col));ref.mesh.instanceColor.needsUpdate=true;}
  }
  for(const mesh of this.plotMeshes){const p=mesh.userData.plot,selected=p.id===state.selected;mesh.visible=state.visible.has(p.id);mesh.userData.line.visible=mesh.visible;const result=state.results.get(p.id);const color=selected?'#e0fa50':result?.total>=60?'#9960cc':result?'#289f97':'#a4af54';mesh.material.color.set(color);mesh.material.opacity=selected?.28:.10;mesh.userData.line.material.color.set(color);}
  const shadowSig=Object.entries(state.layers).map(([k,v])=>k+v).join('|')+state.quality;
  if(shadowSig!==this.shadowSignature){this.shadowSignature=shadowSig;this.renderer.shadowMap.needsUpdate=true;}
  this.setLighting(state.lighting);this.renderer.render(this.scene,this.camera);
 }
 pick(point,camera){this.raycaster.setFromCamera(new THREE.Vector2(point[0]/camera.w*2-1,1-point[1]/camera.h*2),this.camera);const visible=this.pickables.filter(m=>m.parent.visible);const hit=this.raycaster.intersectObjects(visible,false)[0];return hit?.object.userData.items[hit.instanceId]?.item;}
 dispose(){this.renderer.dispose();}
}

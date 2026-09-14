import {ShapeUtils} from 'three/src/extras/ShapeUtils.js';
import {Vector2} from 'three/src/math/Vector2.js';
import {facadeGrid,facadeVariation} from './facade-variation.js';
import {buildingBounds,buildingHash} from './building-appearance.js';
import {materialIndex,landmarkIndex,photoTransform,transformPhotoUV} from './building-materials.js';
export const REALISM_LIMITS=Object.freeze({buildings:4000,vertices:650000,minZoom:12.4});
const WORLD=40030228.88407185,RAD=Math.PI/180,STRIDE=19;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mercator=([lng,lat])=>[(lng+180)/360,(1-Math.asinh(Math.tan(lat*RAD))/Math.PI)/2];
const polygons=g=>g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
const rgb=hex=>[1,3,5].map(i=>parseInt(String(hex||'#c3c8c6').slice(i,i+2),16)/255);
const midpoint=(a,b)=>a.map((x,i)=>(x+b[i])/2);
const signedArea=r=>r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2;
const cross=(a,b,c)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);return l>1e-6?n.map(x=>x/l):[0,0,0];};
function clip(points,side,axis,mid){const dot=p=>p[0]*axis[0]+p[1]*axis[1]-mid,out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=dot(a),db=dot(b),ia=side*da>=-1e-8,ib=side*db>=-1e-8;if(ia)out.push(a);if(ia!==ib){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}
function hull(points){const p=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),z=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),chain=ps=>{const a=[];for(const v of ps){while(a.length>1&&z(a.at(-2),a.at(-1),v)<=0)a.pop();a.push(v);}return a;};return [...chain(p).slice(0,-1),...chain(p.reverse()).slice(0,-1)];}
/** Original footprints/courtyards, ENU metres. Decorative dimensions are visual estimates. */
export function buildBuildingMesh(features,{origin=[118.81,32.055],theme='day',terrainElevation=()=>0,schematic=true,vertexLimit=REALISM_LIMITS.vertices,manifest=null,detail=false,shadows=true}={}){
 const originMercator=mercator(origin),unit=1/(WORLD*Math.cos(origin[1]*RAD)),vertices=[],shadowData=[],decorations=[],decorationGroups=[],included=[],materials=materialIndex(manifest),landmarks=landmarkIndex(manifest);let overflow=false,decorating=false,decorStart=0,detailedCount=0;
 const local=p=>{const m=mercator(p);return [(m[0]-originMercator[0])/unit,(originMercator[1]-m[1])/unit];};
 const mat=id=>materials.get(id)?.layer||0,scale=id=>materials.get(id)?.physicalSizeM||1;
 const emit=(tri,color,kind=8,uv=null,material=0,ao=null,target=vertices,facadeUV=null)=>{if(decorating&&target===vertices){if((decorations.length-decorStart)/STRIDE+3>960||decorations.length/STRIDE+3>135000)return;target=decorations;}else if((vertices.length+shadowData.length)/STRIDE+3>vertexLimit){overflow=true;return;}const n=cross(...tri);if(Math.hypot(...n)<.5)return;for(let i=0;i<3;i++)target.push(...tri[i],...n,...color,...(uv?.[i]||[tri[i][0],tri[i][1],1]),kind,material,ao?.[i]??1,...(facadeUV?.[i]||[-1,-1,-1,-1]));};
 const quad=(p,c,k=8,m=0,uv=null,ao=null,facadeUV=null)=>{for(const ids of [[0,1,2],[0,2,3]])emit(ids.map(i=>p[i]),c,k,uv&&ids.map(i=>uv[i]),m,ao&&ids.map(i=>ao[i]),vertices,facadeUV&&ids.map(i=>facadeUV[i]));};
 for(const f of features){const p=f.properties||{},h=schematic?Number(p.render_height):Number(p.height_m);if(!Number.isFinite(h)||h<=0)continue;const bounds=buildingBounds(f.geometry);if(!bounds)continue;const id=p.osm_id||f.id,landmark=landmarks.get(id),model=landmark?.model,center=[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2],ground=Number(terrainElevation(center,f))||0,base=ground+Math.min(Number(p.render_base)||0,h),bodyH=model==='auditorium'?h*.58:model==='museum'?h*.65:h,top=ground+bodyH+.18,start=vertices.length,shadowStart=shadowData.length,wall=rgb(p[`appearance_${theme}`]||p.appearance_day),facade=['palace','museum','gate'].includes(model)?8:({windows:1,curtain:2,classical:3,industrial:4,stone:5}[p.facade_kind]||1),wallId=landmark||facade===2?'':p.appearance_kind==='heritage'||p.appearance_kind==='lowrise'?'red_brick_03':facade===5?'stone_brick_wall_001':'concrete_floor_02',wallMat=mat(wallId),wallScale=scale(wallId),photo=landmark?.photo?materials.get(landmark.photo):null,ordinary=!landmark&&!p.visual_landmark,layout=facadeVariation(p,id),encodedFacade=ordinary?layout.packedKind(facade):facade,nearDetail=detail&&(!!landmark||detailedCount<220);decorStart=decorations.length;if(nearDetail&&ordinary)detailedCount++;
  for(const polygon of polygons(f.geometry)){
   const rings=polygon.map((r,i)=>{const out=r.slice(0,r.length>1&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1]?-1:undefined).map(local);if((signedArea(out)>0)!==(i===0))out.reverse();return out;});if(rings[0].length<3||rings.flat().length>2000)continue;
   const flat=rings.flat();let axis=[1,0],longest=0;for(let i=0;i<rings[0].length;i++){const a=rings[0][i],b=rings[0][(i+1)%rings[0].length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len>longest){longest=len;axis=[dx/len,dy/len];}}
   const front=landmark?[Math.sin(landmark.frontBearing*RAD),Math.cos(landmark.frontBearing*RAD)]:[-axis[1],axis[0]],right=[-front[1],front[0]],proj=(a,v)=>a[0]*v[0]+a[1]*v[1];
   const across=[-axis[1],axis[0]],range=flat.reduce((r,c)=>[Math.min(r[0],proj(c,axis)),Math.min(r[1],proj(c,across)),Math.max(r[2],proj(c,axis)),Math.max(r[3],proj(c,across))],[Infinity,Infinity,-Infinity,-Infinity]),mid=(range[1]+range[3])/2,half=(range[3]-range[1])/2;
   const umin=Math.min(...flat.map(c=>proj(c,right))),umax=Math.max(...flat.map(c=>proj(c,right))),vmin=Math.min(...flat.map(c=>proj(c,front))),vmax=Math.max(...flat.map(c=>proj(c,front))),width=umax-umin,depth=vmax-vmin,uc=(umin+umax)/2,vc=(vmin+vmax)/2;
   const at=(u,v,z)=>[right[0]*u+front[0]*v,right[1]*u+front[1]*v,z],midpointXY=at(uc,vc,0);
   const roofForm=['museum','heritage'].includes(model)?'hipped':model==='station'||model==='exhibition'||ordinary&&p.appearance_kind==='industrial'&&layout.seed%4===0&&p.roof_source!=='OSM 标签'?'barrel':model==='auditorium'||model==='library'||model==='art'||model==='palace'||model==='gate'?'flat':ordinary&&p.roof_form==='gabled'&&layout.seed%3===1&&p.roof_source!=='OSM 标签'?'hipped':p.roof_form;
   const roofHeight=roofForm==='gabled'||roofForm==='hipped'?clamp(half*.42,1.2,model==='museum'?10:7):roofForm==='dome'?clamp(half*.65,4,14):roofForm==='barrel'?clamp(depth*.06,2,6):0;
   const roofZ=c=>{const u=proj(c,axis),v=proj(c,across);if(roofForm==='gabled')return top+roofHeight*Math.max(0,1-Math.abs(v-mid)/(half||1));if(roofForm==='hipped')return top+roofHeight*Math.max(0,Math.min(1-Math.abs(v-mid)/(half||1),(u-range[0])/Math.max(1,half),(range[2]-u)/Math.max(1,half)));if(roofForm==='dome'){const a=(u-(range[0]+range[2])/2)/Math.max(1,(range[2]-range[0])*.27),b=(v-mid)/Math.max(1,half*.68);return top+roofHeight*Math.sqrt(Math.max(0,1-a*a-b*b));}if(roofForm==='barrel')return top+roofHeight*Math.cos((proj(c,front)-vc)/Math.max(1,depth)*Math.PI);return top;};
   const roofId=roofForm==='gabled'||roofForm==='hipped'?buildingHash(id)%3===0?'clay_roof_tiles':'grey_roof_tiles':'concrete_floor_02',roofMat=mat(roofId),roofScale=scale(roofId),roofColor=rgb(model==='museum'?'#b78b43':model==='heritage'?'#567865':p.roof_color),roofUV=c=>[proj(c,axis)/roofScale,proj(c,across)/roofScale,1];
   // All wall edges use the same geographic facade coordinate; fragmented OSM edges never repeat a photograph.
   for(let ri=0;ri<rings.length;ri++)for(let i=0;i<rings[ri].length;i++){const a=rings[ri][i],b=rings[ri][(i+1)%rings[ri].length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.1)continue;
    const n=[(b[1]-a[1])/len,-(b[0]-a[0])/len],edgeDirection=[(b[0]-a[0])/len,(b[1]-a[1])/len],wallStart=proj(a,edgeDirection)-proj(midpointXY,edgeDirection),ua=(proj(a,right)-umin)/width,ub=(proj(b,right)-umin)/width,rangePhoto=landmark?.facadeRange||[0,1,0,1],eligible=photo&&landmark.transform&&ri===0&&proj(n,front)>.76&&proj(midpoint(a,b),front)>vmax-Math.max(2,depth*.24),cuts=[0,1];
    const va=proj(a,across)-mid,vb=proj(b,across)-mid;if((roofForm==='gabled'||roofForm==='hipped')&&va*vb<0)cuts.push(va/(va-vb));
    if(eligible&&Math.abs(ub-ua)>1e-6)for(const u of rangePhoto.slice(0,2)){const t=(u-ua)/(ub-ua);if(t>0&&t<1)cuts.push(t);}cuts.sort((a,b)=>a-b);
    for(let j=0;j<cuts.length-1;j++){const t0=cuts[j],t1=cuts[j+1],aa=a.map((v,k)=>v+(b[k]-v)*t0),bb=a.map((v,k)=>v+(b[k]-v)*t1),u0=ua+(ub-ua)*t0,u1=ua+(ub-ua)*t1,um=(u0+u1)/2,za=roofZ(aa),zb=roofZ(bb),photoHere=eligible&&um>=rangePhoto[0]-1e-6&&um<=rangePhoto[1]+1e-6;
     const zcuts=photoHere?[base,base+(top-base)*rangePhoto[2],base+(top-base)*rangePhoto[3],Math.max(za,zb)]:[base,Math.max(za,zb)];
     for(let z=0;z<zcuts.length-1;z++){const low=zcuts[z],high=zcuts[z+1];if(high-low<.01)continue;const zA=Math.min(high,za),zB=Math.min(high,zb),pts=[[...aa,low],[...bb,low],[...bb,zB],[...aa,zA]],isPhoto=photoHere&&z===1,uv=isPhoto?[[u0,0],[u1,0],[u1,1],[u0,1]].map(([u,v])=>transformPhotoUV(landmark.transform,(u-rangePhoto[0])/(rangePhoto[1]-rangePhoto[0]),v)):[[(wallStart+len*t0)/wallScale,(low-base)/wallScale,1],[(wallStart+len*t1)/wallScale,(low-base)/wallScale,1],[(wallStart+len*t1)/wallScale,(zB-base)/wallScale,1],[(wallStart+len*t0)/wallScale,(zA-base)/wallScale,1]];
      quad(pts,wall,isPhoto?6:encodedFacade,isPhoto?photo.layer:wallMat,uv,[(low-base)/h,(low-base)/h,(zB-base)/h,(zA-base)/h],isPhoto?null:[[len*t0,low-base,len,top-base],[len*t1,low-base,len,top-base],[len*t1,zB-base,len,top-base],[len*t0,zA-base,len,top-base]]);
     }
    }
    // Roof edge thickness and a low parapet catch sunlight even at district scale.
    if(nearDetail||landmark){decorating=ordinary;const z1=roofZ(a),z2=roofZ(b),off=roofForm==='flat'?.15:.48,raise=roofForm==='flat'?.48:.18,aa=[a[0]+n[0]*off,a[1]+n[1]*off],bb=[b[0]+n[0]*off,b[1]+n[1]*off];quad([[...aa,z1-.18],[...bb,z2-.18],[...bb,z2+raise],[...aa,z1+raise]],roofColor,8,roofMat,[[0,0,1],[len/roofScale,0,1],[len/roofScale,.2,1],[0,.2,1]]);quad([[...a,z1+raise],[...b,z2+raise],[...bb,z2+raise],[...aa,z1+raise]],roofColor,8,roofMat);decorating=false;}
   }
   const roofRings=rings.map(r=>r.slice());
   // Open elliptical light court, contained within the library footprint.
   const ellipse=(ru,rv,z)=>Array.from({length:48},(_,i)=>at(uc+Math.cos(i/48*Math.PI*2)*ru,vc+Math.sin(i/48*Math.PI*2)*rv,z));
   if(model==='library'&&rings.length===1){const hole=ellipse(width*.32,depth*.30,top).map(p=>p.slice(0,2));if(signedArea(hole)>0)hole.reverse();roofRings.push(hole);}
   const roofFlat=roofRings.flat(),triangles=ShapeUtils.triangulateShape(roofRings[0].map(c=>new Vector2(...c)),roofRings.slice(1).map(r=>r.map(c=>new Vector2(...c))));
   const roofTriangle=(tri,sub=0)=>{if(sub>0){const [a,b,c]=tri,ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);for(const t of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])roofTriangle(t,sub-1);return;}if(signedArea(tri)<0)tri=[tri[0],tri[2],tri[1]];emit(tri.map(c=>[...c,roofZ(c)]),roofColor,0,tri.map(roofUV),roofMat);};
   for(const ids of triangles){const tri=ids.map(i=>roofFlat[i]);if(roofForm==='gabled'){for(const side of [-1,1]){const c=clip(tri,side,across,mid);for(let i=1;i<c.length-1;i++)roofTriangle([c[0],c[i],c[i+1]]);}}else if(roofForm==='hipped'){
    const faces=[{n:across,c:-range[1]},{n:across.map(x=>-x),c:range[3]},{n:axis,c:-range[0]},{n:axis.map(x=>-x),c:range[2]}];for(const face of faces){let piece=tri;for(const other of faces){if(face===other)continue;piece=clip(piece,-1,[face.n[0]-other.n[0],face.n[1]-other.n[1]],other.c-face.c);if(piece.length<3)break;}for(let i=1;i<piece.length-1;i++)roofTriangle([piece[0],piece[i],piece[i+1]]);}
   }else roofTriangle(tri,['dome','barrel'].includes(roofForm)?(landmark||roofForm==='dome'?3:2):0);}
   const box=(u,v,w,d,z,h,c=wall,k=8,m=0)=>{const p=[at(u-w/2,v-d/2,z),at(u+w/2,v-d/2,z),at(u+w/2,v+d/2,z),at(u-w/2,v+d/2,z)],q=p.map(x=>[x[0],x[1],z+h]);for(let i=0;i<4;i++){const j=(i+1)%4;quad([p[i],p[j],q[j],q[i]],c,k,m,[[0,0,1],[w,0,1],[w,h,1],[0,h,1]]);}quad([q[3],q[2],q[1],q[0]],c,8,m);};
   const cylinder=(u,v,r,z,h,c=wall,segments=16,rTop=r)=>{for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,aa=at(u+Math.cos(a)*r,v+Math.sin(a)*r,z),bb=at(u+Math.cos(b)*r,v+Math.sin(b)*r,z),cc=at(u+Math.cos(b)*rTop,v+Math.sin(b)*rTop,z+h),dd=at(u+Math.cos(a)*rTop,v+Math.sin(a)*rTop,z+h);quad([aa,bb,cc,dd],c);emit([at(u,v,z+h),dd,cc],c);}};
   if(model==='auditorium'){
    const radius=Math.min(width,depth)*.28,z=top+1.2,green=rgb('#638a76');cylinder(uc,vc-.4,radius,top,1.2,wall,24);
    for(let j=0;j<9;j++)for(let i=0;i<32;i++){const p=(a,b)=>at(uc+Math.cos(a)*Math.cos(b)*radius,vc-.4+Math.sin(a)*Math.cos(b)*radius,z+Math.sin(b)*h*.30);quad([p(i/32*Math.PI*2,j/9*Math.PI/2),p((i+1)/32*Math.PI*2,j/9*Math.PI/2),p((i+1)/32*Math.PI*2,(j+1)/9*Math.PI/2),p(i/32*Math.PI*2,(j+1)/9*Math.PI/2)],green);}
    cylinder(uc,vc-.4,radius*.16,z+h*.30,1.5,wall,8);cylinder(uc,vc-.4,radius*.21,z+h*.30+1.5,1.1,green,8,0);
    const porticoW=width*.54,frontV=vmax+.2;if(!photo)for(const u of [-.36,-.12,.12,.36]){cylinder(uc+porticoW*u,frontV,.43,base+bodyH*.18,bodyH*.75,wall,12);box(uc+porticoW*u,frontV,1.3,1.2,top-.8,.45);}
    emit([at(uc-porticoW*.55,frontV+.55,top),at(uc+porticoW*.55,frontV+.55,top),at(uc,frontV+.55,top+3.4)],wall);box(uc,frontV,porticoW*1.16,1.3,top-.5,.5);
   }else if(model==='library'){
    const outer=ellipse(width*.34,depth*.32,top+.35),inner=ellipse(width*.32,depth*.30,top+.35);for(let i=0;i<48;i++){const j=(i+1)%48;quad([inner[i],inner[j],outer[j],outer[i]],wall);quad([inner[i],inner[j],[inner[j][0],inner[j][1],top-1.2],[inner[i][0],inner[i][1],top-1.2]],wall);}
    for(const u of [-.38,-.16,.08,.31])cylinder(uc+width*u,vmax-.5,.45,base,bodyH,wall,12);
    // Diagonal glass mullions on the open court's curved inner face.
    const court=ellipse(width*.30,depth*.28,top-1.2);for(let i=0;i<48;i++){const j=(i+1)%48;quad([[court[i][0],court[i][1],base+1],[court[j][0],court[j][1],base+1],court[j],court[i]],rgb('#7dabb0'),2,0,[[i*2,0,1],[(i+1)*2,0,1],[(i+1)*2,bodyH,1],[i*2,bodyH,1]]);}
   }else if(model==='palace'){
    box(uc,vmax-.35,width*.46,.7,top,1.5);box(uc,vmax-.35,width*.26,.7,top+1.5,.6);box(uc,vmax-.35,width*.14,.7,top+2.1,.3);
    if(photo&&landmark.plaqueCorners){const t=photoTransform(landmark.plaqueCorners);quad([at(uc-width*.23,vmax+.015,top),at(uc+width*.23,vmax+.015,top),at(uc+width*.23,vmax+.015,top+1.5),at(uc-width*.23,vmax+.015,top+1.5)],wall,6,photo.layer,[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>transformPhotoUV(t,u,v)));}
   }else if(model==='station'||model==='exhibition'){
    if(model==='station')for(let i=0;i<12;i++){const u=umin+width*(i+.5)/12;for(let j=0;j<16;j++){const v0=vmin+depth*j/16,v1=vmin+depth*(j+1)/16,a=at(u-.14,v0,0),b=at(u+.14,v0,0),c=at(u+.14,v1,0),d=at(u-.14,v1,0);quad([a,b,c,d].map(p=>[p[0],p[1],roofZ(p)+.08]),rgb('#cbd4d7'));}if(nearDetail&&!photo)cylinder(u,vmax-.6,.32,base,bodyH,wall,10);}
   }else if(model==='museum'||model==='heritage'){
    // A ridge and turned-up ridge ends, with the hipped roof kept over the recorded polygon.
    const ridgeZ=top+roofHeight;box(uc,vc,width*.62,.55,ridgeZ,.4,roofColor);for(const u of [-.31,.31])box(uc+width*u,vc,.6,.8,ridgeZ,1.0,roofColor);
   }else if(model==='art'){
    for(let i=0;i<9;i++)box(uc+width*(i-4)/11,vc,width*.025,depth*.64,top,.7,rgb('#b6c9c8'));
   }else if(model==='pagoda'){
    const radius=Math.min(width,depth)*.5;for(let i=1;i<=9;i++){const z=base+(top-base)*i/9,r=radius*(1.06-.035*i);cylinder(uc,vc,r,z-.5,.7,rgb('#587868'),8,r*.78);}
   }else if(nearDetail&&roofForm==='flat'&&rings.length===1&&buildingHash(id)%3===0&&width>12&&depth>12){
    decorating=ordinary;
    // Deterministic illustrative rooftop services, never used as assessment data.
    box(uc,vc,Math.min(4,width*.18),Math.min(5,depth*.18),top,.85,rgb('#a7b1b0'));box(uc+2,vc+2,1.2,1.2,top,1.4,rgb('#b9bbb1'));decorating=false;
   }
   if(nearDetail&&ordinary){decorating=true;
    const light=wall.map(x=>Math.min(1,x*1.07)),slab=wall.map(x=>x*.87),glass=rgb(layout.variation%2?'#5d777c':'#7d8a7f');let edgeCount=0,units=0;
    for(let ei=0;ei<rings[0].length&&edgeCount<2;ei++){
     const a=rings[0][ei],b=rings[0][(ei+1)%rings[0].length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<11)continue;const dir=[(b[0]-a[0])/len,(b[1]-a[1])/len],n=[dir[1],-dir[0]];if(Math.abs(proj(n,front))<.78)continue;edgeCount++;
     const point=(u,v,z)=>[a[0]+dir[0]*u+n[0]*v,a[1]+dir[1]*u+n[1]*v,z],grid=facadeGrid(len,top-base,layout),startU=-grid.margin,bayPitch=grid.bay,floor=grid.floor;
     // Alternate solid floor bands and projecting slabs, not a universal glass grid.
     if([2,3,5,7,8].includes(layout.style))for(let z=base+floor;z<top-.5;z+=floor*(layout.style===3?1:2)){quad([point(0,.02,z-.13),point(len,.02,z-.13),point(len,.18,z+.03),point(0,.18,z+.03)],slab);quad([point(0,.18,z+.03),point(len,.18,z+.03),point(len,.02,z+.03),point(0,.02,z+.03)],light);}
     if([7,8].includes(layout.style)){
      for(let z=base+floor;z<top-floor*.6&&units<20;z+=floor){
       const offset=layout.style===8&&Math.round((z-base)/floor)%2?1:0;
       for(let bay=0;bay<grid.columns&&units<20;bay++){
        if((bay+offset+layout.seed)%3===0)continue;const centerU=(bay+.5)*bayPitch-startU,w=bayPitch*layout.openingW*.5,u0=centerU-w,u1=centerU+w;if(u0<.6||u1>len-.6)continue;const d=layout.style===7?.5:.32,low=z+.12,high=low+.16;
        quad([point(u0,0,high),point(u1,0,high),point(u1,d,high),point(u0,d,high)],light);quad([point(u0,d,low),point(u1,d,low),point(u1,d,high),point(u0,d,high)],slab);quad([point(u0,0,low),point(u0,d,low),point(u0,d,high),point(u0,0,high)],slab);quad([point(u1,d,low),point(u1,0,low),point(u1,0,high),point(u1,d,high)],slab);
        quad([point(u0,d,high+.1),point(u1,d,high+.1),point(u1,d,high+.72),point(u0,d,high+.72)],glass);quad([point(u0,d+.035,high+.70),point(u1,d+.035,high+.70),point(u1,d+.035,high+.75),point(u0,d+.035,high+.75)],light);units++;
       }
      }
     }
    }
    if(roofForm==='flat'&&rings.length===1&&h>30&&width>15&&depth>15&&layout.seed%3!==0){box(uc,vc,width*.30,depth*.28,top,Math.min(3.5,h*.06),wall);box(uc,vc,width*.21,depth*.20,top+Math.min(3.5,h*.06),.45,roofColor);}
    decorating=false;
   }
   if(shadows){const footprint=rings[0],shift=[.55/1.25*h,.7/1.25*h],outline=hull([...footprint,...footprint.map(c=>[c[0]+shift[0],c[1]+shift[1]])]);for(let i=1;i<outline.length-1;i++)emit([outline[0],outline[i],outline[i+1]].map(c=>[...c,ground+.07]),[.1,.16,.21],7,null,0,null,shadowData);}
  }
  // Atomic budget: never hide a base building after producing only part of its mesh.
  if(overflow){vertices.length=start;shadowData.length=shadowStart;decorations.length=decorStart;break;}if(vertices.length>start){included.push(id);if(decorations.length>decorStart)decorationGroups.push([decorStart,decorations.length]);}
 }
 let room=vertexLimit-(vertices.length+shadowData.length)/STRIDE;const admitted=[];for(const [a,b] of decorationGroups){const n=(b-a)/STRIDE;if(n<=room){admitted.push(...decorations.slice(a,b));room-=n;}}
 return {vertices:new Float32Array([...shadowData,...vertices,...admitted]),decorationVertices:admitted.length/STRIDE,shadowVertices:shadowData.length/STRIDE,included,origin:originMercator,unit,stride:STRIDE};
}

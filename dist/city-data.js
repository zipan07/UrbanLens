// Deterministic metropolitan demo; geometry is never used as assessment evidence.
export const WIDTH=12000, HEIGHT=8400;
export const USES={housing:{name:'居住',color:'#e7bc89'},office:{name:'商务',color:'#6ebfda'},industry:{name:'工业',color:'#cd8d82'},civic:{name:'公共服务',color:'#ab9cda'}};
export const riverX=y=>6200+650*Math.sin(y/1550)+170*Math.sin(y/510);
export const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
export const rotatePoint=([x,y],cx,cy,a)=>[cx+(x-cx)*Math.cos(a)-(y-cy)*Math.sin(a),cy+(x-cx)*Math.sin(a)+(y-cy)*Math.cos(a)];
export function overlap(a,b){
 for(const poly of [a,b])for(let i=0;i<poly.length;i++){const u=poly[i],v=poly[(i+1)%poly.length],n=[v[1]-u[1],u[0]-v[0]],aa=a.map(p=>p[0]*n[0]+p[1]*n[1]),bb=b.map(p=>p[0]*n[0]+p[1]*n[1]);if(Math.max(...aa)<Math.min(...bb)||Math.max(...bb)<Math.min(...aa))return false;}return true;
}
function clip(poly,nx,ny,k){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=a[0]*nx+a[1]*ny-k,db=b[0]*nx+b[1]*ny-k;if(da<=0)out.push(a);if((da<=0)!==(db<=0)){const t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return out;}
export function createCity(parcelData=[]){
 let seed=250912;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const blocks=[],buildings=[],parks=[],facilities=[],roads=[],plots=[],seeds=[],edges=new Set();
 const special=[[1350,1350],[1670,1290],[2050,1350],[1320,1680],[1700,1690],[2050,1710],[1330,2090],[1710,2070],[2420,1380],[2440,1770],[2440,2110],[2060,2100]];
 special.forEach(([x,y],i)=>seeds.push({x,y,parcel:parcelData[i]}));
 for(let col=0;col<24;col++)for(let row=0;row<16;row++){const x=100+(col+.15+rand()*.7)*490,y=100+(row+.15+rand()*.7)*500;if(x>950&&x<2850&&y>950&&y<2500)continue;seeds.push({x,y});}
 const lake=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2;return [10100+Math.cos(a)*(650+80*Math.sin(a*3)),2050+Math.sin(a)*850];});
 for(let index=0;index<seeds.length;index++){
  const s=seeds[index];let cell=rect(40,40,WIDTH-80,HEIGHT-80);
  for(const t of seeds){if(s===t)continue;const nx=t.x-s.x,ny=t.y-s.y,k=(t.x*t.x+t.y*t.y-s.x*s.x-s.y*s.y)/2;cell=clip(cell,nx,ny,k);if(!cell.length)break;}
  if(cell.length<3)continue;
  for(let i=0;i<cell.length;i++){const a=cell[i],b=cell[(i+1)%cell.length],key=[a,b].map(p=>p.map(v=>Math.round(v)).join(',')).sort().join('|');if(!edges.has(key)){roads.push({points:[a,b],major:index%7===0});edges.add(key);}}
  const points=cell.map(([x,y])=>[s.x+(x-s.x)*.89,s.y+(y-s.y)*.89]);
  if(points.some(([x,y])=>Math.abs(x-riverX(y))<240)||contains([s.x,s.y],lake)||points.some(p=>contains(p,lake)))continue;
  const p=s.parcel,green=!p&&(rand()<.13||(s.x>8800&&s.y<3500));
  if(green){parks.push({id:'G-'+index,name:s.x>8800?'东山湖森林公园':'街区公园',points});continue;}
  const use=p?({'工业':'industry','商业':'office','居住':'housing','公共服务':'civic'}[p.use]):s.x<2600&&s.y>2800?'industry':s.x>7200&&s.x<9600&&s.y>3300&&s.y<6500?'office':rand()<.10?'civic':'housing';
  const block={id:'B-'+index,points,use,x:s.x,y:s.y};blocks.push(block);
  if(p)plots.push({...block,id:p.id,name:p.name});
  const angle=use==='industry'?0:Math.atan2(points[1][1]-points[0][1],points[1][0]-points[0][0]);
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),occupied=[];
  const target=p?4:use==='industry'?7:use==='civic'?6:16;
  for(let attempt=0;attempt<target*35&&occupied.length<target;attempt++){
   const w=use==='industry'?70+rand()*55:use==='office'?40+rand()*35:25+rand()*23,d=use==='industry'?40+rand()*30:45+rand()*45,cx=xmin+rand()*(xmax-xmin),cy=ymin+rand()*(ymax-ymin);
   const footprint=rect(cx-w/2,cy-d/2,w,d).map(q=>rotatePoint(q,cx,cy,angle)),reserved=rect(cx-w/2-7,cy-d/2-7,w+14,d+14).map(q=>rotatePoint(q,cx,cy,angle));
   if(!reserved.every(q=>contains(q,points))||occupied.some(q=>overlap(q,reserved)))continue;occupied.push(reserved);
   const floors=use==='office'?15+Math.floor(rand()*38):use==='industry'?2+Math.floor(rand()*3):use==='civic'?3+Math.floor(rand()*5):3+Math.floor(rand()*(s.y>6500?6:17));
   buildings.push({id:'BLD-'+index+'-'+occupied.length,name:USES[use].name+'建筑 '+(index+1)+'－'+occupied.length,points:footprint,x:cx-w/2,y:cy-d/2,width:w,depth:d,angle,height:floors*(use==='industry'?4.5:3.3),floors,use,blockId:block.id,variant:index%3,roof:use==='industry'?'厂房坡屋顶':use==='housing'&&floors<10?'住宅坡屋顶':use==='office'?'退台与设备屋面':'平屋顶',material:{housing:'浅色抹灰 / 深灰窗框',office:'玻璃幕墙 / 金属框架',industry:'红砖 / 金属屋面',civic:'石材 / 玻璃'}[use],parcelId:p?.id});
  }
  if(use==='civic')facilities.push({id:'P-'+index,name:index%2?'社区医院':'城市学校',kind:index%2?'H':'学',x:s.x,y:s.y,z:36});
 }
 const metro={points:[[800,4300],[2400,3300],[4000,3900],[5800,4700],[8000,5200],[10500,6100]],stations:[[800,4300],[2400,3300],[4000,3900],[5800,4700],[8000,5200],[10500,6100]]};
 metro.stations.forEach(([x,y],i)=>facilities.push({id:'M-'+i,name:['西港站','滨河更新站','文化中心站','江心站','中央商务站','南城站'][i],kind:'M',x,y,z:0}));
 const water=[];for(let y=0;y<=HEIGHT;y+=70)water.push([riverX(y)-155,y]);for(let y=HEIGHT;y>=0;y-=70)water.push([riverX(y)+155,y]);
 return {blocks,buildings,parks,facilities,roads,plots,metro,water,lakes:[lake]};
}
export function project([x,y,z=0],camera){const dx=x-camera.x,dy=y-camera.y,c=Math.cos(camera.bearing),s=Math.sin(camera.bearing);return [camera.w/2+(dx*c-dy*s)*camera.scale,camera.h/2+((dx*s+dy*c)*Math.sin(camera.pitch)-z*Math.cos(camera.pitch))*camera.scale];}
export function unproject([x,y],camera){const a=(x-camera.w/2)/camera.scale,b=(y-camera.h/2)/camera.scale/Math.sin(camera.pitch),c=Math.cos(camera.bearing),s=Math.sin(camera.bearing);return [camera.x+a*c+b*s,camera.y-a*s+b*c];}
export function contains([x,y],polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}

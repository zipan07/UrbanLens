// Deterministic fictional geometry; deliberately independent of assessment attributes.
export const WIDTH=6000, HEIGHT=4200;
export const USES={housing:{name:'居住',color:'#e7bc89'},office:{name:'商务',color:'#6ebfda'},industry:{name:'工业',color:'#cd8d82'},civic:{name:'公共服务',color:'#ab9cda'}};
export const riverX=y=>3350+180*Math.sin(y/850);
export const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
export function createCity(parcelData=[]){
 let seed=240911; const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const blocks=[],buildings=[],parks=[],facilities=[],roads=[],plots=[];
 for(let x=0;x<=WIDTH;x+=300)roads.push({points:[[x,0],[x,HEIGHT]],major:x%900===0});
 for(let y=0;y<=HEIGHT;y+=300)roads.push({points:[[0,y],[WIDTH,y]],major:y%900===0});
 const plotCells=[[4,4],[5,4],[6,4],[4,5],[5,5],[6,5],[4,6],[5,6],[7,4],[7,5],[7,6],[6,6]];
 for(let col=0;col<20;col++)for(let row=0;row<14;row++){
  const x=col*300+24,y=row*300+24,w=252,h=252;
  if([y,y+h/2,y+h].some(yy=>x<riverX(yy)+210&&x+w>riverX(yy)-210))continue;
  const pi=plotCells.findIndex(([c,r])=>c===col&&r===row),p=parcelData[pi];
  const green=!p&&((col+row*3)%13===0||(col>15&&row<3));
  if(green){parks.push({id:`G-${col}-${row}`,name:col>15?'东山生态公园':'邻里公园',points:rect(x,y,w,h)});continue;}
  const use=p?({'工业':'industry','商业':'office','居住':'housing','公共服务':'civic'}[p.use]):col<5?'industry':col>11&&row<8?'office':(col+row)%11===0?'civic':'housing';
  const block={id:`B-${col}-${row}`,points:rect(x,y,w,h),use};blocks.push(block);
  if(p)plots.push({...block,id:p.id,name:p.name,x:x+w/2,y:y+h/2});
  const count=use==='industry'?2:4;
  for(let i=0;i<count;i++){
   const bw=use==='industry'?204:use==='housing'?38+rand()*14:58+rand()*29,bh=use==='industry'?82:70+rand()*22;
   const bx=x+18+(i%2)*(use==='industry'?0:124),by=y+18+(use==='industry'?i:i>>1)*117;
   const floors=use==='office'?14+Math.floor(rand()*30):use==='housing'?4+Math.floor(rand()*14):use==='industry'?2+Math.floor(rand()*3):3+Math.floor(rand()*5);
   buildings.push({id:`BLD-${col}-${row}-${i}`,name:`${USES[use].name}建筑 ${col+1}－${row+1}－${i+1}`,points:rect(bx,by,bw,bh),height:floors*(use==='industry'?4.5:3.3),floors,use,variant:(col+row+i)%3,roof:use==='industry'?'厂房坡屋顶':use==='housing'&&floors<10?'住宅坡屋顶':use==='office'?'退台与设备屋面':'平屋顶',material:{housing:'浅色抹灰 / 深灰窗框',office:'玻璃幕墙 / 金属框架',industry:'红砖 / 金属屋面',civic:'石材 / 玻璃'}[use],parcelId:p?.id});
  }
  if(use==='civic')facilities.push({id:`P-${col}-${row}`,name:(col+row)%2?'社区医院':'城市学校',kind:(col+row)%2?'H':'学',x:x+w/2,y:y+h/2,z:36});
 }
 const metro={points:[[300,2850],[1800,2850],[2700,2250],[3900,2250],[4800,1650],[5700,1650]],stations:[[900,2850],[1800,2850],[2700,2250],[3900,2250],[4800,1650],[5700,1650]]};
 metro.stations.forEach(([x,y],i)=>facilities.push({id:`M-${i}`,name:['西港站','滨河更新站','文化中心站','江东站','中央商务站','东山站'][i],kind:'M',x,y,z:0}));
 const water=[];for(let y=0;y<=HEIGHT;y+=70)water.push([riverX(y)-135,y]);for(let y=HEIGHT;y>=0;y-=70)water.push([riverX(y)+135,y]);
 return {blocks,buildings,parks,facilities,roads,plots,metro,water};
}
export function project([x,y,z=0],camera){const dx=x-camera.x,dy=y-camera.y,c=Math.cos(camera.bearing),s=Math.sin(camera.bearing);return [camera.w/2+(dx*c-dy*s)*camera.scale,camera.h/2+((dx*s+dy*c)*Math.sin(camera.pitch)-z*Math.cos(camera.pitch))*camera.scale];}
export function unproject([x,y],camera){const a=(x-camera.w/2)/camera.scale,b=(y-camera.h/2)/camera.scale/Math.sin(camera.pitch),c=Math.cos(camera.bearing),s=Math.sin(camera.bearing);return [camera.x+a*c+b*s,camera.y-a*s+b*c];}
export function contains([x,y],polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}

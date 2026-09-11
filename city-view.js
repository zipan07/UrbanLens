import {createCity,project,unproject,contains,USES,WIDTH,HEIGHT,rect,riverX} from './city-data.js';
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class CityView {
 constructor(canvas,parcels,onSelect){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.data=createCity(parcels);this.onSelect=onSelect;
  this.camera={x:3000,y:2100,bearing:-.25,pitch:Math.PI/3,scale:.13,w:800,h:600};
  this.mode='3d';this.layers={buildings:true,land:true,roads:true,green:true,facilities:true,plots:true};this.color='use';this.visible=new Set(parcels.map(p=>p.id));this.results=new Map();this.hits=[];this.pointers=new Map();this.scope='city';
  $('#city-count').textContent=`6.0 × 4.2 km · ${this.data.buildings.length} 栋建筑 · ${this.data.facilities.length} 处设施`;
  this.bind();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas.parentElement);this.resize();
 }
 resize(){const box=this.canvas.getBoundingClientRect();if(!box.width||!box.height)return;const oldW=this.camera.w;this.camera.w=box.width;this.camera.h=box.height;const dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.round(box.width*dpr);this.canvas.height=Math.round(box.height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);if(this.scope==='city')this.fitScale();else this.camera.scale*=box.width/oldW;this.drawSoon();}
 fitScale(){const c=this.camera;const cos=Math.abs(Math.cos(c.bearing)),sin=Math.abs(Math.sin(c.bearing));c.scale=Math.min(c.w/(WIDTH*cos+HEIGHT*sin+700),Math.max(100,c.h-160)/((WIDTH*sin+HEIGHT*cos)*Math.sin(c.pitch)+600));}
 overview(){Object.assign(this.camera,{x:3000,y:2100,bearing:this.mode==='3d'?-.25:0});this.scope='city';this.fitScale();this.drawSoon();}
 focus(id){const p=this.data.plots.find(p=>p.id===id);if(!p)return;this.scope='parcel';Object.assign(this.camera,{x:p.x,y:p.y,scale:Math.min(this.camera.w/1300,this.camera.h/1150)});this.drawSoon();}
 update({selected,visible,results}){this.selected=selected;this.visible=visible;this.results=results;this.drawSoon();}
 drawSoon(){if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.draw();});}
 setMode(mode){this.mode=mode;this.camera.pitch=mode==='2d'?Math.PI/2:Number($('#city-pitch').value)*Math.PI/180;$('#city-pitch').disabled=mode==='2d';document.querySelectorAll('[data-city-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cityMode===mode)));if(this.scope==='city')this.fitScale();this.drawSoon();}
 zoom(factor,at=[this.camera.w/2,this.camera.h/2]){const before=unproject(at,this.camera);this.camera.scale=clamp(this.camera.scale*factor,.035,2.2);const after=unproject(at,this.camera);this.camera.x+=before[0]-after[0];this.camera.y+=before[1]-after[1];this.scope='custom';this.bound();this.drawSoon();}
 bound(){this.camera.x=clamp(this.camera.x,-500,WIDTH+500);this.camera.y=clamp(this.camera.y,-500,HEIGHT+500);}
 bind(){
  document.querySelectorAll('[data-city-mode]').forEach(b=>b.addEventListener('click',()=>this.setMode(b.dataset.cityMode)));
  document.querySelectorAll('[data-layer]').forEach(b=>b.addEventListener('change',()=>{this.layers[b.dataset.layer]=b.checked;if(!b.checked)this.clearInspection();this.drawSoon();}));
  $('#city-color').addEventListener('change',e=>{this.color=e.target.value;$('#city-use-legend').hidden=this.color!=='use';$('#city-height-legend').hidden=this.color!=='height';this.drawSoon();});
  $('#city-pitch').addEventListener('input',e=>{this.camera.pitch=Number(e.target.value)*Math.PI/180;this.scope='custom';this.drawSoon();});
  $('#zoom-in').addEventListener('click',()=>this.zoom(1.3));$('#zoom-out').addEventListener('click',()=>this.zoom(1/1.3));$('#zoom-fit').addEventListener('click',()=>this.overview());$('#city-focus').addEventListener('click',()=>this.focus(this.selected));
  $('#city-rotate').addEventListener('click',()=>{this.camera.bearing+=Math.PI/6;this.drawSoon();});
  $('#city-expand').addEventListener('click',()=>{const expanded=$('.workspace').classList.toggle('city-expanded');$('#city-expand').setAttribute('aria-pressed',String(expanded));$('#city-expand').textContent=expanded?'收起画布 ↙':'展开画布 ↗';});
  $('#city-inspector-close').addEventListener('click',()=>this.clearInspection());
  const pos=e=>{const r=this.canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
  this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
  this.canvas.addEventListener('pointerdown',e=>{const p=pos(e);this.canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,p);this.drag={start:p,last:p,moved:false,rotate:e.shiftKey||e.button===2};if(this.pointers.size>1){this.drag.moved=true;this.pinch=null;}});
  this.canvas.addEventListener('pointermove',e=>{
   if(!this.pointers.has(e.pointerId))return;const p=pos(e);this.pointers.set(e.pointerId,p);
   if(this.pointers.size===2){const [a,b]=[...this.pointers.values()],dist=Math.hypot(a[0]-b[0],a[1]-b[1]);if(this.pinch)this.zoom(dist/this.pinch,[(a[0]+b[0])/2,(a[1]+b[1])/2]);this.pinch=dist;this.drag.moved=true;return;}
   const d=this.drag;if(!d)return;const dx=p[0]-d.last[0],dy=p[1]-d.last[1];if(Math.hypot(p[0]-d.start[0],p[1]-d.start[1])>4)d.moved=true;
   if(d.rotate)this.camera.bearing+=dx*.006;else{const a=unproject(d.last,this.camera),b=unproject(p,this.camera);this.camera.x+=a[0]-b[0];this.camera.y+=a[1]-b[1];}
   d.last=p;this.scope='custom';this.bound();this.drawSoon();
  });
  const end=e=>{const d=this.drag;this.pointers.delete(e.pointerId);if(e.type==='pointerup'&&d&&!d.moved&&this.pointers.size===0)this.pick(pos(e));this.pinch=null;if(this.pointers.size){const p=[...this.pointers.values()][0];this.drag={start:p,last:p,moved:true,rotate:false};}else this.drag=null;};
  this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',end);
  this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom(Math.exp(-clamp(e.deltaY,-100,100)*.003),pos(e));},{passive:false});
  this.canvas.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','=','-','r','R'].includes(e.key)){e.preventDefault();if(e.key==='+'||e.key==='=')this.zoom(1.3);else if(e.key==='-')this.zoom(1/1.3);else if(e.key.toLowerCase()==='r')this.overview();else{const delta={ArrowUp:[0,-60],ArrowDown:[0,60],ArrowLeft:[-60,0],ArrowRight:[60,0]}[e.key],a=unproject([this.camera.w/2+delta[0],this.camera.h/2+delta[1]],this.camera);this.camera.x=a[0];this.camera.y=a[1];this.scope='custom';this.bound();this.drawSoon();}}});
 }
 clearInspection(){this.inspected=null;$('#city-inspector').hidden=true;this.drawSoon();}
 pick(p){
  const hit=[...this.hits].reverse().find(h=>contains(p,h.shape));
  if(hit?.item.kind){this.inspect(hit.item);return;}
  if(hit?.item.parcelId&&this.layers.plots&&this.visible.has(hit.item.parcelId)){this.clearInspection();this.onSelect(hit.item.parcelId);return;}
  const ground=unproject(p,this.camera),plot=this.layers.plots&&this.data.plots.find(q=>this.visible.has(q.id)&&contains(ground,q.points));
  if(plot){this.clearInspection();this.onSelect(plot.id);return;}
  if(hit){this.inspect(hit.item);return;}this.clearInspection();
 }
 inspect(item){this.inspected=item.id;$('#city-inspector').hidden=false;$('#city-object-name').textContent=item.name;$('#city-object-detail').textContent=item.kind?`${item.kind==='M'?'轨道交通站点':'公共服务设施'} · 虚构城市设施`:`${USES[item.use].name} · ${item.floors} 层 · ${item.height.toFixed(1)} m 高`;$('#city-object-note').textContent=item.parcelId?'关联更新地块；开启更新地块图层并清除筛选后可选地评估。':'城市背景对象 · 不纳入地块评分';this.drawSoon();}
 polygon(points,fill,stroke,width=1){const ctx=this.ctx;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
 world(points,fill,stroke,width=1,z=0){const p=points.map(([x,y])=>project([x,y,z],this.camera));this.polygon(p,fill,stroke,width);return p;}
 line(points,color,width,dash=[]){const ctx=this.ctx;ctx.beginPath();points.map(p=>project(p,this.camera)).forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}
 draw(){
  const ctx=this.ctx,c=this.camera,d=this.data;ctx.clearRect(0,0,c.w,c.h);ctx.fillStyle='#14232d';ctx.fillRect(0,0,c.w,c.h);this.hits=[];
  this.world(rect(0,0,WIDTH,HEIGHT),'#293b46','#536571');
  for(const b of d.blocks)this.world(b.points,this.layers.land?{housing:'#394c57',office:'#474559',industry:'#304e50',civic:'#555248'}[b.use]:'#30424d');
  if(this.layers.roads){for(const r of d.roads){this.line(r.points,r.major?'#64717a':'#4e616c',Math.max(.5,(r.major?25:11)*c.scale));if(r.major&&c.scale>.16)this.line(r.points,'#9ba6a6',.6,[4,5]);}}
  if(this.layers.green){for(const p of d.parks){this.world(p.points,'#456559');if(c.scale>.13){const [x,y]=p.points[0];for(let i=0;i<4;i++)for(let j=0;j<4;j++){const s=project([x+32+i*57,y+32+j*57,5],c);ctx.beginPath();ctx.ellipse(s[0],s[1],Math.max(1,14*c.scale),Math.max(1,12*c.scale),0,0,Math.PI*2);ctx.fillStyle='#73927b';ctx.fill();}}}const bank=[];for(let y=0;y<=HEIGHT;y+=70)bank.push([riverX(y)-192,y]);for(let y=HEIGHT;y>=0;y-=70)bank.push([riverX(y)+192,y]);this.world(bank,'#3f625a');this.world(d.water,'#32647a');}
  if(this.layers.roads){for(const y of [900,1800,2700,3600]){this.line([[riverX(y)-230,y],[riverX(y)+230,y]],'#87969d',Math.max(2,35*c.scale));}this.line(d.metro.points,'#d6b2f3',Math.max(1.3,9*c.scale),[7,4]);}
  if(this.layers.plots)for(const p of d.plots){if(!this.visible.has(p.id))continue;const color=p.id===this.selected?'#dbff73':this.results.get(p.id)?.total>=60?'#c5a5f0':this.results.has(p.id)?'#83cac4':'#a7b995';this.world(p.points,p.id===this.selected?'#647643':null,color,p.id===this.selected?2.5:1.2);}
  if(this.layers.buildings){
   const sorted=[...d.buildings].sort((a,b)=>{const depth=q=>{const [x,y]=q.points[0];return -(x*Math.sin(c.bearing)+y*Math.cos(c.bearing))*Math.cos(c.pitch);};return depth(a)-depth(b);});
   for(const b of sorted){const roof=b.points.map(([x,y])=>project([x,y,b.height],c));if(roof.every(p=>p[0]<-100)||roof.every(p=>p[0]>c.w+100)||roof.every(p=>p[1]<-120)||roof.every(p=>p[1]>c.h+120))continue;
    const selected=this.layers.plots&&this.visible.has(b.parcelId)&&b.parcelId===this.selected;
    const color=selected?'#dcfa91':this.color==='height'?b.height>90?'#c0a5ef':b.height>45?'#77b5c6':'#b4cec1':USES[b.use].color;
    if(this.mode==='3d'){
     // Draw only walls facing the camera. Roof is drawn after visible walls.
     for(let i=0;i<4;i++){const a=b.points[i],n=b.points[(i+1)%4],dx=n[0]-a[0],dy=n[1]-a[1];const nx=dy,ny=-dx;const facing=nx*(-Math.sin(c.bearing))+ny*(-Math.cos(c.bearing));if(facing<=0)continue;
      const wall=[project(a,c),project(n,c),roof[(i+1)%4],roof[i]];this.polygon(wall,color);this.polygon(wall,i%2?'#11213066':'#11213099');this.hits.push({shape:wall,item:b});
      if(c.scale>.65&&b.floors>4){for(let floor=3;floor<b.floors;floor+=3)this.line([[a[0],a[1],floor*b.height/b.floors],[n[0],n[1],floor*b.height/b.floors]],'#d4e9ed44',.6);}
     }
    }
    this.polygon(roof,color,b.id===this.inspected?'#ffffff':'#20344155',b.id===this.inspected?2:.6);this.hits.push({shape:roof,item:b});
   }
  }
  if(this.layers.facilities)for(const f of d.facilities){const p=project([f.x,f.y,this.mode==='3d'?f.z:0],c);if(p[0]<16||p[0]>c.w-16||p[1]<16||p[1]>c.h-16)continue;const r=f.kind==='M'?7:9;ctx.beginPath();ctx.arc(...p,r,0,Math.PI*2);ctx.fillStyle=f.kind==='M'?'#ccaff0':'#eed1a8';ctx.fill();ctx.fillStyle='#18262f';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText(f.kind,p[0],p[1]+3.5);this.hits.push({shape:rect(p[0]-r,p[1]-r,r*2,r*2),item:f});}
  ctx.textAlign='center';ctx.font='11px sans-serif';
  if(c.scale<.2)for(const [name,x,y] of [['西港产业区',700,1600],['滨河更新片区',1900,1650],['江东中央商务区',4600,1200],['东山生态区',5350,500],['南城居住区',4300,3550]]){const p=project([x,y,180],c);ctx.fillStyle='#14232ddd';ctx.fillRect(p[0]-name.length*6-8,p[1]-13,name.length*12+16,22);ctx.fillStyle='#e1e9e7';ctx.fillText(name,...p);}
  if(this.layers.plots&&c.scale>=.2)for(const p of d.plots){if(!this.visible.has(p.id))continue;const s=project([p.x,p.y,0],c);ctx.fillStyle='#111f29df';ctx.fillRect(s[0]-30,s[1]+10,60,17);ctx.fillStyle=p.id===this.selected?'#dbff73':'#e0e8e8';ctx.fillText(p.id,s[0],s[1]+22);}
  $('#city-north').style.transform=`rotate(${Math.atan2(Math.sin(c.bearing),Math.cos(c.bearing)*Math.sin(c.pitch))*180/Math.PI}deg)`;
  const meters=c.scale<.15?1000:c.scale<.4?500:100;$('#city-scale-bar').style.width=`${meters*c.scale}px`;$('#city-scale-label').textContent=meters===1000?'1 km':`${meters} m`;$('#city-camera-state').textContent=`${this.mode==='3d'?'3D 体量':'2D 平面'} · ${Math.round(c.pitch*180/Math.PI)}°`;
 }
}

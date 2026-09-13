// Small, source-attributed landmark navigator inside the existing layer popover.
const node=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
const link=(label,href)=>{const e=node('a',label);if(/^https:\/\//.test(href||'')){e.href=href;e.target='_blank';e.rel='noopener noreferrer';}return e;};
export function updateBuildingPanel(status,{map,base,enable}){
 const output=document.querySelector('#realism-status'),gallery=document.querySelector('#realism-gallery'),list=document.querySelector('#realism-landmarks');if(!output||!gallery||!list)return;
 if(status.state==='loading'){output.textContent='正在加载实景与材质…';return;}
 if(status.state==='error'){output.textContent='贴图暂不可用 · 已显示基础材质';return;}
 if(status.state!=='ready')return;
 output.textContent=status.failures?'部分贴图未加载 · 已保留示意材质':(status.manifest.materials.length?`${status.landmarks} 座实景地标 · 扫描材质已就绪`:'精细建筑已就绪 · 窗型、阳台与屋顶');gallery.hidden=!status.manifest.materials.length;
 list.replaceChildren();const manifest=status.manifest,materials=new Map(manifest.materials.map(m=>[m.id,m]));
 for(const landmark of manifest.landmarks.filter(l=>l.photo)){
  const photo=materials.get(landmark.photo),card=node('article'),button=node('button'),img=node('img');button.type='button';button.title=`查看${landmark.name}`;
  if(/^assets\/building-realism\/[a-z0-9._-]+$/i.test(photo.maps.baseColor))img.src=new URL(photo.maps.baseColor,base).href;img.alt=landmark.name+'实景参考';img.loading='lazy';img.width=160;img.height=95;
  button.append(img,node('strong',landmark.name));button.addEventListener('click',()=>{enable();map.easeTo({center:landmark.center,zoom:17.5,pitch:62,bearing:landmark.frontBearing-180,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1000});document.querySelector('#layers-popover').hidden=true;});
  const credit=node('small');credit.append(link(photo.author,photo.sourcePage),document.createTextNode(' · '),link(photo.license,photo.licenseUrl));card.append(button,credit);list.append(card);
 }
 const sources=document.querySelector('#realism-surface-credits');sources.replaceChildren();for(const m of manifest.materials.filter(m=>m.type==='surface')){const row=node('small');row.append(link(m.name,m.sourcePage),document.createTextNode(` · ${m.author} · CC0`));sources.append(row);}
}

import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {referencePoint} from '../src/value-domain.js';
import {inGeometry} from '../src/geo.js';
const file='dist/data/research-units.geojson',collection=JSON.parse(fs.readFileSync(file));
const existing=collection.features.filter(f=>f.id.startsWith('XW-'));
for(const f of existing)f.properties.district='玄武区';
const choices={
 gulou:[
 ['way/547612793','居住社区','清河新寓二村：社区公共服务与慢行联系','核对社区日常服务的实际步行路径，比较微更新与设施补充。'],
 ['way/783604432','居住社区','龙凤花园：居住环境与共享空间','调查公共空间使用时段、停车冲突及适老出行需求。'],
 ['way/91829529','产业空间','南京西站：铁路空间与周边城市联系','在权属、运营和历史要素核查后，比较保留利用与公共通达方案。'],
 ['way/1355383539','产业空间','南大苏富特科技创新园：载体利用与服务配套','核对楼宇实际使用与租赁需求，比较存量空间的分期利用方式。'],
 ['way/318061162','商业文旅','苏宁慧谷：商务空间与滨水联系','调查通勤、公共空间和服务需求，比较空间组织优化与运营调整。'],
 ['way/165476764','校园周边','河海大学西康路校区：校园与街区联系','研究校园边界、公共通行与服务共享条件，不预设开放或建设权限。']
 ],
 qinhuai:[
 ['way/587964567','产业空间','1865产业园区：工业遗产与复合利用','核对保护要求、既有业态与公共空间承载，比较渐进改善路径。'],
 ['relation/2137425','产业空间','熊猫通信工业园：产业载体与功能适配','先调查企业使用、设施条件和经营需求，再讨论空间调整。'],
 ['relation/2137443','居住社区','万达新村：社区配套与环境改善','核对服务可达性、建筑条件及居民需求，形成轻重缓急清单。'],
 ['way/1021848763','居住社区','康美里：生活服务与适老更新','结合步行实测和居民访谈，比较公共空间与服务补充的优先顺序。'],
 ['way/590937998','商业文旅','夫子庙：历史空间与日常使用','分别观察居民、游客与商户需求，核对保护要求和高峰承载。'],
 ['relation/14290821','商业文旅','熙南里文化街区：文化空间与持续运营','比较文化展示、日常消费和公共活动的时段组织及运营条件。']
 ]
};
for(const [district,rows]of Object.entries(choices)){
 const p=JSON.parse(fs.readFileSync(`dist/packed/${district}.json`));const extra=JSON.parse(gunzipSync(Buffer.from(p.parts.map(n=>fs.readFileSync('dist/packed/'+n,'utf8')).join(''),'base64')));
 rows.forEach(([osm,type,story,question],i)=>{const f=extra.data.land.features.find(f=>f.properties.osm_id===osm);if(!f||!inGeometry(referencePoint(f.geometry),extra.data.boundary.features[0].geometry))throw Error('Invalid case '+osm);
 const id=(district==='gulou'?'GL':'QH')+'-R'+String(i+1).padStart(2,'0');existing.push({...structuredClone(f),id,properties:{...f.properties,unit_id:id,category:'research',district:district==='gulou'?'鼓楼区':'秦淮区',research_type:type,story,study_question:question,case_status:'预设研究情景，非官方更新项目',boundary_source:'OSM 用地轮廓选作研究单元，不是地籍或官方更新单元',source_date:extra.manifest.snapshotAt,source_url:'https://www.openstreetmap.org/'+osm}});});
}
if(existing.length!==20)throw Error('Expected 20 research cases');
fs.writeFileSync(file,JSON.stringify({...collection,metadata:{...collection.metadata,version:'NANJING-RESEARCH-23',districts:['玄武区','鼓楼区','秦淮区'],count:20,note:'20 个真实轮廓上的预设研究情景，不代表被认定为低效、闲置或已列入更新计划。经营、空置与质量数据缺失时仍保留未知或明确标为模拟。'},features:existing}));
console.log(existing.map(f=>`${f.id} ${f.properties.name}`).join('\n'));

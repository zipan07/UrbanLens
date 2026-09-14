import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {detailedInsights} from '../src/assessment-insights.js';
import {installReadingView,revealAssessment} from '../src/assessment-reading.js';
import {loadStudyData} from '../server/district-data.js';
import {analyzeUnit,computeAssessment} from '../src/value-domain.js';
import {inGeometry} from '../src/geo.js';
test('20 cases belong to all three districts and their local assessments use district buildings',async()=>{
 const {data,services,boundary}=await loadStudyData(p=>JSON.parse(fs.readFileSync('dist/'+p)),p=>fs.readFileSync('dist/'+p,'utf8'));
 const units=JSON.parse(fs.readFileSync('dist/data/research-units.geojson')).features;
 assert.equal(units.length,20);assert.equal(new Set(units.map(u=>u.id)).size,20);assert.deepEqual([...new Set(units.map(u=>u.properties.district))],['玄武区','鼓楼区','秦淮区']);
 for(const u of units){const a=analyzeUnit(u,data,services);assert(inGeometry(a.point,boundary));assert(a.buildingCount>=0,u.id);const r=computeAssessment(u,a,{mode:'hybrid'});assert(Number.isFinite(r.total));assert(r.studyContext.question);}
});
test('contributions and bounded sensitivity use effective base weight; missing totals stay missing',()=>{
 const r={total:50,auxiliary:{effectiveWeight:.2},dimensions:[{name:'A',score:95,weight:.4},{name:'B',score:0,weight:.6}],input:{},fieldEvidence:[{key:'vacancy',kind:'simulated',verification:'verified',validity:'valid'},{key:'area',kind:'derived',verification:'verified',validity:'valid'}]};
 const d=detailedInsights(r);assert.equal(d.contributions[0].contribution,30.4);assert.equal(d.contributions[0].increase,1.6);assert.equal(d.contributions[1].contribution,0);assert.equal(d.verified,1);assert.equal(d.simulated,1);assert.equal(detailedInsights({...r,total:null}).contributions[0].increase,null);assert.equal(detailedInsights({...r,mode:'demo'}).verified,1);
});
function environment(t,html){const {window,document}=parseHTML(html);const frames=new Map();let n=0;for(const [k,v]of Object.entries({window,document,matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),requestAnimationFrame:f=>{frames.set(++n,f);return n;},cancelAnimationFrame:i=>frames.delete(i),ResizeObserver:class{observe(){}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}}})){const old=Object.getOwnPropertyDescriptor(globalThis,k);Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});t.after(()=>old?Object.defineProperty(globalThis,k,old):delete globalThis[k]);}return {window,document,frames};}
test('splitter supports keyboard bounds and reset without collapsing the reading pane',t=>{
 const {window,document}=environment(t,'<html><body><main class="workspace"><button id="reading-toggle"></button><section class="map-workspace"></section><aside id="inspector"></aside><button id="mobile-panel"></button></main></body></html>');
 const workspace=document.querySelector('.workspace');Object.defineProperty(workspace,'clientWidth',{value:1200});window.innerWidth=1363;workspace.getBoundingClientRect=()=>({left:76,width:1200});document.querySelector('#inspector').getBoundingClientRect=()=>({width:424});installReadingView({resize(){}});const separator=document.querySelector('#workspace-splitter');assert.equal(separator.getAttribute('role'),'separator');
 const key=k=>{const e=new window.Event('keydown',{bubbles:true,cancelable:true});e.key=k;separator.dispatchEvent(e);};key('End');assert(Math.abs(parseFloat(workspace.style.getPropertyValue('--reading-map-width'))-880)<.01);key('Home');assert.equal(workspace.style.getPropertyValue('--reading-map-width'),'220px');key('ArrowRight');assert(Math.abs(parseFloat(workspace.style.getPropertyValue('--reading-map-width'))-244)<.01);separator.dispatchEvent(new window.Event('dblclick'));assert.equal(workspace.style.getPropertyValue('--reading-map-width'),'776px');
});
test('progressive reveal exposes real results, skips immediately and cleans up pending content',t=>{
 const {window,document}=environment(t,'<html><body><div id="value-detail"><div class="assessment-dashboard"><span data-metric="total">42.5</span></div><article class="analysis-card">First</article><section class="assessment-insight-block">Evidence</section><section class="budget-card">Budget</section></div></body></html>');
 window.HTMLElement.prototype.animate=()=>({cancel(){}});const root=document.querySelector('#value-detail'),stop=revealAssessment(root,{progressive:true});assert.equal(root.querySelector('.assessment-dashboard').hidden,false);assert.equal(root.querySelector('.analysis-card').hidden,true);root.querySelector('.assessment-release button').click();assert.equal(root.querySelectorAll('[hidden]').length,0);assert.equal(root.querySelector('[data-metric]').textContent,'42.5');stop();assert.equal(root.querySelectorAll('[hidden]').length,0);
});

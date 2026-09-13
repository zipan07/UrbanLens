import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {installPhoneWorkspace,PHONE_QUERY,PHONE_TOOLS} from '../src/phone-workspace.js';
test('phone defaults to map; every tool moves once, drawers switch, and desktop restores original nodes',async()=>{
 const {window,document}=parseHTML(readFileSync('dist/index.html','utf8'));
 const names=['window','document','matchMedia','MutationObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','Event'];const before=Object.fromEntries(names.map(k=>[k,globalThis[k]]));
 const media={matches:false,addEventListener(){}};let resizes=0,next=0;const frames=new Map();
 window.HTMLElement.prototype.getBoundingClientRect=()=>({height:48,width:390});
 Object.assign(globalThis,{window,document,Event:window.Event,matchMedia:()=>media,MutationObserver:window.MutationObserver,ResizeObserver:class{observe(){}},requestAnimationFrame:f=>{frames.set(++next,f);return next;},cancelAnimationFrame:id=>frames.delete(id)});
 const panel=document.querySelector('#inspector'),openPanel=on=>panel.classList.toggle('is-open',on);
 const original=PHONE_TOOLS.map(s=>document.querySelector(s)).filter(Boolean).map(el=>[el,el.parentNode,el.nextSibling]);
 const click=action=>document.querySelector(`[data-phone="${action}"]`).click();
 const settle=async()=>{await new Promise(r=>setTimeout(r,0));for(const [id,f]of [...frames]){frames.delete(id);f();}await new Promise(r=>setTimeout(r,0));};
 document.addEventListener('urbanlens:reading-close',()=>document.body.classList.remove('reading-wide'));
 try{
  const controller=installPhoneWorkspace({map:{resize(){resizes++;}},studio:()=>({adapter:{tab:()=>openPanel(true)}}),openPanel});
  assert.equal(document.body.classList.contains('phone-ui'),false);assert.equal(resizes,0);for(const [el,parent]of original)assert.equal(el.parentNode,parent);
  media.matches=true;controller.sync();await settle();assert.equal(panel.classList.contains('is-open'),false);
  const content=document.querySelector('.phone-tools-content');for(const [el]of original)assert.equal(el.parentNode,content);
  click('assessment');await settle();assert.equal(panel.classList.contains('is-open'),true);
  document.body.classList.add('reading-wide');click('tools');await settle();assert.equal(document.querySelector('#phone-tools-panel').hidden,false);assert.equal(panel.classList.contains('is-open'),false);assert.equal(document.body.classList.contains('reading-wide'),false);
  click('menu');await settle();assert.equal(document.querySelector('#phone-tools-panel').hidden,true);assert.equal(document.body.classList.contains('phone-menu-open'),true);
  click('map');await settle();assert.equal(document.body.classList.contains('phone-menu-open'),false);
  document.body.classList.add('is-presenting');click('assessment');document.dispatchEvent(new window.Event('urbanlens:home'));await settle();await settle();assert.equal(panel.classList.contains('is-open'),false);
  const count=resizes;document.body.classList.add('is-map-moving');await settle();document.body.classList.remove('is-map-moving');await settle();assert.equal(resizes,count,'map motion must not trigger a resize loop');
  media.matches=false;controller.sync();await settle();for(const [el,parent,sibling]of original){assert.equal(el.parentNode,parent);assert.equal(el.nextSibling,sibling);}assert.equal(document.body.classList.contains('phone-ui'),false);
  assert.ok(PHONE_QUERY.includes('(pointer:coarse)'),'wide landscape requires a touch device');
 }finally{Object.assign(globalThis,before);}
});
test('mobile CSS is isolated and includes bounded scrolling and viewport safe areas',()=>{
 const css=readFileSync('dist/phone.css','utf8');assert.ok(css.includes('100dvh'));assert.ok(css.includes('safe-area-inset-bottom'));assert.ok(css.includes('overflow-x:auto'));assert.ok(css.includes('overflow-y:auto'));assert.ok(css.includes('.phone-ui.is-presenting .phone-dock'));
 const html=readFileSync('dist/index.html','utf8');assert.ok(html.indexOf('./phone.css')>html.indexOf('./reading.css'));
});

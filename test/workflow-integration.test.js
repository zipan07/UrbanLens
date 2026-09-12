import test from 'node:test';
import assert from 'node:assert/strict';
import {ValueStudio} from '../src/value-studio.js';

const polygon=id=>({type:'Feature',properties:{parcel_id:id},geometry:{type:'Polygon',coordinates:[[[118.8,32.05],[118.801,32.05],[118.801,32.051],[118.8,32.051],[118.8,32.05]]]}});
function studio(){
 const s=Object.create(ValueStudio.prototype),base={...polygon('XW-R01'),id:'XW-R01',properties:{name:'Base',parcel_id:'XW-R01'}};
 s.units=[base];s.analyses=new Map([['XW-R01',{area:100}]]);s.data={buildings:{features:[]},land:{metadata:{snapshotAt:'2026-09-11'}}};s.services={features:[],metadata:{snapshotAt:'2026-09-12'}};
 s.state={selected:'XW-R01',compared:[],runs:[],mode:'observed'};s.adapter={tab(){},clearObjectSelection(){}};s.render=()=>{};
 return s;
}
test('replacing imported boundaries removes obsolete comparison and analysis entries',()=>{
 const s=studio();s.addImported({features:[polygon('IMPORT-A')]});s.state.compared=['XW-R01','IMPORT-A'];s.addImported({features:[polygon('IMPORT-B')]});
 assert.deepEqual(s.units.map(u=>u.id),['XW-R01','IMPORT-B']);assert.deepEqual(s.state.compared,['XW-R01']);assert(!s.analyses.has('IMPORT-A'));assert(s.analyses.has('IMPORT-B'));
});
test('a degenerate import is rejected before changing current units or comparison',()=>{
 const s=studio();s.addImported({features:[polygon('IMPORT-A')]});s.state.compared=['IMPORT-A'];const before={units:s.units,analyses:s.analyses,selected:s.state.selected,compared:[...s.state.compared]};
 const bad=polygon('BAD');bad.geometry.coordinates=[Array.from({length:4},()=>[118.8,32.05])];assert.throws(()=>s.addImported({features:[polygon('GOOD'),bad]}),/有效面积/);
 assert.equal(s.units,before.units);assert.equal(s.analyses,before.analyses);assert.equal(s.state.selected,before.selected);assert.deepEqual(s.state.compared,before.compared);
});
test('a matching data fingerprint cannot reuse a run from an older rule',()=>{
 const s=studio();s.result=()=>({fingerprint:'same-data',ruleVersion:'NEW'});s.state.runs=[{id:'old',unitId:'XW-R01',fingerprint:'same-data',ruleVersion:'OLD'}];assert.equal(s.run(),undefined);
 s.state.runs.push({id:'new',unitId:'XW-R01',fingerprint:'same-data',ruleVersion:'NEW'});assert.equal(s.run().id,'new');
});

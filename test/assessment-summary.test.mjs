import test from 'node:test';
import assert from 'node:assert/strict';
import {renewalSummary,retrofitBudget} from '../src/assessment-summary.js';
test('missing observations do not become diagnosed vacancy, safety or funding facts',()=>{
 const s=renewalSummary({input:{},dimensions:[],missing:['使用状态']});
 assert.match(s.cards[0].text,/信息不足/);assert.match(s.cards[3].text,/尚缺独立约束/);assert.match(s.cards[3].text,/不能据此给出项目总投资/);assert.deepEqual(s.missing,['使用状态']);
});
test('simulated assumptions remain explicit and high scores mean attention not return',()=>{
 const s=renewalSummary({mode:'hybrid',simulation:{count:3},input:{vacancy:50,condition:3,area:20000,distance:800},dimensions:[{name:'使用状态',score:50},{name:'建筑状况',score:70}],constraints:[{label:'权属',status:'unknown'}]});
 assert.match(s.context,/模拟假设/);assert.match(s.cards[0].text,/50%/);assert.match(s.cards[1].text,/不表示收益更高/);assert.match(s.cards[2].text,/步行路径/);assert.match(s.cards[3].text,/权属/);
});
test('retrofit budget uses selected area, user unit cost and reserve without implying total investment',()=>{
 const b=retrofitBudget(10000,30,1000,10);assert.equal(b.area,3000);assert.equal(b.base,3000000);assert.ok(Math.abs(b.total-3300000)<.01);assert.ok(Math.abs(b.reserveAmount-300000)<.01);
 for(const args of [[null,30,1000,10],[10000,30,NaN,10],[10000,101,1000,10],[10000,30,-1,10],[10000,30,1000,-1]])assert.equal(retrofitBudget(...args),null);
});

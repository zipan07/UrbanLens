import test from 'node:test';
import assert from 'node:assert/strict';
import {computeAssessment} from '../src/value-domain.js';

// Independently selected inputs and fixed hand-calculated expectations.
// Dimension order: spatial, efficiency, industry, building, vacancy.
const samples = [
  {id:'C01',name:'legal zero values',area:1000,buildingArea:0,distance:0,industry:'符合',condition:1,vacancy:0,ratio:0,scores:[0,100,20,0,0],coverage:100,total:24},
  {id:'C02',name:'ordinary complete record',area:1000,buildingArea:1000,distance:300,industry:'待调整',condition:2,vacancy:25,ratio:1,scores:[20,50,80,33.3,25],coverage:100,total:41.7},
  {id:'C03',name:'fractional building score',area:1000,buildingArea:1500,distance:750,industry:'符合',condition:3,vacancy:50,ratio:1.5,scores:[50,25,20,66.7,50],coverage:100,total:42.3},
  {id:'C04',name:'exact mapping thresholds',area:1000,buildingArea:2000,distance:1500,industry:'待调整',condition:4,vacancy:100,ratio:2,scores:[100,0,80,100,100],coverage:100,total:76},
  {id:'C05',name:'valid values beyond score saturation thresholds',area:1000,buildingArea:3000,distance:2100,industry:'符合',condition:1,vacancy:0,ratio:3,scores:[100,0,20,0,0],coverage:100,total:24},
  {id:'C06',name:'missing distance',area:1000,buildingArea:1000,distance:null,industry:'待调整',condition:2,vacancy:25,ratio:1,scores:[null,50,80,33.3,25],coverage:80,total:null},
  {id:'C07',name:'zero denominator',area:0,buildingArea:1000,distance:300,industry:'待调整',condition:2,vacancy:25,ratio:null,scores:[20,null,80,33.3,25],coverage:80,total:null},
  {id:'C08',name:'missing building area',area:1000,buildingArea:null,distance:300,industry:'待调整',condition:2,vacancy:25,ratio:null,scores:[20,null,80,33.3,25],coverage:80,total:null},
  {id:'C09',name:'multiple missing dimensions',area:1000,buildingArea:1000,distance:300,industry:'待核实',condition:null,vacancy:null,ratio:1,scores:[20,50,null,null,null],coverage:40,total:null},
  {id:'C10',name:'invalid raw values are not clipped',area:1000,buildingArea:-20,distance:-1,industry:'待调整',condition:5,vacancy:101,ratio:null,scores:[null,null,80,null,null],coverage:20,total:null},
];

function calculate(sample,profile='balanced') {
  const unit={id:sample.id,properties:{name:sample.name}};
  const analysis={area:sample.area,nearest:{transit:sample.distance===null?null:{distance:sample.distance}},counts:{},geometryDate:'2026-09-01',spatialDate:'2026-09-02'};
  const {buildingArea,vacancy,industry,condition}=sample;
  const uploaded={[sample.id]:{buildingArea,vacancy,industry,condition,source:'Independent QA fixture',date:'2026-09-03'}};
  return computeAssessment(unit,analysis,{mode:'uploaded',profile,uploaded});
}

for(const sample of samples) {
  test(`${sample.id}: ${sample.name}`,()=>{
    const result=calculate(sample);
    assert.equal(result.ratio,sample.ratio,'FAR');
    assert.deepEqual(result.scores,sample.scores,'five dimension scores');
    assert.deepEqual(result.dimensions.map(d=>d.score),sample.scores,'displayed dimension scores');
    assert.equal(result.coverage,sample.coverage,'weighted coverage');
    assert.equal(result.total,sample.total,'composite score');
  });
}

// Two nonuniform profiles, each checked for a full score and a missing-weight case.
test('public profile: complete total 83 and missing-transit coverage 65%',()=>{
  const complete=calculate(samples[3],'public');
  assert.deepEqual(complete.scores,[100,0,80,100,100]);
  assert.deepEqual(complete.dimensions.map(d=>d.weight),[0.35,0.15,0.1,0.25,0.15]);
  assert.equal(complete.coverage,100);
  assert.equal(complete.total,83);
  const missing=calculate(samples[5],'public');
  assert.deepEqual(missing.scores,[null,50,80,33.3,25]);
  assert.equal(missing.coverage,65);
  assert.equal(missing.total,null);
});

test('efficiency profile: complete total 62 and missing-transit coverage 85%',()=>{
  const complete=calculate(samples[3],'efficiency');
  assert.deepEqual(complete.scores,[100,0,80,100,100]);
  assert.deepEqual(complete.dimensions.map(d=>d.weight),[0.15,0.35,0.15,0.1,0.25]);
  assert.equal(complete.coverage,100);
  assert.equal(complete.total,62);
  const missing=calculate(samples[5],'efficiency');
  assert.deepEqual(missing.scores,[null,50,80,33.3,25]);
  assert.equal(missing.coverage,85);
  assert.equal(missing.total,null);
});

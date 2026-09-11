import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cameraFromState,RealCityScene} from '../src/city-webgl.js';
import {createCity,project} from '../dist/city-data.js';
import {parcels,filterParcels,evaluate} from '../dist/domain.js';

test('PRD filters intersect without treating valid zero or unassessed results as missing',()=>{
 const results=new Map([['UL-001',evaluate(parcels[0])]]);
 assert.deepEqual(filterParcels('','',{quality:'missing'}).map(p=>p.id),['UL-004','UL-010']);
 assert.ok(filterParcels('','',{quality:'full'}).some(p=>p.id==='UL-008'));
 assert.deepEqual(filterParcels('','工业',{minArea:18000,maxArea:20000,status:'done'},results).map(p=>p.id),['UL-001']);
 assert.equal(filterParcels('','',{minArea:30000,maxArea:10000}).length,0);
 assert.equal(filterParcels('','',{status:'todo'},results).length,11);
 assert.deepEqual(filterParcels('','',{status:'high'},results).map(p=>p.id),['UL-001']);
});
test('WebGL camera and overlay map projection align including exact top-down views',()=>{
 const cam=new THREE.OrthographicCamera(-1,1,1,-1,1,26000);
 for(const bearing of [-1.5,-.25,0,2])for(const pitch of [.5,.87,Math.PI/2]){
  const state={x:3000,y:2100,w:900,h:640,scale:.23,bearing,pitch};cameraFromState(cam,state);
  for(const [x,y,z] of [[1600,1500,0],[3900,2000,120],[3000,2100,12]]){
   const v=new THREE.Vector3(x,z,y).project(cam),expected=project([x,y,z],state);
   assert.ok(Math.abs((v.x+1)/2*state.w-expected[0])<1e-7);assert.ok(Math.abs((1-v.y)/2*state.h-expected[1])<1e-7);
  }
 }
});
test('architectural batches have finite transforms and remain associated with their source buildings',()=>{
 // Construct geometry only, without claiming to exercise a browser or GPU context.
 const scene=Object.create(RealCityScene.prototype);Object.assign(scene,{data:createCity(parcels),materials:new Map(),batches:new Map(),groups:{},scene:new THREE.Scene(),pickables:[],buildingRefs:[],boxGeo:new THREE.BoxGeometry(1,1,1),gableGeo:new THREE.BoxGeometry(1,1,1)});
 for(const key of ['buildings','detail'])scene.groups[key]=new THREE.Group();
 scene.buildArchitecture();scene.flush();assert.equal(new Set(scene.buildingRefs.map(r=>r.item.id)).size,720);
 for(const group of Object.values(scene.groups))for(const mesh of group.children){assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));assert.ok(mesh.boundingSphere.radius>0);}
 const fake={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};scene.materials.get('facade-office').onBeforeCompile(fake);assert.ok(fake.fragmentShader.includes('cityPosition'));assert.ok(fake.vertexShader.includes('instanceMatrix'));
});

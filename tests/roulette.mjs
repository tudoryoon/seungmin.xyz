import assert from 'node:assert/strict';
import {STATIONS} from '../stations.js';
import {uniformIndex, pointerIndex, landingAngle, createSpin, TAU} from '../roulette-core.js';

assert.equal(STATIONS.length,448);
assert.equal(new Set(STATIONS.map(s=>s.id)).size,448);
const expected=[102,51,44,51,56,39,53,24,38,58];
const lines=[...Array.from({length:9},(_,i)=>`${i+1}호선`),'경의중앙선'];
lines.forEach((line,i)=>assert.equal(STATIONS.filter(s=>s.lines.includes(line)).length,expected[i],line));
for(const station of STATIONS) {
  assert.ok(station.lines.length && station.lines.every(line=>lines.includes(line)));
  assert.equal(new Set(station.lines).size,station.lines.length);
}
for(const name of ['신촌','양평']) assert.equal(STATIONS.filter(s=>s.name===name).length,2);
for(const name of ['서울역','총신대입구(이수)','대곡','지축','홍대입구']) assert.equal(STATIONS.filter(s=>s.name===name).length,1);
for(const name of ['연천','신창','인천','광명','서동탄','까치산','신설동','진접','마천','하남검단산','석남','별내','중앙보훈병원','운천','임진강','도라산','지평','한국항공대','평택지제','자양']) assert.ok(STATIONS.some(s=>s.name===name),name);
assert.ok(STATIONS.find(s=>s.name==='도라산').note);
assert.deepEqual(STATIONS.find(s=>s.name==='까치산').lines,['2호선','5호선']);
const count=STATIONS.length, limit=2**32-(2**32%count);
for(let i=0;i<count*4;i++) assert.equal(uniformIndex(count,values=>{values[0]=i;}),i%count);
let calls=0;
assert.equal(uniformIndex(count,values=>{values[0]=[2**32-1,limit,447][calls++];}),447);
assert.equal(calls,3,'reject incomplete remainder');
assert.equal(uniformIndex(count,values=>{values[0]=limit-1;}),count-1);
for(const bad of [0,-1,1.5,NaN,Infinity,2**32+1]) assert.throws(()=>uniformIndex(bad),RangeError);
for(let i=0;i<count;i++) for(const from of [0,.98, TAU*51+.45]) {
  const angle=landingAngle(from,i,count);
  assert.equal(pointerIndex(angle,count),i,'visual pointer matches chosen station');
  assert.ok(angle>=from+TAU*6);
}
let motion=true, frames=new Map(), next=0, picks=0, result=[], states=[], drawn=[];
const spin=createSpin({count,motion:()=>motion,pick:()=>{picks++;return 447;},
  frame:callback=>{frames.set(++next,callback);return next;},cancelFrame:id=>frames.delete(id),
  draw:(angle,index)=>drawn.push([angle,index]),result:index=>result.push(index),state:state=>states.push(state)});
assert.equal(spin.start(),true);assert.equal(spin.start(),false);assert.equal(picks,1);
for(const time of [0,1000,2000,4200]){const callbacks=[...frames.values()];frames.clear();callbacks.forEach(cb=>cb(time));}
assert.deepEqual(result,[447]);assert.deepEqual(states,[true,false]);assert.equal(frames.size,0);
assert.equal(pointerIndex(drawn.at(-1)[0],count),447);
spin.start();spin.cancel();assert.equal(frames.size,0);assert.equal(result.length,1);
motion=false;spin.start();assert.equal(frames.size,0);assert.deepEqual(result,[447,447]);
motion=true;spin.start();spin.finish();spin.finish();assert.equal(frames.size,0);assert.deepEqual(result,[447,447,447]);
console.log('PASS: 448 stations, line/branch coverage, transfer deduplication, homonyms, unbiased sampling, all landing angles, double-click guard, reduced motion and lifecycle.');

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ease,randomSequence,helixPoint,particleCamera} from '../entry-particles.js';
assert.equal(ease(-1,0,1),0);assert.equal(ease(2,0,1),1);assert.equal(ease(.5,0,1),.5);
const a=randomSequence(),b=randomSequence();for(let i=0;i<100;i++)assert.equal(a(),b());
for(let arm=0;arm<3;arm++)for(let i=0;i<=100;i++){
  const p=helixPoint(i/100,arm);assert.ok(p.every(Number.isFinite));assert.ok(Math.hypot(p[0],p[1])>=6.49);
}
for(const aspect of [.38,.46,1,2.2]){
  assert.equal(particleCamera(-20,aspect).z,particleCamera(0,aspect).z,'camera cannot go beyond its start');
  assert.equal(particleCamera(30,aspect).z,particleCamera(1,aspect).z,'camera cannot go beyond its end');
  assert.equal(particleCamera(NaN,aspect).earthOpacity,1);
  let last=Infinity;for(let i=0;i<=100;i++){const pose=particleCamera(i/100,aspect);assert.ok(pose.z<=last);last=pose.z;}
}
const css=await readFile(new URL('../continuity.css',import.meta.url),'utf8');
assert.match(css,/html\.entry-flow,body\.entry-flow \{ overscroll-behavior:none/);
assert.match(css,/data-entry-renderer=particles/);
console.log('PASS: particle geometry, deterministic distribution, clamped reversible camera, root overscroll and bitmap fallback styles.');

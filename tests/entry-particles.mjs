import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ease,randomSequence,helixPoint,createEntryParticles} from '../entry-particles.js';
import {SEOUL,globePoint,geographicJourney,buildGeography} from '../entry-geography.js';

assert.equal(ease(-1,0,1),0);assert.equal(ease(2,0,1),1);
const a=randomSequence(),b=randomSequence();for(let i=0;i<100;i++)assert.equal(a(),b());
const center=globePoint(SEOUL);assert.ok(Math.hypot(center[0],center[1],center[2]-4)<1e-9);
for(const aspect of [.38,.46,1,2.2]){
  let last=Infinity;
  for(let i=0;i<=1000;i++){
    const p=i/1000,state=geographicJourney(p,aspect);
    assert.ok(Object.values(state).every(Number.isFinite));
    assert.ok(state.altitude<=last+1e-9,'one monotonic camera approach');last=state.altitude;
    for(const [key,value] of Object.entries(state))if(key.endsWith('Opacity')||key==='curl'||key==='flight')assert.ok(value>=0&&value<=1);
    if(p<=.8)assert.equal(state.curl,0,'no spiral before reaching Seoul');
  }
  assert.deepEqual(geographicJourney(NaN,aspect),geographicJourney(0,aspect));
  assert.deepEqual(geographicJourney(-1,aspect),geographicJourney(0,aspect));
  assert.deepEqual(geographicJourney(2,aspect),geographicJourney(1,aspect));
  assert.ok(Math.abs(last-geographicJourney(1,aspect).landing)<1e-9);
  for(const p of [.14,.22,.3,.39,.4,.53,.58,.62,.71,.78,.8]){
    const h=1e-5,left=(Math.log(geographicJourney(p,aspect).altitude)-Math.log(geographicJourney(p-h,aspect).altitude))/h;
    const right=(Math.log(geographicJourney(p+h,aspect).altitude)-Math.log(geographicJourney(p,aspect).altitude))/h;
    assert.ok(Math.abs(left-right)<.01,'logarithmic camera speed is continuous through every detail level');
  }
  const still=geographicJourney(.9,aspect,false);
  assert.ok(Math.abs(still.altitude-geographicJourney(0,aspect).altitude)<1e-10);assert.equal(still.curl,0);assert.equal(still.flight,0);
}
const shapes=buildGeography(randomSequence(73),true);
assert.deepEqual(shapes,buildGeography(randomSequence(73),true));
for(const points of Object.values(shapes))for(const point of points){assert.ok(point.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...globePoint(point))-4)<1e-10,'every level shares exactly one sphere');}
assert.ok(shapes.regional.some(p=>p[0]<120)&&shapes.regional.some(p=>p[0]>135),'neighboring geography remains present');
assert.ok(shapes.korea.some(p=>p[1]>40)&&shapes.korea.some(p=>p[1]<34));
assert.ok(shapes.local.length>6000&&shapes.river.length>400);
for(let arm=0;arm<3;arm++)for(const strand of [-1,0,1])for(let i=0;i<=100;i++)assert.ok(helixPoint(i/100,arm,strand).every(Number.isFinite));
const css=await readFile(new URL('../continuity.css',import.meta.url),'utf8');
assert.match(css,/height:620svh/);assert.equal(css.includes('entry-place'),false);

const globals=['innerWidth','innerHeight','document','Image'],originals=new Map(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
try{
  for(const width of [390,1440]){
    globalThis.innerWidth=width;globalThis.innerHeight=844;globalThis.document={body:{dataset:{}}};globalThis.Image=class{};
    let scene,camera,ratio=2;
    const renderer={domElement:{clientWidth:width,clientHeight:844},getPixelRatio:()=>ratio,setRenderTarget(){},clear(){},render(s,c){scene=s;camera=c;}};
    const entry=createEntryParticles(renderer,()=>{});entry.render(0,0,{x:0,y:0},true);
    const points=scene.children.filter(o=>o.isPoints),lines=scene.children.filter(o=>o.isLine);
    assert.equal(points.length,8);assert.equal(lines.length,9);
    const total=points.reduce((n,o)=>n+o.geometry.attributes.position.count,0);
    assert.ok(total<(width<760?54000:100000),'bounded mobile/desktop point budget');
    const positions=points.map(o=>o.geometry.attributes.position.array.slice());
    for(const object of points)for(const attribute of Object.values(object.geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));
    for(const p of [0,.25,.45,.65,.8,.9,.945,1,.5,0]){
      entry.render(p,10,{x:.3,y:-.3},true);
      assert.equal(camera.position.z,1,'rebased camera stays stable at every zoom level');
      assert.ok(camera.projectionMatrix.elements.every(Number.isFinite));
      for(let i=0;i<points.length;i++){
        assert.deepEqual(points[i].geometry.attributes.position.array,positions[i],'zoom never swaps or moves geographic vertices');
        assert.equal(points[i].material.uniforms.altitude.value,geographicJourney(p,camera.aspect).altitude);
      }
      if(p<=.8)assert.ok(lines.every(line=>!line.visible));
    }
    assert.equal(points[0].visible,true,'reverse scroll restores Earth');
    ratio=1;renderer.domElement.clientHeight=620;entry.resize();assert.equal(camera.aspect,width/620);
    assert.ok(points.every(o=>o.material.uniforms.ratio.value===1));
    entry.render(.9,300,{x:.5,y:.5},false);
    assert.ok(points.every(o=>o.material.uniforms.time.value===0&&o.material.uniforms.curl.value===0));
    for(const o of [...points,...lines]){o.geometry.dispose();o.material.dispose();}
  }
}finally{for(const key of globals){const descriptor=originals.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
console.log('PASS: one-sphere geography, continuous logarithmic camera, fixed vertices, delayed spiral morph, reverse scroll, reduced motion and bounded budgets.');

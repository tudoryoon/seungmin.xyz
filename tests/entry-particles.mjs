import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ease,randomSequence,helixPoint,particleCamera,createEntryParticles} from '../entry-particles.js';
import {SEOUL,KOREA_EXTENTS,CITY_EXTENTS,project,globePoint,geographicJourney,buildGeography} from '../entry-geography.js';
assert.equal(ease(-1,0,1),0);assert.equal(ease(2,0,1),1);assert.equal(ease(.5,0,1),.5);
const a=randomSequence(),b=randomSequence();for(let i=0;i<100;i++)assert.equal(a(),b());
for(let arm=0;arm<3;arm++)for(const strand of [-1,0,1])for(let i=0;i<=100;i++){
  const p=helixPoint(i/100,arm,strand);assert.ok(p.every(Number.isFinite));assert.ok(Math.hypot(p[0],p[1])>=6.57);
  const main=helixPoint(i/100,arm);assert.ok(Math.hypot(...p.map((v,j)=>v-main[j]))<=.221,'braided filaments stay close to the main curve');
}
assert.deepEqual(project(SEOUL),[0,0,0]);
const focus=globePoint(SEOUL);assert.ok(Math.abs(focus[0])<1e-8&&Math.abs(focus[1])<1e-8&&Math.abs(focus[2]-4)<1e-8,'globe camera faces Seoul');
const shapes=buildGeography(randomSequence(73),true);
assert.deepEqual(shapes,buildGeography(randomSequence(73),true),'geography is deterministic');
for(const points of Object.values(shapes))for(const point of points)assert.ok(point.every(Number.isFinite));
assert.ok(shapes.korea.some(p=>p[1]>40)&&shapes.korea.some(p=>p[1]<34),'both Koreas and Jeju are included');
assert.ok(shapes.city.every(p=>p[0]>126.7&&p[0]<127.3&&p[1]>37.3&&p[1]<37.8));
assert.ok(shapes.river.length>400&&shapes.river.every(p=>p[0]>126.5&&p[0]<127.4));
assert.equal(geographicJourney(.45).koreaOpacity,1);assert.equal(geographicJourney(.8).cityOpacity,1);
assert.equal(geographicJourney(1).cityOpacity,0);assert.equal(geographicJourney(1).burstOpacity,0);
assert.equal(geographicJourney(.9,1,false).burstOpacity,0,'reduced motion suppresses the arrival burst');
for(const aspect of [.38,.46,1,2.2]){
  const halfY=(aspect<.8?32:24)*Math.tan(24*Math.PI/180);
  const country=geographicJourney(.45,aspect),city=geographicJourney(.82,aspect);
  for(const [bounds,scale] of [[KOREA_EXTENTS,country.mapScale],[CITY_EXTENTS,city.cityScale]]){
    assert.ok(bounds.x*scale<=halfY*aspect*.88+1e-8,'geography fits narrow viewports');
    assert.ok(bounds.y*scale<=halfY*.8+1e-8,'geography fits viewport height');
  }
  assert.equal(particleCamera(-20,aspect).z,particleCamera(0,aspect).z,'camera cannot go beyond its start');
  assert.equal(particleCamera(30,aspect).z,particleCamera(1,aspect).z,'camera cannot go beyond its end');
  assert.deepEqual(particleCamera(NaN,aspect),particleCamera(0,aspect));
  let last=Infinity;for(let i=0;i<=100;i++){
    const pose=particleCamera(i/100,aspect);assert.ok(pose.z<=last);last=pose.z;
    assert.ok(Object.values(pose).every(Number.isFinite));
    const arrival=geographicJourney(i/100,aspect);
    assert.ok(Object.values(arrival).every(Number.isFinite));
    for(const name of ['earthOpacity','koreaOpacity','cityOpacity','burstOpacity','markerOpacity','spiralOpacity'])assert.ok(arrival[name]>=0&&arrival[name]<=1);
    assert.ok(Math.abs(pose.x)<1&&Math.abs(pose.y)<.4);
  }
  assert.equal(particleCamera(1,aspect).z,-96);
  for(const p of [.13,.2,.3,.34,.64,.74,.76]){
    const h=.0001,left=(particleCamera(p,aspect).z-particleCamera(p-h,aspect).z)/h;
    const right=(particleCamera(p+h,aspect).z-particleCamera(p,aspect).z)/h;
    assert.ok(Math.abs(left-right)<1,'camera velocity remains continuous across the sequence');
  }
}
const css=await readFile(new URL('../continuity.css',import.meta.url),'utf8');
assert.match(css,/html\.entry-flow,body\.entry-flow \{ overscroll-behavior:none/);
assert.match(css,/data-entry-renderer=particles/);
assert.match(css,/\.entry-stage[^\n]+height:620svh/,'the scrollable distance doubles from 2.6 to 5.2 viewports');

// Build real Three.js objects without a GPU or remote assets, then inspect their render contract.
const globals=['innerWidth','innerHeight','document','Image'];
const originals=new Map(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
try {
  for(const width of [390,1440]){
    globalThis.innerWidth=width;globalThis.innerHeight=844;
    globalThis.document={body:{dataset:{}}};globalThis.Image=class{};
    let scene,camera,pixelRatio=2;
    const renderer={domElement:{clientWidth:width,clientHeight:844},getPixelRatio:()=>pixelRatio,setRenderTarget(){},clear(){},render(s,c){scene=s;camera=c;}};
    const entry=createEntryParticles(renderer,()=>{});
    entry.render(0,0,{x:0,y:0},true);
    assert.equal(document.body.dataset.entryRenderer,'particles');
    const pointObjects=[],lines=[];
    scene.traverse(object=>{if(object.isPoints)pointObjects.push(object);if(object.isLine)lines.push(object);});
    assert.equal(pointObjects.length,10);assert.equal(lines.length,9);
    const pointCount=pointObjects.reduce((total,object)=>total+object.geometry.attributes.position.count,0);
    assert.ok(pointCount<(width<760?32000:58000),'mobile and desktop point budgets stay bounded');
    for(const object of [...pointObjects,...lines])for(const attribute of Object.values(object.geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));
    const earth=pointObjects.find(object=>object.material.uniforms.surface.value===1);
    assert.equal(earth.parent.visible,true);
    for(const p of [.2,.5,.85,1,.5,0]){
      entry.render(p,12,{x:.2,y:-.2},true);
      assert.equal(camera.position.z,particleCamera(p,camera.aspect).z);
      assert.ok(camera.projectionMatrix.elements.every(Number.isFinite));
    }
    entry.render(1,20,{x:0,y:0},true);assert.equal(earth.parent.visible,false);
    entry.render(0,20,{x:0,y:0},true);assert.equal(earth.parent.visible,true,'rewinding restores the point globe');
    pixelRatio=1;renderer.domElement.clientHeight=620;entry.resize();
    assert.equal(camera.aspect,width/620);assert.ok(pointObjects.every(object=>object.material.uniforms.ratio.value===1));
    entry.render(.6,0,{x:.5,y:.5},false);
    const stillPose=camera.matrixWorld.toArray(),stillRotations=scene.children.map(object=>object.rotation.toArray());
    entry.render(.6,300,{x:-.5,y:-.5},false);
    assert.deepEqual(camera.matrixWorld.toArray(),stillPose);assert.deepEqual(scene.children.map(object=>object.rotation.toArray()),stillRotations);
    assert.ok(pointObjects.every(object=>object.material.uniforms.time.value===0),'reduced motion freezes all particle phases');
    for(const object of [...pointObjects,...lines]){object.geometry.dispose();object.material.dispose();}
  }
} finally {
  for(const key of globals){const descriptor=originals.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
}
console.log('PASS: Earth/Korea/Seoul geography, reversible morph, arrival burst, braided geometry, scene lifecycle, reduced motion and bounded particle budgets.');

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDungeon} from '../dungeon.js';
import {createRoads,roadSpawn,moveOnRoad,nearbyRoad,isWalkable,WALK_SPEED} from '../roads.js';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');
assert.equal(WALK_SPEED,200*1.5);
const pixels=(roads,a,b)=>Math.hypot((b.x-a.x)*roads.width/100,(b.y-a.y)*roads.height/100);
const percent=(roads,[x,y])=>({x:x/roads.map.size[0]*100,y:y/roads.map.size[1]*100});
for(const [width,height] of [[1440,900],[390,844],[320,740],[1024,1366],[2560,1080]]) {
  const roads=createRoads(width<=height,width,height),spawn=roadSpawn(roads);
  const route=roads.map.routes.roulette;
  const routeLength=route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-route[i][0],p[1]-route[i][1]),0);
  assert.ok(routeLength<(width<=height?420:850),'roulette uses the direct bridge route');
  for(const bridge of roads.map.bridges) {
    const fromIndex=route.findIndex(p=>p[0]===bridge.from[0]&&p[1]===bridge.from[1]);
    assert.deepEqual(route[fromIndex+1],bridge.to,'visible bridge matches walking segment');
    const middle=bridge.from.map((n,i)=>(n+bridge.to[i])/2);
    assert.ok(isWalkable(roads,percent(roads,middle)),'bridge deck is walkable');
    assert.ok(bridge.width>=roads.map.radius*2+16,'deck contains the full walking corridor');
  }
  for(const direction of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:1,y:1}]) {
    const next=moveOnRoad(roads,spawn,direction,.016);
    assert.ok(Math.abs(pixels(roads,spawn,next)-4.8)<.0001,'1.5x speed without a diagonal boost');
    if(direction.x===0)assert.ok(Math.abs(next.x-spawn.x)<.00001,'vertical input does not snap sideways');
    if(direction.y===0)assert.ok(Math.abs(next.y-spawn.y)<.00001,'horizontal input does not snap vertically');
  }
  for(const [name,path] of [...Object.entries(roads.map.routes),...roads.map.paths.map((path,index)=>['side-'+index,path])]) {
    let position=percent(roads,path[0]);
    for(const waypoint of path.slice(1)) {
      const target=percent(roads,waypoint);
      for(let tick=0;pixels(roads,position,target)>.1&&tick<600;tick++) {
        const distance=pixels(roads,position,target);
        position=moveOnRoad(roads,position,{x:(target.x-position.x)*width,y:(target.y-position.y)*height},Math.min(.016,distance/WALK_SPEED));
        assert.ok(isWalkable(roads,position),'walkable through every corridor');
      }
      assert.ok(pixels(roads,position,target)<.2,'reachable waypoint: '+name);
    }
    if(!name.startsWith('side-'))assert.equal(nearbyRoad(roads,position),name);
  }
  assert.equal(isWalkable(roads,percent(roads,width<=height?[600,1030]:[570,480])),false,'water outside the bridge stays blocked');
  let position=spawn;
  for(let tick=0;tick<1600;tick++) {
    const direction=tick<400?{x:-1,y:0}:{x:Math.cos(tick*.013),y:Math.sin(tick*.013)};
    const next=moveOnRoad(roads,position,direction,.05);
    assert.ok(isWalkable(roads,next));assert.ok(pixels(roads,position,next)<=15.0001,'no wall jumps');position=next;
  }
}

const window=new Window({url:'http://localhost/',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
const saved=Object.fromEntries(['window','document','location','matchMedia','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,globalThis[key]]));
let active=true,width=1440,height=900,time=1,next=0,frames=new Map(),destinations=[];
Object.assign(globalThis,{window,document:window.document,location:{assign:url=>destinations.push(url)},matchMedia:()=>({matches:false,addEventListener(){}}),requestAnimationFrame:callback=>{frames.set(++next,callback);return next;},cancelAnimationFrame:id=>frames.delete(id)});
try {
  window.document.write(await readFile(new URL('../index.html',import.meta.url),'utf8'));
  const stage=window.document.getElementById('map'),actor=window.document.getElementById('map-actor');stage.hidden=false;
  Object.defineProperty(stage,'clientWidth',{get:()=>width});Object.defineProperty(stage,'clientHeight',{get:()=>height});
  for(const button of stage.querySelectorAll('[data-move]'))button.setPointerCapture=()=>{};
  const dungeon=createDungeon(stage,()=>active);dungeon.reset();
  const key=(name,type='keydown',target=window)=>target.dispatchEvent(new window.KeyboardEvent(type,{key:name,bubbles:true,cancelable:true}));
  const position=()=>({x:parseFloat(actor.style.left),y:parseFloat(actor.style.top)});
  function step(count=1){for(let i=0;i<count;i++){time+=16;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(time));}}
  for(const marker of stage.querySelectorAll('[data-location]'))marker.click();key('Enter');stage.querySelector('#nearby-enter').click();assert.equal(destinations.length,0);
  key('ArrowRight');step(10);key('ArrowRight','keyup');const stopped=position();step(10);assert.deepEqual(position(),stopped);
  key('ArrowRight','keydown',window.document.querySelector('input'));step(10);assert.deepEqual(position(),stopped);
  active=false;key('ArrowRight');step(10);assert.deepEqual(position(),stopped);active=true;
  key('ArrowLeft');step(2);window.dispatchEvent(new window.Event('blur'));assert.equal(frames.size,0);
  const before=position();width=1280;height=720;window.dispatchEvent(new window.Event('resize'));assert.deepEqual(position(),before);
  const roads=createRoads(false,width,height);
  for(const destination of ['workout','roulette']) {
  dungeon.reset();
  assert.equal(stage.querySelector('#map-bridges'),null,'no mismatched vector bridge overlay');
  assert.match(stage.querySelector('.dungeon-art img').getAttribute('src'),/dungeon-wide-v2\.webp$/);
  for(const point of roads.map.routes[destination].slice(1)) {
    const target=percent(roads,point);
    for(let tick=0;pixels(roads,position(),target)>9&&tick<500;tick++) {
      const here=position(),dx=(target.x-here.x)*width/100,dy=(target.y-here.y)*height/100;
      const keys=[];if(Math.abs(dx)>4)keys.push(dx>0?'ArrowRight':'ArrowLeft');if(Math.abs(dy)>4)keys.push(dy>0?'ArrowDown':'ArrowUp');
      for(const name of keys)key(name);step();for(const name of keys)key(name,'keyup');
    }
    assert.ok(pixels(roads,position(),target)<=9,'keyboard reaches bend');
  }
  assert.equal(stage.querySelector('.nearby').dataset.location,destination);key('Enter');
  assert.equal(destinations.at(-1),destination==='roulette'?'roulette.html':'test.html#workout');
  }
  dungeon.reset();const right=stage.querySelector('[data-move=ArrowRight]');right.dispatchEvent(new window.PointerEvent('pointerdown',{pointerId:1,bubbles:true}));step(10);right.dispatchEvent(new window.PointerEvent('pointercancel',{pointerId:1}));assert.equal(frames.size,0);
  console.log('PASS: free corridor/plaza movement, all primary and side paths, 1.5x speed, water collision, 5 layouts, keyboard/touch guards, resize and gated entrance.');
}finally{await window.happyDOM.close();for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}

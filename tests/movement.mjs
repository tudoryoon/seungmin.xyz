import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDungeon} from '../dungeon.js';
import {createRoads,roadSpawn,roadPosition,moveOnRoad,nearbyRoad} from '../roads.js';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');
const inputs={ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}};
const outbound=portrait=>({calendar:portrait?'ArrowUp':'ArrowLeft',workout:'ArrowRight',library:'ArrowDown'});
for(const [width,height] of [[1440,900],[390,844],[320,740],[1024,1366],[2560,1080]]) {
  const portrait=width<=height,roads=createRoads(portrait,width,height);
  for(const [route,key] of Object.entries(outbound(portrait))) {
    let state=roadSpawn();
    for(let frame=0;frame<1000;frame++)state=moveOnRoad(roads,state,inputs[key],.016);
    assert.equal(state.route,route);assert.equal(state.segment,roads.routes[route].length-1);assert.equal(state.t,1,'route reaches its entrance');
    assert.equal(nearbyRoad(roads,state),route);
    assert.deepEqual(moveOnRoad(roads,state,inputs[key],.016),state,'cannot move past a road end');
    const direction={x:-inputs[key].x,y:-inputs[key].y};
    for(let frame=0;frame<1000&&state.route;frame++)state=moveOnRoad(roads,state,direction,.016);
    assert.deepEqual(state,roadSpawn(),'every entrance connects back to the junction');
  }
  let state=roadSpawn();
  for(let frame=0;frame<1000;frame++) {
    const before=roadPosition(roads,state),angle=frame*2.39996;
    state=moveOnRoad(roads,state,{x:Math.cos(angle),y:Math.sin(angle)},.05);
    const point=roadPosition(roads,state);
    assert.ok(Math.hypot((point.x-before.x)*width/100,(point.y-before.y)*height/100)<=10.00001,'no diagonal speed boost or jumps');
    assert.ok(point.x>0&&point.x<100&&point.y>0&&point.y<100);
    assert.ok(state.t>=0&&state.t<=1);
  }
}

const window=new Window({url:'http://localhost/',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
const saved=Object.fromEntries(['window','document','location','matchMedia','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,globalThis[key]]));
let active=true,portrait=false,width=1440,height=900,time=1,next=0,frames=new Map(),destinations=[];
const media={get matches(){return portrait;},addEventListener(){}};
Object.assign(globalThis,{window,document:window.document,location:{assign:url=>destinations.push(url)},matchMedia:()=>media,requestAnimationFrame:callback=>{frames.set(++next,callback);return next;},cancelAnimationFrame:id=>frames.delete(id)});
try {
  window.document.write(await readFile(new URL('../index.html',import.meta.url),'utf8'));
  const stage=window.document.getElementById('map'),actor=window.document.getElementById('map-actor');stage.hidden=false;
  Object.defineProperty(stage,'clientWidth',{get:()=>width});Object.defineProperty(stage,'clientHeight',{get:()=>height});
  for(const button of stage.querySelectorAll('[data-move]'))button.setPointerCapture=()=>{};
  const dungeon=createDungeon(stage,()=>active);dungeon.reset();
  const key=(name,type='keydown',target=window,options={})=>target.dispatchEvent(new window.KeyboardEvent(type,{key:name,bubbles:true,cancelable:true,...options}));
  function step(count=1){for(let i=0;i<count;i++){time+=16;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(time));}}
  const position=()=>({x:parseFloat(actor.style.left),y:parseFloat(actor.style.top)});
  key('ArrowRight');step(10);key('ArrowRight','keyup');const stopped=position();assert.equal(frames.size,0);step(20);assert.deepEqual(position(),stopped);
  key('ArrowLeft');step(2);window.dispatchEvent(new window.Event('blur'));const blurred=position();step(20);assert.deepEqual(position(),blurred);
  active=false;key('ArrowRight');step(20);assert.deepEqual(position(),blurred);active=true;
  key('ArrowRight','keydown',window.document.querySelector('input[type=email]'));step(20);assert.deepEqual(position(),blurred);
  key('ArrowRight','keydown',window,{ctrlKey:true});step(20);assert.deepEqual(position(),blurred);
  for(const layout of [[1440,900],[390,844]]) {
    [width,height]=layout;portrait=width<=height;
    for(const [name,direction] of Object.entries(outbound(portrait))) {
      dungeon.reset();const count=destinations.length,spawn=position();
      for(const node of stage.querySelectorAll('[data-location]')){assert.equal(node.hasAttribute('href'),false);node.click();}
      key('Enter');stage.querySelector('#nearby-enter').click();step(10);
      assert.equal(destinations.length,count,'clicks and distant Enter cannot enter');assert.deepEqual(position(),spawn);
      key(direction);step(1000);key(direction,'keyup');
      assert.equal(stage.querySelector('.nearby').dataset.location,name);
      assert.equal(actor.dataset.walking,'false','road end stops walking');
      const end=position();window.dispatchEvent(new window.Event('resize'));assert.deepEqual(position(),end,'resize preserves road progress');
      key('Enter','keydown',window.document.getElementById('map-title'));
      assert.equal(new URL(destinations.at(-1),'http://localhost').hash,'#'+name);
      key('Enter');assert.equal(destinations.length,count+1);
    }
  }
  dungeon.reset();const spawn=position();
  const right=stage.querySelector('[data-move=ArrowRight]');right.dispatchEvent(new window.PointerEvent('pointerdown',{pointerId:1,bubbles:true}));step(10);
  assert.ok(position().x>spawn.x);right.dispatchEvent(new window.PointerEvent('pointercancel',{pointerId:1}));assert.equal(frames.size,0);
  console.log('PASS: connected-road movement at five sizes, all entrances and return paths, no off-road jumps/diagonal boost, endpoint stops, arrow/touch guards, resize, and blocked click/distant entrance.');
}finally{await window.happyDOM.close();for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}

import assert from 'node:assert/strict';
import {createDungeon} from '../dungeon.js';
import {createRoads,roadSpawn} from '../roads.js';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');
const w=new Window({url:'http://localhost/#map'}),frames=new Map();
let id=0,active=true;
Object.assign(globalThis,{window:w,document:w.document,location:w.location,
  matchMedia:()=>Object.assign(new w.EventTarget(),{matches:false}),
  requestAnimationFrame:callback=>{frames.set(++id,callback);return id;},cancelAnimationFrame:key=>frames.delete(key)});
document.body.innerHTML='<section id="map"><h1 id="map-title" tabindex="-1">지도</h1><div id="map-actor"></div><button id="nearby-enter" hidden></button><button data-move="ArrowRight"></button><input></section>';
const stage=document.getElementById('map'),actor=document.getElementById('map-actor'),button=stage.querySelector('[data-move]');
Object.defineProperties(stage,{clientWidth:{value:1440},clientHeight:{value:900}});
button.setPointerCapture=()=>{};
const dungeon=createDungeon(stage,()=>active),x=()=>parseFloat(actor.style.left);
const key=(type,value,target=w)=>target.dispatchEvent(new w.KeyboardEvent(type,{key:value,bubbles:true,cancelable:true}));
const tick=time=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(time));};
try {
  dungeon.reset();const start=x();
  key('keydown','ArrowRight');key('keyup','ArrowRight');
  assert.ok(x()>start,'a tap released before the first animation frame still moves');
  assert.equal(frames.size,0);assert.equal(actor.dataset.walking,'false');
  dungeon.reset();button.dispatchEvent(new w.PointerEvent('pointerdown',{pointerId:1}));
  button.dispatchEvent(new w.PointerEvent('pointerup',{pointerId:1}));
  assert.ok(x()>start,'a short touch moves immediately');assert.equal(frames.size,0);
  dungeon.reset();key('keydown','ArrowRight');const first=x();
  key('keydown','ArrowRight');assert.equal(x(),first,'key repeat must not add extra immediate steps');
  tick(performance.now()+32);assert.ok(x()>first,'held input continues on frames');
  w.dispatchEvent(new w.Event('blur'));assert.equal(frames.size,0);
  const stopped=x();tick(performance.now()+64);assert.equal(x(),stopped);
  active=false;key('keydown','ArrowRight');assert.equal(x(),stopped);
  active=true;key('keydown','ArrowRight',stage.querySelector('input'));assert.equal(x(),stopped);
  dungeon.reset();key('keydown','ArrowRight');active=false;tick(performance.now()+32);
  assert.equal(frames.size,0);assert.equal(actor.dataset.walking,'false');
  assert.equal(start,roadSpawn(createRoads(false,1440,900)).x);
  console.log('PASS: short keyboard/touch input, held movement, repeat, blur, inactive map and form guards.');
} finally {await w.happyDOM.close();}

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as Three from '../vendor/three.module.js';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');
const window=new Window({url:'http://localhost/'});
const keys=['window','document','matchMedia','MutationObserver','devicePixelRatio','requestAnimationFrame','cancelAnimationFrame'];
const saved=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
const frames=new Map();
let next=0,time=1,currentSource='http://localhost/assets/dungeon-wide-v2.webp',hidden=false;
let renders=0,rendererDisposals=0,throwOnRender=false;
const portrait=new window.EventTarget();portrait.matches=false;
class Renderer {
  debug={};
  setPixelRatio(ratio){assert.ok(ratio>0&&ratio<=1.5);}
  setSize(width,height){assert.ok(width>0&&height>0);}
  render(){if(throwOnRender)throw new Error('GPU unavailable');renders++;}
  dispose(){rendererDisposals++;}
}
Object.assign(globalThis,{window,document:window.document,matchMedia:()=>portrait,MutationObserver:window.MutationObserver,devicePixelRatio:2,
  requestAnimationFrame:callback=>{frames.set(++next,callback);return next;},cancelAnimationFrame:id=>frames.delete(id)});
try {
  document.body.dataset.stage='map';
  document.body.innerHTML='<section id="map"><canvas hidden></canvas><img></section>';
  Object.defineProperty(document,'hidden',{get:()=>hidden});
  const stage=document.querySelector('section'),canvas=document.querySelector('canvas'),image=document.querySelector('img');
  Object.defineProperties(stage,{clientWidth:{get:()=>1440},clientHeight:{get:()=>900}});
  Object.defineProperties(image,{complete:{get:()=>true},naturalWidth:{get:()=>1585},currentSrc:{get:()=>currentSource}});
  const source=(await readFile(new URL('../map-wind.js',import.meta.url),'utf8'))
    .replace(/^import .*;\n/,'').replaceAll('export ','').split('\nconst stage=document.getElementById')[0];
  const {createMapWind,BLOSSOMS}=new Function('THREE',source+'\nreturn {createMapWind,BLOSSOMS};')({...Three,WebGLRenderer:Renderer});
  for(const layout of Object.values(BLOSSOMS)) {
    assert.equal(layout.crowns.length,4);
    for(const [x,y,rx,ry]of layout.crowns)assert.ok(x>0&&x<layout.size[0]&&y>0&&y<layout.size[1]&&rx>0&&ry>0);
  }
  const tick=()=>{time+=34;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(time));};
  const sync=()=>window.dispatchEvent(new window.Event('realm-view'));
  const stopped=()=>{assert.equal(frames.size,0);assert.equal(canvas.hidden,true);};
  const running=()=>{assert.equal(frames.size,1);tick();assert.equal(canvas.hidden,false);assert.equal(canvas.dataset.windState,'running');};
  const wind=createMapWind(stage,canvas,image);
  running();assert.equal(canvas.dataset.windLayout,'wide');const before=renders;tick();assert.ok(renders>before);
  document.body.classList.add('reduced-motion');sync();stopped();
  document.body.classList.remove('reduced-motion');sync();running();
  stage.hidden=true;sync();stopped();stage.hidden=false;sync();running();
  document.body.dataset.stage='avatar';sync();stopped();document.body.dataset.stage='map';sync();running();
  hidden=true;document.dispatchEvent(new window.Event('visibilitychange'));stopped();
  hidden=false;document.dispatchEvent(new window.Event('visibilitychange'));running();
  window.dispatchEvent(new window.Event('pagehide'));stopped();window.dispatchEvent(new window.Event('pageshow'));running();
  portrait.matches=true;portrait.dispatchEvent(new window.Event('change'));stopped();assert.equal(canvas.dataset.windState,'loading');
  currentSource='http://localhost/assets/dungeon-tall-v2.webp';image.dispatchEvent(new window.Event('load'));running();assert.equal(canvas.dataset.windLayout,'tall');
  canvas.dispatchEvent(new window.Event('webglcontextlost',{cancelable:true}));stopped();assert.equal(canvas.dataset.windState,'unavailable');
  canvas.dispatchEvent(new window.Event('webglcontextrestored'));running();
  throwOnRender=true;tick();stopped();assert.equal(canvas.dataset.windState,'unavailable');sync();stopped();
  wind.dispose();assert.equal(rendererDisposals,1);window.dispatchEvent(new window.Event('resize'));stopped();
  console.log('PASS: blossom layout, animation, motion preference, stage/visibility/page lifecycle, responsive image loading, GPU fallback and cleanup.');
}finally {
  await window.happyDOM.close();
  for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
}

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as Three from '../vendor/three.module.js';
const {Window}=await import(process.env.DOM_MODULE || 'happy-dom');
const source=(await readFile(new URL('../portal.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replace('export function createPortal','function createPortal');
for(const width of [390,1440]) {
  const w=new Window({url:'http://localhost/'});
  w.document.write('<canvas id="portal"></canvas>');
  const canvas=w.document.getElementById('portal');
  const keys=['window','document','innerWidth','innerHeight','devicePixelRatio'];
  const previous=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let hidden=false,instance,ready,draws=0,progress,throwRender=false;
  class Renderer {
    constructor(options){this.options=options;this.debug={};this.ratio=1;instance=this;}
    setPixelRatio(value){this.ratio=value;}
    getPixelRatio(){return this.ratio;}
    setSize(width,height){this.size=[width,height];}
    setAnimationLoop(value){this.loop=value;}
    clear(){} clearDepth(){} render(){draws++;}
  }
  try {
    Object.assign(globalThis,{window:w,document:w.document,innerWidth:width,innerHeight:844,devicePixelRatio:3});
    Object.defineProperty(w.document,'hidden',{get:()=>hidden});
    const createEntryParticles=(_renderer,onReady)=>{ready=onReady;return {ready:true,resize(){},render(p){if(throwRender)throw Error('GPU failure');draws++;progress=p;}};}
    const {createPortal}=new Function('THREE','createEntryParticles',source+'\nreturn {createPortal};')({...Three,WebGLRenderer:Renderer},createEntryParticles);
    const portal=createPortal(canvas,true);
    assert.equal(instance.options.antialias,width>=760);
    assert.ok(width*844*instance.ratio**2<=(width<760?1400000:5000000)+1);
    assert.equal(canvas.dataset.renderState,'ready');assert.equal(w.document.body.dataset.entryRenderer,'particles');
    portal.setEntryProgress(.45);portal.setMotion(false);assert.equal(progress,.45);
    portal.setMotion(true);
    const lost=new w.Event('webglcontextlost',{cancelable:true});canvas.dispatchEvent(lost);
    assert.equal(lost.defaultPrevented,true);assert.equal(canvas.hidden,true);assert.equal(instance.loop,null);
    assert.equal(w.document.body.dataset.entryRenderer,'fallback');
    const beforeLost=draws;w.dispatchEvent(new w.Event('pageshow'));ready();assert.equal(draws,beforeLost);
    canvas.dispatchEvent(new w.Event('webglcontextrestored'));
    assert.equal(canvas.hidden,false);assert.equal(canvas.dataset.renderState,'ready');assert.ok(instance.loop);
    assert.equal(progress,.45,'resume keeps the scroll position');assert.ok(draws>beforeLost);
    w.dispatchEvent(new w.Event('pagehide'));const beforeSuspend=draws;
    portal.setEntryProgress(.6);ready();portal.setStage('entry');assert.equal(instance.loop,null);assert.equal(draws,beforeSuspend);
    w.dispatchEvent(new w.Event('pageshow'));assert.ok(instance.loop);assert.ok(draws>beforeSuspend);
    hidden=true;w.document.dispatchEvent(new w.Event('visibilitychange'));assert.equal(instance.loop,null);
    hidden=false;w.document.dispatchEvent(new w.Event('visibilitychange'));assert.ok(instance.loop);
    portal.setMotion(false);assert.equal(instance.loop,null);const beforeStill=draws;
    w.dispatchEvent(new w.Event('pagehide'));w.dispatchEvent(new w.Event('pageshow'));
    assert.equal(instance.loop,null);assert.ok(draws>beforeStill,'reduced motion still paints when the app resumes');
    instance.debug.onShaderError();assert.equal(canvas.hidden,true);
    canvas.dispatchEvent(new w.Event('webglcontextrestored'));w.dispatchEvent(new w.Event('pageshow'));
    assert.equal(canvas.hidden,true,'a real shader failure must keep the visible fallback');
    const other=w.document.createElement('canvas');const errorPortal=createPortal(other,true);
    throwRender=true;errorPortal.setMotion(false);assert.equal(other.dataset.renderState,'render-error');assert.equal(other.hidden,true);
  } finally {
    await w.happyDOM.close();
    for(const [key,value] of previous)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];
  }
}
const css=await readFile(new URL('../continuity.css',import.meta.url),'utf8');
assert.ok(!css.includes('body:not([data-entry-renderer])'),'the fallback remains visible while GPU modules load');
console.log('PASS: mobile GPU budget, lost/restored context, Android app suspension/resume, retained scroll, reduced motion redraw, shader/runtime fallback.');

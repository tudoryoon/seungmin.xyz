import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import cytoscape from '../vendor/cytoscape.mjs';
import { createResearch } from '../research.js';
import fixture from './research-fixture.mjs';

const { Window } = await import(process.env.DOM_MODULE || 'happy-dom');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
function setup({ deferred = false } = {}) {
  const window = new Window({url:'https://example.com/#research?note=fde-20260922&view=graph',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  window.document.write(html); window.document.body.dataset.stage = 'research';
  let width = 640, height = 420, frameId = 0;
  const frames = new Map(), observers = [], instances = [], calls = {load:0,create:0,fit:0,resize:0,destroy:0};
  window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  window.cancelAnimationFrame = id => frames.delete(id);
  window.ResizeObserver = class { constructor(callback) { this.callback = callback; observers.push(this); } observe(target) { this.target = target; } disconnect() { this.target = null; } };
  const originalRect = window.HTMLElement.prototype.getBoundingClientRect;
  window.HTMLElement.prototype.getBoundingClientRect = function() { return this.id === 'research-graph' ? {width,height,x:0,y:0,top:0,left:0,right:width,bottom:height} : originalRect.call(this); };
  const factory = options => {
    calls.create++;
    // Use the shipped graph engine, with its actual collections, positions and viewport API.
    const graph = cytoscape({...options,container:undefined,headless:true,styleEnabled:true});
    for (const method of ['fit','resize','destroy']) { const original = graph[method]; graph[method] = function(...args) { calls[method]++; return original.apply(this,args); }; }
    instances.push(graph); return graph;
  };
  let resolve;
  const module = deferred ? new Promise(r => { resolve = r; }) : Promise.resolve({default:factory});
  const root = window.document.getElementById('research-content'); root.hidden = false;
  const reader = createResearch(root,{data:structuredClone(fixture),loadGraph:()=>{calls.load++;return module;}});
  const flush = async () => {
    await Promise.resolve(); await Promise.resolve();
    for (let i=0; frames.size && i<10; i++) { const pending=[...frames.values()];frames.clear();for(const callback of pending) callback(); }
    assert.equal(frames.size,0,'resize work converges instead of fitting in a frame loop');
  };
  return {window,root,reader,calls,instances,flush,resolve:()=>resolve({default:factory}),
    resize(w,h) {width=w;height=h;for(const o of observers) if(o.target?.id==='research-graph') o.callback();},
    async close(){reader.destroy();await window.happyDOM.close();}
  };
}

const app = setup();
try {
  await app.flush(); const graph = app.instances[0];
  assert.equal(app.calls.create,1); assert.equal(app.calls.fit,1,'one initial fit');
  graph.zoom(1.6); graph.pan({x:75,y:-35}); graph.getElementById('pltr').position({x:345,y:123});
  assert.equal(app.root.querySelector('#research-zoom-level').textContent,'160%');
  const viewport = {zoom:graph.zoom(),pan:{...graph.pan()}}, position = {...graph.getElementById('pltr').position()};
  const assertStable = () => { assert.equal(app.calls.create,1);assert.equal(app.calls.destroy,0);assert.equal(app.calls.fit,1);assert.deepEqual({zoom:graph.zoom(),pan:graph.pan()},viewport);assert.deepEqual(graph.getElementById('pltr').position(),position); };
  for(let i=0;i<8;i++) { const next=structuredClone(fixture);next.records[4].sections[0].text += ' Hydration batch '+i;app.reader.update(next);await app.flush();assertStable(); }
  const changed = structuredClone(fixture);
  changed.relations.push({id:'new-link',from:'fde-20260922',to:'diary-20260913',type:'link',label:'새 근거',reason:'Synthetic new source',status:'editorial',evidence:[{record:'fde-20260922',section:'implementation'},{record:'diary-20260913',section:'implementation'}]});
  app.reader.update(changed);await app.flush();assertStable();assert.equal(graph.getElementById('new-link').length,1);
  changed.records.find(r=>r.id==='pltr').title='PLTR · 새 제목';app.reader.update(structuredClone(changed));await app.flush();assertStable();assert.match(graph.getElementById('pltr').data('label'),/새 제목/);
  app.root.querySelector('#research-suggestions').click();await app.flush();assertStable();assert.equal(graph.getElementById('fde-jev').length,0);
  app.root.querySelector('#research-suggestions').click();await app.flush();assertStable();assert.equal(graph.getElementById('fde-jev').length,1);
  app.resize(400,300);app.resize(410,310);await app.flush();assertStable();
  app.resize(0,0);await app.flush();app.resize(390,400);await app.flush();assertStable();
  app.root.querySelector('[data-research-panel=context]').click();app.root.querySelector('[data-research-panel=record]').click();await app.flush();assertStable();
  app.window.dispatchEvent(new app.window.Event('realm-view'));await app.flush();assertStable();
  app.reader.update(structuredClone(fixture));await app.flush();assert.equal(graph.getElementById('new-link').length,0);assertStable();
  app.root.querySelector('#research-fit').click();await app.flush();assert.equal(app.calls.fit,2,'explicit overview still fits');
  app.root.querySelector('.research-record-link[data-record=pltr]').click();await app.flush();assert.equal(app.calls.create,1);assert.equal(app.calls.fit,3,'new selected record fits once, reusing the renderer');
  assert.equal(graph.getElementById('pltr').hasClass('focus'),true);
  app.window.document.body.dataset.stage='home';app.window.dispatchEvent(new app.window.Event('realm-view'));await app.flush();assert.equal(app.calls.destroy,1);
} finally { await app.close(); }

const pending = setup({deferred:true});
try {
  pending.reader.update(structuredClone(fixture));pending.reader.render();
  pending.root.querySelector('.research-record-link[data-record=pltr]').click();
  assert.equal(pending.calls.load,1,'coalesce hydration while graph module is loading');
  pending.resize(0,0);pending.resolve();await pending.flush();assert.equal(pending.calls.create,1);assert.equal(pending.calls.fit,0);
  assert.equal(pending.instances[0].getElementById('pltr').hasClass('focus'),true,'latest selection wins during import');
  pending.resize(640,420);await pending.flush();assert.equal(pending.calls.fit,1);pending.resize(640,420);await pending.flush();assert.equal(pending.calls.fit,1);
} finally { await pending.close(); }

const canceled = setup({deferred:true});
try { canceled.root.querySelector('[data-research-view=read]').click();canceled.resolve();await canceled.flush();assert.equal(canceled.calls.create,0,'late import cannot resurrect a hidden graph'); }
finally { await canceled.close(); }
console.log('PASS: persistent renderer, stable zoom/pan/dragged positions through hydration, topology edits, filters and resize; explicit fit, focus change, hidden panel, concurrent import and teardown.');

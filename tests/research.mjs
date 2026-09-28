import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import data from './research-fixture.mjs';
import {createResearchIndex,filterRecords,relatedRecords,readResearchRoute,researchHref,recordDate,safeSourceURL} from '../research-core.js';
import {createResearch} from '../research.js';
const index=createResearchIndex(data);
assert.equal(index.records.size,6);
assert.ok(filterRecords(index,{query:'팔란티어'}).some(r=>r.id==='pltr'));
assert.ok(filterRecords(index,{query:'NVIDIA'}).some(r=>r.id==='nvda-202608'));
assert.deepEqual(filterRecords(index,{month:'undated'}).map(r=>r.id),['pltr']);
assert.equal(filterRecords(index,{month:'2026-09'}).length,3);
assert.equal(filterRecords(index,{month:'2026-08'}).length,2);
assert.equal(filterRecords(index,{query:'없는 검색어'}).length,0);
assert.equal(recordDate(index.records.get('saas-202608')),'2026.08 중순');
assert.equal(recordDate(index.records.get('pltr')),'날짜 미지정');
assert.equal(relatedRecords(index,'fde-20260922',false).length,1);
assert.equal(relatedRecords(index,'fde-20260922',true).length,2);
const route={note:'pltr',view:'graph',query:'도입 & AI',month:'undated',entity:'adoption',suggestions:false,section:'implementation'};
assert.deepEqual(readResearchRoute(researchHref(route),index),route);
assert.equal(readResearchRoute('#research?note=garbage&view=bad&entity=missing',index).note,'fde-20260922');
assert.equal(safeSourceURL('javascript:alert(1)'),null);
assert.equal(safeSourceURL('https://user:password@example.com'),null);
for(const edit of [d=>d.records.push(d.records[0]),d=>d.relations[0].evidence[0].section='missing',d=>d.relations[0].to='unknown',d=>d.records[0].source.url='javascript:alert(1)']){
  const copy=structuredClone(data);edit(copy);assert.throws(()=>createResearchIndex(copy));
}
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const window=new Window({url:'https://seungmin.xyz/#research?view=read',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
window.document.write(html);window.document.body.dataset.stage='research';
window.HTMLElement.prototype.scrollIntoView=function(){};
const root=window.document.getElementById('research-content');root.hidden=false;
const reader=createResearch(root,{data,loadGraph:async()=>{throw new Error('graph unavailable');}}),$=id=>window.document.getElementById(id);
try{
  assert.equal(root.querySelectorAll('.research-record-link').length,6);
  assert.equal($('research-record-title').textContent,'FDE 전성시대');
  assert.equal(root.querySelectorAll('.research-relation').length,2);
  $('research-suggestions').click();assert.equal(root.querySelectorAll('.research-relation').length,1);
  $('research-query').value='엔비디아';$('research-query').dispatchEvent(new window.Event('input'));
  assert.equal(root.querySelectorAll('.research-record-link').length,1);assert.match($('research-record-title').textContent,/NVDA/);
  $('research-query').value='없음없음';$('research-query').dispatchEvent(new window.Event('input'));assert.equal($('research-empty').hidden,false);assert.equal($('research-reader').hidden,true);
  $('research-reset').click();assert.equal(root.querySelectorAll('.research-record-link').length,6);
  root.querySelector('.research-record-link[data-record=pltr]').click();assert.equal($('research-record-title').textContent,'PLTR · 도입의 병목');assert.equal(root.dataset.panel,'record');
  root.querySelector('.research-evidence a').click();assert.ok(root.querySelector('.is-evidence'));
  const saved=reader.getState();window.history.replaceState(null,'','#research?note=jev-20260923');window.dispatchEvent(new window.Event('realm-view'));assert.equal($('research-record-title').textContent,'JEV 모델 스터디');
  window.history.replaceState(null,'',researchHref(saved));window.dispatchEvent(new window.Event('realm-view'));assert.equal(reader.getState().note,saved.note);
  root.querySelector('[data-research-view=graph]').click();await Promise.resolve();await Promise.resolve();assert.match($('research-graph-status').textContent,/표시하지 못/);assert.ok($('research-graph-links').children.length);
  root.querySelector('[data-research-panel=list]').click();assert.equal(root.dataset.panel,'list');
  for(const a of root.querySelectorAll('a[target=_blank]')){assert.ok(a.href.startsWith('https://'));assert.equal(a.rel,'noopener noreferrer');}
  assert.match($('research-snapshot-label').textContent,/2026.09.27/);
  assert.ok(root.textContent.includes('자동 동기화 미연결'));
  console.log('PASS: 6 records, source/evidence integrity, aliases, dates, filters, routes, suggestions, mobile panels and graph failure fallback.');
}finally{reader.destroy();await window.happyDOM.close();}

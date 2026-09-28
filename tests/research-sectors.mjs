import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import fixture from './research-fixture.mjs';
import { SECTOR_NODES, SECTOR_RELATIONS, matchSectorRecords, sectorCoverage } from '../research-sectors.js';
import { createResearch } from '../research.js';
import { createResearchIndex, readResearchRoute, researchHref } from '../research-core.js';

const make = (id, title, text, extra = {}) => ({ ...structuredClone(fixture.records[0]), id, title, entities: [], loaded: true, sections: [{ id: 'body', text: text || '아직 작성된 본문이 없습니다.', markdown: text }], ...extra });
const records = [
  make('hbm-study', 'HBM 스터디', 'HBM4의 메모리 구조를 살펴봅니다.'),
  make('diary', '투자일기', '오늘은 SaaS를 짧게 언급하고 HBM4 자료를 읽었습니다.'),
  make('noise', '무관한 기록', '```\nHBM\n```\n![](https://example.com/HBM.png)\n[참고](https://example.com/SaaS)\n<script>HBM</script>'),
  make('boundary', '무관한 기록', 'CPUfoo MYGPU HBM4x shipping sunrise'),
  make('blank', 'CPU', '', { state: '빈 페이지' }),
  make('pending', 'TSMC N2', '원문 불러오는 중…', { loaded: false }),
  make('p-title', 'P US FY2Q27 실적발표', '분기 보고서'),
  make('p-noise', 'P의 일반 문장', 'P U 단일 글자는 분류에 사용하지 않습니다.'),
  make('nbis-earnings', 'FY2Q26 실적발표', '실적 보고서 본문입니다.', { path: ['스터디', 'NBIS US'] }),
  make('unsafe', 'NVL72 <img src=x onerror=alert(1)>', 'Vera Rubin <script>alert(1)</script> <b>구성</b>')
];
const data = { ...structuredClone(fixture), records, relations: [], mode: 'fixture' };
const hits = matchSectorRecords(records);
assert.deepEqual(hits.get('hbm').map(i => [i.record.id, i.basis]), [['hbm-study','title'],['diary','mention']]);
assert.equal(hits.get('platform').length, 1);
assert.equal(hits.get('platform')[0].basis, 'mention');
assert.equal(sectorCoverage(hits.get('platform'), false).state, 'mention');
assert.equal(sectorCoverage(hits.get('cpu'), false).state, 'empty');
assert.equal(sectorCoverage(hits.get('n2'), true).state, 'pending');
assert.equal(sectorCoverage(hits.get('n3'), true).state, 'pending');
assert.equal(sectorCoverage(hits.get('n3'), false).state, 'missing');
assert.equal(sectorCoverage(hits.get('hbm'), false).state, 'record');
assert.equal(sectorCoverage(matchSectorRecords([make('scan','HBM 보고서','![보고서](https://example.com/report.png)')]).get('hbm'), false).state, 'record');
assert.deepEqual(hits.get('storage').map(i => i.record.id), ['p-title']);
assert.equal(hits.get('entertainment').length, 0);
assert.equal(hits.get('neocloud')[0].basis, 'path');
assert.equal(hits.get('neocloud')[0].term, 'NBIS US');
assert.equal(sectorCoverage(hits.get('neocloud'), false).state, 'record');
const edited = structuredClone(records); edited[1].sections[0] = { id:'body',text:'주제가 변경되었습니다.',markdown:'주제가 변경되었습니다.' };
assert.equal(matchSectorRecords(edited).get('platform').length, 0);
assert.equal(matchSectorRecords(edited.filter(r => r.id !== 'hbm-study')).get('hbm').length, 0);
const ids = new Set(SECTOR_NODES.map(n => n.id)); assert.equal(ids.size, SECTOR_NODES.length);
for (const r of SECTOR_RELATIONS) { assert.ok(ids.has(r.from) && ids.has(r.to)); assert.notEqual(r.from, r.to); assert.ok(r.note); if (r.status === '공식 설명') assert.ok(r.source.url.startsWith('https://')); }
const index = createResearchIndex(data);
assert.equal(readResearchRoute('#research', index).view, 'sector');
assert.equal(readResearchRoute(researchHref({view:'sector',sector:'hbm'}), index).sector, 'hbm');
assert.equal(readResearchRoute('#research?view=sector&sector=<script>', index).sector, 'rack');

const { Window } = await import(process.env.DOM_MODULE || 'happy-dom');
const window = new Window({url:'https://seungmin.xyz/#research?view=sector&sector=hbm',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
window.document.write(await readFile(new URL('../index.html', import.meta.url), 'utf8')); window.document.body.dataset.stage = 'research';
const root = window.document.getElementById('research-content'); root.hidden = false;
const reader = createResearch(root, {data,loadGraph:async()=>{throw Error('Not needed');}});
const $ = selector => root.querySelector(selector);
try {
  assert.equal(root.dataset.view, 'sector'); assert.equal($('.research-layout').hidden, true);
  assert.equal(root.querySelectorAll('[data-sector]').length, 20);
  assert.equal($('.sector-detail h3').textContent, '메모리 HBM');
  assert.ok(reader.prioritizedRecordIds().includes('hbm-study')); assert.ok(!reader.prioritizedRecordIds().includes('diary'));
  $('[data-sector=platform]').click();
  assert.equal(reader.getState().sector, 'platform');
  assert.match($('.sector-detail').textContent, /본문 언급 · 분류 제안/);
  assert.equal($('.sector-record-title').textContent, '투자일기');
  assert.equal($('.sector-read').textContent, 'Research에서 읽기 →');
  assert.match($('.sector-read').href, /note=diary/);assert.match($('.sector-read').href, /section=body/);
  assert.equal($('.sector-record-actions .sector-source').target,'_blank');
  $('.sector-read').click();
  assert.equal(root.dataset.view, 'read'); assert.equal($('#research-record-title').textContent, '투자일기');
  assert.equal(reader.getState().section,'body');
  $('[data-research-view=sector]').click();
  assert.equal(reader.getState().sector,'platform');
  $('.sector-record-title').click();assert.equal(root.dataset.view,'read');
  $('[data-research-view=sector]').click();
  $('.sector-controls input[type=search]').value = 'CoWoS'; $('.sector-controls input[type=search]').dispatchEvent(new window.Event('input'));
  assert.equal(root.querySelectorAll('[data-sector]').length, 1);
  $('.sector-controls input[type=search]').value = '존재하지않음'; $('.sector-controls input[type=search]').dispatchEvent(new window.Event('input'));
  assert.equal(root.querySelectorAll('[data-sector]').length, 0); assert.equal($('.sector-no-results').hidden, false);
  $('.sector-controls input[type=search]').value = ''; $('.sector-controls input[type=search]').dispatchEvent(new window.Event('input'));
  $('.sector-controls input[type=checkbox]').click(); assert.equal($('[data-sector=hbm]'), null);
  $('.sector-controls input[type=checkbox]').click(); $('[data-sector=rack]').click();
  assert.equal($('.sector-detail img'), null); assert.equal($('.sector-detail script'), null);
  assert.match($('.sector-detail').textContent, /<img src=x onerror=alert\(1\)>/);
  const official = [...root.querySelectorAll('.sector-connection-button')].find(b => b.textContent.includes('공식 설명')); official.click();
  assert.ok($('.sector-connection a').href.startsWith('https://')); assert.equal($('.sector-connection a').rel, 'noopener noreferrer');
  reader.update({...data, records: edited}); assert.equal(root.querySelectorAll('[data-sector]').length, 20);
  $('[data-sector=platform]').click(); assert.equal($('.sector-record-title'), null);
  window.history.replaceState(null,'','#research?view=sector&sector=cpu'); window.dispatchEvent(new window.Event('realm-view'));
  assert.equal($('.sector-detail h3').textContent, 'CPU');
  reader.update({...data, records: [], relations: []}); assert.equal(root.querySelectorAll('[data-sector]').length, 20);
  assert.equal($('.sector-detail h3').textContent, 'CPU');
  console.log('PASS: sector taxonomy, title vs mention, empty/loading coverage, noise rejection, edits/deletions, routes, filters, safe excerpts, record navigation and empty catalogs.');
} finally { reader.destroy(); assert.equal($('#research-sector-view').children.length, 0); await window.happyDOM.close(); }

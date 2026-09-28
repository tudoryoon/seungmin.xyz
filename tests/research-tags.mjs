import assert from 'node:assert/strict';
import fixture from './research-fixture.mjs';
import { extractRecordTags, tagEntityId, tagKey } from '../research-tags.js';
import { rebuildNotionRelations } from '../research-sync-core.js';
import { createResearchIndex, filterRecords, relatedRecords, readResearchRoute, researchHref } from '../research-core.js';
import { matchSectorRecords, sectorCoverage } from '../research-sectors.js';
import { createResearch } from '../research.js';

const make = (id, title, markdown, extra = {}) => ({ ...structuredClone(fixture.records[0]), id, title, entities: [], loaded: true,
  source:{title,url:'https://example.com/'+id,pageId:id},path:[],sections:[{id:'body',label:'원문',text:markdown,markdown}], ...extra });
const parse = text => extractRecordTags(make('sample','테스트',text));
assert.deepEqual(parse('#금리 #ROE #gpu\n**#GPU** #네오클라우드, ＃HBM #NVDA_랙').map(t=>t.key), ['금리','roe','gpu','네오클라우드','hbm','nvda랙']);
assert.deepEqual(parse('\\#금리 #유동성').map(t=>t.label), ['금리','유동성'], 'Notion-escaped hashes remain explicit tags');
assert.deepEqual(parse('# Heading\n## GPU\n##CPU\nC# text MY#GPU\nhttps://example.com/#GPU\nwww.example.com/#HBM\n[link](#CPU)\n![#GPU](https://example.com/x)\n`#CPU`\n```text\n#GPU\n```\n~~~\n#HBM\n~~~\n<script>#GPU</script>\n<pre>#CPU</pre>\n<!-- #HBM -->\n<a href="https://example.com/#GPU">link</a>'), []);
assert.deepEqual(parse('```\n#GPU'), [], 'unfinished code fence is not a tag');
assert.equal(extractRecordTags(make('pending','테스트','#GPU',{loaded:false})).length,0);
assert.equal(parse('#'+'a'.repeat(81)).length,0);
assert.equal(parse('[#GPU](https://example.com)')[0].label,'GPU','visible tagged link text counts');

const raw = { ...structuredClone(fixture), relations:[], reviewedRelations:[], records:[
  make('diary-a','첫 번째 일기','#금리 #GPU\n주제 검토'),
  make('diary-b','두 번째 일기','#금리\n자료 검토'),
  make('mention','다른 일기','금리 GPU를 잠깐 언급합니다.'),
  make('gpu-study','GPU 스터디','칩에 대한 자료'),
  make('company-note','기업 분석','#NVIDIA\n비교 자료'),
  make('nvda','NVDA US','기업 자료'),
  make('alias-note','별칭 태그','#nvda\n다른 자료'),
  make('false-prefix','다른 태그','#GPUfoo #HBM4x')
] };
const data = rebuildNotionRelations(structuredClone(raw)), index = createResearchIndex(data);
const rateId = tagEntityId(tagKey('금리'));
assert.ok(data.entities.some(e=>e.id===rateId && e.generatedBy==='hashtag'));
assert.deepEqual(filterRecords(index,{tag:rateId}).map(r=>r.id).sort(),['diary-a','diary-b']);
assert.deepEqual(filterRecords(index,{tag:'nvda'}).map(r=>r.id).sort(),['alias-note','company-note']);
assert.equal(data.records.find(r=>r.id==='mention').tags.length,0);
const link = (a,b) => data.relations.find(r=>[r.from,r.to].includes(a)&&[r.from,r.to].includes(b));
assert.equal(link('diary-a','diary-b').strength,'strong','one shared tag suffices');
assert.equal(link('diary-a','gpu-study').type,'tag','tag points to a titled subject record');
assert.equal(link('company-note','nvda').strength,'strong');
assert.equal(link('company-note','alias-note').strength,'strong','known company aliases share a subject');
assert.equal(link('diary-a','mention'),undefined,'ordinary body mentions do not become strong links');
assert.ok(link('diary-a','diary-b').tagEvidence.every(e=>e.excerpt.includes('#금리')));
assert.ok(relatedRecords(index,'diary-a',false).some(n=>n.record.id==='diary-b'),'strong tags survive suggestion filtering');
assert.equal(readResearchRoute(researchHref({note:'diary-a',tag:rateId}),index).tag,rateId);
assert.equal(readResearchRoute('#research?tag=<script>',index).tag,undefined);
const hits=matchSectorRecords(data.records);
assert.equal(hits.get('gpu')[0].basis,'tag');
assert.ok(hits.get('gpu').some(h=>h.record.id==='diary-a'&&h.term==='#GPU'));
assert.ok(!hits.get('gpu').some(h=>h.record.id==='false-prefix'));
assert.match(sectorCoverage(hits.get('gpu'),false).label,/직접 태그/);
assert.equal(matchSectorRecords([make('rack','일기','#NVDA랙')]).get('rack')[0].basis,'tag');
assert.equal(matchSectorRecords([make('one','일기','#P #U')]).get('storage')[0].basis,'tag','explicit single-letter tickers are unambiguous');

// Preserve a real parent/link edge and add the explicit evidence instead of duplicating it.
const parentRaw=structuredClone(raw);parentRaw.records[1].source.parentId='diary-a';
const parent=rebuildNotionRelations(parentRaw).relations.find(r=>r.from==='diary-a'&&r.to==='diary-b');
assert.equal(parent.type,'parent');assert.equal(parent.strength,'strong');assert.ok(parent.tagEvidence.length>=2);
const changed=structuredClone(data);
for(const r of changed.records) r.sections=r.sections.map(s=>({...s,text:'새 내용',markdown:'새 내용'}));
const cleaned=rebuildNotionRelations(changed);createResearchIndex(cleaned);
assert.ok(!cleaned.entities.some(e=>e.generatedBy==='hashtag'));
assert.ok(!cleaned.relations.some(r=>r.strength==='strong'));
assert.ok(cleaned.records.every(r=>!r.tags.length));
assert.deepEqual(rebuildNotionRelations(structuredClone(data)),data,'rebuild is idempotent');

const { Window } = await import(process.env.DOM_MODULE || 'happy-dom');
const window = new Window({url:'https://example.com/#research?note=diary-a',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
const root=window.document.createElement('section');window.document.body.append(root);window.document.body.dataset.stage='research';
const reader=createResearch(root,{data});
try {
  assert.equal(root.querySelectorAll('.research-tag-explicit').length,2);
  assert.match(root.querySelector('.research-relation[data-strength=strong]').textContent,/긴밀한 연관/);
  assert.match(root.querySelector('.research-evidence').textContent,/#금리/);
  const tagButton=[...root.querySelectorAll('.research-tag-explicit')].find(b=>b.textContent==='#금리');tagButton.click();
  assert.equal(reader.getState().tag,rateId);
  assert.equal(root.querySelectorAll('.research-record-link').length,2);
  assert.equal(root.querySelector('#research-entity').value,'tag:'+rateId);
  root.querySelector('#research-reset').click();assert.equal(root.querySelectorAll('.research-record-link').length,raw.records.length);
  root.querySelector('[data-research-view=sector]').click();root.querySelector('[data-sector=gpu]').click();
  assert.match(root.querySelector('.sector-record-group h5').textContent,/직접 태그 · 긴밀한 연관/);
  assert.equal(root.querySelector('.sector-record').dataset.basis,'tag');
  assert.ok(reader.prioritizedRecordIds().includes('diary-a'));
  reader.update(cleaned);assert.equal(root.querySelector('.sector-record[data-basis=tag]'),null);
  console.log('PASS: explicit hashtag parsing, exclusions, strong topic/subject links, aliases, evidence, deletion, exact tag filters, sector priority and UI.');
} finally {reader.destroy();await window.happyDOM.close();}

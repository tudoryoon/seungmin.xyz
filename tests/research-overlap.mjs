import assert from 'node:assert/strict';
import { findBodyOverlaps } from '../research-overlap.js';
import { makeNotionDataset, mergeNotionBodies, rebuildNotionRelations } from '../research-sync-core.js';
import { createResearchIndex, relatedRecords } from '../research-core.js';
import { createResearch } from '../research.js';

// Synthetic prose; never store the user's reports in regression fixtures.
const first = 'The fictional laboratory expanded its test equipment to measure how cooling systems respond during a prolonged power interruption.';
const second = 'A separate observation in this synthetic report describes how inventory planning changes when component delivery takes several additional weeks.';
const prose = first + '\n\n' + second;
const record = (id, text, loaded=true) => ({id,title:'Independent title '+id,loaded,sections:[{id:'notion-body',text,markdown:text}]});
const match = findBodyOverlaps([record('report',prose),record('diary','My unrelated thoughts.\n\n- **'+first+'** {color="orange_bg"}\n- '+second)]);
assert.equal(match.length,1,'a copied report excerpt in a longer diary is detected without entity tags');
assert.equal(match[0].overlap.passages,2);
assert.ok(match[0].overlap.characters >= 120);
assert.deepEqual(match[0].evidence.map(e=>e.section),['notion-body','notion-body']);
assert.equal(findBodyOverlaps([record('a',prose),record('b',prose,false)]).length,0,'both bodies must finish loading');
assert.equal(findBodyOverlaps([record('a',first+'\n\n'+first),record('b',first+'\n\n'+first)]).length,0,'repeated copies of one passage count once');
assert.equal(findBodyOverlaps([record('a','AI PLTR NVDA\n\nSame short phrase.'),record('b','AI PLTR NVDA\n\nSame short phrase.')]).length,0,'short keywords do not create an overlap');
assert.equal(findBodyOverlaps([record('a','# '+first+'\n\n## '+second),record('b','# '+first+'\n\n## '+second)]).length,0,'headings alone do not create an overlap');
for (const ignored of ['```text\n'+prose+'\n```','![image]('+first+')\n\n<pdf src="https://example.com">'+second+'</pdf>']) {
  assert.equal(findBodyOverlaps([record('a',ignored),record('b',ignored)]).length,0,'code and attachments are not prose evidence');
}
assert.equal(findBodyOverlaps([record('a',prose),record('b',first.replace('equipment to','equipment\nto')+'\n\n> '+second)]).length,1,'soft line wrapping and quote formatting do not hide copied prose');
assert.equal(findBodyOverlaps([record('a',prose),record('b',first+'\n\n'+second.replace('several','zero'))]).length,0,'changed wording is not treated as an exact copy');
assert.equal(findBodyOverlaps([record('a',prose),record('b','<p>'+first+'</p><p>'+second+'</p>')]).length,1,'HTML paragraph formatting is ignored');
const stable = [record('a',prose),record('b',prose),record('c',prose)];
assert.deepEqual(findBodyOverlaps(stable),findBodyOverlaps([...stable].reverse()),'order of page loading does not change overlap direction or evidence');
const edited = record('a',prose);findBodyOverlaps([edited,record('b',prose)]);
edited.sections[0].markdown='Changed content';
assert.equal(findBodyOverlaps([edited,record('b',prose)]).length,0,'cached extraction follows changed source text');

const rootId='00000000000000000000000000000000',a='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',b='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const page=(id,title,parent=rootId)=>({id,url:'https://www.notion.so/'+id,properties:{title:{type:'title',title:[{plain_text:title}]}},created_time:'2026-09-28T01:00:00Z',last_edited_time:'2026-09-28T01:00:00Z',parent:{page_id:parent}});
const pages=[page(rootId,'Root','workspace'),page(a,'Diary'),page(b,'Report')];
const catalog=makeNotionDataset(pages,{records:[],entities:[],relations:[]},{rootId,syncedAt:'2026-09-28T01:00:00Z'});
const body=(pageId,markdown,linkedPageIds=[])=>({pageId,markdown,linkedPageIds,editedAt:pages[1].last_edited_time,fetchedAt:'2026-09-28T01:00:00Z'});
const partial=mergeNotionBodies(catalog,[body(a,prose)]);
assert.equal(partial.relations.length,0,'partial hydration has no premature match');
const dataset=mergeNotionBodies(partial,[body(b,'Some extra thoughts.\n\n'+prose)]);
assert.equal(dataset.relations.length,1);
assert.equal(dataset.relations[0].type,'overlap');
assert.equal(dataset.relations[0].status,'suggested');
assert.equal(relatedRecords(createResearchIndex(dataset),'notion-'+a,false).length,0,'existing suggestion toggle hides overlap relations');
assert.equal(mergeNotionBodies(dataset,[body(b,'Changed content')]).relations.length,0,'editing away copied prose removes the suggestion');
assert.equal(mergeNotionBodies(dataset,[{pageId:b,removed:true}]).relations.length,0,'deleted pages cannot leave stale suggestions');
const linked=mergeNotionBodies(dataset,[body(a,prose,[b])]);
assert.equal(linked.relations.length,1);assert.equal(linked.relations[0].type,'link');assert.equal(linked.relations[0].status,'editorial','source links keep priority');
const parented=structuredClone(dataset);parented.records[1].source.parentId=a;
assert.equal(rebuildNotionRelations(parented).relations[0].type,'parent','source hierarchy keeps priority');

const {Window}=await import(process.env.DOM_MODULE||'happy-dom');
const window=new Window({url:'https://example.com/#research?note=notion-'+a});
window.document.body.dataset.stage='research';
const root=window.document.createElement('section');window.document.body.append(root);
// Evidence must be inserted as text, even when it contains markup-like text.
const uiData=structuredClone(dataset);uiData.relations[0].overlap.excerpts.push('<img src=x onerror=alert(1)>');
const reader=createResearch(root,{data:uiData});
try {
  assert.match(root.querySelector('.research-relation-label').textContent,/본문 중복.*연결 제안/);
  assert.equal(root.querySelector('.research-evidence summary').textContent,'겹치는 구절 2개');
  assert.equal(root.querySelectorAll('.research-overlap-excerpt').length,3);
  assert.equal(root.querySelector('.research-evidence img'),null,'excerpts cannot execute HTML');
  assert.equal(root.querySelectorAll('.research-evidence a').length,2,'both original bodies remain reachable');
  root.querySelector('#research-suggestions').click();assert.equal(root.querySelector('.research-relation'),null);
  root.querySelector('#research-suggestions').click();assert.ok(root.querySelector('.research-relation'));
  root.querySelector('.research-evidence a').click();assert.ok(root.querySelector('.is-evidence'));
} finally { reader.destroy();await window.happyDOM.close(); }
console.log('PASS: partial-copy detection, formatting normalization, distinct passages, noise rejection, stable evidence, hydration/edit/delete reconciliation, source priority, suggestions toggle and safe evidence UI.');

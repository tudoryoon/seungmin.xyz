import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createNotionResearch, ROOT_PAGE } from '../lib/notion-research.js';
import { kstDate, titleDate, makeNotionDataset, mergeNotionBodies, scopedPages } from '../research-sync-core.js';
import { createResearchIndex } from '../research-core.js';
import { renderNotionMarkdown } from '../research-markdown.js';
import { createResearch, createResearchGate } from '../research.js';
import seed from './research-fixture.mjs';

const a='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', b='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', outside='cccccccccccccccccccccccccccccccc';
const page=(id,title,parent=ROOT_PAGE)=>({id,url:'https://www.notion.so/'+id,properties:{title:{type:'title',title:[{plain_text:title}]}},created_time:'2026-09-21T18:28:00Z',last_edited_time:'2026-09-22T05:38:00Z',parent:{type:'page_id',page_id:parent}});
const pages=[page(ROOT_PAGE,'Root','workspace'),page(a,'FDE (260923)'),page(b,'PLTR US',a),page(outside,'Outside','workspace')];
assert.equal(kstDate('2026-09-21T18:28:00Z'),'2026-09-22');
assert.equal(kstDate('invalid'),null);
assert.equal(titleDate('NVDA (26-08-26)'),'2026-08-26');
assert.equal(titleDate('스터디 (260923)'),'2026-09-23');
assert.equal(titleDate('잘못된 날짜 260231'),null);
assert.equal(scopedPages(pages,ROOT_PAGE).length,3);
const data=makeNotionDataset(pages,seed,{rootId:ROOT_PAGE,syncedAt:'2026-09-27T11:00:00Z'});
assert.equal(data.records.length,2); assert.equal(data.records[0].date.start,'2026-09-22');assert.equal(data.records[0].studyDate,'2026-09-23');
assert.ok(data.relations.some(r=>r.type==='parent'));
createResearchIndex(data);
const reviewSeed={...seed,records:[{...seed.records[0],source:{url:'https://www.notion.so/'+a}},{...seed.records[1],source:{url:'https://www.notion.so/'+b}}],relations:[{...seed.relations[1],id:'prior-review',from:seed.records[0].id,to:seed.records[1].id}]};
const independentPages=pages.map(p=>p.id===b?{...p,parent:{page_id:ROOT_PAGE}}:p);
const reviewed=makeNotionDataset(independentPages,reviewSeed,{rootId:ROOT_PAGE,syncedAt:'2026-09-27T11:00:00Z'});
assert.ok(reviewed.relations.some(r=>r.id==='review-prior-review'&&r.status==='suggested'));
assert.ok(!mergeNotionBodies(reviewed,[{pageId:a,removed:true}]).relations.length,'removed source removes reviewed relations too');
const body={pageId:a,editedAt:pages[1].last_edited_time,markdown:'PLTR AI 도입\n\n# Current text',linkedPageIds:[b],fetchedAt:'2026-09-27T11:00:00Z'};
const merged=mergeNotionBodies(data,[body]);assert.equal(merged.records[0].loaded,true);createResearchIndex(merged);
assert.equal(mergeNotionBodies(data,[{...body,editedAt:'different'}]).records[0].loaded,false);
assert.equal(mergeNotionBodies(merged,[{pageId:a,removed:true}]).records.length,1);
assert.equal(mergeNotionBodies(data,[{...body,truncated:true}]).records[0].state,'일부 원문');

let revoked=false,deleted=false,calls=[],attempts=0,time=Date.now();const stored=new Map();
const fetchRequest=async(url,options)=>{
  calls.push({url,method:options.method});
  assert.equal(options.redirect,'manual','never forward the Notion credential to redirects');
  assert.equal(options.headers['Notion-Version'],'2026-03-11');assert.equal(options.headers.Authorization,'Bearer fake-test-token');
  if(url.endsWith('pages/'+ROOT_PAGE))return Response.json(pages[0],{status:revoked?403:200});
  if(url.endsWith('search'))return Response.json({results:deleted?pages.filter(p=>p.id!==b):pages,has_more:false});
  if(url.endsWith('/markdown')){
    if(attempts++===0)return new Response('',{status:429,headers:{'Retry-After':'1'}});
    return Response.json({markdown:'# Secret fixture\nhttps://app.notion.com/p/'+b,truncated:false,unknown_block_ids:[]});
  }
  throw Error('Unexpected route '+url);
};
const env={NOTION_TOKEN:'fake-test-token',RESEARCH_SECRET:randomBytes(32).toString('hex')};
const load=createNotionResearch({fetchRequest,now:()=>time,sleep:async()=>{},cache:()=>({match:async r=>stored.get(r.url)?.clone(),put:async(r,response)=>stored.set(r.url,response)})});
const request=query=>new Request('https://example.com/api/research'+(query||''));
const catalog=await load(seed,env,request());assert.equal(catalog.records.length,2);assert.equal(catalog.sync.status,'connected');
const hydration=await load(seed,env,request('?hydrate='+a));assert.equal(hydration.bodies.length,1);assert.ok(hydration.bodies[0].linkedPageIds.includes(b));
const before=calls.filter(c=>c.url.endsWith('/markdown')).length;
await load(seed,env,request('?hydrate='+a));assert.equal(calls.filter(c=>c.url.endsWith('/markdown')).length,before,'cache skips unchanged body');
await load(seed,env,request('?hydrate='+a+'&refresh=images'));
assert.equal(calls.filter(c=>c.url.endsWith('/markdown')).length,before+1,'image repair bypasses the normal body cache');
await load(seed,env,request('?hydrate='+a+'&refresh=images'));
assert.equal(calls.filter(c=>c.url.endsWith('/markdown')).length,before+1,'image repairs share a bounded fresh export');
await assert.rejects(()=>load(seed,env,request('?hydrate='+a+','+b+'&refresh=images')),e=>e.status===400);
await assert.rejects(()=>load(seed,env,request('?hydrate='+a+'&refresh=anything')),e=>e.status===400);
for(const value of stored.values())assert.ok(!(await value.clone().text()).includes('Secret fixture'),'cached content is encrypted');
assert.equal((await load(seed,env,request('?hydrate='+outside))).bodies[0].removed,true,'outside root is never fetched');
await assert.rejects(()=>load(seed,env,request('?hydrate=../../private')),e=>e.status===400);
revoked=true;await assert.rejects(()=>load(seed,env,request('?hydrate='+a)),e=>e.status===403,'cached content cannot bypass revoked root');revoked=false;
deleted=true;time+=31000;assert.equal((await load(seed,env,request('?hydrate='+b))).bodies[0].removed,true);
assert.ok(calls.every(c=>c.method==='GET'||c.url.endsWith('/search')),'no Notion writes');
let redirectCalls=0;
const redirectLoad=createNotionResearch({fetchRequest:async()=>{redirectCalls++;return new Response(null,{status:302,headers:{Location:'https://unrelated.example'}});}});
await assert.rejects(()=>redirectLoad(seed,env,request()),e=>e.code==='notion_redirect');
assert.equal(redirectCalls,1,'reject redirects without a second authenticated request');

const {JSDOM}=await import(process.env.JSDOM_MODULE||'jsdom');
const win=new JSDOM('',{url:'https://example.com/#research?view=read',pretendToBeVisual:true}).window;
const root=win.document.createElement('section');win.document.body.append(root);win.document.body.dataset.stage='research';
try {
  const fragment=renderNotionMarkdown('# Hello\n<script>alert(1)</script>\n[bad](javascript:alert(1))\n<page url="https://example.com/note">Good note</page>\n<img src=x onerror=alert(1)>',win.document);
  root.append(fragment);assert.equal(root.querySelectorAll('script,[onerror]').length,0);assert.ok(!root.innerHTML.includes('javascript:'));assert.ok(root.querySelector('a[href="https://example.com/note"]'));
  root.replaceChildren(renderNotionMarkdown('# Title {color="orange_bg"}\n\n**bold **\n\n```text\n{color="orange_bg"}\n```\n<pdf src="https://example.com/p.pdf">PDF</pdf>',win.document));
  assert.equal(root.querySelector('h1').textContent,'Title ');assert.equal(root.querySelector('strong').textContent,'bold');assert.match(root.querySelector('code').textContent,/color=/);assert.ok(root.querySelector('a[href="https://example.com/p.pdf"]'));
  root.replaceChildren(renderNotionMarkdown('<table header-row="true">\n<tr><td>**Cell** <img src=x onerror=alert(1)></td></tr>\n</table>\n**After table**\n<empty-block/>\n![Image](https://example.com/image.png)',win.document));
  assert.equal(root.querySelector('td strong').textContent,'Cell');assert.equal(root.querySelectorAll('strong').length,2);assert.equal(root.querySelectorAll('[onerror]').length,0);assert.equal(root.querySelector('img').src,'https://example.com/image.png');
  const reader=createResearch(root,{data:merged});
  assert.match(root.textContent,/작성 2026.09.22 03:28 KST/);assert.match(root.textContent,/제목 날짜 2026.09.23/);
  const query=root.querySelector('#research-query');query.value='PLTR';query.dispatchEvent(new win.Event('input'));query.focus();
  reader.update(mergeNotionBodies(merged,[{...body,pageId:b,markdown:'PLTR AI 도입'}]));
  assert.equal(reader.getState().query,'PLTR');assert.equal(win.document.activeElement,query);reader.destroy();
  let n=0,updates=0;const gate=createResearchGate(root,{
    fetchRequest:async(url)=>url.includes('hydrate=')?Response.json({bodies:data.records.map(r=>({...body,pageId:r.source.pageId}))}):Response.json({...data,records:structuredClone(data.records)}),
    createReader:(_root,{data:initial})=>({getState:()=>({note:initial.records[0].id}),setSyncStatus:()=>{},update(next){updates++;assert.ok(next.records.every(r=>r.loaded));},destroy(){n++;}})
  });
  await gate.check();for(let i=0;i<20;i++)await new Promise(r=>setTimeout(r,2));assert.equal(updates,1);gate.destroy();assert.equal(n,1);
  console.log('PASS: Notion KST dates, title dates, root scope, encrypted cache, revocation, deletion, rate retry, markdown XSS, progressive updates and read-only requests.');
} finally { win.close(); }

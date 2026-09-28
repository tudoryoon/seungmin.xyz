import assert from 'node:assert/strict';
import { notionImageKey } from '../research-media.js';
import { renderNotionMarkdown } from '../research-markdown.js';
import { createResearchGate } from '../research.js';
import seed from './research-fixture.mjs';
const { JSDOM } = await import(process.env.JSDOM_MODULE || 'jsdom');
const win = new JSDOM('', {url:'https://example.com/#research',pretendToBeVisual:true}).window;
const root = win.document.createElement('section'); win.document.body.append(root); win.document.body.dataset.stage = 'research';
const url = 'https://prod-files-secure.s3.us-west-2.amazonaws.com/workspace/file/image.png?X-Amz-Signature=old';
const fresh = url.replace('=old', '=fresh');
assert.equal(notionImageKey(url), notionImageKey(fresh));
assert.equal(notionImageKey('https://prod-files-secure.s3.us-west-2.amazonaws.com.evil.test/a'), '');
assert.equal(notionImageKey('https://example.com/a?image=1'), '');
const tick = async () => { for(let i=0;i<8;i++) await new Promise(resolve=>setTimeout(resolve,1)); };
let gate;
try {
  let calls=0;
  root.append(renderNotionMarkdown(`![차트](${url})`,win.document,{refreshImage:async()=>{calls++;return fresh;}}));
  const img=root.querySelector('img'), status=root.querySelector('[role=status]'), retry=root.querySelector('button');
  assert.equal(img.loading,'lazy');assert.equal(img.referrerPolicy,'no-referrer');
  img.dispatchEvent(new win.Event('error'));await tick();
  assert.equal(calls,1);assert.equal(img.src,fresh);assert.equal(retry.disabled,true);
  img.dispatchEvent(new win.Event('load'));assert.equal(status.hidden,true);assert.equal(img.hidden,false);
  img.dispatchEvent(new win.Event('error'));await tick();
  assert.equal(calls,1,'failed repair does not loop');assert.equal(img.hidden,true);assert.equal(retry.hidden,false);assert.equal(retry.disabled,false);
  retry.click();await tick();assert.equal(calls,2,'manual retry remains available');
  img.dispatchEvent(new win.Event('load'));assert.equal(retry.hidden,true);
  let finish;
  root.replaceChildren(renderNotionMarkdown(`![차트](${url})`,win.document,{refreshImage:()=>new Promise(r=>{finish=r;})}));
  root.querySelector('img').dispatchEvent(new win.Event('error'));root.replaceChildren();finish(fresh);await tick();assert.equal(root.children.length,0,'late image responses cannot revive removed content');
  root.append(renderNotionMarkdown(`![외부](https://example.org/chart.png)`,win.document,{refreshImage:async()=>{throw Error('must not refresh external source through Notion');}}));
  root.querySelector('img').dispatchEvent(new win.Event('error'));await tick();root.querySelector('img').dispatchEvent(new win.Event('error'));
  assert.equal(root.querySelector('button').hidden,false,'external failures show a recoverable placeholder');

  const data=structuredClone(seed);data.mode='notion-live';data.records=data.records.slice(0,1);data.relations=[];
  const record=data.records[0];record.loaded=true;record.source.pageId='a'.repeat(32);record.source.editedAt='2026-09-28T00:00:00Z';
  let refresh,requests=0;
  gate=createResearchGate(root,{
    fetchRequest:async(request)=>{
      if(!request.includes('hydrate='))return Response.json(data);
      requests++;assert.match(request,/refresh=images/);
      return Response.json({bodies:[{pageId:record.source.pageId,editedAt:record.source.editedAt,markdown:`![차트](${fresh})`,fetchedAt:new Date().toISOString(),linkedPageIds:[]}]});
    },
    createReader:(_root,options)=>{refresh=options.onRefreshImages;return{getState:()=>({note:record.id}),update(){},destroy(){},setSyncStatus(){}};}
  });
  await gate.check();const [first,second]=await Promise.all([refresh(record.id),refresh(record.id)]);
  assert.equal(requests,1,'multiple broken images share one authenticated body refresh');assert.equal(first,second);assert.match(first,/Signature=fresh/);
  gate.destroy();gate=null;
  gate=createResearchGate(root,{fetchRequest:async request=>request.includes('hydrate=')?new Response('',{status:401}):Response.json(data),createReader:(_root,options)=>{refresh=options.onRefreshImages;return{destroy(){},getState:()=>({note:record.id}),setSyncStatus(){}};}});
  await gate.check();assert.equal(await refresh(record.id),null);assert.equal(root.dataset.locked,'true','expired Research access clears the reader during image repair');
  gate.destroy();gate=null;
  let finishHydration,updates=0;
  const pendingData=structuredClone(data);pendingData.records[0].loaded=false;
  gate=createResearchGate(root,{fetchRequest:async request=>{
    if(request.includes('refresh=images'))return new Response('',{status:401});
    if(request.includes('hydrate='))return new Promise(resolve=>{finishHydration=resolve;});
    return Response.json(pendingData);
  },createReader:(_root,options)=>{refresh=options.onRefreshImages;return{destroy(){},update(){updates++;},getState:()=>({note:record.id}),setSyncStatus(){}};}});
  await tick();await refresh(record.id);
  finishHydration(Response.json({bodies:[{pageId:record.source.pageId,editedAt:record.source.editedAt,markdown:'late private text',linkedPageIds:[]}]}));
  await tick();assert.equal(updates,0,'authentication failure also invalidates concurrent hydration');assert.equal(root.dataset.locked,'true');
  console.log('PASS: signed image renewal, bounded retries, external fallback, stale response disposal, coalesced refresh and expired-session locking.');
}finally{gate?.destroy();win.close();}

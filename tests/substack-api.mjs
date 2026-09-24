import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest} from '../functions/api/substack.js';
import snapshot from '../data/substack-snapshot.js';
import {validateFeed} from '../lib/substack-feed.js';
import {emptyFeed,sampleFeed} from './substack-fixture.mjs';

const originalFetch=globalThis.fetch, originalCaches=globalThis.caches, originalNow=Date.now;
let calls=0,mode='ok',stored=null,background=[],cacheFails=false,resolveFetch;
const now=Math.max(originalNow(),Date.parse(snapshot.fetchedAt)+3600000);
Date.now=()=>now;
globalThis.fetch=async(url,options)=>{
  calls++;assert.equal(url,'https://tudoryoon.substack.com/feed');
  assert.equal(options.redirect,'manual');assert.equal(options.headers.Cookie,undefined);assert.equal(options.headers.Authorization,undefined);
  if(mode==='redirect')return new Response(null,{status:302,headers:{Location:'https://other.example/feed'}});
  if(mode==='throw')throw new Error('private upstream details');
  if(mode==='blocked')return new Response('Blocked',{status:429});
  if(mode==='html')return new Response('<html>Blocked</html>',{headers:{'Content-Type':'text/html'}});
  if(mode==='large')return new Response('x'.repeat(3*1024*1024+1),{headers:{'Content-Type':'application/xml'}});
  if(mode==='doctype')return new Response('<!DOCTYPE rss><rss/>',{headers:{'Content-Type':'application/xml'}});
  if(mode==='invalid')return new Response('<rss><channel><item></channel></rss>',{headers:{'Content-Type':'application/xml'}});
  if(mode==='slow')await new Promise(resolve=>{resolveFetch=resolve;});
  return new Response(mode==='empty'?emptyFeed:sampleFeed,{headers:{'Content-Type':'application/xml','Set-Cookie':'do-not-forward=1'}});
};
globalThis.caches={default:{
  async match(key){assert.equal(key.url,'https://seungmin.xyz/api/substack?cache=last-good-v2');if(cacheFails)throw Error('cache unavailable');return stored?.clone();},
  async put(key,response){if(cacheFails)throw Error('cache unavailable');stored=response;}
}};
const request=()=>new Request('https://seungmin.xyz/api/substack?url=https://attacker.invalid',{headers:{Cookie:'private-session',Authorization:'Bearer private'}});
const run=()=>onRequest({request:request(),waitUntil:promise=>{background.push(promise);}});
async function settle(){await Promise.all(background);background=[];}
const cacheResponse=(xml,time)=>new Response(xml,{headers:{'Content-Type':'application/xml','X-Feed-Updated-At':new Date(time).toISOString()}});
try {
  assert.ok(validateFeed(snapshot.xml)>0,'ship actual public posts, never an empty placeholder');
  const cold=await run();assert.equal(cold.status,200);assert.equal(await cold.text(),snapshot.xml);await settle();
  assert.equal(cold.headers.get('Set-Cookie'),null);assert.equal(cold.headers.get('X-Feed-State'),'snapshot');
  assert.equal(stored.headers.get('Cache-Control'),'public, max-age=2592000');
  stored=cacheResponse(sampleFeed,now);const before=calls;
  const fresh=await run();assert.equal(await fresh.text(),sampleFeed);assert.equal(fresh.headers.get('X-Feed-State'),'fresh');assert.equal(calls,before);
  const method=await onRequest({request:new Request('https://seungmin.xyz/api/substack',{method:'POST'})});assert.equal(method.status,405);assert.equal(calls,before);
  for(mode of ['throw','blocked','redirect','html','large','doctype','invalid','empty']) {
    stored=null;const fallback=await run();await settle();assert.equal(fallback.status,200);assert.equal(await fallback.text(),snapshot.xml);assert.equal(stored,null,'bad feeds do not poison the cache');
    stored=cacheResponse(sampleFeed,now-600000);const stale=await run();await settle();assert.equal(stale.headers.get('X-Feed-State'),'stale');assert.equal(await stale.text(),sampleFeed);assert.equal(await stored.clone().text(),sampleFeed);
  }
  mode='slow';stored=cacheResponse(sampleFeed,now-600000);
  const instant=await run();assert.equal(instant.status,200);assert.ok(resolveFetch,'refresh continues independently');assert.equal(await instant.text(),sampleFeed);resolveFetch();await settle();
  mode='ok';cacheFails=true;const noCache=await run();assert.equal(await noCache.text(),snapshot.xml);await settle();
  const uncached=await onRequest({request:request()});assert.equal(await uncached.text(),sampleFeed,'without waitUntil the live fetch still works');
  mode='throw';assert.equal((await onRequest({request:request()})).status,200);
  cacheFails=false;stored=cacheResponse('<rss><channel>',now);const damaged=await run();await settle();assert.equal(await damaged.text(),snapshot.xml);
  const routes=JSON.parse(await readFile(new URL('../_routes.json',import.meta.url),'utf8'));assert.deepEqual(routes.include,['/api/substack','/api/substack/']);
  console.log('PASS: fresh/stale/snapshot responses, slow/blocked origins, strict XML/size/empty validation, cache outages, credential isolation and routing.');
} finally {globalThis.fetch=originalFetch;globalThis.caches=originalCaches;Date.now=originalNow;}

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequest } from '../functions/api/substack.js';
import { emptyFeed } from './substack-fixture.mjs';
const originalFetch=globalThis.fetch, originalCaches=globalThis.caches;
let calls=0,mode='ok',stored=null,putDone;
globalThis.fetch=async(url,options)=>{
  calls++;const source=new URL(url);assert.equal(source.origin+source.pathname,'https://tudoryoon.substack.com/feed');
  assert.equal(source.searchParams.get('refresh'),String(Math.floor(Date.now()/300000)));
  assert.equal(options.redirect,'error');assert.equal(options.headers.Cookie,undefined);assert.equal(options.headers.Authorization,undefined);
  if(mode==='throw')throw new Error('upstream details must not leak');
  if(mode==='html')return new Response('<html>Blocked</html>',{headers:{'Content-Type':'text/html'}});
  if(mode==='large')return new Response('x'.repeat(3*1024*1024+1),{headers:{'Content-Type':'application/xml'}});
  if(mode==='doctype')return new Response('<!DOCTYPE rss><rss/>',{headers:{'Content-Type':'application/xml'}});
  return new Response(emptyFeed,{headers:{'Content-Type':'application/xml','Set-Cookie':'do-not-forward=1'}});
};
globalThis.caches={default:{async match(key){assert.equal(key.url,'https://seungmin.xyz/api/substack');return stored?.clone();},async put(key,response){stored=response;}}};
const request=()=>new Request('https://seungmin.xyz/api/substack?url=https://attacker.invalid',{headers:{Cookie:'private-session',Authorization:'Bearer private'}});
const run=()=>onRequest({request:request(),waitUntil:promise=>{putDone=promise;}});
try{
  const first=await run();await putDone;
  assert.equal(first.status,200);assert.equal(await first.text(),emptyFeed);
  assert.equal(first.headers.get('Set-Cookie'),null);assert.equal(first.headers.get('Cache-Control'),'public, max-age=300');
  assert.equal((await run()).status,200);assert.equal(calls,1,'cache hit avoids upstream fetch');
  const method=await onRequest({request:new Request('https://seungmin.xyz/api/substack',{method:'POST'})});assert.equal(method.status,405);assert.equal(calls,1);
  for(mode of ['throw','html','large','doctype']){stored=null;const failure=await run();assert.equal(failure.status,502);assert.equal(await failure.text(),'Feed unavailable');assert.equal(failure.headers.get('Cache-Control'),'no-store');}
  const routes=JSON.parse(await readFile(new URL('../_routes.json',import.meta.url),'utf8'));
  assert.deepEqual(routes.include,['/api/substack','/api/substack/'],'only feed requests invoke Functions');
  console.log('PASS: fixed public upstream, no credential forwarding, cache, query isolation, method guard, bounded bodies, failures and scoped function routing.');
}finally{globalThis.fetch=originalFetch;globalThis.caches=originalCaches;}

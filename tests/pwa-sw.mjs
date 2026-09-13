import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const handlers=new Map(),stored=new Map(),deleted=[],fetched=[],origin='https://example.test';
let claimed=0,skipped=0,failNetwork=false;
const publicOffline='<h1>Offline</h1>';
const caches={
  async open(name){if(!stored.has(name))stored.set(name,new Map());const cache=stored.get(name);return {
    async add(request){assert.equal(request.url,origin+'/offline.html');assert.equal(request.cache,'reload');cache.set('/offline.html',new Response(publicOffline));},
    async match(path){return cache.get(path)?.clone();}
  };},
  async keys(){return [...stored.keys()];},
  async delete(name){deleted.push(name);return stored.delete(name);}
};
stored.set('realm-offline-old',new Map());stored.set('unrelated-private-cache',new Map());
runInNewContext(await readFile(new URL('../sw.js',import.meta.url),'utf8'),{
  URL,Response,Set,caches,
  Request:class extends Request{constructor(url,options){super(new URL(url,origin),options);}},
  self:{location:{origin},clients:{async claim(){claimed++;}},async skipWaiting(){skipped++;},addEventListener(name,handler){handlers.set(name,handler);}},
  async fetch(request,options){fetched.push({request,options});if(failNetwork)throw new Error('offline');return new Response('fresh online page');}
});
async function lifecycle(name){let promise;handlers.get(name)({waitUntil(value){promise=value;}});await promise;}
await lifecycle('install');assert.equal(skipped,1);assert.deepEqual([...stored.get('realm-offline-v1').keys()],['/offline.html']);
await lifecycle('activate');assert.equal(claimed,1);assert.deepEqual(deleted,['realm-offline-old']);assert.ok(stored.has('unrelated-private-cache'));
function navigate(path,{method='GET',mode='navigate'}={}){let response;handlers.get('fetch')({request:{url:new URL(path,origin).href,method,mode},respondWith(value){response=value;}});return response;}
for(const path of ['/','/index.html','/test.html?code=fake-auth','/roulette.html']) {
  assert.equal(await (await navigate(path)).text(),'fresh online page');
  assert.equal(fetched.at(-1).options.cache,'no-store');
  assert.equal(fetched.at(-1).request.url,new URL(path,origin).href,'auth parameters preserved on network');
}
failNetwork=true;
for(const path of ['/','/index.html','/test.html?code=fake-auth','/roulette.html'])assert.equal(await (await navigate(path)).text(),publicOffline);
for(const path of ['https://private.supabase.co/rest/v1/journal_records','https://private.supabase.co/storage/v1/object/sign/private?token=fake','/favicon.svg','/pwa.js'])assert.equal(navigate(path),undefined,'API/files are not intercepted');
assert.equal(navigate('/test.html',{method:'POST'}),undefined);assert.equal(navigate('/test.html',{mode:'cors'}),undefined);
assert.deepEqual([...stored.get('realm-offline-v1').keys()],['/offline.html'],'only the public fallback is cached');
stored.get('realm-offline-v1').clear();assert.equal((await navigate('/')).status,503);
const offline=await readFile(new URL('../offline.html',import.meta.url),'utf8');
assert.ok(!/src="https?:|<link|<script\s+src=/.test(offline),'offline fallback needs no network assets');
console.log('PASS: network-only navigation, offline fallback, auth parameters, cache isolation, no API/file/POST interception and no private caching.');

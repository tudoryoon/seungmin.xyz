import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeUrl,inspectFile,MAX_FILE_SIZE,createLibraryStore} from '../library-store.js';
import {movePosition} from '../dungeon.js';
const {Window} = await import(process.env.DOM_MODULE || 'happy-dom');
const {PGlite} = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const owner='00000000-0000-4000-8000-000000000001', other='00000000-0000-4000-8000-000000000002';
const id='10000000-0000-4000-8000-000000000001';
const pdf=new File(['%PDF-1.7\nfixture'],'notes.pdf',{type:'application/pdf'});
assert.equal(normalizeUrl('example.com/a'),'https://example.com/a');
for(const value of ['javascript:alert(1)','data:text/html,hi','file:///tmp/a','https://name:password@example.com'])assert.throws(()=>normalizeUrl(value));
assert.equal((await inspectFile(pdf)).kind,'pdf');
await assert.rejects(inspectFile(new File(['<svg/>'],'image.png',{type:'image/png'})));
await assert.rejects(inspectFile({size:MAX_FILE_SIZE+1,name:'large.pdf'}));
const straight=movePosition({x:50,y:50},{x:1,y:0},.05,1000,1000);
const diagonal=movePosition({x:50,y:50},{x:1,y:1},.05,1000,1000);
assert.ok(Math.abs(Math.hypot(diagonal.x-50,diagonal.y-50)-(straight.x-50))<.00001,'diagonal speed is normalized');
assert.equal(movePosition({x:99,y:99},{x:1,y:1},100,1000,1000).y,94);

// Exercise real PostgreSQL constraints and RLS without changing a production account.
const db=new PGlite();
try {
  await db.exec(`create role anon;create role authenticated;
    create schema auth;create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
    alter table storage.objects enable row level security;
    grant usage on schema auth,storage to authenticated;
    grant select,insert,update on storage.objects to authenticated;
    insert into auth.users values ('${owner}'),('${other}');`);
  const sql=await readFile(new URL('../supabase/library.sql',import.meta.url),'utf8');
  await db.exec(sql);
  const bucket=(await db.query("select * from storage.buckets where id='library-files'")).rows[0];
  assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),MAX_FILE_SIZE);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`);
  await db.query("insert into public.library_items(user_id,id,kind,title,url) values ($1,$2,'link','Example','https://example.com')",[owner,id]);
  await assert.rejects(db.query("insert into public.library_items(user_id,id,kind,title,url) values ($1,gen_random_uuid(),'link','Invalid',null)",[owner]),e=>e.code==='23514');
  await assert.rejects(db.query("insert into public.library_items(user_id,id,kind,title,url) values ($1,gen_random_uuid(),'link','Invalid','javascript:alert(1)')",[owner]),e=>e.code==='23514');
  await assert.rejects(db.query("insert into public.library_items(user_id,id,kind,title,url) values ($1,gen_random_uuid(),'link','Other','https://example.com')",[other]),e=>e.code==='42501');
  await db.query("insert into storage.objects(bucket_id,name) values ('library-files',$1)",[owner+'/'+id+'.pdf']);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('library-files',$1)",[other+'/'+id+'.pdf']),e=>e.code==='42501');
  await db.exec(`set request.jwt.claim.sub='${other}';`);
  assert.equal((await db.query('select * from public.library_items')).rows.length,0);
  assert.equal((await db.query('select * from storage.objects')).rows.length,0);
  await db.exec('reset role;set role anon;');
  await assert.rejects(db.query('select * from public.library_items'),e=>e.code==='42501');
  await db.exec('reset role;');await db.exec(sql);
  assert.equal((await db.query('select * from public.library_items')).rows.length,1,'repeat setup preserves data');
} finally {await db.close();}

let identity={id:owner,version:1}, failWrite=false, failUpload=false, changeDuringUpload=false;
const rows=new Map(), files=new Map();
const bucket={
  async upload(path,file){if(failUpload)return {error:new Error('upload failed')};files.set(path,file);if(changeDuringUpload)identity={id:other,version:2};return {data:{path}};},
  async createSignedUrl(path){return {data:{signedUrl:'https://storage.example/'+path}};},
  async download(path){return {data:files.get(path)}}
};
const client={storage:{from:()=>bucket},from:()=>{
  let kind='select',row,filters={};
  const query={select(){return this;},order(){return this;},eq(key,value){filters[key]=value;return this;},
    upsert(value){kind='upsert';row=value;return this;},update(value){kind='update';row=value;return this;},
    async range(from,to){return {data:[...rows.values()].filter(r=>r.user_id===filters.user_id).slice(from,to+1)};},
    async single(){
      if(failWrite)return {error:new Error('write failed')};
      const key=kind==='upsert'?row.id:filters.id;
      const existing=rows.get(key);
      const result={created_at:new Date().toISOString(),archived:false,notes:'',...existing,...row};
      rows.set(key,result);return {data:result};
    }};
  return query;
}};
const store=createLibraryStore(client,()=>identity);
const saved=await store.saveFile(pdf,id);
assert.equal(saved.storage_path,owner+'/'+id+'.pdf');
await assert.rejects(store.download({...saved,user_id:other}));
failWrite=true;await assert.rejects(store.saveFile(pdf,id));failWrite=false;
await store.saveFile(pdf,id);assert.equal(rows.size,1,'retry reuses metadata identity');assert.equal(files.size,1);
failUpload=true;await assert.rejects(store.saveFile(pdf,'failed-id'));failUpload=false;assert.equal(rows.size,1);
changeDuringUpload=true;await assert.rejects(store.saveFile(pdf,'switch-id'),e=>e.code==='ACCOUNT_CHANGED');
assert.equal(rows.has('switch-id'),false);changeDuringUpload=false;identity={id:owner,version:3};
rows.clear();

// DOM-level product checks, with no real browser, account, or network traffic.
const window=new Window({url:'http://localhost/test.html#library',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true,disableIframePageLoading:true}});
try {
  window.document.write(await readFile(new URL('../test.html',import.meta.url),'utf8'));
  const cloud={user:{id:owner,email:'fixture@example.com'},ready:true,version:3,list:async()=>[]};
  window.journalCloud=cloud;window.realmClient=client;window.lucide={createIcons(){}};
  window.cloudError=e=>e.message;
  window.testLibraryModule=await import('../library-store.js');
  window.eval(await readFile(new URL('../journal.js',import.meta.url),'utf8'));
  const source=await readFile(new URL('../library.js',import.meta.url),'utf8');
  window.eval('(()=>{const {createLibraryStore,inspectFile,libraryError,normalizeUrl}=window.testLibraryModule;\n'+source.replace(/^import[^\n]+\n/,'')+'\n})()');
  const $=id=>window.document.getElementById(id);
  async function until(test){for(let i=0;i<100;i++){if(test())return;await new Promise(r=>setTimeout(r,2));}assert.ok(test(),'DOM state settled');}
  await until(()=>!$('add-link').disabled);
  assert.equal($('library').hidden,false);assert.equal($('calendar').hidden,true);assert.equal($('workout').hidden,true);
  assert.equal(window.document.querySelector('nav[aria-label="기록 메뉴"]'),null);
  assert.equal(window.document.querySelector('.settings-tab').hidden,true);
  $('add-link').click();$('link-url').value='example.com';$('link-title').value='<b>자료</b>';
  $('link-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
  await until(()=>rows.size===1&&!$('save-link').disabled);
  assert.equal(window.document.querySelector('.resource-title').textContent,'<b>자료</b>');
  assert.equal(window.document.querySelector('.resource-title b'),null,'stored title is text, not HTML');
  assert.equal(window.document.querySelector('.resource-media').getAttribute('rel'),'noopener noreferrer');
  $('library-search').value='no-match';$('library-search').dispatchEvent(new window.Event('input'));
  assert.equal(window.document.querySelectorAll('.resource-card').length,0);
  $('library-search').value='';$('library-search').dispatchEvent(new window.Event('input'));
  window.document.querySelector('[title="휴지통으로 이동"]').click();
  await until(()=>[...rows.values()][0].archived===true&&!$('add-link').disabled);
  assert.equal(window.document.querySelectorAll('.resource-card').length,0);
  $('library-trash').click();window.document.querySelector('[title="복원"]').click();
  await until(()=>[...rows.values()][0].archived===false&&!$('add-link').disabled);
  $('library-trash').click();
  $('add-link').click();$('link-url').value='javascript:alert(1)';$('link-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
  await until(()=>$('link-error').textContent.length>0);assert.equal(rows.size,1);
  $('link-dialog').close();$('add-files').click();
  Object.defineProperty($('library-files'),'files',{configurable:true,value:[pdf]});
  $('library-files').dispatchEvent(new window.Event('change'));
  await until(()=>!$('save-files').disabled);
  failUpload=true;$('file-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
  await until(()=>window.document.querySelector('[data-state=failed]')&&!$('save-files').disabled);
  assert.equal(rows.size,1,'failed uploads do not create a record');
  failUpload=false;$('file-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
  await until(()=>rows.size===2&&!$('file-dialog').open);
  assert.equal(window.document.querySelectorAll('.resource-card[data-kind=pdf]').length,1);
  let finishJournal;
  cloud.list=()=>new Promise(resolve=>{finishJournal=resolve;});
  window.localStorage.setItem('seungmin-journal-v1',JSON.stringify([{id:'local',kind:'event',date:'2026-09-12',title:'Local'}]));
  window.location.hash='#calendar';window.dispatchEvent(new window.Event('hashchange'));
  window.location.hash='#library';window.dispatchEvent(new window.Event('hashchange'));
  finishJournal([]);await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal($('import-bar').hidden,true,'a late calendar response cannot expose calendar controls in the library');
  cloud.user=null;cloud.version++;window.dispatchEvent(new window.Event('journal-account'));
  assert.equal(window.document.querySelectorAll('.resource-card').length,0,'logout clears resource content');
  assert.equal($('add-link').disabled,true);
  window.location.hash='#workout';window.dispatchEvent(new window.Event('hashchange'));
  assert.equal($('workout').hidden,false);assert.equal($('calendar').hidden,true);assert.equal($('library').hidden,true);
  window.location.hash='#calendar';window.dispatchEvent(new window.Event('hashchange'));
  assert.equal($('calendar').hidden,false);assert.equal(window.document.querySelector('.settings-tab').hidden,false);
  window.location.hash='#projects';window.dispatchEvent(new window.Event('hashchange'));
  assert.equal($('library').hidden,false);assert.equal(window.location.hash,'#library');
} finally {await window.happyDOM.close();}
console.log('PASS: library SQL/RLS and repeat setup, private files, URL/file validation, retry and account isolation, DOM add/search/trash/restore/logout, isolated dungeon views, and normalized keyboard movement.');

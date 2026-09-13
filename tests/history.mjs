import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {STATIONS} from '../stations.js';
import {createRouletteStore,remainingStations} from '../roulette-store.js';
const {Window} = await import(process.env.DOM_MODULE || 'happy-dom');
const {PGlite} = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const sql=await readFile(new URL('../supabase/roulette.sql',import.meta.url),'utf8');
const db=new PGlite();
try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    insert into auth.users values('${owner}'),('${other}');`);
  await db.exec(sql);await db.exec(sql);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`);
  const choose=()=>db.query("select * from public.roulette_choose('seoul','서울역',array['1호선','4호선','경의중앙선'])");
  const first=(await choose()).rows[0],second=(await choose()).rows[0];
  assert.equal(String(first.selected_at),String(second.selected_at),'retry is idempotent');
  assert.equal((await db.query('select count(*)::int n from public.roulette_choices')).rows[0].n,1);
  assert.equal((await db.query("select day=(selected_at at time zone 'Asia/Seoul')::date ok from public.roulette_choices")).rows[0].ok,true);
  await assert.rejects(db.exec('delete from public.roulette_choices'));
  await assert.rejects(db.exec("update public.roulette_choices set station_name='modified'"));
  await assert.rejects(db.exec(`insert into public.roulette_choices(user_id,station_id,station_name,lines) values('${owner}','x','x',array['1호선'])`));
  await assert.rejects(db.query("select public.roulette_choose('x','',array['1호선'])"));
  await assert.rejects(db.query("select public.roulette_choose('x','x',array['unknown'])"));
  await db.exec(`set request.jwt.claim.sub='${other}';`);
  assert.equal((await db.query('select count(*)::int n from public.roulette_choices')).rows[0].n,0);
  await choose();
  assert.equal((await db.query('select count(*)::int n from public.roulette_choices')).rows[0].n,1,'another user has independent choices');
  await db.exec("set role anon;set request.jwt.claim.sub='';");
  await assert.rejects(db.exec('select * from public.roulette_choices'));
  await assert.rejects(choose());
  // Historical tasks remain in the existing owner-only table and cannot be changed after their day.
  await db.exec('reset role;');
  await db.exec(await readFile(new URL('../supabase/daily.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/daily-midnight.sql',import.meta.url),'utf8'));
  await db.exec(`insert into public.daily_plans(user_id,day) values('${owner}','2026-01-01');
    insert into public.daily_tasks(user_id,day,id,title,position,completed_at) values('${owner}','2026-01-01','10000000-0000-4000-8000-000000000001','Keep past title',0,'2026-01-01T12:00:00Z');
    set role authenticated;set request.jwt.claim.sub='${owner}';`);
  await db.query('select public.daily_plan_state()');
  assert.equal((await db.query("select title from public.daily_tasks where day='2026-01-01'")).rows[0].title,'Keep past title');
  await assert.rejects(db.query("select public.daily_plan_update('2026-01-01',0,'check',null,'10000000-0000-4000-8000-000000000001',false)"),/DAY_CHANGED/);
  await db.exec(`set request.jwt.claim.sub='${other}';`);
  assert.equal((await db.query("select * from public.daily_tasks where day='2026-01-01'")).rows.length,0);
} finally {await db.close();}
assert.equal(remainingStations(STATIONS,[{station_id:STATIONS[0].id}]).length,447);
assert.equal(remainingStations(STATIONS,STATIONS.map(station=>({station_id:station.id}))).length,0);
const fixed={station_id:STATIONS[0].id,day:'2026-09-14'};
for(const data of [fixed,[fixed]]) {
  const api=createRouletteStore({rpc:async()=>({data})},()=>({id:owner,epoch:1}));
  assert.deepEqual(await api.choose(STATIONS[0]),fixed);
}
for(const data of [[],[fixed,fixed],null]) {
  const api=createRouletteStore({rpc:async()=>({data})},()=>({id:owner,epoch:1}));
  await assert.rejects(api.choose(STATIONS[0]),/INVALID_HISTORY/);
}
for(const name of ['신촌','양평']) {
  const same=STATIONS.filter(station=>station.name===name);
  assert.equal(remainingStations(same,[{station_id:same[0].id}])[0].id,same[1].id,'different same-name stations remain independent');
}
let identity={id:owner,epoch:1},resolveList;
const store=createRouletteStore({from(){return {select(){return this},eq(){return this},order(){return this},range(){return this},then(resolve){resolveList=resolve;}};}},()=>identity);
const pending=store.list();await new Promise(resolve=>setTimeout(resolve,0));identity={id:other,epoch:2};resolveList({data:[]});
await assert.rejects(pending,/ACCOUNT_CHANGED/);
const w=new Window({url:'https://seungmin.xyz/test#calendar',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
try {
  w.document.write('<aside id="daily-panel"><h2 id="daily-title">오늘 할 일</h2><input id="draft" value="작성 중"></aside>');
  const $=id=>w.document.getElementById(id);
  w.eval((await readFile(new URL('../daily-history.js',import.meta.url),'utf8')).replace('export function createDailyHistory','window.createDailyHistory = function'));
  let selected='2026-09-14',month='2026-09',user={id:owner},active=true,defer=false,late,fail=false;
  let state={day:'2026-09-14',tasks:[{id:'today',title:'Today',completed:false}]};
  let data=[{id:'past',day:'2026-09-13',title:'<b>기록 그대로</b>',completed_at:'2026-09-13T12:00:00Z',position:0}];
  const client={from(name){assert.equal(name,'daily_tasks');return {select(){return this},eq(key,id){assert.equal(id,user.id);return this},gte(){return this},lt(){return this},order(){return this},limit(count){assert.equal(count,620);return this},then(resolve){if(defer)late=resolve;else resolve({data:structuredClone(data),error:fail?{message:'offline'}:null});}};}};
  w.journalCalendar={range:()=>({selected,month}),render(){w.dispatchEvent(new w.Event('journal-calendar-range'));}};
  const history=w.createDailyHistory({panel:$('daily-panel'),client,getUser:()=>user,getState:()=>state,isActive:()=>active});
  await history.sync();
  assert.equal($('daily-live').hidden,false);assert.equal(w.dailyHistory.counts('2026-09-13').total,1);
  selected='2026-09-13';await history.sync();
  assert.equal($('daily-live').hidden,true);assert.equal($('daily-history').hidden,false);
  assert.equal($('daily-history-list').querySelector('span').textContent,'<b>기록 그대로</b>');
  assert.equal($('daily-history-list').querySelector('b'),null);
  assert.equal($('daily-history-list').querySelector('input').checked,true);
  assert.equal($('daily-history-list').querySelector('input').disabled,true);
  assert.equal($('draft').value,'작성 중');
  selected='2026-09-14';await history.sync();assert.equal($('daily-live').hidden,false);
  state={day:'2026-09-15',tasks:[]};await history.sync(true);assert.equal($('daily-history').hidden,false,'midnight switches to selected-date history');
  selected='2026-09-20';await history.sync();assert.equal($('daily-history-status').textContent,'저장된 할 일이 없습니다.');
  fail=true;await history.sync(true);assert.equal($('daily-history-retry').hidden,false);fail=false;
  defer=true;const loading=history.sync(true);await new Promise(resolve=>setTimeout(resolve,0));
  user={id:other};active=false;state=null;history.reset();late({data});await loading;
  assert.equal($('daily-history-list').children.length,0);assert.equal(w.dailyHistory.counts('2026-09-13').total,0);
  console.log('PASS: roulette SQL/RLS, retry immutability, independent accounts, exclusion/exhaustion/homonyms, stale responses; historical tasks persist, past writes denied, dated read-only UI, XSS safety, draft retention, midnight, error retry and logout.');
} finally {await w.happyDOM.close();}

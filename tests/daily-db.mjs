import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
try {
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    insert into auth.users values('${owner}'),('${other}');`);
  const sql=await readFile(new URL('../supabase/daily.sql',import.meta.url),'utf8');
  await db.exec(sql);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`);
  const state=async()=>(await db.query('select public.daily_plan_state() as data')).rows[0].data;
  const update=async(s,action,tasks=null,id=null,done=null)=>(await db.query('select public.daily_plan_update($1::date,$2::bigint,$3::text,$4::jsonb,$5::uuid,$6::boolean) as data',[s.day,s.revision,action,tasks&&JSON.stringify(tasks),id,done])).rows[0].data;
  let s=await state();assert.equal(s.level,1);assert.deepEqual(s.tasks,[]);
  assert.equal(s.day,new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s.server_now)));
  assert.equal(new Date(s.ends_at).getTime()-new Date(s.day+'T00:00:00+09:00').getTime(),86400000);
  for(const bad of [null,[],{},[{id:a,title:''}],[{id:a,title:'a'},{id:a,title:'b'}],[{id:'invalid',title:'a'}],Array.from({length:21},()=>({id:a,title:'a'}))]) {
    await assert.rejects(update(s,'save',bad),/INVALID_TASKS/);
  }
  await assert.rejects(update({...s,day:'2000-01-01'},'save',[{id:a,title:'a'}]),/DAY_CHANGED/);
  s=await update(s,'save',[{id:a,title:' 운동 ',completed:true},{id:b,title:'자료 정리'}]);
  assert.equal(s.tasks[0].completed,false,'client cannot forge completion in a list save');
  assert.equal(s.tasks[0].title,'운동');
  const old=s;
  s=await update(s,'check',null,a,true);assert.equal(s.level,1);assert.equal(s.awarded,false);
  await assert.rejects(update(old,'save',[{id:a,title:'overwrite'}]),/PLAN_CHANGED/);
  s=await update(s,'save',[{id:a,title:'운동 바꾸기'},{id:b,title:'자료 정리'}]);
  assert.equal(s.tasks[0].completed,false,'renaming a checked task resets its check');
  await assert.rejects(update(s,'finish'),/TASKS_REMAIN/);
  await assert.rejects(update(s,'check',null,other,true),/TASK_NOT_FOUND/);
  s=await update(s,'check',null,a,true);
  s=await update(s,'save',[{id:a,title:'운동 바꾸기'}]);
  assert.equal(s.level,1,'removing unfinished tasks is not a reward action');
  s=await update(s,'finish');assert.equal(s.level,2);assert.equal(s.awarded,true);
  const retry=await update(old,'check',null,a,true);assert.equal(retry.level,2,'duplicate or lost-response retry does not award twice');
  assert.equal((await update(s,'finish')).level,2);
  await assert.rejects(update(s,'save',[{id:a,title:'change'}]),/ALREADY_COMPLETED/);
  for(const q of ['insert into daily_rewards(user_id,day) values ($1,current_date)','delete from daily_tasks where user_id=$1','update daily_plans set revision=0 where user_id=$1']) {
    await assert.rejects(db.query(q,[owner]),e=>e.code==='42501');
  }
  await db.exec(`set request.jwt.claim.sub='${other}';`);
  assert.equal((await state()).level,1);
  for(const name of ['daily_tasks','daily_plans','daily_rewards'])assert.equal((await db.query('select * from '+name)).rows.length,0);
  let t=await state();t=await update(t,'save',[{id:a,title:'Other account'}]);
  t=await update(t,'check',null,a,true);assert.equal(t.level,2,'the final check awards immediately');
  await db.exec('reset role;set role anon;');
  await assert.rejects(db.query('select public.daily_plan_state()'),e=>e.code==='42501');
  await assert.rejects(db.query('select * from public.daily_rewards'),e=>e.code==='42501');
  await db.exec('reset role;');await db.exec(sql);
  assert.equal((await db.query('select * from public.daily_rewards')).rows.length,2,'migration is repeatable');
  await db.query("insert into daily_plans(user_id,day) values($1,(now() at time zone 'Asia/Seoul')::date-1)",[owner]);
  await db.query("insert into daily_rewards(user_id,day) values($1,(now() at time zone 'Asia/Seoul')::date-1)",[owner]);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`);
  assert.equal((await state()).level,3,'levels accumulate across days, independently of profile metadata');
  await db.exec("set request.jwt.claim.sub='';");
  await assert.rejects(state(),/AUTH_REQUIRED/);
} finally {await db.close();}
console.log('PASS: daily PostgreSQL validation, KST date, revisions, completion rewards, idempotency, cumulative levels, owner RLS and direct-write denial.');

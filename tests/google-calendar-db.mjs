import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
const user='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${user}'),('${other}');`);
  const sql=await readFile(new URL('../supabase/google-calendar.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  await db.exec(`insert into public.google_calendar_connections(user_id,credentials,email) values('${user}','encrypted','test@example.com');insert into public.google_calendar_oauth_states values('state','${user}','encrypted','https://seungmin.xyz',now()+interval '10 minutes');`);
  for(const role of ['anon','authenticated']) {
    await db.exec(`set role ${role};`);
    for(const table of ['google_calendar_connections','google_calendar_oauth_states']) {
      await assert.rejects(db.query(`select * from public.${table}`),e=>e.code==='42501');
      await assert.rejects(db.query(`delete from public.${table}`),e=>e.code==='42501');
    }
    await assert.rejects(db.query('select * from public.consume_google_calendar_state($1,$2)',['state',user]),e=>e.code==='42501');
    await db.exec('reset role;');
  }
  await db.exec('set role service_role;');
  assert.equal((await db.query('select * from public.google_calendar_connections')).rows.length,1);
  assert.equal((await db.query('select * from public.consume_google_calendar_state($1,$2)',['state',other])).rows.length,0);
  assert.equal((await db.query('select * from public.consume_google_calendar_state($1,$2)',['state',user])).rows.length,1);
  assert.equal((await db.query('select * from public.consume_google_calendar_state($1,$2)',['state',user])).rows.length,0);
  await db.exec('reset role;');await db.query('delete from auth.users where id=$1',[user]);
  assert.equal((await db.query('select * from public.google_calendar_connections')).rows.length,0);
  console.log('PASS: repeatable SQL, anon/authenticated denial, server-only credentials, atomic account-bound state consumption and deletion cascade.');
} finally {await db.close();}

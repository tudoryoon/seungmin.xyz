import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {Window} = await import(process.env.DOM_MODULE || 'happy-dom');
const html = await readFile(new URL('../test.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../workout.js', import.meta.url), 'utf8');
const journal = await readFile(new URL('../journal.js', import.meta.url), 'utf8');
const w = new Window({url:'https://seungmin.xyz/test#workout', settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
const $ = id => w.document.getElementById(id);
const pause = () => new Promise(resolve => setTimeout(resolve, 3));
async function until(check) {for (let n = 0; n < 150; n++) {if (check()) return; await pause();} assert.ok(check(), 'UI settles');}
const owner = {id:'owner',email:'owner@example.com',user_metadata:{realm_profile:{name:'Keep profile'},realm_avatar:{name:'Keep avatar'}}};
let user = owner, rows = [], fail = false, authFail = false, lateUser = null, lateRead = false;
const writes = [], metadataWrites = [];
w.document.write(html); w.lucide = {createIcons(){}}; w.confirm = () => true;
w.cloudError = () => '저장 실패';
w.journalCloud = {
  user, ready:true, version:1,
  async list(){return rows.map(row => ({...row}));},
  async save(record){if (fail) throw Error('network'); writes.push(record); rows = rows.filter(row => row.id !== record.id).concat(record);},
  async remove(id){rows = rows.filter(row => row.id !== id);},
  client:{auth:{
    async getUser(){if (lateRead) return new Promise(resolve => {lateUser = resolve;}); return {data:{user},error:authFail ? Error('offline') : null};},
    async updateUser({data}){if (authFail) return {error:Error('offline')}; metadataWrites.push(data); user = {...user,user_metadata:{...user.user_metadata,...data}}; return {data:{user}};}
  }}
};
const submit = () => $('record-form').dispatchEvent(new w.SubmitEvent('submit', {cancelable:true,submitter:$('record-form').querySelector('[type="submit"]')}));
const typeSubmit = () => $('workout-type-form').dispatchEvent(new w.Event('submit', {cancelable:true}));
try {
  w.eval(source); const model = w.workoutModel;
  assert.equal(model.dayKey(new Date('2026-09-13T15:00:00Z')), '2026-09-14');
  assert.equal(model.week('2026-09-13').start, '2026-09-07');
  assert.equal(model.week('2026-09-14').end, '2026-09-20');
  assert.equal(model.week('2027-01-01').start, '2026-12-28');
  assert.equal(model.shift('2028-02-28', 1), '2028-02-29');
  assert.deepEqual([...model.types(['러닝','  수영  ','수영',null])], ['런닝','케틀벨 스윙','푸시업','스쿼트','플랭크','수영']);
  const sample = [
    {kind:'workout',type:'러닝',date:'2026-09-07'},
    {kind:'workout',type:'런닝',date:'2026-09-13',completed:false},
    {kind:'workout',type:'런닝',date:'2026-09-14',completed:true},
    {kind:'event',type:'런닝',date:'2026-09-08'},
    {kind:'workout',type:'케틀벨 스윙',date:'2026-09-13',completed:true}
  ];
  assert.equal(model.progress(sample, '2026-09-13', '2026-09-13')[0].count, 1);
  assert.equal(model.progress(sample, '2026-09-13', '2026-09-12')[1].count, 0, 'future completion not counted');
  const today = model.dayKey(new Date());
  rows = [{id:'legacy',kind:'workout',type:'근력',title:'원래 기록',date:today,duration:20,notes:'유지'}];
  w.eval(journal);
  await until(() => $('workout-list').querySelector('.record'));
  assert.equal($('workout').hidden, false); assert.equal($('calendar').hidden, true);
  assert.equal($('workout-grid').querySelectorAll('.day').length, new Date(Number(today.slice(0,4)), Number(today.slice(5,7)), 0).getDate());
  assert.equal($('workout-goals').children.length, 3);
  $('add-workout').click();
  assert.deepEqual([...$('workout-type').options].map(option => option.value), [...model.defaults]);
  assert.equal($('record-date').value, today);
  $('workout-type').value = '케틀벨 스윙'; $('workout-type').dispatchEvent(new w.Event('change'));
  assert.equal($('record-title').value, '케틀벨 스윙');
  submit(); await until(() => !$('editor').open);
  assert.equal(writes.at(-1).type, '케틀벨 스윙');
  assert.equal(writes.at(-1).completed, true);
  assert.match($('workout-goals').children[1].textContent, /1 \/ 3회/);
  const checkbox = () => $('workout-list').querySelector('[aria-label="케틀벨 스윙 완료"]');
  checkbox().click(); await until(() => writes.at(-1).completed === false && !checkbox().disabled);
  assert.match($('workout-goals').children[1].textContent, /0 \/ 3회/);
  fail = true; checkbox().click(); await until(() => $('message').textContent === '저장 실패');
  assert.equal(checkbox().checked, false, 'failed completion reverts UI'); fail = false;
  $('workout-list').querySelector('[aria-label="원래 기록 수정"]').click();
  assert.equal($('workout-type').value, '근력'); assert.equal($('record-notes').value, '유지');
  submit(); await until(() => !$('editor').open);
  assert.equal(writes.at(-1).type, '근력'); assert.equal(writes.at(-1).title, '원래 기록');
  $('workout-list').querySelector('[aria-label="케틀벨 스윙 수정"]').click();
  $('delete-record').click(); await until(() => !$('editor').open);
  assert.equal($('workout-list').querySelector('[aria-label="케틀벨 스윙 완료"]'), null);
  assert.equal(rows.some(row => row.id === 'legacy'), true, 'deletion preserves unrelated records');
  $('workout-next').click();
  const first = $('workout-grid').querySelector('.day').dataset.date;
  $('add-workout').click(); assert.equal($('record-date').value, first);
  assert.equal($('workout-completed').checked, false); assert.equal($('workout-completed').disabled, true);
  assert.equal([...$('workout-type').options].some(option => option.value === '근력'), false);
  $('close-editor').click(); $('workout-today').click();
  $('add-workout').click(); $('editor-add-workout-type').click();
  $('new-workout-type').value = '  수영  '; typeSubmit(); await until(() => !$('workout-type-dialog').open);
  assert.equal($('workout-type').value, '수영'); assert.equal($('record-title').value, '수영');
  assert.deepEqual([...metadataWrites[0].workout_types], ['수영']);
  assert.equal(user.user_metadata.realm_profile.name, 'Keep profile');
  assert.equal(user.user_metadata.realm_avatar.name, 'Keep avatar');
  $('close-editor').click();
  $('add-workout-type').click(); $('new-workout-type').value = '수영'; typeSubmit();
  await until(() => $('workout-type-error').textContent.includes('이미'));
  assert.equal(metadataWrites.length, 1);
  $('new-workout-type').value = '클라이밍'; authFail = true; typeSubmit();
  await until(() => $('workout-type-error').textContent.includes('저장하지'));
  assert.equal(metadataWrites.length, 1); authFail = false; $('close-workout-type').click();
  $('add-workout-type').click(); $('new-workout-type').value = '<img src=x onerror=alert(1)>'; typeSubmit();
  await until(() => !$('workout-type-dialog').open);
  $('add-workout').click();
  assert.equal($('workout-type').querySelector('img'), null, 'custom names are plain text');
  $('close-editor').click();
  const savedTypeCount = metadataWrites.length;
  // Account changes clear custom choices, including late authenticated requests.
  lateRead = true; $('add-workout-type').click(); $('new-workout-type').value = '클라이밍'; typeSubmit();
  await until(() => lateUser);
  user = {id:'other',email:'other@example.com',user_metadata:{}};
  w.journalCloud.user = user; w.journalCloud.version++;
  lateRead = false; w.dispatchEvent(new w.Event('journal-account')); lateUser({data:{user:owner}});
  await pause(); await pause();
  assert.equal($('workout-type-dialog').open, false); assert.equal(metadataWrites.length, savedTypeCount);
  $('add-workout').click(); assert.deepEqual([...$('workout-type').options].map(option => option.value), [...model.defaults]);
  $('close-editor').click();
  // A fresh authenticated read restores saved types on another device/session.
  user = {...owner,user_metadata:{...owner.user_metadata,workout_types:['수영']}};
  w.journalCloud.user = user; w.journalCloud.version++; w.dispatchEvent(new w.Event('journal-account'));
  await pause(); await pause(); $('add-workout').click();
  assert.ok([...$('workout-type').options].some(option => option.value === '수영'));
  console.log('PASS: KST dates, Monday weeks/year/leap boundaries, defaults, legacy records, planned/completed goals, undo and failed writes, custom types, metadata preservation, user isolation and stale requests.');
} finally {await w.happyDOM.close();}

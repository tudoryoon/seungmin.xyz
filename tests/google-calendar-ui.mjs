import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as core from '../google-calendar-core.js';
const {Window}=await import(process.env.DOM_MODULE || 'happy-dom');
const w=new Window({url:'https://seungmin.xyz/test.html#calendar',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
const $=id=>w.document.getElementById(id);
const pause=()=>new Promise(resolve=>setTimeout(resolve,2));
async function until(test){for(let i=0;i<200;i++){if(test())return;await pause();}assert.ok(test(),'UI settles');}
w.document.write(await readFile(new URL('../test.html',import.meta.url),'utf8'));
w.lucide={createIcons(){}};w.confirm=()=>true;
w.Option=function(text,value){const option=w.document.createElement('option');option.textContent=text;option.value=value;return option;};
let failSave=false,savePending=null,eventPending=null,pendingReads=false,readCount=0;
const local={id:'local',kind:'event',title:'Local record',date:core.localDate(new Date()),start:'12:00'};
const event={id:'google1',etag:'v1',title:'Google <b>record</b>',start:{date:local.date},end:{date:core.nextDate(local.date)},notes:'<b>Safe note</b>',location:'',editable:true,htmlLink:'https://calendar.google.com/calendar/event?eid=example'};
const calls=[];
w.journalCloud={user:{id:'owner',email:'owner@example.com'},ready:true,version:1,async list(){return [local];},async save(){throw new Error('Google events must not enter local storage');}};
w.cloudError=()=> 'Error';w.testCore=core;
w.calendarRequest=async(action,args={})=>{
  calls.push({action,args});
  if(action==='status')return {configured:true,connected:true,email:'calendar@example.com'};
  if(action==='calendars')return {calendars:[{id:'primary',name:'Main',primary:true,accessRole:'owner',color:'#11aa66'},{id:'read',name:'Read',accessRole:'reader',color:'#ffaaaa'}]};
  if(action==='events'){readCount++;if(pendingReads)return new Promise(resolve=>{eventPending=resolve;});return {events:[event]};}
  if(action==='create' || action==='update'){if(failSave)throw new Error('EVENT_CHANGED');if(savePending)return new Promise(resolve=>{savePending.resolve=resolve;});return {id:'saved'};}
  return {};
};
try {
  w.eval(await readFile(new URL('../workout.js',import.meta.url),'utf8'));
  w.eval(await readFile(new URL('../journal.js',import.meta.url),'utf8'));
  const source=(await readFile(new URL('../google-calendar.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
  w.eval(`(()=>{const {occursOn,eventFields,eventPayload,localDate,errorMessage}=window.testCore;const calendarRequest=window.calendarRequest;const connectGoogle=async()=>{};${source}\n})()`);
  await until(()=>$('google-sync-status').textContent==='Google 일정 동기화됨');
  assert.equal($('event-list').querySelectorAll('.record').length,2);
  assert.ok($('month-grid').querySelector(`[aria-label="${local.date}, 일정 2개"]`));
  assert.equal($('event-list').querySelector('b'),null,'provider text cannot inject markup');
  assert.equal($('event-list').querySelector('.notes').textContent,'Safe note');
  assert.equal($('event-destination').value,'primary');
  $('add-event').click();assert.ok($('google-editor').open);assert.equal($('editor').open,false);
  $('google-title').value='New Google';failSave=true;
  $('google-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await until(()=>$('google-error').textContent.includes('Google에서 변경'));
  assert.equal($('google-title').value,'New Google');assert.ok($('google-editor').open);
  const firstId=calls.find(c=>c.action==='create').args.eventId;
  failSave=false;$('google-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await until(()=>!$('google-editor').open && !$('google-save').disabled);
  assert.equal(calls.filter(c=>c.action==='create').at(-1).args.eventId,firstId,'retry keeps idempotency ID');
  $('event-destination').value='local';$('add-event').click();assert.ok($('editor').open);assert.equal($('google-editor').open,false);$('editor').close();
  $('event-list').querySelector('.google-record button').click();assert.ok($('google-editor').open);assert.equal($('google-event-calendar').disabled,true);
  $('google-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>!$('google-save').disabled);
  assert.equal(calls.find(c=>c.action==='update').args.etag,'v1');
  const before=readCount;w.location.hash='#workout';w.dispatchEvent(new w.Event('hashchange'));await pause();
  $('refresh-records').click();await pause();assert.equal(readCount,before,'no Google fetching in other dungeons');
  w.location.hash='#calendar';w.dispatchEvent(new w.Event('hashchange'));await until(()=>readCount>before);
  pendingReads=true;$('next').click();await until(()=>eventPending);
  w.journalCloud.user=null;w.journalCloud.version++;w.dispatchEvent(new w.Event('journal-account'));
  eventPending({events:[event]});await pause();await pause();
  assert.equal($('event-list').querySelectorAll('.google-record').length,0,'late private data cannot enter another account');
  assert.equal($('google-editor').open,false);
  console.log('PASS: merged calendar counts, XSS-safe rows, Google/local destination, draft preservation, retry IDs, update etags, dungeon isolation and logout races.');
} finally {await w.happyDOM.close();}

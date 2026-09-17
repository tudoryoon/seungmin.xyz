import {calendarRequest,connectGoogle,errorMessage} from './google-api.js?v=20260918-1';
import {occursOn,eventFields,eventPayload,localDate} from './google-calendar-core.js?v=20260918-1';
const el = id => document.getElementById(id);
let owner = null, generation = 0, fetchGeneration = 0, listGeneration = 0, connected = false;
let calendars = [], events = [], selectedCalendars = new Set(), loadedRange = '', editingEvent = null, saving = false, requestId = '';
let lastSync = 0;
let hiddenCalendars = new Set();
const current = () => owner && owner === window.journalCloud?.user?.id;
const active = () => ['calendar','connections'].includes(document.body.dataset.view);
const writable = calendar => ['owner','writer'].includes(calendar.accessRole);
const make = (tag,text,className) => {const node=document.createElement(tag);if(text !== undefined)node.textContent=text;if(className)node.className=className;return node;};
const icon = (name,label) => {const button=make('button',undefined,'google-icon');button.type='button';button.title=label;button.setAttribute('aria-label',label);const i=make('i');i.dataset.lucide=name;button.append(i);return button;};
const refreshJournal = () => {window.journalCalendar?.render();window.lucide?.createIcons();};
// A denylist makes new calendars visible; v2 resets the old implicit primary-only allowlist.
const preferencesKey = () => `google-calendar-hidden-v2:${owner}`;
function remember() {try {localStorage.setItem(preferencesKey(),JSON.stringify([...hiddenCalendars]));} catch {}}
function renderCalendars(selectPrimary=false) {
  el('google-visibility').hidden=!connected || !calendars.length;
  for (const container of [el('google-calendars'),el('google-calendar-filters')]) {
    container.replaceChildren();
    for (const calendar of calendars) {
      const label=make('label'),checkbox=make('input'),swatch=make('span',undefined,'google-color');
      checkbox.type='checkbox';checkbox.checked=selectedCalendars.has(calendar.id);checkbox.dataset.calendarId=calendar.id;
      swatch.style.setProperty('--calendar-color',/^#[0-9a-f]{6}$/i.test(calendar.color) ? calendar.color : '#81b6d5');
      label.append(checkbox,swatch,make('span',`${calendar.name}${writable(calendar) ? '' : ' · 읽기 전용'}`));
      checkbox.addEventListener('change',()=>{
        if(checkbox.checked){selectedCalendars.add(calendar.id);hiddenCalendars.delete(calendar.id);}
        else {selectedCalendars.delete(calendar.id);hiddenCalendars.add(calendar.id);}
        for(const input of document.querySelectorAll('.google-calendars input'))input.checked=selectedCalendars.has(input.dataset.calendarId);
        remember();loadEvents(true);
      });
      container.append(label);
    }
  }
  const destination=el('event-destination'),previous=destination.value;
  destination.replaceChildren(new Option('내 기록','local'));
  for (const calendar of calendars.filter(writable)) destination.add(new Option(`Google · ${calendar.name}`,calendar.id));
  destination.value=(!selectPrimary && previous==='local') || calendars.some(c=>c.id===previous && writable(c)) ? previous : (calendars.find(c=>c.primary && writable(c))?.id || 'local');
  el('event-destination-field').hidden=!connected;
}
async function loadCalendars(selectPrimary=false) {
  if(!current() || !connected || !active())return;
  const version=generation,request=++listGeneration;
  try {
    const result=await calendarRequest('calendars');
    if(version!==generation || request!==listGeneration || !current())return;
    calendars=result.calendars;
    selectedCalendars=new Set(calendars.filter(c=>!hiddenCalendars.has(c.id)).map(c=>c.id));
    el('google-connection-error').textContent='';
    renderCalendars(selectPrimary);await loadEvents(true);
  } catch(error) {
    if(version!==generation || request!==listGeneration || !current())return;
    el('google-connection-error').textContent=errorMessage(error);el('google-sync-status').textContent=errorMessage(error);
  }
}
async function loadAccount() {
  const version=++generation; fetchGeneration++;listGeneration++;
  owner=window.journalCloud?.user?.id || null;connected=false;calendars=[];events=[];selectedCalendars=new Set();hiddenCalendars=new Set();loadedRange='';lastSync=0;
  try {const saved=JSON.parse(localStorage.getItem(preferencesKey()));if(Array.isArray(saved))hiddenCalendars=new Set(saved.filter(id=>typeof id==='string'));} catch {}
  el('google-editor').close();el('google-account').textContent=owner ? '연결 확인 중…' : '로그인 후 연결';
  el('google-disconnect').hidden=true;el('google-connect').disabled=!owner;el('google-connect').textContent='연결';
  el('google-setup-link').hidden=false;el('google-sync-status').textContent='';el('google-connection-error').textContent='';
  renderCalendars();refreshJournal();
  if (!owner || !active()) return;
  try {
    const status=await calendarRequest('status');
    if (version!==generation || !current()) return;
    connected=status.connected;
    el('google-account').textContent=connected ? status.email : '미연결';
    el('google-connect').textContent=connected ? '다시 연결' : '연결';
    el('google-disconnect').hidden=!connected;el('google-setup-link').hidden=connected;
    if (!status.configured) {el('google-connection-error').textContent=errorMessage(new Error('NOT_CONFIGURED'));return;}
    if (!connected) return;
    await loadCalendars(true);
  } catch(error) {
    if (version!==generation || !current()) return;
    el('google-account').textContent=connected ? el('google-account').textContent : '연결 확인 실패';
    el('google-connection-error').textContent=errorMessage(error);el('google-sync-status').textContent=errorMessage(error);
  }
}
async function loadEvents(force=false) {
  if (!current() || !connected || !active()) return;
  const range=window.journalCalendar?.range();if(!range)return;
  const key=`${range.start}/${range.end}/${[...selectedCalendars].sort().join(',')}`;
  if (!force && key===loadedRange) return;
  loadedRange=key;
  const version=generation,request=++fetchGeneration;
  events=[];el('google-sync-status').textContent='Google 일정 불러오는 중…';refreshJournal();
  const fetched=[],failures=[];
  // Bound concurrency and keep one failed calendar from hiding the others.
  for (const calendar of calendars.filter(c=>selectedCalendars.has(c.id))) {
    try {
      const result=await calendarRequest('events',{calendarId:calendar.id,timeMin:range.start,timeMax:range.end});
      if(version!==generation || request!==fetchGeneration || !current())return;
      fetched.push(...result.events.map(event=>({...event,calendarId:calendar.id,calendar})));
    } catch(error) {
      if(version!==generation || request!==fetchGeneration || !current())return;
      failures.push(`${calendar.name}: ${errorMessage(error)}`);
    }
  }
  if(version!==generation || request!==fetchGeneration || !current())return;
  events=fetched;lastSync=Date.now();
  el('google-sync-status').textContent=failures.length ? failures.join(' / ') : (selectedCalendars.size ? 'Google 일정 동기화됨' : '표시할 Google 캘린더 없음');
  refreshJournal();
}
function recordRow(event) {
  const row=make('article',undefined,'record google-record'),info=make('div',undefined,'record-info');
  row.style.setProperty('--calendar-color',/^#[0-9a-f]{6}$/i.test(event.calendar.color) ? event.calendar.color : '#81b6d5');
  const fields=eventFields(event);
  info.append(make('p',`Google · ${event.calendar.name}`,'google-source'),make('h3',event.title));
  info.append(make('p',fields.allDay ? (fields.startDate===fields.endDate ? '종일' : `${fields.startDate} ~ ${fields.endDate} · 종일`) : `${fields.startDate===fields.endDate ? '' : fields.startDate+' '}${fields.startTime} ~ ${fields.startDate===fields.endDate ? '' : fields.endDate+' '}${fields.endTime}`));
  if(event.location)info.append(make('p',event.location));
  if(event.notes){const doc=new DOMParser().parseFromString(event.notes,'text/html');info.append(make('p',doc.body.textContent,'notes'));}
  const actions=make('div',undefined,'google-event-actions');
  if(writable(event.calendar) && event.editable){const edit=icon('pencil',`${event.title} 수정`);edit.addEventListener('click',()=>openEditor(event));actions.append(edit);}
  try {const url=new URL(event.htmlLink);if(url.protocol==='https:' && ['www.google.com','calendar.google.com'].includes(url.hostname)){const link=make('a',undefined,'google-icon');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.title='Google Calendar에서 열기';link.setAttribute('aria-label',`${event.title} Google Calendar에서 열기`);const i=make('i');i.dataset.lucide='external-link';link.append(i);actions.append(link);}} catch {}
  row.append(info,actions);return row;
}
function toggleTime() {
  for(const id of ['google-start-time','google-end-time']){el(id).disabled=el('google-all-day').checked;el(id).required=!el('google-all-day').checked;}
}
function openEditor(event=null,date=localDate(new Date())) {
  if(!current() || !connected || saving)return;
  editingEvent=event;requestId=crypto.randomUUID().replaceAll('-','');el('google-form').reset();el('google-error').textContent='';
  const calendarSelect=el('google-event-calendar');calendarSelect.replaceChildren();
  for(const calendar of calendars.filter(writable))calendarSelect.add(new Option(calendar.name,calendar.id));
  calendarSelect.value=event?.calendarId || el('event-destination').value;
  calendarSelect.disabled=Boolean(event);
  const fields=event ? eventFields(event) : {startDate:date,endDate:date,startTime:'09:00',endTime:'10:00',allDay:false};
  el('google-title').value=event?.title || '';el('google-notes').value=event?.notes || '';el('google-location').value=event?.location || '';
  for(const [id,field] of [['google-start-date','startDate'],['google-end-date','endDate'],['google-start-time','startTime'],['google-end-time','endTime']])el(id).value=fields[field];
  el('google-all-day').checked=fields.allDay;toggleTime();
  el('google-editor-title').textContent=event ? 'Google 일정 수정' : 'Google 일정 추가';
  el('google-event-note').textContent=event ? `${event.recurring ? '반복 일정 중 이 날짜만 변경합니다. ' : ''}참석자가 있는 일정은 변경 알림이 전송됩니다.` : '';
  el('google-editor').showModal();el('google-title').focus();
}
window.googleCalendar={eventsForDate:date=>current() ? events.filter(event=>selectedCalendars.has(event.calendarId) && occursOn(event,date)) : [],recordRow,openNew:date=>{
  if(el('event-destination').value==='local' || !connected || !current())return false;
  openEditor(null,date);return true;
}};
el('google-all-day').addEventListener('change',toggleTime);
el('google-start-date').addEventListener('change',()=>{if(el('google-end-date').value<el('google-start-date').value)el('google-end-date').value=el('google-start-date').value;});
el('google-close').addEventListener('click',()=>{if(!saving)el('google-editor').close();});
el('google-editor').addEventListener('cancel',event=>{if(saving)event.preventDefault();});
el('google-form').addEventListener('submit',async event=>{
  event.preventDefault();if(saving || !current())return;
  let payload;
  try {payload=eventPayload({title:el('google-title').value,notes:el('google-notes').value,location:el('google-location').value,startDate:el('google-start-date').value,endDate:el('google-end-date').value,startTime:el('google-start-time').value,endTime:el('google-end-time').value,allDay:el('google-all-day').checked});}
  catch(error){el('google-error').textContent=error.message;return;}
  const version=generation,calendarId=el('google-event-calendar').value;
  saving=true;el('google-save').disabled=true;el('google-error').textContent='';
  const controls=[...el('google-form').querySelectorAll('input,textarea,select,button')].map(control=>({control,disabled:control.disabled}));
  controls.forEach(({control})=>{control.disabled=true;});
  try {
    await calendarRequest(editingEvent ? 'update' : 'create',{calendarId,eventId:editingEvent?.id || requestId,etag:editingEvent?.etag,event:payload});
    if(version!==generation || !current())return;
    selectedCalendars.add(calendarId);hiddenCalendars.delete(calendarId);remember();renderCalendars();el('google-editor').close();await loadEvents(true);
  } catch(error){if(version===generation && current())el('google-error').textContent=errorMessage(error);}
  finally{controls.forEach(({control,disabled})=>{control.disabled=disabled;});saving=false;el('google-save').disabled=false;}
});
el('google-connect').addEventListener('click',async()=>{el('google-connect').disabled=true;el('google-connection-error').textContent='';try{await connectGoogle();}catch(error){el('google-connection-error').textContent=errorMessage(error);el('google-connect').disabled=false;}});
el('google-disconnect').addEventListener('click',async()=>{
  if(!current() || !confirm('Google 연결을 해제할까요? Google의 원본 일정은 유지됩니다.'))return;
  const version=generation;el('google-disconnect').disabled=true;
  try{await calendarRequest('disconnect');if(version===generation)await loadAccount();}
  catch(error){if(version===generation)el('google-connection-error').textContent=errorMessage(error);}
  finally{el('google-disconnect').disabled=false;}
});
window.addEventListener('journal-account',loadAccount);
window.addEventListener('journal-calendar-range',()=>loadEvents());
window.addEventListener('journal-view',()=>{if(active()){if(!connected)loadAccount();else loadCalendars();}});
el('refresh-records').addEventListener('click',()=>{if(active()){if(!connected)loadAccount();else loadCalendars();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden && active() && Date.now()-lastSync>60000)loadEvents(true);});
if(window.journalCloud?.ready)loadAccount();

'use strict';
const $ = id => document.getElementById(id);
const KEY = 'seungmin-journal-v1';
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const today = dateKey(new Date());
let selected = today;
let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let records = [];
let editing = null;
let kind = 'event';
let busy = false;
let loadVersion = 0;
function readLocal() {
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (!Array.isArray(saved) || saved.some(r => !r || typeof r.id !== 'string' || !['event','workout'].includes(r.kind) || typeof r.date !== 'string' || typeof r.title !== 'string')) throw new Error('Invalid data');
  return saved;
} catch {
  $('message').textContent = '저장된 기록을 읽지 못했습니다. 기존 데이터를 보호하기 위해 저장을 중지했습니다.';
  return null;
}
}
records = readLocal();
const cloud = window.journalCloud;
const allRecords = () => records || [];
const workout = window.createWorkoutJournal({getRecords:() => records, row:recordRow, onChange:render});
function selectView() {
  const requested = location.hash.slice(1);
  const view = requested === 'projects' ? 'library' : ['calendar','workout','library','connections'].includes(requested) ? requested : 'calendar';
  if (requested === 'projects') history.replaceState(null, '', location.pathname + location.search + '#library');
  document.querySelectorAll('.view').forEach(section => { section.hidden = section.id !== view; });
  document.body.dataset.view = view;
  const settings = document.querySelector('.settings-tab');
  settings.hidden = !['calendar','connections'].includes(view);
  settings.setAttribute('aria-pressed', String(view === 'connections'));
  document.title = ({calendar:'일정관리',workout:'운동계획',library:'자료 정리',connections:'캘린더 연동'})[view];
  if (view === 'library') { loadVersion++; $('import-bar').hidden = true; $('message').textContent = ''; }
  window.dispatchEvent(new CustomEvent('journal-view', {detail:view}));
}
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
  location.hash = button.dataset.tab;
}));
window.addEventListener('hashchange', selectView);
selectView();
window.lucide?.createIcons();
async function persist(next, record = null) {
  if (records === null) return false;
  const version = cloud?.version;
  if (cloud?.user) {
    try {
      if (record) await cloud.save(record);
      else await cloud.remove(editing);
      if (version !== cloud.version) return false;
      records = next;
      $('storage-status').textContent = `${cloud.user.email} · 온라인 저장됨`;
      return true;
    } catch(error) { $('form-error').textContent = window.cloudError(error); return false; }
  }
  try { localStorage.setItem(KEY, JSON.stringify(next)); records = next; return true; }
  catch { $('form-error').textContent = '저장 공간을 사용할 수 없습니다. 기록을 저장하지 못했습니다.'; return false; }
}
async function loadAccount() {
  const request = ++loadVersion;
  const version = cloud?.version;
  $('editor').close();
  records = null; render();
  const online = Boolean(cloud?.user);
  $('open-auth').hidden = online;
  $('sign-out').hidden = !online;
  $('refresh-records').hidden = !online;
  $('import-bar').hidden = true;
  $('message').textContent = '';
  $('storage-status').textContent = online ? `${cloud.user.email} · 기록 불러오는 중…` : '이 브라우저에 저장 · 로그인하면 온라인 저장';
  if (document.body.dataset.view === 'library') {
    records = []; render();
    $('storage-status').textContent = online ? `${cloud.user.email} · 온라인 저장` : '로그인 확인 중…';
    return;
  }
  if (!online) {records = readLocal();render();return;}
  try {
    const fetched = await cloud.list();
    if (request !== loadVersion || version !== cloud.version) return;
    records = fetched;
    $('storage-status').textContent = `${cloud.user.email} · 온라인 저장`;
    let local = [];
    try { local = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}
    $('import-bar').hidden = !Array.isArray(local) || !local.length;
  } catch(error) {
    if (request !== loadVersion || version !== cloud.version) return;
    $('message').textContent = window.cloudError(error);
    $('storage-status').textContent = `${cloud.user.email} · 온라인 기록 불러오기 실패`;
  }
  render();
}
window.addEventListener('journal-account', loadAccount);
$('refresh-records').addEventListener('click', () => {
  if (document.body.dataset.view === 'library') window.dispatchEvent(new Event('library-refresh'));
  else if (!busy) loadAccount();
});
window.addEventListener('journal-view', event => {
  if (event.detail !== 'library' && cloud?.ready && !busy) loadAccount();
});
$('import-local').addEventListener('click', async () => {
  if (!cloud?.user || records === null || busy) return;
  const local = readLocal();
  if (!local?.length) return;
  if (!confirm(`${cloud.user.email} 계정으로 브라우저 기록 ${local.length}개를 복사할까요?`)) return;
  busy = true; $('import-local').disabled = true;
  const version = cloud.version;
  try {
    await cloud.import(local);
    if (version !== cloud.version) return;
    await loadAccount();
    if (records !== null) $('message').textContent = '가져오기를 완료했습니다. 브라우저 원본은 유지됩니다.';
  } catch(error) {if (version === cloud.version) $('message').textContent = window.cloudError(error);}
  finally {busy = false;$('import-local').disabled = false;}
});
function make(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function recordRow(record) {
  const row = make('article', undefined, 'record');
  const info = make('div', undefined, 'record-info');
  info.append(make('h3', record.title));
  info.append(make('p', record.kind === 'event' ? (record.allDay ? '종일' : `${record.start}${record.end ? ' – '+record.end : ''}`) : `${record.date} · ${record.type} · ${record.duration}분`));
  if (record.kind === 'workout') info.append(make('p', window.workoutModel.done(record) ? '완료' : '예정'));
  if (record.notes) info.append(make('p', record.notes, 'notes'));
  const edit = make('button', '수정');
  edit.setAttribute('aria-label', `${record.title} 수정`);
  edit.addEventListener('click', () => openEditor(record.kind, record));
  if (record.kind === 'workout') {
    edit.textContent = ''; edit.title = '수정';
    const icon = make('i'); icon.dataset.lucide = 'pencil'; edit.append(icon);
    const actions = make('div', undefined, 'workout-record-actions');
    const completed = make('input'); completed.type = 'checkbox'; completed.checked = window.workoutModel.done(record);
    completed.disabled = busy || record.date > window.workoutModel.dayKey(new Date());
    completed.setAttribute('aria-label', `${record.title} 완료`);
    completed.title = record.date > window.workoutModel.dayKey(new Date()) ? '운동 날짜가 되면 완료할 수 있습니다.' : '완료';
    completed.addEventListener('change', async () => {
      if (busy || records === null) return;
      const updated = {...record, completed:completed.checked};
      busy = true; completed.disabled = true;
      const saved = await persist(allRecords().map(item => item.id === record.id ? updated : item), updated);
      busy = false;
      if (!saved) $('message').textContent = $('form-error').textContent || '완료 상태를 저장하지 못했습니다.';
      else $('message').textContent = '';
      render();
    });
    actions.append(completed, edit); row.append(info, actions);
  } else row.append(info, edit);
  return row;
}
function render() {
  $('month-title').textContent = `${month.getFullYear()}년 ${month.getMonth()+1}월`;
  const grid = $('month-grid'); grid.replaceChildren();
  const offset = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate();
  for (let i = 0; i < Math.ceil((offset+days)/7)*7; i++) {
    const day = i-offset+1;
    if (day < 1 || day > days) { grid.append(make('div', undefined, 'blank')); continue; }
    const key = dateKey(new Date(month.getFullYear(),month.getMonth(),day));
    const count = allRecords().filter(r => r.kind === 'event' && r.date === key).length + (window.googleCalendar?.eventsForDate(key).length || 0);
    const button = make('button', undefined, 'day');
    button.classList.toggle('selected', key === selected);
    button.classList.toggle('today', key === dateKey(new Date()));
    button.setAttribute('aria-pressed', String(key === selected));
    const tasks = window.dailyHistory?.counts(key);
    button.setAttribute('aria-label', `${key}, 일정 ${count}개${tasks?.total ? `, 할 일 ${tasks.completed}/${tasks.total}개 완료` : ''}`);
    button.dataset.date = key;
    button.append(make('span', String(day), 'day-number'), make('span', count ? `${count}건` : '', 'day-count'));
    if (tasks?.total) {
      const marker = make('span', `${tasks.completed}/${tasks.total}`, 'day-tasks');
      marker.title = `할 일 ${tasks.completed}/${tasks.total}개 완료`;
      const icon = make('i'); icon.dataset.lucide = 'list-checks'; marker.prepend(icon); button.append(marker);
    }
    button.addEventListener('click', () => { selectCalendarDate(key); window.dispatchEvent(new Event('journal-date-open')); });
    grid.append(button);
  }
  $('selected-date').textContent = `${Number(selected.slice(5,7))}월 ${Number(selected.slice(8))}일`;
  const events = allRecords().filter(r => r.kind === 'event' && r.date === selected).sort((a,b) => (a.start || '').localeCompare(b.start || ''));
  const googleEvents = window.googleCalendar?.eventsForDate(selected) || [];
  const eventRows = [...events.map(record => ({start:record.start || '',row:recordRow(record)})),...googleEvents.map(record => ({start:record.start.date ? '' : new Date(record.start.dateTime).toTimeString(),row:window.googleCalendar.recordRow(record)}))].sort((a,b)=>a.start.localeCompare(b.start));
  $('event-list').replaceChildren(...(eventRows.length ? eventRows.map(item=>item.row) : [make('p',records === null ? '기록을 아직 불러오지 못했습니다.' : '등록된 일정이 없습니다.','empty')]));
  workout.render();
  window.dispatchEvent(new Event('journal-calendar-range'));
}
function toggleTime() {
  for (const id of ['start-time','end-time']) $(id).disabled = $('all-day').checked;
  $('start-time').required = kind === 'event' && !$('all-day').checked;
}
function openEditor(type, record = null) {
  if (records === null || busy || (cloud && !cloud.ready)) return;
  editing = record?.id || null; kind = type;
  $('record-form').reset(); $('form-error').textContent = '';
  $('editor-title').textContent = `${type === 'event' ? '일정' : '운동 기록'} ${record ? '수정' : '추가'}`;
  $('name-label').textContent = type === 'event' ? '제목' : '운동 이름';
  $('event-fields').hidden = type !== 'event'; $('workout-fields').hidden = type !== 'workout';
  $('duration').required = type === 'workout';
  $('record-title').value = record?.title || (type === 'workout' ? '런닝' : '');
  $('record-date').value = record?.date || (type === 'event' ? selected : workout.selected());
  $('record-notes').value = record?.notes || '';
  $('start-time').value = record?.start || '09:00'; $('end-time').value = record?.end || '';
  $('all-day').checked = record?.allDay || false;
  workout.options(record?.type || '런닝', Boolean(record && type === 'workout'));
  $('workout-type').dataset.previous = $('workout-type').value;
  $('duration').value = record?.duration || 30;
  $('workout-completed').checked = record ? record.completed !== false : $('record-date').value <= window.workoutModel.dayKey(new Date());
  updateWorkoutCompletion();
  $('delete-record').hidden = !record;
  toggleTime(); $('editor').showModal(); $('record-title').focus();
}
$('all-day').addEventListener('change', toggleTime);
function updateWorkoutCompletion() {
  $('workout-completed').disabled = $('record-date').value > window.workoutModel.dayKey(new Date());
  if ($('workout-completed').disabled) $('workout-completed').checked = false;
}
$('record-date').addEventListener('change', updateWorkoutCompletion);
$('workout-type').addEventListener('change', () => {
  const field = $('workout-type');
  if (!$('record-title').value.trim() || $('record-title').value === field.dataset.previous) $('record-title').value = field.value;
  field.dataset.previous = field.value;
});
$('add-event').addEventListener('click', () => {
  if (window.googleCalendar?.openNew(selected)) return;
  openEditor('event');
});
$('add-workout').addEventListener('click', () => openEditor('workout'));
$('close-editor').addEventListener('click', () => $('editor').close());
$('record-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const title = $('record-title').value.trim();
  if (!title) { $('form-error').textContent = '이름을 입력해 주세요.'; return; }
  if (kind === 'event' && !$('all-day').checked && $('end-time').value && $('end-time').value <= $('start-time').value) {
    $('form-error').textContent = '종료 시간은 시작 시간 이후로 입력해 주세요.'; return;
  }
  const record = { id: editing || crypto.randomUUID(), kind, title, date: $('record-date').value, notes: $('record-notes').value.trim() };
  if (kind === 'event') Object.assign(record, {allDay:$('all-day').checked,start:$('all-day').checked?'':$('start-time').value,end:$('all-day').checked?'':$('end-time').value});
  else {
    if (!$('workout-type').value) {$('form-error').textContent = '운동 항목을 선택해 주세요.'; return;}
    Object.assign(record, {type:$('workout-type').value,duration:Number($('duration').value),completed:$('workout-completed').checked && record.date <= window.workoutModel.dayKey(new Date())});
  }
  const next = allRecords().filter(r => r.id !== editing).concat(record);
  busy = true; event.submitter.disabled = true;
  const saved = await persist(next, record);
  busy = false; event.submitter.disabled = false;
  if (!saved) return;
  if (kind === 'event') { selected = record.date; const [y,m] = selected.split('-').map(Number); month = new Date(y,m-1,1); }
  else workout.select(record.date);
  $('editor').close(); render();
});
$('delete-record').addEventListener('click', async () => {
  if (busy) return;
  if (!confirm('이 기록을 삭제할까요?')) return;
  busy = true; $('delete-record').disabled = true;
  if (await persist(allRecords().filter(r => r.id !== editing))) { $('editor').close(); render(); }
  busy = false; $('delete-record').disabled = false;
});
$('previous').addEventListener('click', () => {month = new Date(month.getFullYear(),month.getMonth()-1,1);selected=dateKey(month);render();});
$('next').addEventListener('click', () => {month = new Date(month.getFullYear(),month.getMonth()+1,1);selected=dateKey(month);render();});
$('today').addEventListener('click', () => {const now=new Date();selected=dateKey(now);month=new Date(now.getFullYear(),now.getMonth(),1);render();});
function selectCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2100-12-31') return false;
  const [year,monthNumber,day] = value.split('-').map(Number), date = new Date(year,monthNumber-1,day);
  if (dateKey(date) !== value) return false;
  selected = value; month = new Date(year,monthNumber-1,1); render(); return true;
}
window.journalCalendar = {render,selectDate:selectCalendarDate,range:()=>({start:new Date(month.getFullYear(),month.getMonth(),1).toISOString(),end:new Date(month.getFullYear(),month.getMonth()+1,1).toISOString(),month:dateKey(month).slice(0,7),selected})};
render();
if (!cloud || cloud.ready) loadAccount();
if (cloud?.ready) workout.ready();

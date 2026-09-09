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
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (!Array.isArray(saved) || saved.some(r => !r || typeof r.id !== 'string' || !['event','workout'].includes(r.kind) || typeof r.date !== 'string' || typeof r.title !== 'string')) throw new Error('Invalid data');
  records = saved;
} catch {
  $('message').textContent = '저장된 기록을 읽지 못했습니다. 기존 데이터를 보호하기 위해 저장을 중지했습니다.';
  records = null;
}
const allRecords = () => records || [];
$('workout-month').value = today.slice(0,7);
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach(tab => {
    const active = tab === button;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', String(active));
    $(tab.dataset.tab).hidden = !active;
  });
}));
function persist(next) {
  if (records === null) return false;
  try { localStorage.setItem(KEY, JSON.stringify(next)); records = next; return true; }
  catch { $('form-error').textContent = '저장 공간을 사용할 수 없습니다. 기록을 저장하지 못했습니다.'; return false; }
}
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
  if (record.notes) info.append(make('p', record.notes, 'notes'));
  const edit = make('button', '수정');
  edit.setAttribute('aria-label', `${record.title} 수정`);
  edit.addEventListener('click', () => openEditor(record.kind, record));
  row.append(info, edit);
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
    const count = allRecords().filter(r => r.kind === 'event' && r.date === key).length;
    const button = make('button', undefined, 'day');
    button.classList.toggle('selected', key === selected);
    button.classList.toggle('today', key === today);
    button.setAttribute('aria-pressed', String(key === selected));
    button.setAttribute('aria-label', `${key}, 일정 ${count}개`);
    button.append(make('span', String(day), 'day-number'), make('span', count ? `${count}건` : '', 'day-count'));
    button.addEventListener('click', () => { selected = key; render(); grid.querySelector(`[aria-label="${key}, 일정 ${count}개"]`)?.focus(); });
    grid.append(button);
  }
  $('selected-date').textContent = `${Number(selected.slice(5,7))}월 ${Number(selected.slice(8))}일`;
  const events = allRecords().filter(r => r.kind === 'event' && r.date === selected).sort((a,b) => (a.start || '').localeCompare(b.start || ''));
  $('event-list').replaceChildren(...(events.length ? events.map(recordRow) : [make('p','등록된 일정이 없습니다.','empty')]));
  const workouts = allRecords().filter(r => r.kind === 'workout' && r.date.startsWith($('workout-month').value)).sort((a,b) => b.date.localeCompare(a.date));
  $('workout-summary').textContent = `${workouts.length}회 · 총 ${workouts.reduce((sum,r) => sum+Number(r.duration),0)}분`;
  $('workout-list').replaceChildren(...(workouts.length ? workouts.map(recordRow) : [make('p','이번 달 운동 기록이 없습니다.','empty')]));
}
function toggleTime() {
  for (const id of ['start-time','end-time']) $(id).disabled = $('all-day').checked;
  $('start-time').required = kind === 'event' && !$('all-day').checked;
}
function openEditor(type, record = null) {
  if (records === null) return;
  editing = record?.id || null; kind = type;
  $('record-form').reset(); $('form-error').textContent = '';
  $('editor-title').textContent = `${type === 'event' ? '일정' : '운동 기록'} ${record ? '수정' : '추가'}`;
  $('name-label').textContent = type === 'event' ? '제목' : '운동 이름';
  $('event-fields').hidden = type !== 'event'; $('workout-fields').hidden = type !== 'workout';
  $('duration').required = type === 'workout';
  $('record-title').value = record?.title || '';
  $('record-date').value = record?.date || (type === 'event' ? selected : today);
  $('record-notes').value = record?.notes || '';
  $('start-time').value = record?.start || '09:00'; $('end-time').value = record?.end || '';
  $('all-day').checked = record?.allDay || false;
  $('workout-type').value = record?.type || '근력'; $('duration').value = record?.duration || 30;
  $('delete-record').hidden = !record;
  toggleTime(); $('editor').showModal(); $('record-title').focus();
}
$('all-day').addEventListener('change', toggleTime);
$('add-event').addEventListener('click', () => openEditor('event'));
$('add-workout').addEventListener('click', () => openEditor('workout'));
$('close-editor').addEventListener('click', () => $('editor').close());
$('record-form').addEventListener('submit', event => {
  event.preventDefault();
  const title = $('record-title').value.trim();
  if (!title) { $('form-error').textContent = '이름을 입력해 주세요.'; return; }
  if (kind === 'event' && !$('all-day').checked && $('end-time').value && $('end-time').value <= $('start-time').value) {
    $('form-error').textContent = '종료 시간은 시작 시간 이후로 입력해 주세요.'; return;
  }
  const record = { id: editing || crypto.randomUUID(), kind, title, date: $('record-date').value, notes: $('record-notes').value.trim() };
  if (kind === 'event') Object.assign(record, {allDay:$('all-day').checked,start:$('all-day').checked?'':$('start-time').value,end:$('all-day').checked?'':$('end-time').value});
  else Object.assign(record, {type:$('workout-type').value,duration:Number($('duration').value)});
  const next = allRecords().filter(r => r.id !== editing).concat(record);
  if (!persist(next)) return;
  if (kind === 'event') { selected = record.date; const [y,m] = selected.split('-').map(Number); month = new Date(y,m-1,1); }
  else $('workout-month').value = record.date.slice(0,7);
  $('editor').close(); render();
});
$('delete-record').addEventListener('click', () => {
  if (!confirm('이 기록을 삭제할까요?')) return;
  if (persist(allRecords().filter(r => r.id !== editing))) { $('editor').close(); render(); }
});
$('previous').addEventListener('click', () => {month = new Date(month.getFullYear(),month.getMonth()-1,1);render();});
$('next').addEventListener('click', () => {month = new Date(month.getFullYear(),month.getMonth()+1,1);render();});
$('today').addEventListener('click', () => {selected=today;month=new Date(new Date().getFullYear(),new Date().getMonth(),1);render();});
$('workout-month').addEventListener('change', () => {if (!$('workout-month').value) $('workout-month').value=today.slice(0,7);render();});
render();

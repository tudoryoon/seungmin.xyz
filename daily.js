import { validProfile } from './profile.js?v=20260912-9';
import { validAvatar } from './avatar.js?v=20260912-9';

const client = window.realmClient;
const panel = document.getElementById('daily-panel');
panel.innerHTML = `
  <header class="daily-heading"><div><p id="daily-date"></p><h2 id="daily-title" tabindex="-1">오늘 할 일</h2></div></header>
  <div class="daily-summary"><span id="daily-progress">0 / 0</span><span data-player-level>LV. …</span></div>
  <progress id="daily-meter" max="1" value="0" aria-label="오늘 완료한 할 일"></progress>
  <ul id="daily-list" class="daily-list"></ul>
  <form id="daily-form"><div id="daily-inputs"></div>
    <div class="daily-edit-tools"><button type="button" id="daily-add" class="daily-icon" title="할 일 추가" aria-label="할 일 추가"><i data-lucide="plus"></i></button><span id="daily-limit"></span></div>
    <div class="daily-actions"><button type="button" id="daily-cancel">취소</button><button type="submit" id="daily-save" class="daily-primary">저장</button></div>
  </form>
  <div id="daily-view-actions" class="daily-actions"><button type="button" id="daily-edit" class="daily-icon" title="할 일 수정" aria-label="할 일 수정"><i data-lucide="pencil"></i></button></div>
  <p id="daily-status" class="daily-status" role="status" aria-live="polite"></p>
  <div class="daily-error-row"><p id="daily-error" role="alert"></p><button type="button" id="daily-retry" class="daily-icon" title="다시 불러오기" aria-label="다시 불러오기" hidden><i data-lucide="refresh-cw"></i></button></div>`;
const $ = id => document.getElementById(id);
let user = null, epoch = 0, state = null, busy = false, loading = false, editing = false, dirty = false;
let draft = [], failure = '', notice = '', blocked = false, deadline = 0, timer = 0, lastRead = 0;
let logoutSnapshot = [];
let recovery = location.hash.includes('type=recovery') || new URLSearchParams(location.search).get('recovery') === '1';
let active = false;
const eligible = () => !!user && !recovery && validProfile(user.user_metadata?.realm_profile) && validAvatar(user.user_metadata?.realm_avatar)
  && !document.body.classList.contains('session-checking') && document.body.dataset.view === 'calendar';
function icons() { window.lucide?.createIcons(); }
function unlockLogout() { logoutSnapshot.forEach(([node,disabled]) => { node.disabled = disabled; }); logoutSnapshot = []; }
function level(value) { document.querySelectorAll('[data-player-level]').forEach(node => { node.textContent = 'LV. ' + value; }); }
function errorText(error) {
  const message = error?.message || '';
  if (message === 'POLICY_PENDING') return '자정 정산 설정을 아직 적용하지 못했습니다.';
  if (/DAY_CHANGED/.test(message)) return '날짜가 바뀌었습니다. 오늘 목록을 다시 불러와 주세요.';
  if (/PLAN_CHANGED|ALREADY_COMPLETED/.test(message)) return '다른 화면에서 목록이 변경되었습니다. 다시 불러와 주세요.';
  if (/INVALID_TASKS/.test(message)) return '할 일을 1~20개, 각 160자 이내로 적어 주세요.';
  if (/TASKS_REMAIN/.test(message)) return '아직 완료하지 않은 할 일이 있습니다.';
  if (error?.code === 'PGRST202' || /does not exist/.test(message)) return '오늘 할 일 저장소가 아직 준비되지 않았습니다.';
  return '저장 상태를 확인하지 못했습니다. 연결을 확인하고 다시 불러와 주세요.';
}
function controls() {
  const locked = busy || loading;
  panel.setAttribute('aria-busy', String(locked));
  panel.querySelectorAll('button,input').forEach(node => { node.disabled = locked; });
  $('daily-add').disabled = locked || draft.length >= 20;
  $('daily-save').disabled = locked || blocked || !state;
  $('daily-edit').disabled = locked || blocked || !state;
  panel.querySelectorAll('[data-task-check]').forEach(node => { node.disabled = locked || blocked; });
  $('daily-status').textContent = busy ? '저장 중…' : loading ? '불러오는 중…' : notice;
  $('daily-error').textContent = failure;
  $('daily-retry').hidden = !failure;
}
function render() {
  const tasks = state?.tasks || [], count = tasks.filter(task => task.completed).length;
  $('daily-date').textContent = state ? new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short'}).format(new Date(state.day + 'T00:00:00+09:00')) : '';
  $('daily-progress').textContent = `${count} / ${tasks.length}`;
  $('daily-meter').max = Math.max(1,tasks.length); $('daily-meter').value = count;
  $('daily-form').hidden = !editing || !state;
  $('daily-list').hidden = editing;
  $('daily-view-actions').hidden = editing || !state;
  $('daily-cancel').hidden = !state?.tasks.length;
  $('daily-limit').textContent = `${draft.length} / 20`;
  $('daily-list').replaceChildren(...tasks.map(task => {
    const li = document.createElement('li'), label = document.createElement('label'), input = document.createElement('input'), text = document.createElement('span');
    input.type = 'checkbox'; input.checked = task.completed; input.dataset.taskCheck = task.id;
    text.textContent = task.title; li.dataset.completed = String(task.completed);
    input.addEventListener('change', () => mutate('check', {p_task_id:task.id,p_completed:input.checked}, task.id));
    label.append(input,text); li.append(label); return li;
  }));
  $('daily-inputs').replaceChildren(...draft.map((task,index) => {
    const row = document.createElement('div'), input = document.createElement('input'), remove = document.createElement('button');
    row.className = 'daily-input-row'; input.type = 'text'; input.maxLength = 160; input.required = true; input.value = task.title;
    input.setAttribute('aria-label', `할 일 ${index+1}`); input.placeholder = `할 일 ${index+1}`; input.dataset.draftId = task.id;
    input.addEventListener('input', () => { task.title = input.value; dirty = true; });
    remove.type = 'button'; remove.className = 'daily-icon'; remove.title = '할 일 삭제'; remove.setAttribute('aria-label',`할 일 ${index+1} 삭제`);
    remove.innerHTML = '<i data-lucide="minus"></i>';
    remove.addEventListener('click', () => {
      if (draft.length === 1) { draft[0].title = ''; } else draft.splice(index,1);
      dirty = true; render(); $('daily-inputs').querySelectorAll('input')[Math.min(index,draft.length-1)]?.focus();
    });
    row.append(input,remove); return row;
  }));
  if (state) level(state.level);
  controls(); icons();
}
function startEdit() {
  editing = true; dirty = false;
  draft = state.tasks.length ? state.tasks.map(({id,title}) => ({id,title})) : [{id:crypto.randomUUID(),title:''}];
}
function accept(next) {
  if (next?.reward_policy !== 'kst_midnight') throw new Error('POLICY_PENDING');
  if (!next || !Array.isArray(next.tasks) || !Number.isSafeInteger(next.level) || next.level < 1
    || !Number.isSafeInteger(next.revision) || typeof next.awarded !== 'boolean'
    || !/^\d{4}-\d{2}-\d{2}$/.test(next.day) || !Number.isFinite(Date.parse(next.server_now)) || !Number.isFinite(Date.parse(next.ends_at))
    || next.tasks.some(task => typeof task.id !== 'string' || typeof task.title !== 'string' || typeof task.completed !== 'boolean')) throw new Error('INVALID_STATE');
  const increased = state && next.level > state.level;
  const previousLevel = state?.level;
  state = next; dirty = false; blocked = false; failure = '';
  notice = increased ? `LV. ${state.level} · 레벨 +${next.level - previousLevel}` : '';
  editing = !state.tasks.length;
  if (editing) startEdit(); else draft = [];
  deadline = performance.now() + Math.max(0, Date.parse(state.ends_at) - Date.parse(state.server_now));
  clearTimeout(timer); timer = setTimeout(() => refresh(), Math.max(1000,deadline-performance.now()+150));
  render();
  panel.classList.toggle('daily-awarded', !!increased);
}
function evaluate() {
  const entered = !active && eligible();
  active = eligible(); panel.hidden = !active;
  if (active && (entered || (!state && !loading && !failure))) refresh();
}
async function refresh(force = false) {
  if (!eligible() || loading || busy) return;
  if (dirty && !force) {
    if (deadline && performance.now() >= deadline) { failure = errorText({message:'DAY_CHANGED'}); blocked = true; controls(); }
    return;
  }
  const token = epoch; loading = true; controls();
  try {
    const {data,error} = await client.rpc('daily_plan_state');
    if (token !== epoch) return;
    if (error) throw error;
    accept(data); lastRead = performance.now();
  } catch (error) {
    if (token !== epoch) return;
    failure = errorText(error); blocked = true; render();
  } finally { if (token === epoch) { loading = false; controls(); evaluate(); } }
}
async function mutate(action, values = {}, focusId) {
  if (!eligible() || !state || busy || loading || blocked) return;
  const token = epoch; busy = true; failure = ''; notice = ''; controls();
  logoutSnapshot = [$('logout'),$('sign-out')].filter(Boolean).map(node => [node,node.disabled]);
  logoutSnapshot.forEach(([node]) => { node.disabled = true; });
  try {
    const {data,error} = await client.rpc('daily_plan_update', {p_day:state.day,p_revision:state.revision,p_action:action,...values});
    if (token !== epoch) return;
    if (error) throw error;
    accept(data);
  } catch (error) {
    if (token !== epoch) return;
    failure = errorText(error);
    // A failed response may still have committed. Reload before any subsequent write.
    blocked = true; render();
  } finally {
    if (token === epoch) {
      unlockLogout();
      busy = false; controls();
      if (eligible() && focusId) panel.querySelector(`[data-task-check="${focusId}"]`)?.focus();
    }
  }
}
$('daily-cancel').addEventListener('click',() => { if (dirty && !confirm('작성 중인 변경 내용을 버릴까요?')) return; editing = false; dirty = false; draft = []; render(); });
$('daily-add').addEventListener('click',() => { if (draft.length >= 20) return; draft.push({id:crypto.randomUUID(),title:''}); dirty = true; render(); $('daily-inputs').lastElementChild.querySelector('input').focus(); });
$('daily-edit').addEventListener('click',() => { startEdit(); render(); $('daily-inputs').querySelector('input').focus(); });
$('daily-form').addEventListener('submit',event => {
  event.preventDefault();
  if (!draft.length || draft.some(task => !task.title.trim())) { failure = errorText({message:'INVALID_TASKS'}); controls(); return; }
  mutate('save',{p_tasks:draft.map(task => ({id:task.id,title:task.title.trim()}))});
});
$('daily-retry').addEventListener('click',() => { if (dirty && !confirm('작성 중인 변경 내용을 버리고 다시 불러올까요?')) return; refresh(true); });
window.addEventListener('beforeunload',event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('journal-view',evaluate);
$('refresh-records').addEventListener('click',() => refresh());
new MutationObserver(() => evaluate()).observe(document.body,{attributes:true,attributeFilter:['data-view','class']});
const onReturn = () => { if (!document.hidden && (performance.now()-lastRead>1000 || performance.now()>=deadline)) refresh(); };
window.addEventListener('focus',onReturn); window.addEventListener('online',onReturn); document.addEventListener('visibilitychange',onReturn);
window.addEventListener('pageshow',event => {
  if (!event.persisted) return;
  evaluate(); refresh();
});
function account(next) {
  if (user?.id !== next?.id) {
    unlockLogout();
    epoch++; clearTimeout(timer); state = null; busy = false; loading = false; editing = false; dirty = false;
    draft = []; notice = ''; failure = ''; blocked = false; deadline = 0;
    active = false; panel.hidden = true; level(next ? '…' : 1); render();
  }
  user = next; setTimeout(evaluate,0);
}
client.auth.onAuthStateChange((event,session) => {
  if (event === 'PASSWORD_RECOVERY') recovery = true;
  account(session?.user || null);
});
const initialEpoch = epoch;
client.auth.getSession().then(({data,error}) => {
  if (!error && epoch === initialEpoch) account(data.session?.user || null);
}).catch(() => {});
render();

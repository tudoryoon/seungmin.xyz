export function createDailyHistory({panel, client, getUser, getState, isActive}) {
  const live = document.createElement('div'); live.id = 'daily-live';
  live.append(...panel.childNodes); panel.append(live);
  const history = document.createElement('div'); history.id = 'daily-history'; history.hidden = true;
  history.innerHTML = `<header class="daily-heading"><div><p id="daily-history-date"></p><h2 id="daily-history-title">할 일</h2></div></header>
    <p id="daily-history-progress" class="daily-summary"></p><ul id="daily-history-list" class="daily-list"></ul>
    <p id="daily-history-status" role="status"></p><button type="button" id="daily-history-retry" class="daily-icon" title="다시 불러오기" aria-label="지난 할 일 다시 불러오기" hidden><i data-lucide="refresh-cw"></i></button>`;
  panel.append(history);
  const $ = id => document.getElementById(id);
  let rows = [], key = '', epoch = 0, loading = false, failure = false;
  const selection = () => window.journalCalendar?.range();
  const tasksForDate = day => {
    const current = getState();
    if (current?.day === day) return current.tasks;
    return rows.filter(row => row.day === day).map(row => ({id:row.id,title:row.title,completed:row.completed_at !== null}));
  };
  function render() {
    const selected = selection()?.selected, current = getState();
    const isHistory = Boolean(selected && current && selected !== current.day);
    live.hidden = isHistory; history.hidden = !isHistory;
    panel.setAttribute('aria-labelledby', isHistory ? 'daily-history-title' : 'daily-title');
    if (!isHistory) return;
    const tasks = tasksForDate(selected);
    $('daily-history-date').textContent = selected.replaceAll('-', '.');
    $('daily-history-progress').textContent = loading || failure ? '' : `${tasks.filter(task => task.completed).length} / ${tasks.length}`;
    $('daily-history-status').textContent = loading ? '불러오는 중…' : failure ? '기록을 불러오지 못했습니다.' : tasks.length ? '' : '저장된 할 일이 없습니다.';
    $('daily-history-retry').hidden = !failure;
    $('daily-history-list').replaceChildren(...(loading || failure ? [] : tasks).map(task => {
      const item = document.createElement('li'), label = document.createElement('label'), checkbox = document.createElement('input'), title = document.createElement('span');
      checkbox.type = 'checkbox'; checkbox.checked = task.completed; checkbox.disabled = true;
      title.textContent = task.title; item.dataset.completed = String(task.completed);
      label.append(checkbox,title); item.append(label); return item;
    }));
    window.lucide?.createIcons();
  }
  async function sync(force = false) {
    render();
    const user = getUser(), range = selection();
    if (!isActive() || !user || !range?.month) return;
    const nextKey = `${user.id}:${range.month}`;
    if (key === nextKey && !force) return;
    key = nextKey; const token = ++epoch; rows = []; loading = true; failure = false; render();
    try {
      const [year,month] = range.month.split('-').map(Number);
      const end = new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
      const {data,error} = await client.from('daily_tasks').select('id,day,title,completed_at,position')
        .eq('user_id',user.id).gte('day',`${range.month}-01`).lt('day',end).order('day').order('position').limit(620);
      if (token !== epoch || getUser()?.id !== user.id) return;
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('INVALID_HISTORY');
      rows = data;
    } catch {
      if (token !== epoch) return;
      failure = true;
    } finally {
      if (token === epoch) {loading = false; render(); window.journalCalendar?.render();}
    }
  }
  function reset() {
    epoch++; key = ''; rows = []; loading = false; failure = false;
    history.hidden = true; live.hidden = false; $('daily-history-list').replaceChildren();
    $('daily-history-date').textContent = ''; $('daily-history-progress').textContent = ''; $('daily-history-status').textContent = '';
  }
  const counts = day => {
    const tasks = tasksForDate(day);
    return {total:tasks.length,completed:tasks.filter(task => task.completed).length};
  };
  window.dailyHistory = {counts};
  $('daily-history-retry').addEventListener('click', () => sync(true));
  window.addEventListener('journal-calendar-range', () => sync());
  return {sync,reset,render};
}

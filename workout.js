'use strict';
(() => {
  const defaults = ['런닝', '케틀벨 스윙', '푸시업', '스쿼트', '플랭크'];
  const targets = [['런닝', 2], ['케틀벨 스윙', 3], ['푸시업', 3]];
  const normalize = name => String(name || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  const identity = name => normalize(name).replace(/^러닝$/, '런닝').toLocaleLowerCase('ko');
  const dayKey = date => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const date = key => new Date(`${key}T12:00:00Z`);
  const shift = (key, days) => { const value = date(key); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
  const week = key => { const start = shift(key, -((date(key).getUTCDay() + 6) % 7)); return {start, end:shift(start, 6)}; };
  const done = (record, now = dayKey(new Date())) => record.completed !== false && record.date <= now;
  const types = (custom = []) => {
    const result = [...defaults];
    for (const value of Array.isArray(custom) ? custom : []) {
      if (typeof value !== 'string') continue;
      const name = normalize(value);
      if (name && name.length <= 40 && !result.some(item => identity(item) === identity(name))) result.push(name);
      if (result.length >= 35) break;
    }
    return result;
  };
  const progress = (records, key, now = dayKey(new Date())) => {
    const {start, end} = week(key);
    return targets.map(([type, target]) => ({type, target, count:records.filter(record => record.kind === 'workout' && record.date >= start && record.date <= end && done(record, now) && identity(record.type) === identity(type)).length}));
  };
  window.workoutModel = {defaults, types, identity, normalize, dayKey, shift, week, done, progress};
  window.createWorkoutJournal = ({getRecords, row, onChange}) => {
    const $ = id => document.getElementById(id);
    const cloud = window.journalCloud;
    let selected = dayKey(new Date()), month = selected.slice(0, 7);
    let custom = [], owner, request = 0, saving = false;
    const localKey = 'seungmin-workout-types-v1';
    const make = (tag, text, className) => {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    };
    function account() {
      const id = cloud?.user?.id || null;
      if (id === owner) return;
      owner = id; request++; custom = [];
      $('workout-type-dialog').close();
      if (id) custom = cloud.user.user_metadata?.workout_types || [];
      else { try { custom = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch {} }
    }
    function options(value = defaults[0], legacy = false) {
      account();
      const available = types(custom);
      const equivalent = available.find(name => identity(name) === identity(value));
      // Keep a legacy record's exact category when editing, without restoring old defaults.
      if (legacy && !available.includes(value)) available.push(value);
      $('workout-type').replaceChildren(...available.map(name => {const option = make('option', name); option.value = name; return option;}));
      $('workout-type').value = legacy ? value : equivalent || available[0];
    }
    async function refreshTypes() {
      account();
      if (!cloud?.user || document.body.dataset.view !== 'workout') return;
      const id = owner, version = cloud.version, current = ++request;
      try {
        const {data, error} = await cloud.client.auth.getUser();
        if (error || data?.user?.id !== id || current !== request || version !== cloud.version) return;
        custom = data.user.user_metadata?.workout_types || [];
      } catch { /* Existing choices remain available when the network is unavailable. */ }
    }
    function render() {
      account();
      const records = getRecords(), workouts = (records || []).filter(item => item.kind === 'workout');
      const now = dayKey(new Date()), range = week(selected);
      const [year, number] = month.split('-').map(Number);
      $('workout-month-title').textContent = `${year}년 ${number}월`;
      const offset = date(`${month}-01`).getUTCDay(), days = new Date(Date.UTC(year, number, 0)).getUTCDate();
      const grid = $('workout-grid'); grid.replaceChildren();
      grid.setAttribute('aria-busy', String(records === null));
      for (let index = 0; index < Math.ceil((offset + days) / 7) * 7; index++) {
        const day = index - offset + 1;
        if (day < 1 || day > days) {grid.append(make('div', undefined, 'blank')); continue;}
        const key = `${month}-${String(day).padStart(2, '0')}`, entries = workouts.filter(item => item.date === key);
        const completed = entries.filter(item => done(item, now)).length;
        const button = make('button', undefined, 'day'); button.dataset.date = key;
        button.classList.toggle('today', key === now); button.classList.toggle('selected', key === selected);
        button.classList.toggle('in-week', key >= range.start && key <= range.end);
        button.setAttribute('aria-pressed', String(key === selected));
        button.setAttribute('aria-label', `${key}, 운동 ${entries.length}개, 완료 ${completed}개`);
        const marks = make('span', undefined, 'day-count'); marks.setAttribute('aria-hidden', 'true');
        for (const item of entries.slice(0, 3)) marks.append(make('span', undefined, `workout-dot${done(item, now) ? '' : ' planned'}`));
        if (entries.length > 3) marks.append(make('span', `+${entries.length - 3}`));
        button.append(make('span', String(day), 'day-number'), marks);
        button.addEventListener('click', () => {selected = key; render(); grid.querySelector(`[data-date="${key}"]`)?.focus();});
        grid.append(button);
      }
      const monthly = workouts.filter(item => item.date.startsWith(month));
      const completed = monthly.filter(item => done(item, now));
      $('workout-summary').textContent = records === null ? '불러오는 중…' : `완료 ${completed.length}회 · ${completed.reduce((sum, item) => sum + (Number(item.duration) || 0), 0)}분 · 예정 ${monthly.length - completed.length}회`;
      $('workout-selected-date').textContent = `${Number(selected.slice(5, 7))}월 ${Number(selected.slice(8))}일`;
      const entries = workouts.filter(item => item.date === selected);
      $('workout-list').replaceChildren(...(entries.length ? entries.map(row) : [make('p', records === null ? '기록을 불러오는 중입니다.' : '등록된 운동이 없습니다.', 'empty')]));
      $('workout-week-range').textContent = `${range.start.replaceAll('-', '.')} ~ ${range.end.slice(5).replace('-', '.')} · 월–일`;
      $('workout-goals').replaceChildren(...progress(workouts, selected, now).map(goal => {
        const item = make('div', undefined, 'workout-goal'), heading = make('div', undefined, 'workout-goal-heading');
        heading.append(make('strong', goal.type), make('span', records === null ? `— / ${goal.target}회` : `${goal.count} / ${goal.target}회`));
        const bar = make('progress'); bar.max = goal.target; bar.value = records === null ? 0 : Math.min(goal.count, goal.target);
        bar.setAttribute('aria-label', `${goal.type} 주간 완료 ${records === null ? '확인 중' : goal.count}회, 목표 ${goal.target}회`);
        item.append(heading, bar); return item;
      }));
      window.lucide?.createIcons();
    }
    function moveMonth(delta) {
      const [year, number] = month.split('-').map(Number);
      month = new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7);
      selected = month + '-01'; render();
    }
    $('workout-previous').addEventListener('click', () => moveMonth(-1));
    $('workout-next').addEventListener('click', () => moveMonth(1));
    $('workout-today').addEventListener('click', () => {selected = dayKey(new Date()); month = selected.slice(0, 7); render();});
    function openTypes() {
      account(); if (saving || (cloud && !cloud.ready)) return;
      $('workout-type-form').reset(); $('workout-type-error').textContent = '';
      $('workout-type-dialog').showModal(); $('new-workout-type').focus();
    }
    $('add-workout-type').addEventListener('click', openTypes);
    $('editor-add-workout-type').addEventListener('click', openTypes);
    $('close-workout-type').addEventListener('click', () => {if (!saving) $('workout-type-dialog').close();});
    $('workout-type-dialog').addEventListener('cancel', event => {if (saving) event.preventDefault();});
    $('workout-type-form').addEventListener('submit', async event => {
      event.preventDefault(); if (saving) return;
      account(); const id = owner, version = cloud?.version;
      const name = normalize($('new-workout-type').value);
      if (!name || name.length > 40) {$('workout-type-error').textContent = '운동 이름을 1~40자로 입력해 주세요.'; return;}
      saving = true; $('save-workout-type').disabled = true; $('workout-type-error').textContent = '';
      const currentAccount = () => owner === id && version === cloud?.version;
      try {
        let latest = custom;
        if (id) {
          const {data, error} = await cloud.client.auth.getUser();
          if (error) throw error;
          if (!currentAccount() || data?.user?.id !== id) return;
          latest = data.user.user_metadata?.workout_types || [];
        }
        const available = types(latest);
        if (available.some(value => identity(value) === identity(name))) throw new Error('이미 있는 운동 항목입니다.');
        if (available.length >= 35) throw new Error('추가 운동은 최대 30개까지 저장할 수 있습니다.');
        const next = available.slice(defaults.length).concat(name);
        if (id) {
          const {data, error} = await cloud.client.auth.updateUser({data:{workout_types:next}});
          if (error) throw error;
          if (!currentAccount() || data?.user?.id !== id) return;
          cloud.user = data.user;
        } else localStorage.setItem(localKey, JSON.stringify(next));
        if (!currentAccount()) return;
        custom = next; request++;
        if ($('editor').open && !$('workout-fields').hidden) {options(name); $('workout-type').dispatchEvent(new Event('change'));}
        $('workout-type-dialog').close(); onChange();
      } catch (error) {
        if (currentAccount()) $('workout-type-error').textContent = ['이미 있는 운동 항목입니다.', '추가 운동은 최대 30개까지 저장할 수 있습니다.'].includes(error.message) ? error.message : '항목을 저장하지 못했습니다. 다시 시도해 주세요.';
      } finally {saving = false; $('save-workout-type').disabled = false;}
    });
    window.addEventListener('journal-account', () => {account(); refreshTypes();});
    window.addEventListener('journal-view', refreshTypes);
    $('refresh-records').addEventListener('click', refreshTypes);
    document.addEventListener('visibilitychange', () => {if (!document.hidden && document.body.dataset.view === 'workout') {render(); refreshTypes();}});
    return {render, options, selected:() => selected, select(key) {selected = key; month = key.slice(0, 7);}, ready:refreshTypes};
  };
})();

'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const notebook = $('schedule-notebook'), book = $('notebook-book');
  const workspace = $('calendar-workspace'), agenda = document.querySelector('#calendar .day-agenda'), tasks = $('daily-panel');
  const agendaHome = agenda.parentElement, tasksHome = tasks.parentElement;
  const soundKey = 'journal-page-sound-v1';
  const audio = $('notebook-audio');
  audio.volume = 0.4;
  let opened = false, soundEnabled = true, flipTimer = 0, touch = null, filtersOpen = false;
  document.querySelector('.notebook-binding').replaceChildren(...Array.from({length:13}, () => document.createElement('span')));
  try { soundEnabled = localStorage.getItem(soundKey) !== 'off'; } catch {}
  const selection = () => window.journalCalendar.range().selected;
  const localToday = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  };
  function soundState() {
    $('notebook-sound').setAttribute('aria-pressed', String(soundEnabled));
    $('notebook-sound').innerHTML = `<i data-lucide="${soundEnabled ? 'volume-2' : 'volume-x'}"></i>`;
    window.lucide?.createIcons();
  }
  function playSound() {
    if (!soundEnabled) return;
    try {
      audio.currentTime = 0;
      const started = audio.play();
      started?.catch(() => {});
    } catch { /* Audio support must never block date navigation. */ }
  }
  function sync() {
    const day = selection(), date = new Date(day + 'T12:00:00');
    $('notebook-day').textContent = String(date.getDate()).padStart(2,'0');
    $('notebook-date').textContent = new Intl.DateTimeFormat('ko-KR', {year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(date);
    $('notebook-date-picker').value = day;
    $('notebook-previous').disabled = day <= '1900-01-01';
    $('notebook-next').disabled = day >= '2100-12-31';
  }
  function show(value, focus = false) {
    if (value && !opened) { filtersOpen = $('google-visibility').open; $('google-visibility').open = false; }
    else if (!value && opened) $('google-visibility').open = filtersOpen;
    opened = value; document.body.dataset.scheduleMode = value ? 'notebook' : 'calendar';
    // Move the original views, preserving their handlers, drafts and account isolation.
    (value ? $('notebook-agenda-slot') : agendaHome).append(agenda);
    (value ? $('notebook-tasks-slot') : tasksHome).append(tasks);
    workspace.hidden = value; notebook.hidden = !value;
    $('calendar-mode').setAttribute('aria-pressed', String(!value));
    $('notebook-mode').setAttribute('aria-pressed', String(value));
    sync();
    if (focus) {
      if (value) { $('notebook-date').focus({preventScroll:true}); notebook.scrollIntoView({block:'start',behavior:'instant'}); }
      else $('month-grid').querySelector(`[data-date="${selection()}"]`)?.focus({preventScroll:true});
    }
  }
  function turnTo(day) {
    if (!opened || flipTimer || day === selection()) return;
    const direction = day > selection() ? 'next' : 'previous';
    if (!window.journalCalendar.selectDate(day)) return;
    playSound();
    $('notebook-announcement').textContent = $('notebook-date').textContent;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    book.dataset.turn = direction;
    flipTimer = window.setTimeout(() => { delete book.dataset.turn; flipTimer = 0; }, 460);
  }
  function turn(offset) {
    const date = new Date(selection() + 'T12:00:00'); date.setDate(date.getDate() + offset);
    turnTo(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`);
  }
  function page(name, focus = false) {
    book.dataset.page = name;
    for (const key of ['agenda','tasks']) {
      const tab = $(`notebook-${key}-tab`), active = key === name;
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
      if (focus && active) tab.focus();
    }
  }
  $('calendar-mode').addEventListener('click', () => show(false, true));
  $('notebook-calendar').addEventListener('click', () => { show(false, true); $('calendar').scrollIntoView({block:'start',behavior:'instant'}); });
  $('notebook-mode').addEventListener('click', () => show(true, true));
  window.addEventListener('journal-date-open', () => show(true, true));
  window.addEventListener('journal-calendar-range', sync);
  $('notebook-previous').addEventListener('click', () => turn(-1));
  $('notebook-next').addEventListener('click', () => turn(1));
  $('notebook-today').addEventListener('click', () => turnTo(localToday()));
  $('notebook-date-picker').addEventListener('change', event => { turnTo(event.target.value); sync(); });
  $('notebook-sound').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    if (!soundEnabled && audio) audio.pause();
    try { localStorage.setItem(soundKey, soundEnabled ? 'on' : 'off'); } catch {}
    soundState();
  });
  for (const key of ['agenda','tasks']) {
    const tab = $(`notebook-${key}-tab`);
    tab.addEventListener('click', () => page(key));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault(); page(event.key === 'Home' ? 'agenda' : event.key === 'End' ? 'tasks' : key === 'agenda' ? 'tasks' : 'agenda', true);
    });
  }
  book.addEventListener('keydown', event => {
    if (event.target !== book || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault(); turn(event.key === 'ArrowLeft' ? -1 : 1);
  });
  book.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || !event.isPrimary || event.target.closest('input,textarea,select,button,a,[contenteditable]')) { touch = null; return; }
    touch = {id:event.pointerId,x:event.clientX,y:event.clientY};
  });
  book.addEventListener('pointerup', event => {
    const start = touch; touch = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX-start.x, dy = event.clientY-start.y;
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy)*1.6) turn(dx < 0 ? 1 : -1);
  });
  book.addEventListener('pointercancel', () => { touch = null; });
  window.addEventListener('journal-account', () => { if (!window.journalCloud?.user) { show(false); audio?.pause(); } });
  window.addEventListener('journal-view', event => { if (event.detail !== 'calendar') audio.pause(); });
  soundState(); sync();
})();

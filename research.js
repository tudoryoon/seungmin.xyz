import { createResearchIndex, filterRecords, relatedRecords, recordDate, readResearchRoute, researchHref, KIND_LABELS, safeSourceURL } from './research-core.js?v=20260927-1';
import { kstTimestamp, mergeNotionBodies, rebuildNotionRelations } from './research-sync-core.js?v=20260928-1';
import { renderNotionMarkdown } from './research-markdown.js?v=20260927-3';

export function createResearch(root, { data, loadGraph = () => import('./vendor/cytoscape.mjs'), onLock = () => {} } = {}) {
  let index = createResearchIndex(data);
  const document = root.ownerDocument, window = document.defaultView;
  const $ = id => root.querySelector('#' + id);
  let state = readResearchRoute(window.location.hash, index), mobile = window.location.hash.includes('note=') ? 'record' : 'list', cy = null, graphEpoch = 0, destroyed = false;
  const listeners = [];
  function listen(target, type, handler) { target.addEventListener(type, handler); listeners.push(() => target.removeEventListener(type, handler)); }
  function element(tag, className, text) {
    const node = document.createElement(tag); if (className) node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  }
  function icon(name) { const node = element('i'); node.dataset.lucide = name; node.setAttribute('aria-hidden', 'true'); return node; }
  function icons() { window.lucide?.createIcons({ root }); }
  function scrollWithin(container, target) {
    if (container && target) container.scrollTop += target.getBoundingClientRect().top - container.getBoundingClientRect().top - 18;
  }
  function external(label, url) {
    const link = element('a', 'research-source', label); const safe = safeSourceURL(url);
    if (safe) { link.href = safe; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    link.append(icon('arrow-up-right')); return link;
  }
  function navigate(changes, replace = false) {
    state = { ...state, section: '', ...changes };
    const href = researchHref(state);
    if (window.location.hash !== href) window.history[replace ? 'replaceState' : 'pushState'](null, '', href);
    render();
  }
  function openRecord(id, section = '') {
    const visible = filterRecords(index, state).some(r => r.id === id);
    mobile = 'record';
    navigate({ note: id, section, ...(section ? { view: 'read' } : {}), ...(visible ? {} : { query: '', entity: '', month: '' }) });
    if (section) scrollWithin($('research-reader'), $(`research-section-${section}`));
    else $('research-record-title')?.focus({ preventScroll: true });
  }
  function recordLink(record, className = '') {
    const a = element('a', className, record.title); a.href = researchHref({ note: record.id }); a.dataset.record = record.id;
    a.addEventListener('click', event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); openRecord(record.id);
    }); return a;
  }

  root.innerHTML = `
    <header class="research-heading"><div class="research-heading-title"><h2 id="research-title">Research</h2><span id="research-total"></span></div><div class="research-edition"><span>초안 01</span><button type="button" id="research-lock" class="icon-button" title="Research 잠그기" aria-label="Research 잠그기"><i data-lucide="lock-keyhole" aria-hidden="true"></i></button></div></header>
    <div class="research-toolbar">
      <label class="research-search"><i data-lucide="search" aria-hidden="true"></i><span class="sr-only">기록 검색</span><input id="research-query" type="search" placeholder="기록, 기업, 질문 검색" maxlength="120" autocomplete="off"></label>
      <select id="research-month" aria-label="기록 월"><option value="">모든 날짜</option></select>
      <select id="research-entity" aria-label="주제와 기업"><option value="">모든 주제</option></select>
      <button id="research-reset" class="icon-button" type="button" title="검색과 필터 초기화" aria-label="검색과 필터 초기화"><i data-lucide="rotate-ccw" aria-hidden="true"></i></button>
      <div class="research-view" role="group" aria-label="보기"><button type="button" data-research-view="read" aria-pressed="true"><i data-lucide="book-open" aria-hidden="true"></i>기록</button><button type="button" data-research-view="graph" aria-pressed="false"><i data-lucide="git-fork" aria-hidden="true"></i>연결</button></div>
    </div>
    <nav class="research-mobile-nav" aria-label="Research 패널"><button type="button" data-research-panel="list" aria-pressed="true">목록</button><button type="button" data-research-panel="record" aria-pressed="false">본문</button><button type="button" data-research-panel="context" aria-pressed="false">관련 기록</button></nav>
    <div class="research-layout">
      <aside class="research-index research-scroll" aria-label="날짜별 기록"><div class="research-index-heading"><h3>기록</h3><span id="research-count" role="status"></span></div><div id="research-list"></div><p id="research-empty" class="research-empty" hidden>일치하는 기록이 없습니다.</p></aside>
      <div class="research-main"><article id="research-reader" class="research-reader research-scroll" aria-labelledby="research-record-title"></article><section id="research-graph-view" class="research-graph-view" aria-label="기록 관계망" hidden><header class="research-graph-heading"><div><span class="research-eyebrow">연결</span><h3 id="research-graph-title"></h3></div><div class="research-graph-tools"><button type="button" id="research-zoom-out" class="icon-button" title="관계망 축소" aria-label="관계망 축소"><i data-lucide="minus" aria-hidden="true"></i></button><button type="button" id="research-zoom-in" class="icon-button" title="관계망 확대" aria-label="관계망 확대"><i data-lucide="plus" aria-hidden="true"></i></button><button type="button" id="research-fit" class="icon-button" title="관계망 전체 보기" aria-label="관계망 전체 보기"><i data-lucide="maximize" aria-hidden="true"></i></button></div></header><div id="research-graph" class="research-graph" role="img" aria-label="선택한 기록과 관련 기록의 관계망"></div><p id="research-graph-status" role="status"></p><nav id="research-graph-links" aria-label="관계망의 기록"></nav><div class="research-legend"><span>기록 기반</span><span>연결 제안</span></div></section><p id="research-main-empty" class="research-empty" hidden>다른 검색어 또는 주제를 선택해 주세요.</p></div>
      <aside class="research-context research-scroll" aria-label="관련 기록과 근거"><div class="research-context-heading"><h3>관련 기록</h3><label class="research-suggestions"><input id="research-suggestions" type="checkbox" checked>제안 포함</label></div><div id="research-relations"></div></aside>
    </div>
    <footer class="research-footer"><span id="research-snapshot-label"></span><span id="research-sync-status" role="status"></span></footer>`;
  function refreshMetadata() {
    root.querySelector('.research-edition > span').hidden = data.mode === 'notion-live';
    $('research-total').textContent = String(index.records.size).padStart(2, '0');
    $('research-snapshot-label').textContent = data.mode === 'notion-live' ? 'Notion · ' + kstTimestamp(data.syncedAt) + ' KST' : 'Notion 검토본 · ' + data.capturedAt.replaceAll('-', '.');
    $('research-sync-status').textContent = data.mode === 'notion-live' ? '자동 동기화 · 생성일 기준' : '원문 요약 · 자동 동기화 미연결';
    $('research-month').replaceChildren(element('option', '', '모든 날짜')); $('research-month').firstChild.value = '';
    $('research-entity').replaceChildren(element('option', '', '모든 주제')); $('research-entity').firstChild.value = '';
    const months = [...new Set(data.records.map(r => r.date.start?.slice(0, 7)).filter(Boolean))].sort().reverse();
    for (const month of months) { const o = element('option', '', month.replace('-', '.')); o.value = month; $('research-month').append(o); }
    const undated = element('option', '', '날짜 미지정'); undated.value = 'undated'; $('research-month').append(undated);
    for (const entity of data.entities) { const o = element('option', '', entity.name); o.value = entity.id; $('research-entity').append(o); }
  }
  refreshMetadata();

  function renderList(records) {
    const groups = new Map();
    for (const record of records) {
      const key = record.date.precision === 'unknown' ? '날짜 미지정' : record.date.start.slice(0, 7).replace('-', '.');
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(record);
    }
    const nodes = [];
    for (const [month, items] of groups) {
      const group = element('section', 'research-date-group'), heading = element('h4', '', month), list = element('ul');
      for (const record of items) {
        const li = element('li'), a = recordLink(record, 'research-record-link');
        a.replaceChildren();
        const meta = element('span', 'research-record-meta', (record.date.precision === 'unknown' ? KIND_LABELS[record.kind] : recordDate(record, true) + ' · ' + KIND_LABELS[record.kind]));
        a.append(meta, element('span', 'research-record-name', record.title));
        if (record.id === state.note) a.setAttribute('aria-current', 'true');
        li.append(a); list.append(li);
      }
      group.append(heading, list); nodes.push(group);
    }
    $('research-list').replaceChildren(...nodes); $('research-empty').hidden = !!records.length;
    $('research-count').textContent = records.length + ' / ' + index.records.size;
  }

  function renderReader(record) {
    const header = element('header', 'research-record-heading');
    const meta = element('div', 'research-meta'); meta.append(element('span', 'research-kind', KIND_LABELS[record.kind]), element('span', '', recordDate(record)), element('span', 'research-state', record.state));
    const title = element('h3', '', record.title); title.id = 'research-record-title'; title.tabIndex = -1;
    const tags = element('div', 'research-tags');
    for (const id of record.entities) {
      const entity = index.entities.get(id), button = element('button', 'research-tag', entity.name); button.type = 'button'; button.dataset.type = entity.type;
      button.title = `${entity.name} 관련 기록`; button.addEventListener('click', () => { mobile = 'list'; navigate({ entity: id, query: '', month: '' }); }); tags.append(button);
    }
    header.append(meta, title);
    if (record.summary) header.append(element('p', 'research-summary', record.summary));
    header.append(tags);
    if (record.source.createdAt) {
      const dates = element('div', 'research-source-dates');
      dates.append(element('span', '', '작성 ' + kstTimestamp(record.source.createdAt) + ' KST'), element('span', '', '수정 ' + kstTimestamp(record.source.editedAt) + ' KST'));
      if (record.studyDate) dates.append(element('span', '', '제목 날짜 ' + record.studyDate.replaceAll('-', '.')));
      header.append(dates);
    }
    const question = element('section', 'research-question'); question.append(element('h4', '', '질문'), element('p', '', record.question));
    const sections = record.sections.map(section => {
      const node = element('section', 'research-section'); node.id = 'research-section-' + section.id;
      if (state.section === section.id) node.classList.add('is-evidence');
      node.append(element('h4', '', section.label));
      if (section.markdown) { const body = element('div', 'research-notion-body'); body.append(renderNotionMarkdown(section.markdown, document)); node.append(body); }
      else if (section.text) node.append(element('p', '', section.text));
      if (section.items) { const ul = element('ul'); for (const item of section.items) ul.append(element('li', '', item)); node.append(ul); }
      if (section.note) node.append(element('p', 'research-note', section.note));
      return node;
    });
    const openQuestions = element('section', 'research-open-questions'); openQuestions.append(element('h4', '', '남은 질문'));
    for (const text of record.questions) openQuestions.append(element('p', '', text));
    const provenance = element('footer', 'research-provenance');
    provenance.append(element('p', '', record.path.join(' / ')), external('Notion 원문', record.source.url));
    for (const ref of record.references || []) provenance.append(external(ref.label, ref.url));
    provenance.append(element('p', 'research-date-basis', '날짜 기준 · ' + record.date.basis));
    if (record.event) provenance.append(element('p', 'research-date-basis', record.event.label + ' · ' + record.event.date.replaceAll('-', '.')));
    if (record.dateNote) provenance.append(element('p', 'research-note', record.dateNote));
    provenance.append(element('p', 'research-date-basis', data.mode === 'notion-live' ? 'Notion 원문 · 생성일과 실제 공부 날짜는 다를 수 있습니다.' : '원문을 바탕으로 재구성한 요약입니다. Notion 원문은 접근 권한이 필요할 수 있습니다.'));
    $('research-reader').replaceChildren(header, ...(record.question ? [question] : []), ...sections, ...(record.questions.length ? [openQuestions] : []), provenance);
    $('research-reader').scrollTop = 0;
  }

  function renderRelations(record) {
    const items = relatedRecords(index, record.id, state.suggestions);
    const nodes = items.map(({ relation, record: other }) => {
      const node = element('section', 'research-relation'); node.id = 'research-relation-' + relation.id;
      node.dataset.status = relation.status;
      const classification = element('div', 'research-relation-label');
      classification.append(element('span', '', relation.label), element('span', 'research-relation-status', relation.status === 'suggested' ? '연결 제안' : '기록 기반'));
      const details = element('details', 'research-evidence'); const summary = element('summary', '', relation.overlap ? `겹치는 구절 ${relation.overlap.passages}개` : '근거 ' + relation.evidence.length);
      details.append(summary);
      for (const excerpt of relation.overlap?.excerpts || []) details.append(element('blockquote', 'research-overlap-excerpt', excerpt));
      for (const evidence of relation.evidence) {
        const source = index.records.get(evidence.record), section = source.sections.find(s => s.id === evidence.section);
        const a = element('a', '', source.title + ' · ' + section.label); a.href = researchHref({ note: source.id, section: section.id });
        a.addEventListener('click', event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); openRecord(source.id, section.id); });
        details.append(a);
      }
      node.append(classification, recordLink(other, 'research-related-title'), element('p', '', relation.reason), details);
      return node;
    });
    if (!nodes.length) nodes.push(element('p', 'research-empty', '표시할 연결이 없습니다.'));
    $('research-relations').replaceChildren(...nodes);
    $('research-graph-links').replaceChildren(...[record, ...items.map(item => item.record)].map(r => recordLink(r, 'research-graph-link')));
  }

  function stopGraph() { graphEpoch++; cy?.destroy(); cy = null; }
  function fitGraph() {
    if (!cy) return;
    cy.resize(); cy.fit(undefined, 38);
    if (cy.zoom() > 1.25) { cy.zoom(1.25); cy.center(); }
  }
  async function renderGraph(record) {
    stopGraph(); const epoch = graphEpoch;
    $('research-graph-title').textContent = record.title;
    $('research-graph-status').textContent = '관계망 불러오는 중…';
    try {
      const { default: cytoscape } = await loadGraph();
      if (destroyed || epoch !== graphEpoch || root.hidden || state.view !== 'graph') return;
      const neighbors = relatedRecords(index, record.id, state.suggestions);
      const nodes = [record, ...neighbors.map(n => n.record)];
      cy = cytoscape({
        container: $('research-graph'), minZoom: .45, maxZoom: 2.5,
        elements: [
          ...nodes.map(r => ({ data: { id: r.id, label: r.title.replace(' · ', '\n'), kind: r.kind }, classes: r.id === record.id ? 'focus' : '' })),
          ...neighbors.map(({ relation: r }) => ({ data: { id: r.id, source: r.from, target: r.to, label: r.label }, classes: r.status }))
        ],
        style: [
          { selector: 'node', style: { 'background-color': '#c0c7c1', 'border-color': '#323e37', 'border-width': 8, width: 20, height: 20, label: 'data(label)', color: '#cbd3ce', 'font-size': 14, 'font-family': 'system-ui, sans-serif', 'text-wrap': 'wrap', 'text-max-width': 120, 'text-valign': 'bottom', 'text-margin-y': 14, 'text-background-color': '#101513', 'text-background-opacity': .94, 'text-background-padding': 4 } },
          { selector: 'node[kind = "study"]', style: { 'background-color': '#c2afde' } },
          { selector: 'node[kind = "earnings"]', style: { 'background-color': '#dfbd82' } },
          { selector: 'node[kind = "diary"]', style: { 'background-color': '#dcaa9e' } },
          { selector: 'node.focus', style: { 'background-color': '#a1e2bf', width: 30, height: 30, 'border-width': 12, 'border-color': '#244336', color: '#eff5ef', 'font-weight': 600 } },
          { selector: 'edge', style: { width: 1.3, 'line-color': '#739782', 'curve-style': 'bezier', label: 'data(label)', 'font-family': 'system-ui, sans-serif', 'font-size': 10, color: '#9ab4a4', 'text-background-color': '#101513', 'text-background-opacity': 1, 'text-background-padding': 5, 'text-rotation': 'autorotate', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#739782', 'arrow-scale': .65 } },
          { selector: 'edge.suggested', style: { 'line-style': 'dashed', 'line-color': '#96867a', 'target-arrow-shape': 'none', color: '#c3ad98' } },
          { selector: 'edge:selected', style: { width: 3, 'line-color': '#e1c799' } }
        ],
        layout: { name: 'concentric', concentric: node => node.id() === record.id ? 2 : 1, levelWidth: () => 1, minNodeSpacing: 95, spacingFactor: 1, padding: 38, animate: false, startAngle: 0, nodeDimensionsIncludeLabels: false }
      });
      cy.on('tap', 'node', event => { if (event.target.id() !== state.note) openRecord(event.target.id()); });
      cy.on('tap', 'edge', event => {
        mobile = 'context'; root.dataset.panel = mobile; updatePanels();
        const panel = $('research-relation-' + event.target.id());
        panel?.querySelector('details')?.setAttribute('open', ''); scrollWithin(root.querySelector('.research-context'), panel);
      });
      fitGraph();
      $('research-graph-status').textContent = '';
    } catch {
      if (epoch === graphEpoch) $('research-graph-status').textContent = '관계망을 표시하지 못했습니다. 아래 목록에서 기록을 열 수 있습니다.';
    }
  }

  function updatePanels() {
    root.dataset.panel = mobile;
    root.querySelectorAll('[data-research-panel]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.researchPanel === mobile)));
    if (mobile === 'record') window.requestAnimationFrame(fitGraph);
  }
  function render() {
    const records = filterRecords(index, state);
    if (records.length && !records.some(r => r.id === state.note)) {
      state.note = records[0].id; state.section = '';
      if (window.location.hash.startsWith('#research')) window.history.replaceState(null, '', researchHref(state));
    }
    const record = records.length ? index.records.get(state.note) : null;
    $('research-query').value = state.query; $('research-month').value = state.month; $('research-entity').value = state.entity;
    $('research-suggestions').checked = state.suggestions;
    $('research-reset').disabled = !state.query && !state.month && !state.entity;
    root.querySelectorAll('[data-research-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.researchView === state.view)));
    updatePanels(); renderList(records);
    $('research-reader').hidden = !record || state.view !== 'read';
    $('research-graph-view').hidden = !record || state.view !== 'graph';
    $('research-main-empty').hidden = !!record;
    if (!record) { stopGraph(); $('research-relations').replaceChildren(); icons(); return; }
    renderReader(record); renderRelations(record);
    if (state.view === 'graph' && !root.hidden) void renderGraph(record); else stopGraph();
    icons();
    if (state.section && state.view === 'read') window.requestAnimationFrame(() => scrollWithin($('research-reader'), $(`research-section-${state.section}`)));
  }

  listen($('research-query'), 'input', () => navigate({ query: $('research-query').value }, true));
  listen($('research-lock'), 'click', onLock);
  listen($('research-month'), 'change', () => navigate({ month: $('research-month').value }));
  listen($('research-entity'), 'change', () => navigate({ entity: $('research-entity').value }));
  listen($('research-reset'), 'click', () => navigate({ query: '', month: '', entity: '' }));
  listen($('research-suggestions'), 'change', () => navigate({ suggestions: $('research-suggestions').checked }));
  for (const button of root.querySelectorAll('[data-research-view]')) listen(button, 'click', () => { mobile = 'record'; navigate({ view: button.dataset.researchView }); });
  for (const button of root.querySelectorAll('[data-research-panel]')) listen(button, 'click', () => { mobile = button.dataset.researchPanel; updatePanels(); });
  listen($('research-fit'), 'click', fitGraph);
  const zoom = factor => { if (cy) cy.zoom({ level: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * factor)), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }); };
  listen($('research-zoom-in'), 'click', () => zoom(1.25)); listen($('research-zoom-out'), 'click', () => zoom(.8));
  const restore = () => {
    if (document.body.dataset.stage !== 'research') { stopGraph(); return; }
    state = readResearchRoute(window.location.hash, index);
    if (state.section) mobile = 'record';
    render();
  };
  listen(window, 'realm-view', restore);
  // Route handling in realm.js dispatches realm-view after restoring the public stage.
  const observer = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(fitGraph) : null;
  observer?.observe($('research-graph'));
  render();
  return { get index() { return index; }, render, getState: () => ({ ...state }),
    setSyncStatus(text) { $('research-sync-status').textContent = text; },
    update(next) {
      const scroll = [...root.querySelectorAll('.research-scroll')].map(n=>[n,n.scrollTop]);
      data = next; index = createResearchIndex(data); refreshMetadata(); render();
      for (const [node, top] of scroll) node.scrollTop = top;
    },
    destroy() { destroyed = true; stopGraph(); observer?.disconnect(); listeners.forEach(dispose => dispose()); } };
}

export function createResearchGate(root, { fetchRequest = (...args) => fetch(...args), createReader = createResearch } = {}) {
  const document = root.ownerDocument, window = document.defaultView;
  let reader = null, dataset = null, pending = null, destroyed = false, generation = 0, lastChecked = 0;
  const messageFor = status => status === 429 ? '잠시 후 다시 시도해 주세요.' : status === 503 ? '서버 설정을 확인 중입니다.' : status === 401 ? '비밀번호가 맞지 않습니다.' : '연결하지 못했습니다. 다시 시도해 주세요.';
  function locked(message = '') {
    reader?.destroy(); reader = null; dataset = null; root.dataset.locked = 'true';
    root.innerHTML = `<section class="research-gate" aria-labelledby="research-gate-title"><i data-lucide="lock-keyhole" aria-hidden="true"></i><h2 id="research-gate-title">Research</h2><form id="research-unlock"><label><span class="sr-only">Research 비밀번호</span><input id="research-password" type="password" name="password" placeholder="비밀번호" autocomplete="current-password" maxlength="128" required></label><button type="submit" class="icon-button" title="Research 열기" aria-label="Research 열기"><i data-lucide="arrow-right" aria-hidden="true"></i></button></form><p id="research-gate-message" role="status"></p></section>`;
    root.querySelector('#research-gate-message').textContent = message;
    window.lucide?.createIcons({root});
    root.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault(); const form = event.currentTarget;
      if (form.getAttribute('aria-busy') === 'true') return;
      const input = root.querySelector('#research-password'), password = input.value; input.value = '';
      form.setAttribute('aria-busy', 'true'); form.querySelector('button').disabled = true;
      const attempt = ++generation;
      try {
        const response = await fetchRequest('/api/research', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'same-origin', cache: 'no-store', body: JSON.stringify({password}), signal: AbortSignal.timeout(12000) });
        if (attempt !== generation || destroyed) return;
        if (!response.ok) { locked(messageFor(response.status)); root.querySelector('input').focus({preventScroll:true}); return; }
        await check(true);
      } catch { if (attempt === generation && !destroyed) locked(messageFor(0)); }
    });
  }
  async function lock() {
    const button = root.querySelector('#research-lock'); if (button) button.disabled = true;
    generation++;
    try {
      const response = await fetchRequest('/api/research', {method:'DELETE',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});
      if (!response.ok) throw Error('Could not lock');
      locked();
    } catch { if (button) { button.disabled = false; button.title = '잠금 실패 · 다시 시도'; } }
  }
  async function check(force = false) {
    if (destroyed || document.body.dataset.stage !== 'research') return;
    if (pending && !force) return pending;
    if (!force && reader && Date.now() - lastChecked < 300000) return;
    const attempt = ++generation;
    pending = (async () => {
      try {
        const response = await fetchRequest('/api/research', {credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});
        if (attempt !== generation || destroyed) return;
        if (response.status === 401) { locked(); return; }
        if (response.status === 403) { locked('Notion 읽기 권한을 확인해 주세요.'); return; }
        if (!response.ok) { locked(messageFor(response.status)); return; }
        let data = await response.json();
        if (attempt !== generation || destroyed) return;
        createResearchIndex(data); lastChecked = Date.now();
        if (data.mode === 'notion-live' && dataset?.mode === 'notion-live') {
          const previous = new Map(dataset.records.map(r=>[r.id,r]));
          data.records = data.records.map(r => {
            const old = previous.get(r.id);
            return old?.loaded && old.source.editedAt === r.source.editedAt && Date.now()-Date.parse(old.source.fetchedAt) < 300000 ? {...old, date:r.date, path:r.path, source:{...old.source,...r.source}} : r;
          });
          data = rebuildNotionRelations(data);
        }
        dataset = data;
        if (!reader) { root.dataset.locked = 'false'; reader = createReader(root, {data,onLock:lock}); }
        else reader.update?.(data);
        if (data.mode === 'notion-live') {
          while (dataset.records.some(r=>!r.loaded) && attempt === generation && !destroyed && !document.hidden) {
            const selected = reader.getState().note;
            const batch = dataset.records.filter(r=>!r.loaded).sort((a,b)=>(b.id===selected)-(a.id===selected)).slice(0,4);
            reader.setSyncStatus(`원문 동기화 ${dataset.records.filter(r=>r.loaded).length} / ${dataset.records.length}`);
            const bodyResponse = await fetchRequest('/api/research?hydrate='+batch.map(r=>r.source.pageId).join(','),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(30000)});
            if (attempt !== generation || destroyed) return;
            if ([401,403].includes(bodyResponse.status)) { locked(bodyResponse.status===403?'Notion 읽기 권한을 확인해 주세요.':''); return; }
            if (!bodyResponse.ok) throw Error('Sync unavailable');
            const content = await bodyResponse.json();
            if (attempt !== generation || destroyed) return;
            const updated = mergeNotionBodies(dataset,content.bodies);
            if (batch.some(r=>updated.records.some(n=>n.id===r.id&&!n.loaded))) throw Error('Source changed while syncing');
            dataset = updated; reader.update(dataset);
          }
          if (dataset?.records.some(r=>!r.loaded)) { lastChecked = 0; reader?.setSyncStatus('원문 동기화 대기'); }
          else reader?.setSyncStatus('자동 동기화 · 생성일 기준');
        }
      } catch { if (attempt === generation && !destroyed) {
        if (reader && dataset?.mode === 'notion-live') { reader.setSyncStatus('동기화 지연 · 잠시 후 재시도'); lastChecked = 0; }
        else locked(messageFor(0));
      } }
      finally { if (attempt === generation) pending = null; }
    })();
    return pending;
  }
  const show = () => {
    if (document.body.dataset.stage === 'research') void check();
    else { generation++; pending = null; locked(); }
  };
  const refocus = () => { if (!document.hidden) void check(); };
  window.addEventListener('realm-view', show); window.addEventListener('focus', refocus); document.addEventListener('visibilitychange', refocus);
  const timer = window.setInterval(refocus, 60000);
  locked(); show();
  return { check, lock, destroy() { destroyed = true; generation++; reader?.destroy(); window.clearInterval(timer); window.removeEventListener('realm-view',show); window.removeEventListener('focus',refocus); document.removeEventListener('visibilitychange',refocus); } };
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('research-content');
  if (root) {
    try { createResearchGate(root); }
    catch { root.textContent = 'Research를 불러오지 못했습니다. 페이지를 새로고침해 주세요.'; }
  }
}

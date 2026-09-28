import { SECTOR_LAYERS, SECTOR_NODES, SECTOR_RELATIONS, matchSectorRecords, sectorCoverage } from './research-sectors.js?v=20260928-2';
import { researchHref, safeSourceURL } from './research-core.js?v=20260928-3';

export function createSectorMap(root, { onSelect, onOpenRecord }) {
  const document = root.ownerDocument, window = document.defaultView;
  const el = (tag, className, text) => { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; };
  let data, hits, selected = 'rack', query = '', onlyGaps = false, expandedRelation = '', frame = 0, disposed = false;
  const byId = new Map(SECTOR_NODES.map(n => [n.id, n]));
  root.innerHTML = `<div class="sector-intro"><div><span class="research-eyebrow">SECTOR STUDY / 01</span><h3>AI 인프라에서 서비스까지</h3><p>항목을 선택하면 산업의 연결과 내가 읽은 기록이 함께 보입니다.</p></div><span class="sector-progress" role="status"></span></div>
    <div class="sector-controls"><label><span class="sr-only">섹터 항목 검색</span><input type="search" placeholder="기업·기술·제품 찾기" maxlength="80" aria-label="섹터 항목 검색"></label><label class="sector-gap-filter"><input type="checkbox">채울 영역만</label><span class="sector-match-note">#직접 태그는 긴밀한 연관으로 우선 표시합니다</span></div>
    <div class="sector-workspace"><div class="sector-map-scroll research-scroll"><div class="sector-map" aria-label="섹터 스터디 목차"></div><p class="sector-no-results" hidden>일치하는 항목이 없습니다.</p><div class="sector-map-legend"><span>● 관련 기록</span><span>◐ 본문 언급</span><span>○ 빈 페이지·기록 없음</span></div><p class="sector-map-hint">선택한 항목의 연결만 표시합니다. 기업별 공급·계약 관계는 근거에서 확인하세요.</p></div><aside class="sector-detail research-scroll" aria-label="섹터 항목과 근거"></aside></div>`;
  const map = root.querySelector('.sector-map'), detail = root.querySelector('.sector-detail');
  root.querySelector('input[type=search]').addEventListener('input', event => { query = event.target.value; render(); });
  root.querySelector('input[type=checkbox]').addEventListener('change', event => { onlyGaps = event.target.checked; render(); });
  function link(label, url) {
    const a = el('a', 'sector-source', label); const safe = safeSourceURL(url);
    if (safe) { a.href = safe; a.target = '_blank'; a.rel = 'noopener noreferrer'; } return a;
  }
  function choose(id) {
    expandedRelation = ''; onSelect(id); detail.scrollTop = 0;
    if (window.innerWidth < 760) {
      const workspace = root.querySelector('.sector-workspace');
      workspace.scrollTop += detail.getBoundingClientRect().top - workspace.getBoundingClientRect().top;
    }
  }
  function renderDetail(n, items, pending) {
    const coverage = sectorCoverage(items, pending), nodes = [];
    const header = el('header', 'sector-detail-heading');
    const back = el('button', 'sector-back', '↑ 섹터 목차로'); back.type = 'button'; back.addEventListener('click', () => { root.querySelector('.sector-workspace').scrollTop = 0; });
    header.append(back, el('span', 'research-eyebrow', SECTOR_LAYERS.find(l => l[0] === n.layer)[1]), el('h3', '', n.name), el('p', '', n.examples), el('span', 'sector-status', coverage.label));
    const question = el('section', 'sector-question'); question.append(el('h4', '', '스터디 질문'), el('p', '', n.question));
    nodes.push(header, question);
    const relations = el('section', 'sector-connections'); relations.append(el('h4', '', '산업의 연결'));
    for (const r of SECTOR_RELATIONS.filter(r => r.from === n.id || r.to === n.id)) {
      const row = el('div', 'sector-connection');
      const b = el('button', 'sector-connection-button'); b.type = 'button'; b.setAttribute('aria-expanded', String(expandedRelation === r.id));
      b.append(el('span', '', byId.get(r.from).name + ' → ' + byId.get(r.to).name), el('small', '', r.label + ' · ' + r.status));
      b.addEventListener('click', () => { expandedRelation = expandedRelation === r.id ? '' : r.id; renderDetail(n, items, pending); });
      row.append(b);
      if (expandedRelation === r.id) {
        row.append(el('p', '', r.note));
        if (r.source) row.append(link(r.source.label, r.source.url), el('p', 'sector-caveat', '자료 확인 · ' + r.checkedAt.replaceAll('-', '.')));
        else row.append(el('p', 'sector-caveat', '조사할 경로입니다. 확인된 공급 계약이나 투자 수혜를 뜻하지 않습니다.'));
        const other = r.from === n.id ? r.to : r.from, jump = el('button', 'sector-jump', byId.get(other).name + ' 살펴보기 →'); jump.type = 'button'; jump.addEventListener('click', () => choose(other)); row.append(jump);
      }
      relations.append(row);
    }
    const records = el('section', 'sector-records'); records.append(el('h4', '', 'Notion에서 읽은 기록'));
    if (pending) records.append(el('p', 'sector-caveat', '원문을 불러오는 중입니다. 관련 기록과 언급 수가 추가될 수 있습니다.'));
    for (const [basis, title] of [['tag', '직접 태그 · 긴밀한 연관'], ['title', '제목에서 찾은 기록'], ['path', '상위 페이지로 연결'], ['mention', '본문 언급 · 분류 제안']]) {
      const matches = items.filter(i => i.basis === basis);
      if (!matches.length) continue;
      const group = el('div', 'sector-record-group'); group.append(el('h5', '', title + ' ' + matches.length));
      for (const item of matches) {
        const record = item.record, article = el('article', 'sector-record'); article.dataset.basis = basis;
        const a = el('a', 'sector-record-title', record.title); a.href = researchHref({ note: record.id, view: 'read' });
        a.addEventListener('click', event => {
          if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); onOpenRecord(record.id, item.section || '');
        });
        article.append(a, el('small', '', [record.date.start?.replaceAll('-', '.') || '날짜 미지정', item.pending ? '원문 확인 중' : item.empty ? '빈 페이지' : basis === 'tag' ? item.term : basis === 'title' ? '제목: ' + item.term : basis === 'path' ? '상위: ' + item.term : '본문 언급'].join(' · ')));
        if (item.excerpt) article.append(el('blockquote', '', item.excerpt));
        article.append(link('Notion 원문 ↗', record.source.url)); group.append(article);
      }
      records.append(group);
    }
    if (!items.length) records.append(el('p', 'sector-caveat', pending ? '현재 불러온 기록에서는 찾지 못했습니다.' : '연결된 기록이 아직 없습니다. Notion에서 이 주제를 공부하면 다음 동기화에 반영됩니다.'));
    nodes.push(records, relations); detail.replaceChildren(...nodes);
  }
  function drawConnections() {
    frame = 0; if (disposed || root.hidden) return;
    map.querySelector('svg')?.remove();
    if (window.innerWidth < 760) return;
    const rect = map.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'sector-lines'); svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`); svg.setAttribute('aria-hidden', 'true');
    const defs = document.createElementNS(ns, 'defs'), marker = document.createElementNS(ns, 'marker');
    marker.id = 'sector-arrow'; marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '9'); marker.setAttribute('refY', '5'); marker.setAttribute('markerWidth', '5'); marker.setAttribute('markerHeight', '5'); marker.setAttribute('orient', 'auto-start-reverse');
    const arrow = document.createElementNS(ns, 'path'); arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z'); marker.append(arrow); defs.append(marker); svg.append(defs);
    for (const r of SECTOR_RELATIONS.filter(r => r.from === selected || r.to === selected)) {
      const from = map.querySelector(`[data-sector="${r.from}"]`), to = map.querySelector(`[data-sector="${r.to}"]`); if (!from || !to) continue;
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), down = a.top < b.top;
      const path = document.createElementNS(ns, 'path');
      if (Math.abs(a.top - b.top) < 10) {
        const right = a.left < b.left;
        path.setAttribute('d', `M ${(right ? a.right : a.left) - rect.left} ${a.top+a.height/2-rect.top} L ${(right ? b.left : b.right)-rect.left} ${b.top+b.height/2-rect.top}`);
      } else {
        const x1 = a.left + a.width / 2 - rect.left, x2 = b.left + b.width / 2 - rect.left;
        const y1 = (down ? a.bottom : a.top) - rect.top, y2 = (down ? b.top : b.bottom) - rect.top;
        if (Math.abs(y2-y1) < 90) path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${(y1+y2)/2}, ${x2} ${(y1+y2)/2}, ${x2} ${y2}`);
        else {
          const corridor = a.right - rect.left + 7, offset = down ? 16 : -16;
          path.setAttribute('d', `M ${x1} ${y1} V ${y1+offset} H ${corridor} V ${y2-offset} H ${x2} V ${y2}`);
        }
      }
      path.setAttribute('marker-end', 'url(#sector-arrow)'); if (!r.source) path.setAttribute('stroke-dasharray', '4 4'); svg.append(path);
    }
    map.prepend(svg);
  }
  function scheduleDraw() { if (frame) window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(drawConnections); }
  function render() {
    if (!data || disposed) return;
    const focused = map.contains(document.activeElement) ? document.activeElement.dataset.sector : null;
    const pending = data.records.some(r => r.loaded === false), visible = [];
    const needle = query.normalize('NFKC').toLowerCase().trim();
    for (const [id, label] of SECTOR_LAYERS) {
      const layer = el('section', 'sector-layer'), heading = el('h4', '', label), cards = el('div', 'sector-layer-nodes');
      for (const n of SECTOR_NODES.filter(n => n.layer === id)) {
        const coverage = sectorCoverage(hits.get(n.id), pending);
        if (onlyGaps && coverage.state === 'record' || needle && ![n.name, n.examples, ...n.aliases, ...n.tickers].join(' ').normalize('NFKC').toLowerCase().includes(needle)) continue;
        const button = el('button', 'sector-node'); button.type = 'button'; button.dataset.sector = n.id; button.dataset.coverage = coverage.state; button.setAttribute('aria-pressed', String(n.id === selected));
        button.append(el('strong', '', n.name), el('span', 'sector-examples', n.examples), el('span', 'sector-coverage', coverage.label));
        button.addEventListener('click', () => choose(n.id)); cards.append(button); visible.push(n.id);
      }
      if (cards.children.length) { layer.append(heading, cards); map.append(layer); }
    }
    // Replace old layers only after creating the new ones, preserving the selected detail scroll.
    const layers = [...map.querySelectorAll('.sector-layer')];
    const newCount = new Set(visible.map(id => byId.get(id).layer)).size;
    layers.slice(0, layers.length - newCount).forEach(n => n.remove());
    const covered = SECTOR_NODES.filter(n => sectorCoverage(hits.get(n.id), pending).state === 'record').length;
    root.querySelector('.sector-progress').textContent = `관련 기록이 있는 영역 ${covered} / ${SECTOR_NODES.length}`;
    root.querySelector('.sector-no-results').hidden = !!visible.length;
    renderDetail(byId.get(selected), hits.get(selected), pending);
    if (focused) map.querySelector(`[data-sector="${focused}"]`)?.focus({ preventScroll: true });
    scheduleDraw();
  }
  const observer = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(scheduleDraw) : null;
  observer?.observe(map);
  return {
    prioritizedRecordIds() { return (hits?.get(selected) || []).filter(hit => hit.basis !== 'mention').map(hit => hit.record.id); },
    update(next, id) { if (data !== next) hits = matchSectorRecords(next.records); data = next; selected = byId.has(id) ? id : 'rack'; render(); },
    destroy() { disposed = true; observer?.disconnect(); if (frame) window.cancelAnimationFrame(frame); root.replaceChildren(); }
  };
}

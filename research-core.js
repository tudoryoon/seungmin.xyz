export const KIND_LABELS = { study: '주제 스터디', company: '기업', earnings: '실적', diary: '일기', thesis: '산업 가설' };
export const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim();

export function createResearchIndex(data) {
  if (data?.version !== 1 || !Array.isArray(data.records) || !Array.isArray(data.entities) || !Array.isArray(data.relations)) throw new Error('Invalid research dataset');
  const unique = items => {
    const map = new Map();
    for (const item of items) {
      if (!/^[a-z0-9-]+$/.test(item.id) || map.has(item.id)) throw new Error('Duplicate or invalid ID');
      map.set(item.id, item);
    }
    return map;
  };
  const records = unique(data.records), entities = unique(data.entities);
  unique(data.relations);
  const search = new Map();
  for (const record of records.values()) {
    if (!record.title || !record.sections?.length || !safeSourceURL(record.source?.url)) throw new Error('Incomplete research record');
    const sectionIds = new Set();
    for (const section of record.sections) {
      if (sectionIds.has(section.id) || !section.id || (!section.text && !section.items?.length)) throw new Error('Invalid section');
      sectionIds.add(section.id);
    }
    if (!record.entities.every(id => entities.has(id))) throw new Error('Unknown entity');
    const aliases = record.entities.flatMap(id => { const entity = entities.get(id); return [entity.name, ...entity.aliases]; });
    search.set(record.id, normalize([record.title, record.source.title, record.summary, record.question, ...record.path, ...aliases, ...record.sections.flatMap(s => [s.label, s.text, ...(s.items || []), s.note]), ...record.questions].join(' ')));
  }
  for (const relation of data.relations) {
    if (!records.has(relation.from) || !records.has(relation.to) || relation.from === relation.to || !['editorial', 'suggested'].includes(relation.status) || !relation.reason || relation.evidence?.length < 2) throw new Error('Invalid relation');
    for (const evidence of relation.evidence) {
      if (![relation.from, relation.to].includes(evidence.record) || !records.get(evidence.record)?.sections.some(s => s.id === evidence.section)) throw new Error('Missing evidence');
    }
    if (![relation.from, relation.to].every(id => relation.evidence.some(e => e.record === id))) throw new Error('Evidence must cover both records');
  }
  return { data, records, entities, search };
}

export function safeSourceURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}

export function filterRecords(index, { query = '', month = '', entity = '', kind = '' } = {}) {
  const words = normalize(query).split(' ').filter(Boolean);
  return [...index.records.values()].filter(record =>
    words.every(word => index.search.get(record.id).includes(word)) &&
    (!month || (month === 'undated' ? !record.date.start : record.date.start?.startsWith(month))) &&
    (!entity || record.entities.includes(entity)) && (!kind || record.kind === kind)
  ).sort((a, b) => (b.date.start || '').localeCompare(a.date.start || '') || a.title.localeCompare(b.title, 'ko'));
}

export function relatedRecords(index, id, includeSuggested = true) {
  return index.data.relations.filter(r => (r.from === id || r.to === id) && (includeSuggested || r.status !== 'suggested'))
    .sort((a, b) => (a.status === 'suggested') - (b.status === 'suggested'))
    .map(relation => ({ relation, record: index.records.get(relation.from === id ? relation.to : relation.from) }));
}

export function recordDate(record, compact = false) {
  if (!record.date.start) return '날짜 미지정';
  if (record.date.label) return record.date.label;
  const value = record.date.start.replaceAll('-', '.');
  return compact ? value.slice(5) : value;
}

export function readResearchRoute(hash, index) {
  const params = new URLSearchParams(hash.split('?')[1] || '');
  return {
    note: index.records.has(params.get('note')) ? params.get('note') : 'fde-20260922',
    view: params.get('view') === 'graph' ? 'graph' : 'read',
    query: (params.get('q') || '').slice(0, 120),
    month: /^(\d{4}-\d{2}|undated)$/.test(params.get('month') || '') ? params.get('month') : '',
    entity: index.entities.has(params.get('entity')) ? params.get('entity') : '',
    suggestions: params.get('suggestions') !== 'off',
    section: /^[a-z0-9-]+$/.test(params.get('section') || '') ? params.get('section') : ''
  };
}

export function researchHref(state = {}) {
  const params = new URLSearchParams();
  if (state.note) params.set('note', state.note);
  if (state.view === 'graph') params.set('view', 'graph');
  if (state.query) params.set('q', state.query);
  if (state.month) params.set('month', state.month);
  if (state.entity) params.set('entity', state.entity);
  if (state.suggestions === false) params.set('suggestions', 'off');
  if (state.section) params.set('section', state.section);
  return '#research' + (params.size ? '?' + params : '');
}

import { normalize } from './research-core.js';

export const notionId = value => String(value || '').replaceAll('-', '').toLowerCase();
export function kstDate(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + 9 * 3600000).toISOString().slice(0, 10) : null;
}
export function kstTimestamp(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ').replaceAll('-', '.') : null;
}
export function titleDate(title) {
  const match = title.match(/(?:^|[^\d])((?:20)?\d{2})[-.]?(\d{2})[-.]?(\d{2})(?!\d)/);
  if (!match) return null;
  const date = `${match[1].length === 2 ? '20' : ''}${match[1]}-${match[2]}-${match[3]}`;
  return kstDate(date + 'T00:00:00Z') === date ? date : null;
}
export function scopedPages(pages, rootId) {
  const map = new Map(pages.filter(p => !p.in_trash && !p.archived).map(p => [notionId(p.id), p]));
  const root = notionId(rootId);
  return [...map.values()].filter(page => {
    let id = notionId(page.id); const seen = new Set();
    while (map.has(id) && !seen.has(id)) {
      if (id === root) return true;
      seen.add(id); id = notionId(map.get(id).parent?.page_id);
    }
    return false;
  });
}
export function notionTitle(page) {
  return Object.values(page.properties || {}).find(p => p.type === 'title')?.title?.map(t => t.plain_text ?? t.text?.content ?? '').join('') || '제목 없음';
}
export function makeNotionDataset(pages, seed, { rootId, syncedAt }) {
  const scope = scopedPages(pages, rootId), map = new Map(scope.map(p => [notionId(p.id), p]));
  const legacy = new Map(seed.records.map(r => [notionId(r.source.url.match(/[a-f0-9]{32}|[a-f0-9-]{36}/i)?.[0]), r.id]));
  const records = scope.filter(p => notionId(p.id) !== notionId(rootId)).map(page => {
    const id = notionId(page.id), title = notionTitle(page), path = [], seen = new Set([id]);
    let parent = notionId(page.parent?.page_id);
    while (map.has(parent) && !seen.has(parent)) { seen.add(parent); path.unshift(notionTitle(map.get(parent))); parent = notionId(map.get(parent).parent?.page_id); }
    const created = kstDate(page.created_time);
    return {
      id: legacy.get(id) || 'notion-' + id, title, kind: /실적/.test(title) ? 'earnings' : path.some(p => /일기/.test(p)) ? 'diary' : / US$/.test(title) ? 'company' : 'study',
      source: { url: page.url || 'https://www.notion.so/' + id, title, pageId: id, parentId: notionId(page.parent?.page_id), createdAt: page.created_time, editedAt: page.last_edited_time },
      date: { start: created, precision: created ? 'day' : 'unknown', basis: created ? 'Notion 페이지 생성일 (KST)' : 'Notion 생성일 정보 없음' },
      studyDate: titleDate(title), path, entities: [], summary: '', question: '', questions: [], state: 'Notion', loaded: false,
      sections: [{ id: 'notion-body', label: 'Notion 원문', text: '원문 불러오는 중…' }]
    };
  });
  const entities = structuredClone(seed.entities);
  for (const record of records) {
    const ticker = record.title.match(/\b([A-Z][A-Z0-9.]{0,6}) US\b/)?.[1];
    if (ticker && !entities.some(e=>e.name===ticker)) entities.push({id:'ticker-'+ticker.toLowerCase().replaceAll('.','-'),name:ticker,type:'company',aliases:[]});
  }
  return rebuildNotionRelations({ version: 1, mode: 'notion-live', capturedAt: kstDate(syncedAt), syncedAt, entities, records, relations: [] });
}
export function rebuildNotionRelations(data) {
  const records = data.records, byPage = new Map(records.map(r => [r.source.pageId, r]));
  const matches = (text, alias) => {
    const term = normalize(alias);
    return /^[a-z0-9 ]+$/.test(term) ? new RegExp('(?:^|[^a-z0-9])' + term + '(?:$|[^a-z0-9])', 'i').test(text) : text.includes(term);
  };
  for (const r of records) {
    const text = normalize([r.title, ...r.path.slice(1), ...(r.loaded ? r.sections.map(s => s.text) : [])].join(' '));
    r.entities = data.entities.filter(e => [e.name, ...e.aliases].some(a => matches(text, a))).map(e => e.id);
  }
  const relations = [], pairs = new Set();
  function add(from, to, type, label, reason, status) {
    const pair = [from.id, to.id].sort().join(':'); if (pairs.has(pair) || from.id === to.id) return;
    pairs.add(pair); relations.push({ id: type + '-' + from.id + '-' + to.id, from: from.id, to: to.id, type, label, reason, status,
      evidence: [from, to].map(r => ({ record: r.id, section: 'notion-body' })) });
  }
  for (const r of records) {
    const parent = byPage.get(r.source.parentId);
    if (parent) add(parent, r, 'parent', '하위 기록', 'Notion의 상위·하위 페이지 관계입니다.', 'editorial');
    for (const link of r.source.linkedPageIds || []) {
      const other = byPage.get(notionId(link)); if (other) add(r, other, 'link', '원문 링크', 'Notion 원문에서 연결된 페이지입니다.', 'editorial');
    }
  }
  const degree = new Map();
  for (let i = 0; i < records.length; i++) for (let j = i + 1; j < records.length; j++) {
    const a = records[i], b = records[j]; if (!a.loaded || !b.loaded || (degree.get(a.id) || 0) >= 3 || (degree.get(b.id) || 0) >= 3) continue;
    const common = a.entities.filter(id => b.entities.includes(id));
    if (common.length < 2 || pairs.has([a.id,b.id].sort().join(':'))) continue;
    const labels = common.map(id => data.entities.find(e => e.id === id).name).slice(0, 3).join(', ');
    add(a, b, 'topic', '공통 주제', labels + ' 표현을 공유하는 자동 연결 제안입니다. 인과관계나 결론의 일치를 뜻하지 않습니다.', 'suggested');
    degree.set(a.id, (degree.get(a.id) || 0) + 1); degree.set(b.id, (degree.get(b.id) || 0) + 1);
  }
  return { ...data, relations };
}

export function mergeNotionBodies(data, bodies) {
  const byPage = new Map(bodies.map(b => [b.pageId, b]));
  const records = data.records.filter(r => !byPage.get(r.source.pageId)?.removed).map(record => {
    const body = byPage.get(record.source.pageId);
    if (!body || body.editedAt !== record.source.editedAt) return record;
    return { ...record, loaded: true, source: { ...record.source, linkedPageIds: body.linkedPageIds, fetchedAt: body.fetchedAt },
      state: body.truncated || body.unsupported ? '일부 원문' : body.markdown.trim() ? 'Notion' : '빈 페이지',
      sections: [{ id: 'notion-body', label: 'Notion 원문', text: body.markdown || '아직 작성된 본문이 없습니다.', markdown: body.markdown,
        note: body.truncated || body.unsupported ? 'Notion API에서 일부 블록을 가져오지 못했습니다. 전체 내용은 원문에서 확인해 주세요.' : '' }] };
  });
  return rebuildNotionRelations({ ...data, records });
}

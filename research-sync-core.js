import { normalize } from './research-core.js';
import { findBodyOverlaps } from './research-overlap.js?v=20260928-1';
import { extractRecordTags, tagKey, tagEntityId } from './research-tags.js?v=20260928-1';

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
  const recordIds = new Set(records.map(r=>r.id));
  const reviewedRelations = seed.relations.filter(r=>recordIds.has(r.from)&&recordIds.has(r.to)).map(r=>({
    ...r, id:'review-'+r.id, status:'suggested', reason:'초안 검토에서 제안한 연결입니다. ' + r.reason,
    evidence:[r.from,r.to].map(record=>({record,section:'notion-body'}))
  }));
  return rebuildNotionRelations({ version: 1, mode: 'notion-live', capturedAt: kstDate(syncedAt), syncedAt, entities, records, reviewedRelations, relations: [] });
}
export function rebuildNotionRelations(data) {
  const records = data.records, byPage = new Map(records.map(r => [r.source.pageId, r]));
  // Rebuild derived tag topics so removing a tag also removes its filters/links.
  data.entities = data.entities.filter(e => e.generatedBy !== 'hashtag');
  const knownEntities = [...data.entities], tagEntities = new Map();
  for (const r of records) {
    r.tags = extractRecordTags(r).map(tag => {
      let entity = knownEntities.find(e => [e.name, ...e.aliases].some(a => tagKey(a) === tag.key)) || tagEntities.get(tag.key);
      if (!entity) {
        entity = { id: tagEntityId(tag.key), name: tag.label, aliases: [], type: 'topic', generatedBy: 'hashtag' };
        data.entities.push(entity); tagEntities.set(tag.key, entity);
      }
      return { ...tag, entity: entity.id };
    });
  }
  const matches = (text, alias) => {
    const term = normalize(alias);
    return /^[a-z0-9 ._-]+$/.test(term) ? new RegExp('(?:^|[^a-z0-9])' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[^a-z0-9])', 'i').test(text) : text.includes(term);
  };
  for (const r of records) {
    const text = normalize([r.title, ...r.path.slice(1), ...(r.loaded ? r.sections.map(s => s.text) : [])].join(' '));
    r.entities = [...new Set([...knownEntities.filter(e => [e.name, ...e.aliases].some(a => matches(text, a))).map(e => e.id), ...r.tags.map(t => t.entity)])];
  }
  const relations = [], pairs = new Set();
  function add(from, to, type, label, reason, status, details = {}) {
    const pair = [from.id, to.id].sort().join(':'); if (pairs.has(pair) || from.id === to.id) return;
    pairs.add(pair); relations.push({ id: type + '-' + from.id + '-' + to.id, from: from.id, to: to.id, type, label, reason, status,
      evidence: [from, to].map(r => ({ record: r.id, section: 'notion-body' })), ...details });
  }
  for (const r of records) {
    const parent = byPage.get(r.source.parentId);
    if (parent) add(parent, r, 'parent', '하위 기록', 'Notion의 상위·하위 페이지 관계입니다.', 'editorial');
    for (const link of r.source.linkedPageIds || []) {
      const other = byPage.get(notionId(link)); if (other) add(r, other, 'link', '원문 링크', 'Notion 원문에서 연결된 페이지입니다.', 'editorial');
    }
  }
  // A shared explicit tag, or an explicit tag pointing to a subject's titled
  // record, is strong topical relevance. Ordinary body mentions never qualify.
  const byEntity = new Map(data.entities.map(e => [e.id, e]));
  const titleEvidence = (record, entity) => {
    const alias = [entity.name, ...entity.aliases].find(a => {
      if (entity.type === 'company' && /^[a-z]$/i.test(a)) return new RegExp('^' + a + '(?:\\s+US\\b|$|\\s+[·(（-])', 'i').test(record.title);
      return matches(normalize(record.title), a);
    });
    return alias ? { record: record.id, section: record.sections[0].id, basis: 'title', excerpt: record.title } : null;
  };
  for (let i = 0; i < records.length; i++) for (let j = i + 1; j < records.length; j++) {
    const a = records[i], b = records[j], labels = [], proof = [];
    const candidates = new Set([...a.tags, ...b.tags].map(t => t.entity));
    for (const id of candidates) {
      const entity = byEntity.get(id);
      const evidence = [a, b].map(record => {
        const tag = record.tags.find(t => t.entity === id);
        return tag ? {record: record.id, section: tag.section, basis: 'tag', excerpt: tag.excerpt} : titleEvidence(record, entity);
      });
      if (evidence.every(Boolean)) { labels.push('#' + entity.name); proof.push(...evidence); }
    }
    if (!labels.length) continue;
    const pair = [a.id, b.id].sort().join(':'), reason = labels.join(' · ') + ' 직접 태그를 근거로 연결한 긴밀한 주제 연관입니다. 태그를 공유하거나 해당 주제를 제목으로 다루는 기록입니다.';
    const tagEvidence = [...new Map(proof.map(e => [e.record + ':' + e.section + ':' + e.excerpt, e])).values()];
    const details = {strength:'strong',tagLabels:labels,tagEvidence};
    if (pairs.has(pair)) {
      const existing = relations.find(r => [r.from,r.to].sort().join(':') === pair);
      Object.assign(existing, details); existing.reason += ' ' + reason;
    } else add(a, b, 'tag', '직접 태그', reason, 'editorial', {...details,evidence:tagEvidence.map(({record,section})=>({record,section}))});
  }
  for (const {from, to, overlap, evidence} of findBodyOverlaps(records)) {
    add(from, to, 'overlap', '본문 중복', `서식을 제외한 긴 구절 ${overlap.passages}개(총 ${overlap.characters}자)가 일치합니다. 같은 자료의 발췌·재사용 여부를 확인해 보세요.`, 'suggested', {overlap, evidence});
  }
  const recordIds = new Set(records.map(r=>r.id));
  for (const relation of data.reviewedRelations || []) {
    const pair = [relation.from,relation.to].sort().join(':');
    if (recordIds.has(relation.from) && recordIds.has(relation.to) && !pairs.has(pair)) { pairs.add(pair); relations.push(relation); }
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

import { normalize } from './research-core.js';

const MIN_PASSAGE_LENGTH = 25, MIN_SHARED_CHARACTERS = 120;
const sectionCache = new WeakMap();

function passages(section) {
  const source = section.markdown ?? section.text ?? '';
  const cached = sectionCache.get(section);
  if (cached?.source === source) return cached.passages;
  // Compare prose only. Formatting, headings, URLs and attachments are not evidence.
  const text = source
    .replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|pre|code|page|mention-page|file|pdf|video|audio)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/^\s*#{1,6}\s+.*$/gm, '')
    .replace(/\{(?:(?:color="[a-z_]+"|toggle="true")\s*)+\}/g, '')
    .replace(/!\[[^\]]*\]\([^\n]*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^\n]*?\)/g, '$1')
    .replace(/https?:\/\/[^\s<>]+/g, '')
    .replace(/<\/?(?:p|li|td|th|tr|div|br)\b[^>]*>/gi, '\n\n')
    .replace(/<\/?(?:a|span|strong|b|em|i|u|s|del|img|empty-block|blockquote|ul|ol|h[1-6]|details|summary|table|thead|tbody)\b[^>]*>/gi, '')
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[name])
    .replace(/^\s*(?:[-+*]|\d+[.)]|>)\s+/gm, '\n\n')
    .replace(/[*_`~]/g, '')
    .replace(/ {2,}\n/g, '\n\n');
  const result = new Map();
  for (const paragraph of text.split(/\n\s*\n/)) {
    const plain = paragraph.replace(/\s+/g, ' ').trim();
    for (const sentence of plain.split(/(?<=[.!?。！？])\s+/u)) {
      const key = normalize(sentence).replace(/[.!?。！？]+$/u, '').trim();
      if ((key.match(/[\p{L}\p{N}]/gu) || []).length < MIN_PASSAGE_LENGTH) continue;
      if (!result.has(key)) result.set(key, { text:sentence, section:section.id });
    }
  }
  sectionCache.set(section, {source, passages:result});
  return result;
}

export function findBodyOverlaps(records) {
  const lookup = new Map(), candidates = new Map();
  for (const record of records.filter(r => r.loaded).sort((a, b) => a.id.localeCompare(b.id))) {
    const unique = new Map();
    for (const section of record.sections) for (const [key, passage] of passages(section)) {
      if (!unique.has(key)) unique.set(key, passage);
    }
    for (const [key, passage] of unique) {
      const previous = lookup.get(key) || [];
      for (const other of previous) {
        const pair = other.record.id + ':' + record.id;
        let match = candidates.get(pair);
        if (!match) {
          match = {from:other.record, to:record, shared:[], characters:0};
          candidates.set(pair, match);
        }
        match.shared.push({key, from:other.passage, to:passage});
        match.characters += key.length;
      }
      previous.push({record, passage}); lookup.set(key, previous);
    }
  }
  return [...candidates.values()]
    .filter(match => match.shared.length >= 2 && match.characters >= MIN_SHARED_CHARACTERS)
    .sort((a, b) => b.characters - a.characters || a.from.id.localeCompare(b.from.id) || a.to.id.localeCompare(b.to.id))
    .map(({from, to, shared, characters}) => {
      shared.sort((a, b) => b.key.length - a.key.length || a.key.localeCompare(b.key));
      return {from, to, overlap:{passages:shared.length, characters, excerpts:shared.slice(0,3).map(s => s.from.text.length > 220 ? s.from.text.slice(0,220) + '…' : s.from.text)},
        evidence:[{record:from.id,section:shared[0].from.section},{record:to.id,section:shared[0].to.section}]};
    });
}

// Explicit author tags, shared by the Notion sync and sector atlas.
export const tagKey = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s_·/.-]+/g, '');
export const tagEntityId = key => 'tag-' + Array.from(key, c => c.codePointAt(0).toString(16)).join('-');

function tagProse(value) {
  return String(value || '').normalize('NFKC').replace(/\r\n?/g, '\n')
    .replace(/(^|\n)[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n[ \t]*\2[~`]*[ \t]*(?=\n|$)|$)/g, '$1')
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<(script|style|pre|code|page|mention-page|file|pdf|video|audio)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/(`+)[\s\S]*?\1/g, ' ')
    .replace(/!\[[^\]]*\]\([^\n)]*\)/g, ' ')
    .replace(/^\s*\[[^\]]+\]:[^\n]*$/gm, '')
    .replace(/\[([^\]]+)\]\([^\n)]*\)/g, '$1')
    .replace(/(?:https?:\/\/|www\.|mailto:)[^\s<>]+/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{(?:(?:color="[a-z_]+"|toggle="true")\s*)+\}/g, '')
    // Notion may escape a literal leading hash when serializing Markdown.
    .replace(/\\#/g, '#');
}

export function extractRecordTags(record) {
  if (record.loaded === false) return [];
  const found = new Map();
  for (const section of record.sections || []) {
    const text = tagProse(section.markdown ?? [section.text, ...(section.items || [])].filter(Boolean).join('\n'));
    for (const line of text.split('\n')) {
      for (const match of line.matchAll(/(?:^|[\s([{,:;!?、，：；！？|>*])#([\p{L}\p{N}][\p{L}\p{M}\p{N}_·./-]*)/gu)) {
        const label = match[1].replace(/[._·/-]+$/, ''), key = tagKey(label);
        if (!key || label.length > 80 || found.has(key)) continue;
        found.set(key, { key, label, section: section.id, excerpt: line.slice(Math.max(0, match.index - 60), match.index + 240).trim() });
      }
    }
  }
  return [...found.values()];
}

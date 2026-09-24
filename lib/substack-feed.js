import saxes from '../vendor/saxes.mjs';

export const FEED_URL = 'https://tudoryoon.substack.com/feed';
export const MAX_BYTES = 3 * 1024 * 1024;

export function validateFeed(xml) {
  if (typeof xml !== 'string' || !xml.trim() || new TextEncoder().encode(xml).length > MAX_BYTES || /<!DOCTYPE/i.test(xml)) throw new Error('Invalid feed');
  const parser = new saxes.SaxesParser(), path = [];
  let channel = false, items = 0;
  parser.on('opentag', tag => {
    path.push(tag.name);
    if (path.length === 1 && tag.name !== 'rss') throw new Error('Invalid feed');
    if (path.join('/') === 'rss/channel') channel = true;
    if (path.join('/') === 'rss/channel/item') items++;
  });
  parser.on('closetag', () => path.pop());
  parser.write(xml).close();
  if (!channel) throw new Error('Invalid feed');
  return items;
}

export async function readFeed(response) {
  if (!response.ok || !/\b(xml|rss)\b/i.test(response.headers.get('Content-Type') || '') || !response.body) throw new Error('Unavailable feed');
  if (Number(response.headers.get('Content-Length')) > MAX_BYTES) throw new Error('Oversized feed');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, xml = '';
  try {
    for (;;) {
      const {value,done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('Oversized feed');
      xml += decoder.decode(value,{stream:true});
    }
    xml += decoder.decode();
    validateFeed(xml);
    return xml;
  } finally { await reader.cancel().catch(() => {}); }
}

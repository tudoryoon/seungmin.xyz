import { researchHref, safeSourceURL } from './research-core.js?v=20260928-3';

const PAGE_ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
const normalizeId = value => PAGE_ID.test(value || '') ? value.replaceAll('-', '').toLowerCase() : '';

function notionPage(url) {
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!['notion.so', 'notion.com', 'notion.site'].some(domain => host === domain || host.endsWith('.' + domain))) return null;
  // Database page links can carry the selected page in ?p=; a hash is a block,
  // not a different page. Never match IDs in arbitrary hosts or query strings.
  const selected = normalizeId(url.searchParams.get('p'));
  let path;
  try { path = decodeURIComponent(url.pathname).replace(/\/+$/, ''); } catch { path = ''; }
  const match = /(?:^|[-/])([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.exec(path);
  return { pageId: selected || normalizeId(match?.[1]) };
}

export function createResearchLinkResolver(records) {
  const pages = new Map();
  for (const record of records) {
    const source = safeSourceURL(record.source?.url);
    const id = normalizeId(record.source?.pageId) || (source && notionPage(new URL(source))?.pageId);
    if (id) pages.set(id, record);
  }
  return (value, baseURL) => {
    if (!value?.trim()) return null;
    let url;
    try { url = safeSourceURL(new URL(value, baseURL).href); } catch { return null; }
    if (!url) return null;
    const notion = notionPage(new URL(url));
    return { url, notion: !!notion, record: notion ? pages.get(notion.pageId) : undefined };
  };
}

// Called only after markup sanitization (or on a link created with textContent).
// Unknown Notion destinations become buttons, so modifier/middle clicks cannot
// accidentally leave Research either. The reader provides an explicit source action.
export function configureResearchLink(link, { resolveLink, baseURL, onOpenRecord, onUnavailable } = {}) {
  const destination = resolveLink?.(link.getAttribute('href'), baseURL);
  if (!destination) { link.removeAttribute('href'); return; }
  const { url, notion, record } = destination;
  if (record) {
    link.href = researchHref({ note: record.id });
    link.removeAttribute('target'); link.removeAttribute('rel');
    link.classList.add('research-internal-link'); link.dataset.record = record.id;
    link.title = record.title + ' · Research에서 읽기';
    link.addEventListener('click', event => {
      if (!onOpenRecord || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); onOpenRecord(record.id);
    });
  } else if (notion) {
    const button = link.ownerDocument.createElement('button');
    button.type = 'button'; button.className = 'research-unavailable-link';
    button.append(...link.childNodes); button.title = 'Research 연동 상태 확인';
    button.addEventListener('click', () => onUnavailable?.({ url, label: button.textContent || '연결된 페이지', trigger: button }));
    link.replaceWith(button);
  } else {
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  }
}

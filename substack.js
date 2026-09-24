import createDOMPurify from './vendor/dompurify.mjs';
import snapshot from './data/substack-snapshot.js?v=20260924-9';

const PUBLICATION = 'https://tudoryoon.substack.com';
const MAX_LENGTH = 3 * 1024 * 1024;
const CACHE_KEY = 'seungmin-public-substack-v1';
const dateFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });

function safeURL(value, article = false) {
  try {
    const url = new URL(value, PUBLICATION);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (article && (url.origin !== PUBLICATION || !url.pathname.startsWith('/p/'))) return null;
    return url;
  } catch { return null; }
}

export function parseSubstackFeed(xml, Parser = DOMParser) {
  if (typeof xml !== 'string' || xml.length > MAX_LENGTH || /<!DOCTYPE/i.test(xml)) throw new Error('Invalid feed');
  const doc = new Parser().parseFromString(xml, 'application/xml');
  const channel = doc.querySelector('rss > channel');
  if (doc.querySelector('parsererror') || doc.documentElement?.localName !== 'rss' || !channel) throw new Error('Invalid feed');
  const value = (element, name) => [...element.children].find(child => child.localName === name)?.textContent?.trim() || '';
  const seen = new Set(), posts = [];
  for (const item of [...channel.children].filter(child => child.localName === 'item')) {
    const url = safeURL(value(item, 'link'), true), title = value(item, 'title');
    if (!url || !title || seen.has(url.href)) continue;
    seen.add(url.href);
    const date = new Date(value(item, 'pubDate'));
    posts.push({ url: url.href, title: title.slice(0, 500), author: value(item, 'creator').slice(0, 100),
      date: Number.isFinite(date.getTime()) ? date.toISOString() : '',
      html: value(item, 'encoded') || value(item, 'description') });
  }
  return posts.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30);
}

export function sanitizeSubstackBody(html, document) {
  const purify = createDOMPurify(document.defaultView);
  const fragment = purify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_TAGS: ['p','br','h1','h2','h3','h4','h5','h6','blockquote','ul','ol','li','pre','code','strong','b','em','i','u','s','hr','a','img','figure','figcaption','table','thead','tbody','tr','th','td','div','span','sup','sub'],
    ALLOWED_ATTR: ['href','src','alt','title','colspan','rowspan'],
    ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false
  });
  for (const link of fragment.querySelectorAll('a')) {
    const url = link.hasAttribute('href') && safeURL(link.getAttribute('href'));
    if (!url) { link.removeAttribute('href'); continue; }
    link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  }
  for (const image of fragment.querySelectorAll('img')) {
    const url = image.hasAttribute('src') && safeURL(image.getAttribute('src'));
    if (!url || !['substackcdn.com','tudoryoon.substack.com'].includes(url.hostname)) { image.remove(); continue; }
    image.src = url.href; image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
  }
  return fragment;
}

export function createSubstackReader(root, fetchFeed = (...args) => fetch(...args), fallback = snapshot) {
  const document = root.ownerDocument, $ = id => document.getElementById(id);
  const list = $('substack-posts'), article = $('substack-article'), status = $('substack-status'), retry = $('substack-retry');
  let posts = [], pending = null, checkedAt = 0, fetchedAt = 0, selected = null, listScroll = 0;
  const metadata = post => [post.author, post.date && dateFormat.format(new Date(post.date))].filter(Boolean).join(' · ');
  function open(post) {
    selected = post; listScroll = root.scrollTop;
    list.hidden = true; article.hidden = false;
    $('substack-article-title').textContent = post.title;
    $('substack-article-meta').textContent = metadata(post);
    $('substack-article-body').replaceChildren(sanitizeSubstackBody(post.html, document));
    if (!$('substack-article-body').textContent.trim() && !$('substack-article-body').querySelector('img')) {
      const empty = document.createElement('p'); empty.textContent = '본문은 원문에서 확인할 수 있습니다.';
      $('substack-article-body').append(empty);
    }
    $('substack-original').href = post.url;
    root.scrollTop = 0; $('substack-article-title').focus({ preventScroll: true });
  }
  function renderList() {
    const elements = posts.map(post => {
      const item = document.createElement('li'), button = document.createElement('button');
      const meta = document.createElement('span'), title = document.createElement('span');
      button.type = 'button'; button.dataset.post = post.url;
      meta.className = 'substack-meta'; meta.textContent = metadata(post);
      title.className = 'substack-post-title'; title.textContent = post.title;
      button.append(meta, title); button.addEventListener('click', () => open(post));
      item.append(button); return item;
    });
    list.replaceChildren(...elements);
  }
  function accept(xml, timestamp, source, persist = false) {
    const next = parseSubstackFeed(xml,document.defaultView.DOMParser);
    const time = Date.parse(timestamp);
    if (!Number.isFinite(time) || time < fetchedAt || (!next.length && posts.length)) return false;
    const focusURL = list.contains(document.activeElement) ? document.activeElement.dataset.post : null;
    const scroll = root.scrollTop;
    posts = next; fetchedAt = time; renderList(); root.dataset.feedSource = source;
    // Updating the list must not interrupt an open article or keyboard focus.
    root.scrollTop = scroll;
    if (focusURL) [...list.querySelectorAll('button')].find(button => button.dataset.post === focusURL)?.focus({preventScroll:true});
    if (persist && posts.length) {
      try { document.defaultView.localStorage.setItem(CACHE_KEY,JSON.stringify({xml,fetchedAt:new Date(time).toISOString()})); } catch { /* Private browsing/quota must not interrupt reading. */ }
    }
    return true;
  }
  try { accept(fallback.xml,fallback.fetchedAt,'snapshot'); } catch { /* The live endpoint can still recover. */ }
  try {
    const raw = document.defaultView.localStorage.getItem(CACHE_KEY);
    if (raw && raw.length <= MAX_LENGTH * 2) {
      const saved = JSON.parse(raw); accept(saved.xml,saved.fetchedAt,'saved');
    }
  } catch { /* Ignore damaged or unavailable browser storage. */ }
  status.textContent = posts.length ? '' : '불러오는 중…';
  $('substack-back').addEventListener('click', () => {
    const url = selected?.url; selected = null;
    article.hidden = true; list.hidden = false; root.scrollTop = listScroll;
    [...list.querySelectorAll('button')].find(button => button.dataset.post === url)?.focus({ preventScroll: true });
  });
  async function load(force = false) {
    if (pending) return pending;
    if (!force && checkedAt && Date.now() - checkedAt < 60000) return;
    checkedAt = Date.now();
    root.setAttribute('aria-busy', 'true'); retry.hidden = true;
    status.textContent = posts.length ? '' : '불러오는 중…';
    pending = (async () => {
      try {
        const response = await fetchFeed('/api/substack', { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error('Unavailable feed');
        const source = response.headers.get('X-Feed-State') || 'fresh';
        accept(await response.text(),response.headers.get('X-Feed-Updated-At') || new Date().toISOString(),source,true);
        status.textContent = posts.length ? '' : '아직 발행한 글이 없습니다.';
        retry.hidden = source === 'fresh';
      } catch {
        status.textContent = posts.length ? '' : '글을 불러오지 못했습니다.';
        retry.hidden = false;
      } finally { root.setAttribute('aria-busy', 'false'); pending = null; }
    })();
    return pending;
  }
  retry.addEventListener('click', () => { void load(true); });
  return { load };
}

export function watchSubstack(reader, document) {
  const view = document.defaultView;
  let refresh = 0;
  const check = () => { if (document.body.dataset.stage === 'substack' && !document.hidden) void reader.load(); };
  const show = () => {
    view.clearInterval(refresh); refresh = 0;
    if (document.body.dataset.stage === 'substack') {
      check(); refresh = view.setInterval(check, 60 * 1000);
    }
  };
  view.addEventListener('realm-view', show);
  view.addEventListener('focus', check);
  view.addEventListener('online', check);
  document.addEventListener('visibilitychange', check);
  show();
  return () => {
    view.clearInterval(refresh);
    view.removeEventListener('realm-view', show); view.removeEventListener('focus', check);
    view.removeEventListener('online', check);
    document.removeEventListener('visibilitychange', check);
  };
}

if (typeof document !== 'undefined' && document.getElementById('substack-content')) {
  watchSubstack(createSubstackReader(document.getElementById('substack-content')), document);
}

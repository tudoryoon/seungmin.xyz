import assert from 'node:assert/strict';
import { createResearchLinkResolver } from '../research-links.js';
import { renderNotionMarkdown } from '../research-markdown.js';
import { createResearch } from '../research.js';
import seed from './research-fixture.mjs';

const a = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', b = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', c = 'cccccccccccccccccccccccccccccccc';
const uuid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const data = structuredClone(seed);
data.records = data.records.slice(0, 3); data.relations = [];
const [parent, child, legacy] = data.records;
parent.source = { url: 'https://www.notion.so/Parent-' + a, pageId: a };
child.source = { url: 'https://app.notion.com/p/' + b, pageId: uuid };
legacy.source = { url: 'https://workspace.notion.site/Legacy-' + c };
child.loaded = false;
child.sections = [{ id: 'notion-body', label: '본문', text: '원문 불러오는 중…' }];
const resolveLink = createResearchLinkResolver(data.records);
for (const url of [
  'https://app.notion.com/p/Child-' + b,
  'https://notion.so/' + uuid.toUpperCase() + '?source=copy_link#' + a,
  'https://workspace.notion.site/Child-' + b + '/',
  'https://www.notion.so/' + a + '?p=' + b,
  '/Child-' + b, b, 'https://www.notion.so/%43hild-' + b
]) assert.equal(resolveLink(url, parent.source.url).record?.id, child.id, url);
assert.equal(resolveLink(legacy.source.url).record?.id, legacy.id, 'legacy source URL lookup');
assert.equal(resolveLink('#' + b, parent.source.url).record?.id, parent.id, 'block hashes do not select another page');
for (const url of ['https://notion.so.evil.test/' + b, 'https://example.com/' + b, 'https://example.com/?p=' + b]) {
  assert.equal(resolveLink(url).notion, false); assert.equal(resolveLink(url).record, undefined);
}
for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'http://notion.so/' + b, 'https://user:pass@notion.so/' + b, '', null]) assert.equal(resolveLink(url, parent.source.url), null);
assert.equal(resolveLink('https://notion.so/' + 'd'.repeat(32)).notion, true);
assert.equal(resolveLink('https://notion.so/%ZZ').record, undefined);

const markdown = `[본문 링크](https://app.notion.com/p/${b})

<page url="/${b}">하위 페이지</page>

<mention-page url="https://www.notion.so/${uuid}">페이지 멘션</mention-page>

<table><tr><td>[표 안 링크](https://workspace.notion.site/Child-${b})</td></tr></table>

https://notion.so/${b}

[미연동 페이지](https://notion.so/${'d'.repeat(32)})

[외부 자료](https://example.org/report)

[위험 링크](javascript:alert(1))

<page url="javascript:alert(1)">위험 페이지</page>

<img src=x onerror=alert(1)><script>alert(1)</script>`;
parent.sections[0].markdown = markdown;
parent.references = [{ label: '연동 참고 기록', url: child.source.url }, { label: '미연동 참고 기록', url: 'https://notion.so/' + 'e'.repeat(32) }];

const { JSDOM } = await import(process.env.JSDOM_MODULE || 'jsdom');
const win = new JSDOM('', { url: 'https://example.com/#research?note=' + parent.id, pretendToBeVisual: true }).window;
const root = win.document.createElement('section'); win.document.body.append(root); win.document.body.dataset.stage = 'research';
let reader;
try {
  root.append(renderNotionMarkdown(markdown, win.document, { resolveLink, baseURL: parent.source.url }));
  const internal = [...root.querySelectorAll('.research-internal-link')];
  assert.equal(internal.length, 5, 'inline, child page, mention, table and autolink resolve internally');
  for (const link of internal) { assert.equal(link.getAttribute('href'), '#research?note=' + child.id); assert.equal(link.target, ''); }
  assert.equal(root.querySelectorAll('script,[onerror]').length, 0); assert.ok(!root.innerHTML.includes('javascript:'));
  assert.equal(root.querySelector('a[href="https://example.org/report"]').target, '_blank');
  assert.equal(root.querySelectorAll('a[href*="notion."]').length, 0, 'no original destinations on ordinary Notion links');
  assert.equal(root.querySelector('.research-unavailable-link').tagName, 'BUTTON');

  reader = createResearch(root, { data });
  const body = () => root.querySelector('.research-notion-body');
  const click = element => element.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  const query = root.querySelector('#research-query'); query.value = parent.title; query.dispatchEvent(new win.Event('input'));
  assert.equal(root.querySelector('#research-count').textContent, '1 / 3');
  const modified = new win.MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true });
  body().querySelector('.research-internal-link').dispatchEvent(modified);
  assert.equal(modified.defaultPrevented, false, 'modifier clicks retain a valid internal deep link');
  assert.equal(reader.getState().note, parent.id);
  click(body().querySelector('.research-internal-link'));
  assert.equal(reader.getState().note, child.id); assert.equal(reader.getState().view, 'read');
  assert.equal(reader.getState().section, '', 'ordinary reading does not mark an evidence section');
  assert.equal(reader.getState().query, '', 'filters clear if they would hide the linked page');
  assert.equal(root.dataset.panel, 'record'); assert.equal(root.querySelector('#research-record-title').textContent, child.title);
  assert.match(root.querySelector('#research-reader').textContent, /원문 불러오는 중/);
  assert.deepEqual(reader.prioritizedRecordIds(), [child.id], 'pending linked page is prioritized for hydration');
  assert.equal(win.location.origin, 'https://example.com');
  const loaded = structuredClone(data); loaded.records[1].loaded = true; loaded.records[1].sections[0].text = '새로 동기화된 테스트 본문';
  reader.update(loaded); assert.match(root.querySelector('#research-reader').textContent, /새로 동기화된 테스트 본문/);
  // The app's route layer dispatches realm-view on browser back/forward.
  win.history.replaceState(null, '', '#research?note=' + parent.id); win.dispatchEvent(new win.Event('realm-view'));
  assert.equal(root.querySelector('#research-record-title').textContent, parent.title);
  const before = win.location.href;
  click(body().querySelector('.research-unavailable-link'));
  const notice = root.querySelector('.research-link-notice');
  assert.equal(win.location.href, before); assert.equal(notice.hidden, false); assert.equal(win.document.activeElement, notice);
  assert.match(notice.textContent, /아직 Research에 연동되지 않은 페이지/);
  assert.equal(notice.querySelector('a').textContent, 'Notion 원문에서 열기'); assert.equal(notice.querySelector('a').target, '_blank');
  click(notice.querySelector('button')); assert.equal(notice.hidden, true);
  assert.equal(win.document.activeElement, body().querySelector('.research-unavailable-link'));
  click(body().querySelector('.research-unavailable-link'));
  reader.update(loaded);
  assert.equal(root.querySelector('.research-link-notice').hidden, false, 'background hydration retains the source opt-in notice');
  click(root.querySelector('.research-notice-close'));
  assert.equal(root.querySelector('.research-link-notice').hidden, true);
  const source = root.querySelector('.research-provenance > a');
  assert.equal(source.textContent, 'Notion 원문'); assert.equal(source.href, parent.source.url); assert.equal(source.target, '_blank');
  click(root.querySelector('.research-provenance .research-internal-link'));
  assert.equal(reader.getState().note, child.id, 'Notion references also read internally');
  win.history.replaceState(null, '', '#research?note=' + parent.id); win.dispatchEvent(new win.Event('realm-view'));
  const revoked = structuredClone(data); revoked.records = revoked.records.filter(r => r.id !== child.id);
  reader.update(revoked);
  assert.equal(body().querySelectorAll('.research-internal-link').length, 0, 'revoked records leave no stale internal targets');
  assert.equal(body().querySelectorAll('.research-unavailable-link').length, 6);
  console.log('PASS: Notion URL resolution, sanitized child/mention/table links, internal reading, filter reset, hydration, route restore, source opt-in and catalog revocation.');
} finally { reader?.destroy(); win.close(); }

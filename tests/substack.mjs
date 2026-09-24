import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSubstackFeed, sanitizeSubstackBody, createSubstackReader, watchSubstack } from '../substack.js';
import { emptyFeed, sampleFeed, wrapFeed } from './substack-fixture.mjs';
import snapshot from '../data/substack-snapshot.js';
const { JSDOM } = await import(process.env.JSDOM_MODULE || 'jsdom');
const { window } = new JSDOM(await readFile(new URL('../index.html',import.meta.url),'utf8'),{url:'https://seungmin.xyz/#substack'});
try {
  const document=window.document, Parser=window.DOMParser;
  assert.deepEqual(parseSubstackFeed(emptyFeed,Parser),[]);
  assert.throws(()=>parseSubstackFeed('<html>upstream failed</html>',Parser));
  assert.throws(()=>parseSubstackFeed('<!DOCTYPE rss><rss><channel/></rss>',Parser));
  assert.throws(()=>parseSubstackFeed('x'.repeat(3*1024*1024+1),Parser));
  const posts=parseSubstackFeed(sampleFeed,Parser);
  assert.equal(posts.length,12);assert.equal(posts[0].author,'YSM');
  assert.equal(posts[0].url,'https://tudoryoon.substack.com/p/fixture-0');
  assert.match(posts[0].html,/blockquote/);
  const badLinks=['javascript:alert(1)','https://attacker.invalid/p/x','https://tudoryoon.substack.com@attacker.invalid/p/x','http://tudoryoon.substack.com/p/x'];
  assert.equal(parseSubstackFeed(wrapFeed(badLinks.map(link=>`<item><title>Unsafe</title><link>${link}</link></item>`).join('')),Parser).length,0);
  const duplicate='<item><title>One</title><link>https://tudoryoon.substack.com/p/one</link><pubDate>invalid</pubDate></item>';
  assert.equal(parseSubstackFeed(wrapFeed(duplicate.repeat(2)),Parser).length,1);
  const sanitized=sanitizeSubstackBody(`<script>alert(1)</script><iframe src="https://attacker.invalid"></iframe><form><input name="password"></form><p onclick="alert(1)" style="position:fixed" id="auth">Safe</p><a href="javascript:alert(1)">Bad</a><a href="/p/real">Good</a><img src="https://attacker.invalid/tracker" onerror="alert(1)"><img src="https://substackcdn.com/image/test.png" onerror="alert(1)"><svg onload="alert(1)"></svg>`,document);
  assert.equal(sanitized.querySelector('script,iframe,form,input,svg,[onclick],[onerror],[style],[id]'),null);
  assert.equal(sanitized.querySelectorAll('img').length,1);
  assert.equal(sanitized.querySelector('a').hasAttribute('href'),false);
  assert.equal(sanitized.querySelectorAll('a')[1].href,'https://tudoryoon.substack.com/p/real');
  assert.equal(sanitized.querySelectorAll('a')[1].rel,'noopener noreferrer');
  assert.equal(sanitized.querySelector('img').referrerPolicy,'no-referrer');
  let attempts=0,fail=true,release;
  const root=document.getElementById('substack-content');
  const reader=createSubstackReader(root,async(url,options)=>{
    attempts++;assert.equal(url,'/api/substack');assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');
    if(fail)throw new Error('offline');
    await new Promise(resolve=>{release=resolve;});
    return new Response(sampleFeed);
  });
  assert.equal(attempts,0,'feed is lazy and does not load for other pages');
  assert.ok(root.querySelectorAll('#substack-posts button').length > 0,'bundled public posts render before the first request');
  await reader.load();assert.equal(root.getAttribute('aria-busy'),'false');
  assert.equal(root.querySelector('.substack-post-title').textContent,parseSubstackFeed(snapshot.xml,Parser)[0].title,'cold-start failure retains the actual public snapshot');
  assert.equal(document.getElementById('substack-status').textContent,'');
  assert.equal(document.getElementById('substack-retry').hidden,false);
  fail=false;document.getElementById('substack-retry').click();const first=reader.load(),second=reader.load();assert.equal(attempts,2,'retry and concurrent calls deduplicate');release();await first;await second;
  assert.equal(root.querySelectorAll('#substack-posts button').length,12);
  assert.equal(document.getElementById('substack-status').textContent,'');
  const firstButton=root.querySelector('#substack-posts button');root.scrollTop=130;firstButton.click();
  assert.equal(document.getElementById('substack-posts').hidden,true);
  assert.equal(document.getElementById('substack-article').hidden,false);
  assert.equal(document.getElementById('substack-article-title').textContent,posts[0].title);
  assert.equal(document.getElementById('substack-article-body').querySelector('script'),null);
  document.getElementById('substack-back').click();
  assert.equal(root.scrollTop,130);assert.equal(document.activeElement,firstButton);
  await reader.load();assert.equal(attempts,2,'recent results are reused');
  assert.equal(root.lastElementChild.className,'substack-footer','profile address remains last');
  assert.equal(root.lastElementChild.querySelector('a').href,'https://substack.com/@tudoryoon');
  let checks=0,hidden=false,interval=null;
  Object.defineProperty(document,'hidden',{get:()=>hidden});
  window.setInterval=(callback,ms)=>{assert.equal(ms,60000);interval=callback;return 1;};
  window.clearInterval=()=>{interval=null;};
  document.body.dataset.stage='home';
  const dispose=watchSubstack({load(){checks++;}},document);
  assert.equal(checks,0);assert.equal(interval,null);
  document.body.dataset.stage='substack';window.dispatchEvent(new window.Event('realm-view'));
  assert.equal(checks,1);interval();assert.equal(checks,2);
  hidden=true;interval();assert.equal(checks,2,'background tabs do not poll');
  hidden=false;document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(checks,3);
  window.dispatchEvent(new window.Event('online'));assert.equal(checks,4);
  document.body.dataset.stage='auth';window.dispatchEvent(new window.Event('realm-view'));
  assert.equal(interval,null);window.dispatchEvent(new window.Event('focus'));window.dispatchEvent(new window.Event('online'));assert.equal(checks,4,'private routes do not fetch');
  dispose();document.body.dataset.stage='substack';window.dispatchEvent(new window.Event('realm-view'));assert.equal(checks,4);

  const markup=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const cacheKey='seungmin-public-substack-v1';
  const saved=window.localStorage.getItem(cacheKey);
  assert.equal(JSON.parse(saved).xml,sampleFeed,'successful reads are persisted');
  for (const failure of ['offline','http','invalid','empty','older']) {
    const reload=new JSDOM(markup,{url:'https://seungmin.xyz/#substack'});
    try {
      reload.window.localStorage.setItem(cacheKey,saved);
      const reloadedRoot=reload.window.document.getElementById('substack-content');
      const reloaded=createSubstackReader(reloadedRoot,async()=>{
        if (failure==='offline') throw new Error('offline');
        if (failure==='http') return new Response('failed',{status:502});
        if (failure==='invalid') return new Response('<rss>broken');
        if (failure==='empty') return new Response(emptyFeed);
        return new Response(snapshot.xml,{headers:{'X-Feed-State':'snapshot','X-Feed-Updated-At':snapshot.fetchedAt}});
      });
      assert.equal(reloadedRoot.querySelectorAll('#substack-posts button').length,12,'reload immediately restores saved posts');
      const button=reloadedRoot.querySelector('#substack-posts button');
      button.click();reloadedRoot.scrollTop=80;
      await reloaded.load(true);
      assert.equal(reloadedRoot.querySelectorAll('#substack-posts button').length,12,`${failure} must not erase or downgrade posts`);
      assert.equal(reloadedRoot.querySelector('#substack-status').textContent,'');
      assert.equal(reloadedRoot.querySelector('#substack-article').hidden,false,'refresh must not close the article');
      assert.equal(reloadedRoot.scrollTop,80);
      assert.equal(reload.window.localStorage.getItem(cacheKey),saved,'failed or older data must not overwrite the last good snapshot');
    } finally {reload.window.close();}
  }
  for (const storage of ['corrupt','unavailable','quota']) {
    const isolated=new JSDOM(markup,{url:'https://seungmin.xyz/#substack'});
    try {
      if (storage==='corrupt') isolated.window.localStorage.setItem(cacheKey,'not-json');
      if (storage==='unavailable') Object.defineProperty(isolated.window,'localStorage',{get(){throw new Error('blocked');}});
      if (storage==='quota') isolated.window.Storage.prototype.setItem=()=>{throw new Error('quota');};
      const isolatedRoot=isolated.window.document.getElementById('substack-content');
      const isolatedReader=createSubstackReader(isolatedRoot,async()=>new Response(sampleFeed));
      assert.ok(isolatedRoot.querySelectorAll('#substack-posts button').length>0);
      await isolatedReader.load();
      assert.equal(isolatedRoot.querySelectorAll('#substack-posts button').length,12,`${storage} storage cannot prevent live updates`);
    } finally {isolated.window.close();}
  }
  const updatedFeed=wrapFeed('<item><title>A newly published post</title><link>https://tudoryoon.substack.com/p/new-post</link><description>New content</description></item>');
  const freshWindow=new JSDOM(markup,{url:'https://seungmin.xyz/#substack'});
  try {
    freshWindow.window.localStorage.setItem(cacheKey,saved);
    const freshRoot=freshWindow.window.document.getElementById('substack-content');
    const freshReader=createSubstackReader(freshRoot,async()=>new Response(updatedFeed,{headers:{'X-Feed-State':'fresh','X-Feed-Updated-At':new Date(Date.now()+60000).toISOString()}}));
    freshRoot.querySelector('#substack-posts button').click();
    const openTitle=freshRoot.querySelector('#substack-article-title').textContent;
    await freshReader.load();
    assert.equal(freshRoot.querySelector('.substack-post-title').textContent,'A newly published post','new successful feed replaces cached list automatically');
    assert.equal(freshRoot.querySelector('#substack-article-title').textContent,openTitle,'background updates do not replace the article being read');
    assert.equal(JSON.parse(freshWindow.window.localStorage.getItem(cacheKey)).xml,updatedFeed);
  } finally {freshWindow.window.close();}
  console.log('PASS: RSS parsing/sanitization, immediate snapshot, persistent reload, failed/empty/older feed retention, unavailable storage, article/scroll/focus preservation, lazy polling and retry.');
} finally {window.close();}

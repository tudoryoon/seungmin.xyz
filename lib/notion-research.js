import { makeNotionDataset, notionId, scopedPages } from '../research-sync-core.js';

export const ROOT_PAGE = '3b271f4f9d4c80e3ad2cecb7f0db3174';
const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
const failure = (code, status = 503) => Object.assign(new Error(code), { code, status });

export function createNotionResearch({ fetchRequest = (...args) => globalThis.fetch(...args), now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)), cache = () => globalThis.caches?.default } = {}) {
  const memory = new Map(), pending = new Map();
  async function cached(env, key, seconds, produce) {
    const hash = hex(await crypto.subtle.digest('SHA-256', encoder.encode('notion-v1:' + env.NOTION_TOKEN + ':' + env.RESEARCH_SECRET + ':' + key)));
    const found = memory.get(hash); if (found && found.until > now()) return found.value;
    if (pending.has(hash)) return pending.get(hash);
    const task = (async () => {
      const raw = Uint8Array.from(env.RESEARCH_SECRET.match(/../g), s => parseInt(s, 16));
      const aes = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
      const request = new Request('https://research-cache.invalid/' + hash), store = cache();
      if (store) try {
        const hit = await store.match(request);
        if (hit) {
          const bytes = new Uint8Array(await hit.arrayBuffer());
          const decoded = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},aes,bytes.slice(12))));
          if (decoded.until > now()) { memory.set(hash, decoded); return decoded.value; }
        }
      } catch { /* A missing/corrupt cache is never an authorization decision. */ }
      const value = await produce(), entry = {value,until:now()+seconds*1000};
      if (memory.size >= 150) memory.delete(memory.keys().next().value);
      memory.set(hash, entry);
      if (store) try {
        const iv = crypto.getRandomValues(new Uint8Array(12)), encrypted = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},aes,encoder.encode(JSON.stringify(entry))));
        const body = new Uint8Array(12+encrypted.length);body.set(iv);body.set(encrypted,12);
        await store.put(request,new Response(body,{headers:{'Cache-Control':'max-age='+seconds}}));
      } catch { /* Notion remains the source of truth when edge caching is unavailable. */ }
      return value;
    })();
    pending.set(hash, task); try { return await task; } finally { pending.delete(hash); }
  }
  async function api(env, path, body) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let result;
      try { result = await fetchRequest('https://api.notion.com/v1/' + path, {
        method: body ? 'POST' : 'GET', headers:{Authorization:'Bearer '+env.NOTION_TOKEN,'Notion-Version':'2026-03-11','Content-Type':'application/json'},
        ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(12000), redirect:'manual'
      }); } catch (error) {
        // Classify runtime errors without returning request headers or credentials.
        const message = String(error?.message || '');
        const reason = /Illegal invocation/i.test(message) ? 'binding'
          : /redirect/i.test(message) ? 'redirect'
          : /AbortSignal|timeout/i.test(message) ? 'timeout'
          : error?.name === 'TypeError' ? 'type' : 'transport';
        throw failure('notion_' + reason);
      }
      if (result.status >= 300 && result.status < 400) throw failure('notion_redirect');
      if (result.status === 429 && !attempt) { const wait = Math.min(5,Math.max(1,Number(result.headers.get('Retry-After')) || 1)); await sleep(wait*1000); continue; }
      if (!result.ok) throw failure([401,403,404].includes(result.status) ? 'notion_access' : 'notion_unavailable', [401,403,404].includes(result.status) ? 403 : 503);
      const text = await result.text(); if (text.length > 2*1024*1024) throw failure('notion_size');
      try { return JSON.parse(text); } catch { throw failure('notion_response'); }
    }
    throw failure('notion_rate_limit');
  }
  async function catalog(env) {
    // Check the allowed root even when a cached search result exists.
    const root = await api(env, 'pages/' + ROOT_PAGE);
    if (root.in_trash || root.archived) throw failure('notion_access',403);
    const pages = await cached(env,'catalog',30,async () => {
      const items = []; let cursor;
      do {
        const data = await api(env,'search',{filter:{value:'page',property:'object'},page_size:100,...(cursor?{start_cursor:cursor}:{})});
        items.push(...data.results); cursor = data.has_more ? data.next_cursor : null;
        if (items.length > 1000 || data.has_more && !cursor) throw failure('notion_catalog_limit');
        if (cursor) await sleep(350);
      } while (cursor);
      return items;
    });
    return scopedPages([root,...pages.filter(p=>notionId(p.id)!==ROOT_PAGE)],ROOT_PAGE);
  }
  return async function load(seed, env, request) {
    if (!env.NOTION_TOKEN) return { ...seed, sync: {status:'unconfigured'} };
    let pages;
    try { pages = await catalog(env); } catch (error) { throw error.code ? error : failure('notion_catalog'); }
    const syncedAt = new Date(now()).toISOString();
    const params = new URL(request.url).searchParams, hydrate = params.get('hydrate');
    if (!hydrate) {
      try { return { ...makeNotionDataset(pages,seed,{rootId:ROOT_PAGE,syncedAt}), sync:{status:'connected',intervalSeconds:300} }; }
      catch { throw failure('notion_dataset'); }
    }
    const ids = [...new Set(hydrate.split(',').map(notionId))], refresh = params.get('refresh');
    if (!ids.length || ids.length > 4 || ids.some(id=>! /^[a-f0-9]{32}$/.test(id))) throw failure('invalid',400);
    if (refresh && (refresh !== 'images' || ids.length !== 1)) throw failure('invalid',400);
    const allowed = new Map(pages.filter(p=>notionId(p.id)!==ROOT_PAGE).map(p=>[notionId(p.id),p])), bodies=[];
    for (const id of ids) {
      const page = allowed.get(id);
      if (!page) { bodies.push({pageId:id,removed:true}); continue; }
      try {
        // A bounded fresh export repairs expired image signatures even if the
        // normal five-minute body cache still contains the failing URL.
        const bodyKey = refresh ? 'images:' + Math.floor(now()/30000) + ':' : 'body:';
        const body = await cached(env,bodyKey+id+':'+page.last_edited_time,refresh ? 30 : 300,async()=> {
          await sleep(350);
          const content = await api(env,'pages/'+id+'/markdown');
          if (typeof content.markdown !== 'string') throw failure('notion_content');
          // IDs only, never follow arbitrary external URLs found in source content.
          const linkedPageIds = [...content.markdown.matchAll(/https:\/\/(?:app\.)?notion\.(?:com|so)\/[^\s"<>)]*?([a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})(?=[\s"<>)/?#]|$)/gi)].map(m=>notionId(m[1]));
          return {pageId:id,editedAt:page.last_edited_time,markdown:content.markdown,truncated:!!content.truncated,unsupported:!!content.unknown_block_ids?.length,linkedPageIds,fetchedAt:syncedAt};
        });
        bodies.push(body);
      } catch(error) { if(error.code==='notion_access') bodies.push({pageId:id,removed:true}); else throw error; }
    }
    return {bodies,syncedAt};
  };
}

import {readFile, writeFile, rename} from 'node:fs/promises';
import {FEED_URL, readFeed, validateFeed} from '../lib/substack-feed.js';

const target = new URL('../data/substack-snapshot.js',import.meta.url);
const xml = await readFeed(await fetch(FEED_URL, {
  headers:{Accept:'application/rss+xml, application/xml, text/xml'},
  redirect:'manual',signal:AbortSignal.timeout(15000)
}));
if (!validateFeed(xml)) throw new Error('Refusing to replace the public snapshot with an empty feed');
const previous = await readFile(target,'utf8');
const snapshot = {fetchedAt:new Date().toISOString(),xml};
const next = '// Public RSS snapshot. Refreshed with scripts/update-substack-snapshot.mjs.\nexport default ' + JSON.stringify(snapshot,null,2) + ';\n';
if (previous !== next) {
  const temporary = new URL('../data/substack-snapshot.js.tmp',import.meta.url);
  await writeFile(temporary,next); await rename(temporary,target);
}
console.log(`Saved ${validateFeed(xml)} public Substack posts.`);

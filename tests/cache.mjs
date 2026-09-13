import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseAvatar} from '../avatar.js';
import {dailyFixture} from './daily-fixture.mjs';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.TEST_ROOT || fileURLToPath(new URL('../',import.meta.url));
const repo = process.env.SOURCE_REPO || root;
const version = '20260914-4';
const user = {id:'cache-test-user',user_metadata:{
  realm_profile:{version:1,name:'테스트',age:30,gender:'unspecified',mbti:'',blood:''},
  realm_avatar:parseAvatar('청록색 도포를 입은 도사. 지팡이.')
}};
// Serve a local auth fixture, not Playwright routing: routing disables HTTP cache.
const auth = `window.realmError=error=>error.message;window.realmClient={rpc:async()=>({data:${JSON.stringify(dailyFixture())}}),auth:{
  getSession:async()=>({data:{session:{user:${JSON.stringify(user)}}}}),
  onAuthStateChange(){}
}};`;
const browser = await chromium.launch({headless:true,channel:'chrome'});
try {
  for (const revision of ['00b6242','fcb8416','5367651']) {
    let deployed = false;
    const requested = [], errors = [];
    const server = createServer(async(req,res)=>{
      const url = new URL(req.url,'http://local');
      const path = url.pathname.slice(1) || 'index.html';
      if (deployed) requested.push(url.pathname+url.search);
      try {
        const body = path==='auth-client.js' ? auth : deployed ? await readFile(root+'/'+path)
          : execFileSync('git',['show',revision+':'+path],{cwd:repo,stdio:['ignore','pipe','ignore']});
        const type = path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.webp')?'image/webp':'text/html';
        // Model the custom domain overriding asset headers, even after deployment.
        res.writeHead(200,{'Content-Type':type,'Cache-Control':path.endsWith('.html')
          ? 'no-cache, max-age=0, must-revalidate':'public, max-age=14400, must-revalidate'});
        res.end(body);
      } catch {res.writeHead(404);res.end();}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const context = await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    try {
      const page = await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      const base = 'http://127.0.0.1:'+server.address().port;
      await page.goto(base);
      await page.waitForFunction(()=>performance.getEntriesByType('resource').some(entry=>entry.name.includes('/portal.js')));
      await page.locator('#enter').click();
      await page.locator(revision==='00b6242'?'#complete':'#map').waitFor({state:'visible'});
      await page.evaluate(()=>localStorage.setItem('seungmin-journal-v1','{"records":["keep"]}'));
      deployed = true;
      await page.goto('about:blank');
      await page.goto(base);
      await page.locator('#map').waitFor({state:'visible',timeout:5000});
      await page.locator('#map-character').click();
      await page.locator('#open-map').click();
      assert.equal(await page.locator('#map').isVisible(),true);
      assert.equal(await page.locator('[data-location]').count(),4);
      for (const file of ['realm.js','realm-route.js','portal.js','avatar.js','profile.js','dungeon.js','roads.js','map-wind.js','styles.css','dungeon.css','continuity.css','player-level.js']) {
        assert.ok(requested.includes('/'+file+'?v='+version),'new version fetched: '+file);
      }
      assert.equal(await page.evaluate(()=>localStorage.getItem('seungmin-journal-v1')),'{"records":["keep"]}');
      assert.deepEqual(errors,[]);
      console.log('PASS: warm '+revision+' cache upgrades without clearing browser data.');
    } finally {await context.close();await new Promise(resolve=>server.close(resolve));}
  }
  assert.match(await readFile(root+'/_headers','utf8'),/Cache-Control: no-cache, max-age=0, must-revalidate/);
} finally {await browser.close();}

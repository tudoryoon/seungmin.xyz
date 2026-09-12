import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { parseAvatar } from '../avatar.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sharp = (await import(process.env.SHARP_MODULE || 'sharp')).default;
const root = new URL('../', import.meta.url);
const server = createServer(async (req,res) => {
  try {
    const path = new URL(req.url,'http://local').pathname;
    const file = new URL('.' + (path === '/' ? '/index.html' : path), root);
    if (!file.href.startsWith(root.href)) throw new Error('path');
    const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.webp') ? 'image/webp' : 'text/html';
    res.setHeader('Content-Type',type);res.end(await readFile(file));
  } catch {res.writeHead(404);res.end();}
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({headless:true,channel:'chrome'});
const errors = [], failed = [];
const user = {id:'00000000-0000-4000-8000-000000000001',email:'map@example.com',aud:'authenticated',role:'authenticated',
  app_metadata:{provider:'email'},user_metadata:{realm_profile:{version:1,name:'승민',age:31,gender:'unspecified',mbti:'',blood:''},
    realm_avatar:parseAvatar('은빛 긴 머리에 청록색 도포를 입은 도사. 지팡이.')},created_at:new Date().toISOString()};
const session = {access_token:['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url'),'sig'].join('.'),refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user};
async function setup(viewport) {
  const context = await browser.newContext({viewport});
  const page = await context.newPage();
  page.on('pageerror',error => errors.push(error.message));
  page.on('response',r => { if(r.url().startsWith(base) && r.status() >= 400) failed.push(r.url()); });
  await context.route('https://rciahwtvrsysxqvjjtuu.supabase.co/**',async route => {
    const path = new URL(route.request().url()).pathname;
    let result = {},status = 200;
    if(path.endsWith('/token')) result = session;
    else if(path.endsWith('/user')) result = user;
    else if(path.endsWith('/logout')) {status=204;result=null;}
    else if(path.includes('/journal_records')) result = [];
    await route.fulfill({status,contentType:'application/json',body:status===204?'':JSON.stringify(result)});
  });
  await page.goto(base + '/index.html#map');
  await page.locator('#auth').waitFor({state:'visible'});
  assert.equal(await page.locator('#map').isVisible(),false,'signed-out accounts cannot see map');
  await page.locator('#email').fill(user.email);await page.locator('#password').fill('test-password');
  await page.locator('#auth-submit').click();await page.locator('#map').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('.dungeon-art img').complete && document.querySelector('.dungeon-art img').naturalWidth>900);
  return page;
}
async function checkLayout(page, name) {
  await page.locator('#map').evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished)));
  await page.waitForTimeout(400);
  await page.locator('.dungeon-art img').evaluate(async image => { await image.decode(); await new Promise(requestAnimationFrame); });
  const viewport=page.viewportSize();
  assert.equal(await page.locator('body').innerText().then(text=>/seungmin\.xyz/i.test(text)),false,'no visible domain or logo');
  assert.equal(await page.locator('.world').evaluate(element=>getComputedStyle(element).visibility),'visible','space continues behind dungeon');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const nodes=page.locator('[data-location]');
  assert.equal(await nodes.count(),3);
  const boxes=await nodes.evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
  for(const b of boxes){
    assert.ok(b.x>=0 && b.x+b.w<=viewport.width && b.y>=80 && b.y+b.h<=viewport.height,'node fits viewport: '+name);
    assert.ok(b.h>=44,'touch target');
  }
  for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];
    assert.ok(a.x+a.w<=b.x || b.x+b.w<=a.x || a.y+a.h<=b.y || b.y+b.h<=a.y,'nodes do not overlap');
  }
  const painted=await page.locator('#map-avatar').evaluate(canvas=>{
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let opaque=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)opaque++;return opaque;
  });
  assert.ok(painted>1000,'saved avatar rendered');
  const src=await page.locator('.dungeon-art img').evaluate(el=>el.currentSrc);
  assert.ok(src.includes(viewport.width<=viewport.height?'dungeon-tall':'dungeon-wide'));
  const screenshot = await page.screenshot({path:'/tmp/dungeon-'+name+'.png',fullPage:true});
  const stats = await sharp(screenshot).extract({left:Math.round(viewport.width*.44),top:Math.round(viewport.height*.18),width:Math.round(viewport.width*.12),height:Math.round(viewport.height*.12)}).stats();
  assert.ok(stats.channels.slice(0,3).some(channel=>channel.stdev>5),'map terrain is visibly rendered: '+name);
}
try {
  const page=await setup({width:1440,height:900});
  await checkLayout(page,'desktop');
  const actorStart=await page.locator('#map-actor').boundingBox();
  await page.locator('[data-location=calendar]').click();
  await page.waitForFunction(x=>document.querySelector('#map-actor').getBoundingClientRect().x<x-8,actorStart.x);
  assert.equal(await page.locator('#map').getAttribute('aria-busy'),'true');
  await page.locator('#calendar').waitFor({state:'visible'});
  assert.equal(new URL(page.url()).hash,'#calendar');
  await page.locator('.map-return').click();await page.locator('#map').waitFor({state:'visible'});
  assert.equal(await page.locator('#map').getAttribute('aria-busy'),null);
  await page.locator('#motion').uncheck();
  const paused = await page.locator('#portal').screenshot();
  await page.waitForTimeout(300);
  assert.equal(Buffer.compare(await page.locator('#portal').screenshot(),paused)===0,true,'motion toggle freezes the shared scene');
  await page.locator('[data-location=workout]').focus();await page.keyboard.press('Enter');
  await page.locator('#workout').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-tab=workout]').getAttribute('aria-pressed'),'true');
  await page.locator('#add-workout').click();await page.locator('#editor').waitFor({state:'visible'});
  await page.locator('#close-editor').click();
  await page.locator('.map-return').click();await page.locator('#map').waitFor({state:'visible'});
  await page.locator('[data-location=projects]').click();await page.locator('#projects').waitFor({state:'visible'});
  assert.equal(await page.locator('#projects').getByText('준비 중',{exact:true}).count(),1);
  await page.screenshot({path:'/tmp/dungeon-projects.png'});
  await page.locator('[data-tab=calendar]').click();await page.locator('#calendar').waitFor({state:'visible'});
  await page.goBack();await page.locator('#projects').waitFor({state:'visible'});
  await page.reload();await page.locator('#projects').waitFor({state:'visible'});
  await page.locator('.map-return').click();await page.locator('#map').waitFor({state:'visible'});
  await page.locator('#map-character').click();await page.locator('#complete').waitFor({state:'visible'});
  await page.locator('#open-map').click();await page.locator('#map').waitFor({state:'visible'});
  await page.locator('#motion').check();
  await page.locator('[data-location=workout]').click();
  await page.locator('#logout').click();await page.locator('#auth').waitFor({state:'visible'});
  await page.waitForTimeout(750);
  assert.ok(page.url().includes('index.html'),'logout cancels pending navigation');
  assert.equal(await page.locator('#map-name').textContent(),'');
  const mobile=await setup({width:390,height:844});
  await checkLayout(mobile,'mobile');
  for (const [name,viewport] of [
    ['small-mobile',{width:320,height:740}],['tablet',{width:1024,height:1366}],
    ['wide',{width:2560,height:1080}],['short-desktop',{width:1280,height:720}]
  ]) {await mobile.setViewportSize(viewport);await mobile.waitForTimeout(200);await checkLayout(mobile,name);}
  await mobile.setViewportSize({width:390,height:844});
  await mobile.locator('#motion').uncheck();
  await mobile.locator('[data-location=projects]').click();await mobile.locator('#projects').waitFor({state:'visible'});
  await mobile.locator('.map-return').click();await mobile.locator('#map').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  assert.deepEqual(failed,[]);
  console.log('PASS: 3 map destinations, desktop/mobile/tablet layouts, saved avatar, walking transition, reduced motion, keyboard navigation, deep links, back/refresh, character access, and logout cancellation.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}

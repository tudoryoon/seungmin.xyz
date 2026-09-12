import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { parseAvatar, validAvatar, avatarTraits } from '../avatar.js';
import { validProfile } from '../profile.js';
import { dailyFixture } from './daily-fixture.mjs';
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.BROWSER || 'chromium';
const sharp = (await import(process.env.SHARP_MODULE || 'sharp')).default;

const silver = parseAvatar('은빛 긴 머리에 청록색 도포를 입은 도사. 손에는 달빛 지팡이.');
assert.equal(silver.hair,'silver');assert.equal(silver.outfit,'jade');assert.equal(silver.hairstyle,'long');
const red = parseAvatar('검은 포니테일에 붉은 도포를 입고 검을 든 검객.');
assert.equal(red.hair,'black');assert.equal(red.outfit,'red');assert.equal(red.weapon,'sword');assert.equal(red.hairstyle,'ponytail');
assert.equal(parseAvatar('a wizard with silver long hair and a blue robe').outfit,'blue');
assert.equal(parseAvatar('우주를 떠도는 로봇').recognized,false);
assert.equal(validAvatar({...silver,role:'__proto__'}),false);
assert.equal(validProfile({version:1,name:' ',age:20,gender:'male',mbti:'',blood:''}),false);

const root = new URL('../',import.meta.url);
const server = createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://local').pathname;
    const file=new URL('.'+(path==='/'?'/index.html':path),root);
    if(!file.href.startsWith(root.href)) throw new Error('path');
    const type=path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.webp')?'image/webp':'text/html';
    res.setHeader('Content-Type',type);res.end(await readFile(file));
  } catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome',args:['--enable-unsafe-swiftshader']}:{})});
const errors=[];
const users=new Map();
const makeUser=(email,id)=>({id,email,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()});
users.set('a@example.com',makeUser('a@example.com','00000000-0000-4000-8000-000000000001'));
users.set('b@example.com',makeUser('b@example.com','00000000-0000-4000-8000-000000000002'));
const session=user=>({access_token:['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url'),'sig'].join('.'),refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user});
let failUpdate=false,updates=0;
async function setup(options={}) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},...options});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://rciahwtvrsysxqvjjtuu.supabase.co/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    let result={},status=200;
    if(path.endsWith('/token')){
      const body=req.postDataJSON(),user=users.get(body.email);
      if(!user||body.password==='wrong-password'){status=400;result={message:'Invalid login credentials'};}
      else result=session(user);
    } else if(path.endsWith('/signup')) result={user:makeUser('new@example.com','new-user'),session:null};
    else if(path.endsWith('/user')){
      const bearer=req.headers().authorization?.split(' ')[1];
      const id=JSON.parse(Buffer.from(bearer.split('.')[1],'base64url').toString()).sub;
      const user=[...users.values()].find(user=>user.id===id);
      if(req.method()==='PUT'){
        if(failUpdate){status=503;result={message:'offline'};}
        else {Object.assign(user.user_metadata,req.postDataJSON().data || {});updates++;result=user;}
      } else result=user;
    } else if(path.endsWith('/logout')){status=204;result=null;}
    else if(path.includes('/journal_records')) result=[];
    else if(path.endsWith('/daily_plan_state')) result=dailyFixture();
    await route.fulfill({status,contentType:'application/json',body:status===204?'':JSON.stringify(result)});
  });
  return {page,context};
}
async function login(page,email='a@example.com'){
  await page.locator('#email').fill(email);await page.locator('#password').fill('a-test-password');
  await page.locator('#auth-submit').click();
}
async function pixels(locator){
  return await sharp(await locator.screenshot()).ensureAlpha().raw().toBuffer();
}
const changed=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12)n++;return n;};
async function noOverflow(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
try{
  const {page}=await setup();
  await page.goto(base);
  assert.equal(await page.getByText('현실의 나, 또 다른 시작.',{exact:true}).count(),0);
  assert.equal(await page.locator('.entry-subtitle,.entry-footnote,.overline').count(),0);
  await page.waitForFunction(()=>document.querySelector('#portal').width>300);
  const worldCanvas = await page.$('#portal');
  assert.equal(await page.locator('body').innerText().then(text=>/seungmin\.xyz/i.test(text)),false);
  await page.screenshot({path:'/tmp/realm-entry-desktop.png'});
  const portalPixels=await pixels(page.locator('#portal'));
  await page.waitForTimeout(450);
  assert.ok(changed(portalPixels,await pixels(page.locator('#portal')))>20,'portal animates');
  await page.locator('#motion').uncheck();
  const withPortal=await pixels(page.locator('#portal'));
  await page.locator('#portal').evaluate(el=>el.style.opacity='0');
  assert.ok(changed(withPortal,await pixels(page.locator('#portal')))>200,'WebGL contains visible pixels');
  await page.locator('#portal').evaluate(el=>el.style.opacity='');
  await page.locator('#motion').check();
  await page.locator('#enter').click();
  await page.waitForTimeout(800);
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('entering')),true);
  await page.screenshot({path:'/tmp/realm-warp.png'});
  await page.locator('#auth').waitFor({state:'visible'});
  await page.locator('#auth').evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished)));
  await page.waitForTimeout(1000);
  assert.equal(await worldCanvas.evaluate(element=>element===document.querySelector('#portal')),true,'same renderer canvas after entry');
  assert.equal(await page.locator('#profile').isVisible(),false);
  await page.screenshot({path:'/tmp/realm-auth-desktop.png'});
  await page.locator('[data-auth-mode=signup]').click();
  await page.locator('#email').fill('new@example.com');await page.locator('#password').fill('a-test-password');await page.locator('#auth-submit').click();
  await page.getByText('메일함의 인증 링크를 누른 뒤 로그인해 주세요.').waitFor();
  await page.locator('[data-auth-mode=login]').click();
  await page.locator('#email').fill('a@example.com');await page.locator('#password').fill('wrong-password');await page.locator('#auth-submit').click();
  await page.getByText('이메일 또는 비밀번호를 확인해 주세요.').waitFor();
  await login(page);await page.locator('#profile').waitFor({state:'visible'});
  await page.locator('#profile-name').fill('승민');await page.locator('#profile-age').fill('31');
  await page.locator('#profile-gender').selectOption('male');await page.locator('#profile-mbti').selectOption('ENTP');await page.locator('#profile-blood').selectOption('AB');
  failUpdate=true;await page.locator('#profile-form button[type=submit]').click();
  await page.locator('#profile-message').filter({hasText:'저장하거나 연결하지 못했습니다'}).waitFor();
  assert.equal(await page.locator('#profile-name').inputValue(),'승민');assert.equal(updates,0);
  failUpdate=false;await page.locator('#profile-form button[type=submit]').click();
  await page.locator('#avatar').waitFor({state:'visible'});
  assert.equal(await worldCanvas.evaluate(element=>element===document.querySelector('#portal')),true,'same renderer canvas after profile');
  await page.locator('#motion').uncheck();
  await page.locator('#character-prompt').fill('우주를 떠도는 로봇');await page.locator('#generate').click();
  await page.locator('#avatar-message').filter({hasText:'인식 가능한 요소가 없습니다'}).waitFor();
  assert.equal(await page.locator('#save-avatar').isVisible(),false);
  await page.locator('[data-preset]').first().click();await page.locator('#generate').click();
  await page.getByText('저장 전',{exact:true}).waitFor();
  assert.equal(await page.locator('#traits').textContent(),avatarTraits(silver).join(''));
  const sprite=await pixels(page.locator('#avatar-canvas'));
  assert.ok(new Set(sprite).size>30,'sprite has colored pixels');
  await page.screenshot({path:'/tmp/realm-avatar-desktop.png',fullPage:true});
  await page.setViewportSize({width:1280,height:720});
  const footer=await page.locator('.journey').boundingBox(), back=await page.locator('#back-profile').boundingBox();
  assert.ok(footer.y>back.y+back.height,'footer does not overlap short desktop content');
  await noOverflow(page);
  await page.screenshot({path:'/tmp/realm-avatar-short-desktop.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-preset]').nth(1).click();
  assert.equal(await page.locator('#save-avatar').isVisible(),false);
  await page.locator('#generate').click();
  assert.ok(changed(sprite,await pixels(page.locator('#avatar-canvas')))>1000,'text changes actual art');
  failUpdate=true;await page.locator('#save-avatar').click();
  await page.locator('#avatar-message').filter({hasText:'저장하거나 연결하지 못했습니다'}).waitFor();
  assert.equal(await page.locator('#avatar').isVisible(),true);
  failUpdate=false;await page.locator('#save-avatar').click();
  await page.locator('#map').waitFor({state:'visible'});
  await page.locator('#map-character').click();
  await page.locator('#complete').waitFor({state:'visible'});
  assert.equal(users.get('a@example.com').user_metadata.realm_avatar.outfit,'red');
  await page.reload();await page.locator('#complete').waitFor({state:'visible'});
  assert.equal(new URL(page.url()).hash,'#complete');
  assert.equal(await page.locator('#enter').isVisible(),false);
  assert.equal(await page.locator('#saved-name').textContent(),'승민');
  await page.screenshot({path:'/tmp/realm-complete-desktop.png'});
  const other=await setup({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await other.page.goto(base);
  assert.equal(await other.page.locator('#motion').isChecked(),false);
  await other.page.screenshot({path:'/tmp/realm-entry-mobile.png'});
  await noOverflow(other.page);
  await other.page.waitForFunction(()=>document.querySelector('#portal').width>300);
  await other.page.locator('#motion').check();
  const mobilePortal=await pixels(other.page.locator('#portal'));
  await other.page.waitForTimeout(500);
  assert.ok(changed(mobilePortal,await pixels(other.page.locator('#portal')))>20,'mobile portal animates');
  await other.page.locator('#motion').uncheck();
  await other.page.locator('#enter').click();await login(other.page);
  await other.page.locator('#map').waitFor({state:'visible'});
  await other.page.locator('#map-character').click();
  await other.page.locator('#complete').waitFor({state:'visible'});
  assert.equal(await other.page.locator('#saved-name').textContent(),'승민');
  await other.page.locator('#edit-avatar').click();
  await other.page.screenshot({path:'/tmp/realm-avatar-mobile.png',fullPage:true});await noOverflow(other.page);
  await other.page.locator('#logout').click();await other.page.locator('#auth').waitFor({state:'visible'});
  await login(other.page,'b@example.com');await other.page.locator('#profile').waitFor({state:'visible'});
  assert.equal(await other.page.locator('#profile-name').inputValue(),'');
  assert.equal(await other.page.locator('#character-prompt').inputValue(),'');
  await other.page.screenshot({path:'/tmp/realm-profile-mobile.png',fullPage:true});
  await noOverflow(other.page);
  // Direct journal URL is gated for an incomplete account.
  await other.page.goto(base+'/test.html');await other.page.locator('#profile').waitFor({state:'visible'});
  // Recovery works before onboarding and returns to it after updating the password.
  await other.page.goto(base+'/test.html?recovery=1');await other.page.locator('#password-dialog').waitFor({state:'visible'});
  await other.page.locator('#new-password').fill('a-new-test-password');await other.page.locator('#password-form button[type=submit]').click();
  await other.page.locator('#profile').waitFor({state:'visible'});
  await page.locator('.complete-link').click();await page.locator('[data-location=calendar]').click();await page.locator('#add-event').waitFor({state:'visible'});
  await page.screenshot({path:'/tmp/realm-journal-desktop.png'});
  // No GPU: account flow still works.
  const fallback=await setup({viewport:{width:320,height:740},reducedMotion:'reduce'});
  await fallback.page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};});
  await fallback.page.goto(base);await fallback.page.locator('#enter').click();await fallback.page.locator('#auth').waitFor({state:'visible'});await noOverflow(fallback.page);
  await fallback.page.waitForFunction(()=>document.body.dataset.renderer==='fallback');
  assert.equal(await fallback.page.locator('.landscape').evaluate(el=>getComputedStyle(el).opacity),'0.2');
  const fallbackPixels=await pixels(fallback.page.locator('.world'));
  await fallback.page.locator('.landscape').evaluate(el=>el.style.opacity='0');
  assert.ok(changed(fallbackPixels,await pixels(fallback.page.locator('.world')))>200,'no-GPU background is not blank');
  await fallback.context.close();
  // Shader compilation failure and a lost GPU context also retain usable UI.
  for (const failure of ['shader','context']) {
    const broken=await setup({viewport:{width:390,height:844},reducedMotion:'reduce'});
    if(failure==='shader') await broken.page.addInitScript(()=>{
      const original=WebGL2RenderingContext.prototype.getProgramParameter;
      WebGL2RenderingContext.prototype.getProgramParameter=function(program,parameter){
        return parameter===this.LINK_STATUS?false:original.call(this,program,parameter);
      };
    });
    await broken.page.goto(base);
    await broken.page.waitForFunction(()=>document.querySelector('#portal').width>300);
    if(failure==='context') await broken.page.locator('#portal').evaluate(canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await broken.page.waitForFunction(()=>document.body.dataset.renderer==='fallback');
    await broken.page.locator('#enter').click();
    await broken.page.locator('#auth').waitFor({state:'visible'});
    assert.equal(await broken.page.locator('#portal').isVisible(),false);
    assert.equal(await broken.page.locator('#auth-submit').isEnabled(),true);
    await broken.context.close();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: portal nonblank/moving, warp, reduced motion, no-WebGL, signup/login/errors, profile validation/save recovery, actual pixel traits, draft invalidation, avatar save recovery, reload, second-device sync, account isolation, journal gate, desktop/mobile layout.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

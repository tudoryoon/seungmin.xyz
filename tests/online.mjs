import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = new URL('../', import.meta.url);
const server = createServer(async (req,res) => {
  try {
    const path = new URL(req.url,'http://localhost').pathname;
    const file = new URL('.'+path,root);
    if (!file.href.startsWith(root.href)) throw new Error('Invalid path');
    res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');
    res.end(await readFile(file));
  } catch {res.writeHead(404);res.end();}
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({headless:true,channel:'chrome'});
const url = `http://127.0.0.1:${server.address().port}/test.html`;
const user = {id:'00000000-0000-4000-8000-000000000001',email:'test@example.com',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{realm_profile:{version:1,name:'Test',age:30,gender:'unspecified',mbti:'',blood:''},realm_avatar:{version:1,prompt:'도사',role:'sage',outfit:'jade',hair:'black',hairstyle:'short',weapon:'staff',hat:false,skin:'light'}},created_at:new Date().toISOString()};
const token = ['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url'),'signature'].join('.');
const session = {access_token:token,refresh_token:'refresh-test',token_type:'bearer',expires_in:3600,user};
let rows = []; let failSave = false;
const errors = [];
async function pageFor() {
  const page = await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://rciahwtvrsysxqvjjtuu.supabase.co/**',async route => {
    const req=route.request(), path=new URL(req.url()).pathname;
    let result = {}; let status=200;
    if (path.endsWith('/token')) result=session;
    else if (path.endsWith('/user')) result=user;
    else if (path.endsWith('/logout')) {status=204;result=null;}
    else if (path.includes('/rest/v1/journal_records')) {
      if (req.method()==='GET') result=rows;
      if (req.method()==='POST') {
        if(failSave){status=503;result={message:'offline'};}
        else {
          const posted=req.postDataJSON();
          for (const row of Array.isArray(posted)?posted:[posted]) {
            assert.equal(row.user_id,user.id);
            const old=rows.findIndex(r=>r.id===row.id);
            if(old<0) rows.push(row);
            else if(!req.headers().prefer?.includes('ignore-duplicates')) rows[old]=row;
          }
          result=null;
        }
      }
      if(req.method()==='DELETE'){const id=new URL(req.url()).searchParams.get('id').slice(3);rows=rows.filter(r=>r.id!==id);result=null;}
    }
    await route.fulfill({status,contentType:'application/json',body:status===204?'':JSON.stringify(result)});
  });
  await page.goto(url.replace('test.html','index.html#auth'));
  await page.locator('#auth').waitFor({state:'visible'});
  return page;
}
async function login(page) {
  await page.locator('#email').fill(user.email);await page.locator('#password').fill('test-password-123');
  await page.locator('#auth-submit').click();
  await page.locator('#map').waitFor({state:'visible'});
  await page.locator('[data-location=calendar]').click();
  await page.getByText(`${user.email} · 온라인 저장`,{exact:true}).waitFor();
}
try {
  const page=await pageFor();
  await page.evaluate(() => {const now=new Date();const date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');localStorage.setItem('seungmin-journal-v1',JSON.stringify([{id:crypto.randomUUID(),kind:'event',date,title:'Local record'}]));});
  await login(page);
  assert.equal(await page.getByRole('heading',{name:'Local record'}).count(),0);
  page.on('dialog',d=>d.accept());
  await page.locator('#import-local').click();await page.getByText('가져오기를 완료했습니다. 브라우저 원본은 유지됩니다.').waitFor();
  assert.equal(rows.length,1);
  await page.locator('#import-local').click();await page.getByText('가져오기를 완료했습니다. 브라우저 원본은 유지됩니다.').waitFor();
  assert.equal(rows.length,1);
  await page.locator('#add-event').click();await page.locator('#record-title').fill('Cloud record');
  failSave=true;await page.getByRole('button',{name:'저장',exact:true}).click();await page.locator('#form-error').filter({hasText:'요청을 완료하지 못했습니다'}).waitFor();
  assert.equal(await page.locator('#editor').isVisible(),true);assert.equal(rows.length,1);
  failSave=false;await page.getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('heading',{name:'Cloud record',exact:true}).waitFor();assert.equal(rows.length,2);
  const other=await pageFor();await login(other);await other.getByRole('heading',{name:'Cloud record',exact:true}).waitFor();
  await other.getByRole('button',{name:'Cloud record 수정'}).click();await other.locator('#record-title').fill('Changed on phone');await other.getByRole('button',{name:'저장',exact:true}).click();
  await page.locator('#refresh-records').click();await page.getByRole('heading',{name:'Changed on phone',exact:true}).waitFor();
  await page.getByRole('button',{name:'Changed on phone 수정'}).click();await page.locator('#delete-record').click();await page.locator('#editor').waitFor({state:'hidden'});assert.equal(rows.length,1);
  await page.locator('#sign-out').click();await page.locator('#auth').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('seungmin-journal-v1'))[0].title),'Local record');assert.equal(await page.getByRole('heading',{name:'Changed on phone'}).count(),0);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'/tmp/seungmin-online-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: local preservation, auth transitions, idempotent import, failed save recovery, two browser sync, update/delete, logout, mobile layout. API mocked; live RLS requires SQL setup.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}

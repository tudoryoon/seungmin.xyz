import assert from 'node:assert/strict';
import {randomBytes,createCipheriv} from 'node:crypto';
import {createResearchAccess} from '../lib/research-access.js';
import {createResearchGate} from '../research.js';
import data from './research-fixture.mjs';
const secret=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv);
cipher.setAAD(Buffer.from('research-snapshot-v1'));
const encrypted=Buffer.concat([cipher.update(JSON.stringify({password:'fixture-password',data})),cipher.final(),cipher.getAuthTag()]);
const sealed={iv:iv.toString('base64url'),ciphertext:encrypted.toString('base64url')};
let time=Date.now();const handler=createResearchAccess(sealed,{now:()=>time}),env={RESEARCH_SECRET:secret.toString('hex')};
const request=(method='GET',body=null,cookie='',origin='https://example.com',ip='fixture-ip')=>new Request('https://example.com/api/research',{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'CF-Connecting-IP':ip},...(body===null?{}:{body:JSON.stringify(body)})});
assert.equal((await handler(request())).status,503,'missing server key fails closed');
const unauthorized=await handler(request(),env);assert.equal(unauthorized.status,401);assert.ok(!(await unauthorized.text()).includes('FDE'));
assert.equal((await handler(request('POST',{password:'fixture-password'},'','https://attacker.example'),env)).status,403);
assert.equal((await handler(request('POST',{password:'wrong'}),env)).status,401);
assert.equal((await handler(request('POST',{password:'x'.repeat(2000)}),env)).status,400);
const login=await handler(request('POST',{password:'fixture-password'}),env);
assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/Secure/);assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);
const unlocked=await handler(request('GET',null,cookie),env);assert.equal(unlocked.status,200);assert.deepEqual(await unlocked.json(),data);assert.match(unlocked.headers.get('cache-control'),/private, no-store/);
assert.equal((await handler(request('GET',null,cookie+'bad'),env)).status,401,'tampering is rejected');
const logout=await handler(request('DELETE'),env);assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
time+=8*60*60*1000+1;assert.equal((await handler(request('GET',null,cookie),env)).status,401,'expired session');
for(let i=0;i<5;i++)assert.equal((await handler(request('POST',{password:'wrong'},'','https://example.com','limited'),env)).status,401);
const limited=await handler(request('POST',{password:'fixture-password'},'','https://example.com','limited'),env);assert.equal(limited.status,429);assert.ok(limited.headers.has('retry-after'));
time+=16*60*1000;assert.equal((await handler(request('POST',{password:'fixture-password'},'','https://example.com','limited'),env)).status,200);
assert.equal((await handler(request('POST',{password:'fixture-password'}),{RESEARCH_SECRET:randomBytes(32).toString('hex')})).status,503,'wrong decryption key fails closed');
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');
const window=new Window({url:'https://example.com/#research',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
window.document.body.dataset.stage='research';const root=window.document.createElement('section');window.document.body.append(root);
let session='',mounted=0,disposed=0;const wait=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setTimeout(r,2));};
const gate=createResearchGate(root,{
  fetchRequest:async(_url,options)=>{const response=await handler(request(options.method||'GET',options.body?JSON.parse(options.body):null,session),env);const c=response.headers.get('set-cookie');if(c)session=c.split(';')[0];return response;},
  createReader:(_root,{data:actual})=>{assert.deepEqual(actual,data);mounted++;root.textContent='PRIVATE FIXTURE';return{destroy(){disposed++;}};}
});
try{
  await wait();assert.ok(root.querySelector('input[type=password]'));assert.ok(!root.textContent.includes('PRIVATE FIXTURE'));
  root.querySelector('input').value='wrong';root.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true}));await wait();assert.match(root.textContent,/맞지 않습니다/);assert.equal(mounted,0);
  root.querySelector('input').value='fixture-password';root.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true}));await wait();assert.equal(mounted,1);assert.equal(root.dataset.locked,'false');
  await gate.lock();assert.equal(disposed,1);assert.ok(!root.textContent.includes('PRIVATE FIXTURE'));assert.equal(root.dataset.locked,'true');
  console.log('PASS: encrypted data, closed-by-default API, password, CSRF, signed/expired/tampered cookies, attempt limit, logout, no-store and gated UI.');
}finally{gate.destroy();await window.happyDOM.close();}

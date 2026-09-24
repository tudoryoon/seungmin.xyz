import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const {Window}=await import(process.env.DOM_MODULE || 'happy-dom');
const read=file=>readFile(new URL('../'+file,import.meta.url),'utf8');
const until=async test=>{for(let n=0;n<100&&!test();n++)await new Promise(resolve=>setTimeout(resolve,2));assert.ok(test());};
const authSource=await read('auth-client.js'),cloudSource=await read('cloud.js');
assert.ok(!cloudSource.includes('.signUp('),'the legacy signup handler is removed');
for(const name of ['privacy','terms']) {
  const w=new Window({url:`https://seungmin.xyz/${name}`,settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  try {
    w.document.write(await read(name+'.html'));
    assert.equal(w.document.documentElement.lang,'ko');
    assert.equal(w.document.querySelectorAll('h1').length,1);
    assert.equal(w.document.querySelectorAll('script,form,iframe').length,0,'policy pages work without sign-in or JavaScript');
    assert.equal(w.document.querySelector('[rel=canonical]').href,`https://seungmin.xyz/${name}`);
    assert.ok(w.document.querySelector('a[href="mailto:tmdals2008@gmail.com"]'));
    for(const link of w.document.querySelectorAll('a[href],link[href],img[src]')) {
      const path=link.getAttribute('href') || link.getAttribute('src');
      if(/^[a-z]+:/i.test(path))continue;
      await access(new URL('../'+path.split(/[?#]/)[0],import.meta.url));
    }
  } finally {await w.happyDOM.close();}
}
for(const file of ['index.html','test.html']) {
  const html=await read(file);
  assert.ok(html.includes('href="privacy.html"') && html.includes('href="terms.html"'));
  assert.ok(!html.includes('value="signup"') && !html.includes('>회원가입<'));
}
const w=new Window({url:'https://seungmin.xyz/test.html',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
const $=id=>w.document.getElementById(id),calls=[];
let callback,fail=true,pending,hold=false;
const user={id:'private-owner',email:'tmdals2008@gmail.com'};
const client={auth:{
  onAuthStateChange(fn){callback=fn;},
  signInWithPassword(credentials){
    calls.push({action:'signin',...credentials});
    const result=fail?{error:{message:'Invalid login credentials'}}:{data:{user,session:{user}}};
    return hold?new Promise(resolve=>{pending=()=>resolve(result);}):Promise.resolve(result);
  },
  async resetPasswordForEmail(email,options){calls.push({action:'reset',email,options});return {};},
  async signOut(options){calls.push({action:'signout',options});callback('SIGNED_OUT',null);return {};},
  async updateUser(){throw Error('No credential change in this test');}
}};
try {
  w.document.write(await read('test.html'));
  w.supabase={createClient:()=>client};w.eval(authSource);w.eval(cloudSource);
  assert.ok(Object.isFrozen(w.realmAccess));
  assert.equal(w.realmError({message:'Invalid login credentials'}),'접속 비밀번호를 확인해 주세요.');
  assert.ok(w.realmError({status:429}).includes('잠시 후'));
  assert.equal($('auth-email').type,'hidden');
  $('open-auth').click();assert.ok($('auth-dialog').open);
  $('auth-email').value='someone-else@example.com';$('auth-password').value='fixture-password';hold=true;
  const submit=()=>$('auth-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  submit();submit();assert.equal(calls.length,1);pending();
  await until(()=>!$('auth-form').querySelector('[type=submit]').disabled);
  assert.equal(calls[0].email,user.email);assert.equal(calls[0].password,'fixture-password');
  assert.ok($('auth-dialog').open);assert.equal($('auth-message').textContent,'접속 비밀번호를 확인해 주세요.');
  hold=false;fail=false;submit();await until(()=>!$('auth-dialog').open);assert.equal($('auth-password').value,'');
  callback('SIGNED_IN',{user});assert.equal(w.journalCloud.user.id,user.id);
  $('forgot-password').click();await until(()=>!$('forgot-password').disabled);
  assert.equal(calls.at(-1).email,user.email);assert.equal(calls.at(-1).options.redirectTo,'https://seungmin.xyz/test.html');
  $('sign-out').click();await until(()=>w.journalCloud.user===null);
  assert.equal(calls.at(-1).options.scope,'local','locking this device preserves other device sessions');
  assert.equal(w.localStorage.length,0,'the app does not store a password or an unlock flag');
  console.log('PASS: public policy documents/links, password-only legacy form, fixed owner identity, server auth, retry/errors, recovery, lock and no client password storage.');
} finally {await w.happyDOM.close();}

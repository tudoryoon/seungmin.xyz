import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as avatars from '../avatar.js';
import {validProfile} from '../profile.js';
import {resolveRealmStage} from '../realm-route.js';
import {createScrollEntry,entryScene} from '../scroll-entry.js';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');
const user={id:'routing-fixture',email:'fixture@example.com',user_metadata:{realm_profile:{version:1,name:'Fixture',age:31,gender:'unspecified',mbti:'',blood:''},realm_avatar:avatars.parseAvatar('청록색 도포를 입은 도사')}};
assert.equal(resolveRealmStage(null,'#map'),'auth');
assert.equal(resolveRealmStage(null,''),'entry');
assert.equal(resolveRealmStage(user,''),'map');
assert.equal(resolveRealmStage(user,'#unknown'),'map');
assert.equal(resolveRealmStage({...user,user_metadata:{}},'#map'),'profile');
assert.equal(resolveRealmStage({...user,user_metadata:{realm_profile:user.user_metadata.realm_profile}},'#complete'),'avatar');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const source=(await readFile(new URL('../realm.js',import.meta.url),'utf8'))
  .replace(/^import .*;\n/gm,'')
  .replace(/import\('\.\/portal\.js\?v=[^']+'\)/,"Promise.resolve(window.realmTest.portal)");
async function until(test){for(let i=0;i<100;i++){if(test())return;await new Promise(resolve=>setTimeout(resolve,2));}assert.ok(test(),'routing settled');}
async function boot(hash,account,error=null,{preference='off',reduced=false,portalError=false}={}) {
  const window=new Window({url:'http://localhost/index.html'+hash,settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  window.document.write(html);
  // Happy DOM emits hashchange on replaceState; browsers do not. Routes below dispatch explicit events.
  window.addEventListener('hashchange',event=>{if(event instanceof window.HashChangeEvent)event.stopImmediatePropagation();});
  let offset=0;
  Object.defineProperty(window,'innerHeight',{get:()=>1000});
  Object.defineProperty(window,'scrollY',{get:()=>offset});
  Object.defineProperty(window.document.getElementById('entry'),'offsetHeight',{get:()=>2400});
  window.scrollTo=({top})=>{offset=top;window.dispatchEvent(new window.Event('scroll'));};
  if(preference!==null)window.localStorage.setItem('seungmin-realm-motion',preference);
  const reducedQuery=new window.EventTarget();reducedQuery.matches=reduced;
  window.matchMedia=()=>reducedQuery;
  window.HTMLElement.prototype.getAnimations=()=>[];
  window.HTMLElement.prototype.animate=()=>({finished:Promise.resolve(),finish(){},cancel(){}});
  window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){}});
  const callbacks=[],motionValues=[];let finishSession,canMove;
  window.realmClient={auth:{onAuthStateChange(callback){callbacks.push(callback);},getSession:()=>new Promise(resolve=>{finishSession=resolve;}),async signOut(){callbacks.forEach(callback=>callback('SIGNED_OUT',null));return {};}}};
  window.realmError=()=> 'Connection failed';window.lucide={createIcons(){}};
  window.realmTest={...avatars,paintAvatar(){},validProfile,resolveRealmStage,createScrollEntry,entryScene,createDungeon:(_,active)=>{canMove=active;return {reset(){}};},portal:{createPortal:(_,motion)=>{if(portalError){window.document.body.dataset.entryRenderer='particles';throw new Error('Renderer unavailable');}motionValues.push(motion);return {setMotion(value){motionValues.push(value);},setStage(){},setEntryProgress(){}};}}};
  window.eval('(()=>{const {parseAvatar,paintAvatar,validAvatar,avatarTraits,avatarTitle,DEFAULT_PROMPT,validProfile,createDungeon,resolveRealmStage,createScrollEntry,entryScene}=window.realmTest;\n'+source+'\n})()');
  assert.equal(window.document.body.classList.contains('session-checking'),true,'session restoration hides the entrance initially');
  finishSession({data:{session:account?{user:account}:null},error});
  await until(()=>!window.document.body.classList.contains('session-checking'));
  return {window,callbacks,canMove,motionValues,reducedQuery};
}
{
  const {window}=await boot('',null,null,{portalError:true});
  try {
    await until(()=>window.document.body.dataset.renderer==='fallback');
    assert.equal(window.document.body.dataset.entryRenderer,'fallback','a partial renderer failure restores the illustrated fallback');
    assert.equal(window.document.getElementById('portal').hidden,true);
    window.document.getElementById('enter').click();
    await until(()=>window.document.body.dataset.stage==='auth');
    assert.equal(window.document.getElementById('auth').inert,false,'renderer failure does not block login');
  }finally{await window.happyDOM.close();}
}
for(const route of ['','#map','#profile','#avatar','#complete','#continue']) {
  const {window,callbacks}=await boot(route,user);
  try {
    const expected=['#profile','#avatar','#complete'].includes(route)?route.slice(1):'map';
    assert.equal(window.document.body.dataset.stage,expected);assert.equal(window.location.hash,'#'+expected);
    assert.equal(window.document.getElementById('entry').hidden,true);
    window.location.hash='#complete';window.dispatchEvent(new window.Event('hashchange'));
    assert.equal(window.document.body.dataset.stage,'complete');
    window.history.replaceState(null,'','/index.html#map');window.dispatchEvent(new window.Event('popstate'));
    assert.equal(window.document.body.dataset.stage,'map','browser history restores map');
    callbacks.forEach(callback=>callback('SIGNED_OUT',null));await until(()=>window.document.body.dataset.stage==='auth');
    assert.equal(window.location.hash,'#auth');assert.equal(window.document.getElementById('map-name').textContent,'');
    window.location.hash='#map';window.dispatchEvent(new window.Event('hashchange'));assert.equal(window.document.body.dataset.stage,'auth','back cannot reopen a signed-out map');
  }finally{await window.happyDOM.close();}
}
for(const route of ['','#auth']) {
  const {window,callbacks}=await boot(route,null);
  const doc=window.document,auth=doc.getElementById('auth'),entry=doc.getElementById('entry');
  const scroll=async top=>{window.scrollTo({top});await until(()=>Number(doc.body.style.getPropertyValue('--entry-progress'))===top/1400);};
  try {
    assert.equal(window.scrollY,route?1400:0);
    assert.equal(entry.hidden,false);assert.equal(doc.body.classList.contains('entry-flow'),true);
    await scroll(1400);assert.equal(doc.body.dataset.stage,'auth');assert.equal(auth.hidden,false);assert.equal(auth.inert,false);
    doc.getElementById('email').value='draft@example.com';doc.getElementById('password').value='unsent-draft';
    doc.getElementById('email').focus();
    await scroll(1365);assert.equal(doc.body.dataset.stage,'entry');assert.equal(auth.hidden,false);assert.equal(auth.inert,true);
    assert.notEqual(doc.activeElement,doc.getElementById('email'),'rewinding releases form focus');
    await scroll(1302);assert.equal(auth.hidden,true,'geographic curl completes before the login form');
    await scroll(0);assert.equal(auth.hidden,true);assert.equal(window.location.hash,'');
    await scroll(1400);assert.equal(doc.body.dataset.stage,'auth');assert.equal(auth.inert,false);
    assert.equal(doc.getElementById('email').value,'draft@example.com');assert.equal(doc.getElementById('password').value,'unsent-draft');
    window.history.replaceState(null,'','/index.html');window.dispatchEvent(new window.Event('popstate'));
    assert.equal(doc.body.dataset.stage,'entry');assert.equal(window.scrollY,0,'back to empty hash returns to the beginning');
    callbacks.forEach(cb=>cb('SIGNED_IN',{user}));await until(()=>doc.body.dataset.stage==='map');
    assert.equal(doc.body.classList.contains('entry-flow'),false);assert.equal(entry.hidden,true);
    window.scrollTo({top:0});await new Promise(resolve=>window.requestAnimationFrame(resolve));assert.equal(doc.body.dataset.stage,'map');
    callbacks.forEach(cb=>cb('SIGNED_OUT',null));await until(()=>doc.body.dataset.stage==='auth');
    assert.equal(window.scrollY,1400);await scroll(0);assert.equal(doc.body.dataset.stage,'entry','logout can also rewind');
  }finally{await window.happyDOM.close();}
}
for(const [route,account,error,expected] of [['',null,null,'entry'],['#map',null,null,'auth'],['#map',{...user,user_metadata:{}},null,'profile'],['#complete',{...user,user_metadata:{realm_profile:user.user_metadata.realm_profile}},null,'avatar'],['#map',null,new Error('offline'),'auth']]) {
  const {window}=await boot(route,account,error);
  try{assert.equal(window.document.body.dataset.stage,expected);if(error)assert.equal(window.document.getElementById('global-message').textContent,'Connection failed');}finally{await window.happyDOM.close();}
}
for(const account of [null,user]) {
  const {window,canMove,motionValues}=await boot('',account);
  const doc=window.document,toggle=doc.getElementById('settings-toggle'),panel=doc.getElementById('settings-panel'),motion=doc.getElementById('motion');
  try {
    assert.equal(panel.hidden,true);assert.equal(toggle.getAttribute('aria-expanded'),'false');
    assert.equal(toggle.getAttribute('aria-controls'),panel.id);assert.equal(toggle.getAttribute('aria-label'),'설정');
    assert.ok(toggle.querySelector('[data-lucide="settings"]'));assert.ok(panel.contains(motion));
    assert.equal(motion.checked,false);assert.equal(canMove(),!!account);
    toggle.click();assert.equal(panel.hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');
    assert.equal(doc.activeElement,motion);assert.equal(canMove(),false,'settings pause map movement');
    motion.click();assert.equal(panel.hidden,false,'changing a preference keeps settings open');
    assert.equal(motion.checked,true);assert.equal(window.localStorage.getItem('seungmin-realm-motion'),'on');
    assert.equal(doc.body.classList.contains('reduced-motion'),false);assert.equal(motionValues.at(-1),true);
    const escape=new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});motion.dispatchEvent(escape);
    assert.equal(escape.defaultPrevented,true);assert.equal(panel.hidden,true);assert.equal(doc.activeElement,toggle);
    assert.equal(canMove(),!!account,'map movement resumes after closing settings');
    toggle.click();motion.click();assert.equal(window.localStorage.getItem('seungmin-realm-motion'),'off');
    assert.equal(doc.body.classList.contains('reduced-motion'),true);assert.equal(motionValues.at(-1),false);
    motion.dispatchEvent(new window.PointerEvent('pointerdown',{bubbles:true}));assert.equal(panel.hidden,false);
    doc.querySelector('main').dispatchEvent(new window.PointerEvent('pointerdown',{bubbles:true}));
    assert.equal(panel.hidden,true);assert.equal(doc.activeElement,toggle,'outside dismissal does not leave focus in a hidden panel');
    toggle.click();toggle.click();assert.equal(panel.hidden,true);assert.equal(doc.activeElement,toggle);
    toggle.click();const outside=doc.getElementById(account?'logout':'enter');outside.focus();
    assert.equal(panel.hidden,true,'tabbing outside closes settings');assert.equal(doc.activeElement,outside,'outside focus is preserved');
    toggle.click();window.location.hash=account?'#complete':'#auth';window.dispatchEvent(new window.Event('hashchange'));
    assert.equal(panel.hidden,true,'changing screens closes settings');assert.equal(toggle.getAttribute('aria-expanded'),'false');
    assert.notEqual(doc.activeElement,motion);
  }finally{await window.happyDOM.close();}
}
for(const [preference,reduced,expected] of [[null,true,false],[null,false,true],['on',true,true],['off',false,false]]) {
  const {window,reducedQuery}=await boot('',null,null,{preference,reduced});
  try {
    const doc=window.document,motion=doc.getElementById('motion');
    assert.equal(motion.checked,expected,'saved preference wins over OS default');
    assert.equal(doc.getElementById('settings-panel').hidden,true,'reload never restores an open settings menu');
    reducedQuery.matches=!reduced;reducedQuery.dispatchEvent(new window.Event('change'));
    assert.equal(motion.checked,preference===null?reduced:expected,'OS changes only apply without a saved preference');
    doc.getElementById('settings-toggle').click();motion.click();const chosen=motion.checked;
    reducedQuery.matches=reduced;reducedQuery.dispatchEvent(new window.Event('change'));
    assert.equal(motion.checked,chosen,'a manual preference survives later OS changes');
  }finally{await window.happyDOM.close();}
}
console.log('PASS: session routing/history/guards, settings disclosure/focus/dismissal, map pause guard, saved motion preferences and reduced-motion defaults.');

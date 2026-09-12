import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as avatars from '../avatar.js';
import {validProfile} from '../profile.js';
import {resolveRealmStage} from '../realm-route.js';
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
async function boot(hash,account,error=null) {
  const window=new Window({url:'http://localhost/index.html'+hash,settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  window.document.write(html);
  window.localStorage.setItem('seungmin-realm-motion','off');
  window.HTMLElement.prototype.getAnimations=()=>[];
  window.HTMLElement.prototype.animate=()=>({finished:Promise.resolve(),finish(){},cancel(){}});
  window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){}});
  const callbacks=[];let finishSession;
  window.realmClient={auth:{onAuthStateChange(callback){callbacks.push(callback);},getSession:()=>new Promise(resolve=>{finishSession=resolve;}),async signOut(){callbacks.forEach(callback=>callback('SIGNED_OUT',null));return {};}}};
  window.realmError=()=> 'Connection failed';window.lucide={createIcons(){}};
  window.realmTest={...avatars,paintAvatar(){},validProfile,resolveRealmStage,createDungeon:()=>({reset(){}}),portal:{createPortal:()=>({setMotion(){},setStage(){},travel:async()=>{}})}};
  window.eval('(()=>{const {parseAvatar,paintAvatar,validAvatar,avatarTraits,avatarTitle,DEFAULT_PROMPT,validProfile,createDungeon,resolveRealmStage}=window.realmTest;\n'+source+'\n})()');
  assert.equal(window.document.body.classList.contains('session-checking'),true,'session restoration hides the entrance initially');
  finishSession({data:{session:account?{user:account}:null},error});
  await until(()=>!window.document.body.classList.contains('session-checking'));
  return {window,callbacks};
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
for(const [route,account,error,expected] of [['',null,null,'entry'],['#map',null,null,'auth'],['#map',{...user,user_metadata:{}},null,'profile'],['#complete',{...user,user_metadata:{realm_profile:user.user_metadata.realm_profile}},null,'avatar'],['#map',null,new Error('offline'),'auth']]) {
  const {window}=await boot(route,account,error);
  try{assert.equal(window.document.body.dataset.stage,expected);if(error)assert.equal(window.document.getElementById('global-message').textContent,'Connection failed');}finally{await window.happyDOM.close();}
}
console.log('PASS: signed-in root/refresh restoration, profile/avatar/map/character URLs, history navigation, signed-out guards, onboarding prerequisites and session errors.');

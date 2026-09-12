import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseAvatar,validAvatar,DEFAULT_PROMPT} from '../avatar.js';
import {validProfile} from '../profile.js';
const {Window}=await import(process.env.DOM_MODULE || 'happy-dom');
const metadata={realm_profile:{version:1,name:'Fixture',age:30,gender:'unspecified',mbti:'',blood:''},realm_avatar:parseAvatar(DEFAULT_PROMPT)};
const owner={id:'owner',user_metadata:metadata}, other={id:'other',user_metadata:metadata};
const source=(await readFile(new URL('../daily.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
const seed=()=>({day:'2026-09-12',server_now:'2026-09-12T06:00:00Z',ends_at:'2026-09-12T15:00:00Z',revision:0,level:1,awarded:false,tasks:[]});
const clone=value=>JSON.parse(JSON.stringify(value));
async function until(test){for(let i=0;i<150;i++){if(test())return;await new Promise(r=>setTimeout(r,2));}assert.ok(test(),'UI settles');}
async function setup({page='index.html',saved=seed(),initial=owner,stage='map',deferred=false}={}) {
  const w=new Window({url:'http://localhost/'+page,settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  w.document.write(await readFile(new URL('../'+page,import.meta.url),'utf8'));
  w.sessionStorage.setItem('daily-prompt:owner:2026-09-12','1');
  w.document.body.classList.remove('session-checking');if(page==='index.html')w.document.body.dataset.stage=stage;
  let callback,fail=false,pending=null,account=initial,rpcs=0;
  w.confirm=()=>true;w.lucide={createIcons(){}};w.testDaily={validAvatar,validProfile};
  w.realmClient={auth:{onAuthStateChange(cb){callback=cb;},async getSession(){return {data:{session:account?{user:account}:null}};}},async rpc(name,args){
    rpcs++;
    if(deferred)return await new Promise(resolve=>{pending=resolve;});
    if(fail)return {error:{message:'network failed'}};
    if(name==='daily_plan_state')return {data:clone(saved)};
    if(args.p_day!==saved.day)return {error:{message:'DAY_CHANGED'}};
    if(saved.awarded&&args.p_action!=='save')return {data:clone(saved)};
    if(args.p_revision!==saved.revision)return {error:{message:'PLAN_CHANGED'}};
    if(args.p_action==='save')saved.tasks=args.p_tasks.map(t=>({...t,completed:false}));
    if(args.p_action==='check')saved.tasks.find(t=>t.id===args.p_task_id).completed=args.p_completed;
    if(args.p_action!=='save'&&saved.tasks.length&&saved.tasks.every(t=>t.completed)&&!saved.awarded){saved.awarded=true;saved.level++;}
    saved.revision++;return {data:clone(saved)};
  }};
  w.eval('(()=>{const {validAvatar,validProfile}=window.testDaily;\n'+source+'\n})()');
  return {w,$:id=>w.document.getElementById(id),saved,setFail:value=>{fail=value;},setDeferred:value=>{deferred=value;},resolve:value=>pending({data:clone(value)}),hasPending:()=>!!pending,rpcs:()=>rpcs,
    account(next,event='SIGNED_IN'){account=next;callback(event,next?{user:next}:null);}};
}
let app=await setup();
try {
  const {w,$,saved}=app;
  await until(()=>$('daily-dialog').open&&!$('daily-save').disabled);
  assert.equal($('daily-form').hidden,false,'every visit prompts even with a legacy dismissal flag');
  const type=(input,value)=>{input.value=value;input.dispatchEvent(new w.Event('input'));};
  type($('daily-inputs').querySelector('input'),'<b>운동</b>');$('daily-add').click();
  type($('daily-inputs').lastElementChild.querySelector('input'),'자료 읽기');
  $('daily-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await until(()=>saved.tasks.length===2&&!$('daily-edit').disabled);
  assert.equal($('daily-form').hidden,true);
  assert.equal($('daily-list').querySelector('span').textContent,'<b>운동</b>');
  assert.equal($('daily-list').querySelector('b'),null,'titles are text, not executable HTML');
  $('daily-list').querySelector('input').click();
  await until(()=>!$('daily-edit').disabled&&saved.revision===2);
  assert.equal(saved.level,1);assert.equal($('daily-badge').textContent,'1/2');
  $('daily-list').lastElementChild.querySelector('input').click();
  await until(()=>saved.awarded&&$('daily-status').textContent.includes('+1'));
  assert.equal(saved.level,2);assert.equal($('daily-view-actions').hidden,true);
  assert.ok([...w.document.querySelectorAll('[data-player-level]')].every(n=>n.textContent==='LV. 2'));
  assert.ok([...$('daily-list').querySelectorAll('input')].every(n=>n.disabled));
  $('daily-close').click();assert.equal($('daily-dialog').open,false);
  $('daily-open').click();await until(()=>$('daily-status').textContent==='오늘 완료');
  assert.equal(saved.level,2,'reopening does not award');
  app.account(null,'SIGNED_OUT');await until(()=>$('daily-open').hidden);
  assert.equal($('daily-dialog').open,false);assert.equal($('daily-list').children.length,0);
} finally {await app.w.happyDOM.close();}

app=await setup({page:'test.html'});
try {
  const {w,$,saved}=app;await until(()=>$('daily-dialog').open&&!$('daily-save').disabled);
  const input=$('daily-inputs').querySelector('input');input.value='읽기';input.dispatchEvent(new w.Event('input'));
  app.setFail(true);$('daily-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await until(()=>$('daily-error').textContent.length>0&&!$('daily-retry').disabled);
  assert.equal($('daily-inputs').querySelector('input').value,'읽기','failed save retains the draft');
  assert.equal(saved.tasks.length,0);assert.equal($('daily-save').disabled,true,'uncertain writes require server refresh');
  app.setFail(false);w.confirm=()=>false;$('daily-retry').click();assert.equal($('daily-inputs').querySelector('input').value,'읽기');
  w.confirm=()=>true;$('daily-retry').click();await until(()=>!$('daily-save').disabled);
  const nextInput=$('daily-inputs').querySelector('input');nextInput.value='새 목록';nextInput.dispatchEvent(new w.Event('input'));
  saved.day='2026-09-13';saved.server_now='2026-09-12T15:01:00Z';saved.ends_at='2026-09-13T15:00:00Z';
  $('daily-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await until(()=>$('daily-error').textContent.includes('날짜'));
  assert.equal($('daily-inputs').querySelector('input').value,'새 목록','midnight does not silently erase a draft');
  $('daily-retry').click();await until(()=>$('daily-date').textContent.includes('13일')&&!$('daily-save').disabled);
  $('daily-close').click();w.dispatchEvent(new w.CustomEvent('realm-view'));await new Promise(r=>setTimeout(r,10));
  assert.equal($('daily-dialog').open,false,'dismissed empty plan does not repeatedly interrupt this session');
} finally {await app.w.happyDOM.close();}

app=await setup({saved:{...seed(),revision:1,tasks:[{id:'a',title:'saved',completed:false}]}});
try {
  await until(()=>app.$('daily-dialog').open&&!app.$('daily-close').disabled);
  assert.equal(app.$('daily-badge').textContent,'0/1','saved plans open on return visits');
  app.$('daily-close').click();app.w.dispatchEvent(new app.w.CustomEvent('realm-view'));
  await new Promise(r=>setTimeout(r,10));assert.equal(app.$('daily-dialog').open,false,'closing does not immediately reopen the dialog');
  const restored = new app.w.Event('pageshow'); Object.defineProperty(restored,'persisted',{value:true}); app.w.dispatchEvent(restored);
  await until(()=>app.$('daily-dialog').open&&!app.$('daily-close').disabled);
  app.$('daily-close').click();app.account(null,'SIGNED_OUT');app.account(owner);
  await until(()=>app.$('daily-dialog').open,'signing back into the same account prompts again');
} finally {await app.w.happyDOM.close();}
app=await setup({saved:{...seed(),revision:2,level:2,awarded:true,tasks:[{id:'a',title:'done',completed:true}]}});
try {
  await until(()=>app.$('daily-dialog').open&&!app.$('daily-close').disabled);
  assert.equal(app.$('daily-status').textContent,'오늘 완료','completed plans also open without a second reward');
  assert.equal(app.saved.level,2);
} finally {await app.w.happyDOM.close();}
app=await setup({stage:'avatar'});
try {
  await new Promise(r=>setTimeout(r,20));assert.equal(app.rpcs(),0,'no daily popup during character setup');
  app.w.document.body.dataset.stage='map';await until(()=>app.$('daily-dialog').open);
} finally {await app.w.happyDOM.close();}
app=await setup({deferred:true});
try {
  await until(app.hasPending);app.account(null,'SIGNED_OUT');app.resolve({...seed(),level:9,tasks:[{id:'private',title:'private',completed:true}]});
  await new Promise(r=>setTimeout(r,20));assert.equal(app.$('daily-open').hidden,true);assert.equal(app.$('daily-list').children.length,0,'late old-account response stays private');
  app.setDeferred(false);app.account(other);await until(()=>app.$('daily-dialog').open);assert.equal(app.w.document.querySelector('[data-player-level]').textContent,'LV. 1');
} finally {await app.w.happyDOM.close();}
app=await setup({initial:null});
try {await new Promise(r=>setTimeout(r,20));assert.equal(app.rpcs(),0);assert.equal(app.$('daily-open').hidden,true);}
finally {await app.w.happyDOM.close();}
console.log('PASS: daily repeat-visit prompts, legacy dismissal bypass, saved/completed lists, back-forward restoration, repeat sign-in, save/check/level UI, errors/draft protection and account isolation.');

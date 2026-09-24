import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseAvatar,validAvatar,DEFAULT_PROMPT} from '../avatar.js';
import {validProfile} from '../profile.js';
const {Window}=await import(process.env.DOM_MODULE || 'happy-dom');
const owner={id:'owner',user_metadata:{realm_profile:{version:1,name:'Fixture',age:30,gender:'unspecified',mbti:'',blood:''},realm_avatar:parseAvatar(DEFAULT_PROMPT)}};
const seed=()=>({day:'2026-09-12',server_now:'2026-09-12T14:00:00Z',ends_at:'2026-09-12T15:00:00Z',revision:0,level:1,awarded:false,reward_policy:'kst_midnight',tasks:[]});
const clone=value=>JSON.parse(JSON.stringify(value));
async function until(test){for(let i=0;i<150;i++){if(test())return;await new Promise(r=>setTimeout(r,2));}assert.ok(test(),'UI settles');}
async function setup({page='test.html',view='calendar',saved=seed(),initial=owner,deferred=false}={}) {
  const w=new Window({url:'http://localhost/'+page+'#'+view,settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  w.document.write(await readFile(new URL('../'+page,import.meta.url),'utf8'));w.document.body.classList.remove('session-checking');
  const setView=value=>{w.document.body.dataset.view=value;w.document.querySelectorAll('.view').forEach(n=>{n.hidden=n.id!==value;});w.dispatchEvent(new w.CustomEvent('journal-view',{detail:value}));};
  if(page==='test.html')setView(view);
  let callback,fail=false,pending=null,rpcs=0;
  w.confirm=()=>true;w.lucide={createIcons(){}};w.testDaily={validAvatar,validProfile};
  w.realmClient={auth:{onAuthStateChange(cb){callback=cb;},async getSession(){return {data:{session:initial?{user:initial}:null}};}},async rpc(name,args){
    rpcs++;if(deferred)return new Promise(resolve=>{pending=resolve;});
    if(fail)return {error:{message:'network failed'}};
    if(name==='daily_plan_state')return {data:clone(saved)};
    if(args.p_day!==saved.day)return {error:{message:'DAY_CHANGED'}};
    if(args.p_revision!==saved.revision)return {error:{message:'PLAN_CHANGED'}};
    if(args.p_action==='save')saved.tasks=args.p_tasks.map(t=>({...t,completed:false}));
    if(args.p_action==='check')saved.tasks.find(t=>t.id===args.p_task_id).completed=args.p_completed;
    saved.revision++;return {data:clone(saved)};
  }};
  const source=await readFile(new URL('../'+(page==='test.html'?'daily.js':'player-level.js'),import.meta.url),'utf8');
  if(page==='test.html')w.eval((await readFile(new URL('../daily-history.js',import.meta.url),'utf8')).replace('export function createDailyHistory','window.createDailyHistory = function'));
  w.eval('(()=>{const {validAvatar,validProfile}=window.testDaily;const createDailyHistory=window.createDailyHistory;\n'+source.replace(/^import[^\n]+\n/gm,'')+'\n})()');
  return {w,$:id=>w.document.getElementById(id),saved,setView,rpcs:()=>rpcs,setFail:v=>{fail=v;},hasPending:()=>!!pending,
    resolve:value=>pending({data:clone(value)}),account(next){callback(next?'SIGNED_IN':'SIGNED_OUT',next?{user:next}:null);}};
}
let app=await setup();
try {
  const {w,$,saved}=app;await until(()=>!$('daily-panel').hidden&&!$('daily-save').disabled);
  assert.equal($('daily-panel').tagName,'ASIDE');assert.equal($('daily-dialog'),null);assert.equal($('daily-close'),null);assert.equal($('daily-open'),null);
  assert.equal($('daily-panel').closest('#calendar'),$('calendar'));
  assert.notEqual(w.document.activeElement,$('daily-inputs').querySelector('input'),'loading the panel does not steal focus');
  const type=(input,value)=>{input.value=value;input.dispatchEvent(new w.Event('input'));};
  type($('daily-inputs').querySelector('input'),'<b>운동</b>');$('daily-add').click();type($('daily-inputs').lastElementChild.querySelector('input'),'읽기');
  $('daily-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>saved.tasks.length===2&&!$('daily-edit').disabled);
  assert.equal($('daily-list').querySelector('b'),null);assert.equal($('daily-list').querySelector('span').textContent,'<b>운동</b>');
  $('daily-list').querySelector('input').click();await until(()=>saved.revision===2&&!$('daily-edit').disabled);
  $('daily-list').lastElementChild.querySelector('input').click();await until(()=>saved.revision===3&&!$('daily-edit').disabled);
  assert.equal($('daily-status').textContent,'','completing every task adds no extra status copy');
  assert.equal(saved.level,1);assert.equal($('daily-panel').hidden,false);assert.equal($('daily-finish'),null);
  assert.ok([...$('daily-list').querySelectorAll('input')].every(n=>!n.disabled),'completed checks remain reversible');
  $('daily-list').lastElementChild.querySelector('input').click();await until(()=>saved.revision===4&&!$('daily-edit').disabled);
  assert.equal(saved.tasks[1].completed,false);assert.equal($('daily-status').textContent,'');
  $('daily-edit').click();assert.equal($('daily-form').hidden,false);$('daily-cancel').click();assert.equal($('daily-panel').hidden,false);
  w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal($('daily-panel').hidden,false,'Escape cannot dismiss the persistent panel');
  app.setView('library');assert.equal($('daily-panel').hidden,true);
  app.setView('workout');assert.equal($('daily-panel').hidden,true);
  app.setView('connections');assert.equal($('daily-panel').hidden,true);
  app.setView('calendar');await until(()=>!$('daily-panel').hidden&&!$('daily-edit').disabled);
  saved.day='2026-09-13';saved.server_now='2026-09-12T15:00:01Z';saved.ends_at='2026-09-13T15:00:00Z';saved.tasks=[];saved.revision=0;saved.level=2;
  $('refresh-records').click();await until(()=>$('daily-date').textContent.includes('13일')&&!$('daily-save').disabled);
  assert.equal($('daily-panel').hidden,false);assert.equal(w.document.querySelector('[data-player-level]').textContent,'LV. 2');
  assert.equal($('daily-status').textContent,'LV. 2 · 레벨 +1','actual level gains still announce after midnight');
  app.account(null);await until(()=>$('daily-panel').hidden);assert.equal($('daily-list').children.length,0);
} finally {await app.w.happyDOM.close();}
app=await setup({saved:{...seed(),tasks:[{id:'complete',title:'Done',completed:true}]}});try {
  await until(()=>!app.$('daily-panel').hidden&&!app.$('daily-edit').disabled);
  assert.equal(app.$('daily-status').textContent,'','a completed plan reloads without pending copy');
  assert.equal(app.$('daily-list').querySelector('input').checked,true);
} finally {await app.w.happyDOM.close();}
app=await setup({saved:{...seed(),revision:1,tasks:[{id:'a',title:'A',completed:true},{id:'b',title:'B',completed:false}]}});try {
  const {w,$,saved}=app;await until(()=>!$('daily-edit').disabled);
  $('daily-edit').click();
  $('daily-inputs').querySelector('button').click();$('daily-inputs').querySelector('button').click();
  assert.equal($('daily-inputs').children.length,0);assert.equal(w.document.activeElement,$('daily-add'));
  assert.equal($('daily-form').checkValidity(),true,'zero rows can be submitted');
  $('daily-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await until(()=>saved.tasks.length===0&&!$('daily-save').disabled);
  assert.equal($('daily-progress').textContent,'0 / 0');assert.equal($('daily-limit').textContent,'0 / 20');
  assert.equal(saved.level,1);assert.equal($('daily-error').textContent,'');
  $('refresh-records').click();await until(()=>!$('daily-save').disabled);
  assert.equal($('daily-inputs').children.length,0,'empty list remains empty after refresh');
  $('daily-add').click();const input=$('daily-inputs').querySelector('input');
  input.value='New';input.dispatchEvent(new w.Event('input'));
  $('daily-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>saved.tasks.length===1&&!$('daily-edit').disabled);
  $('daily-edit').click();const cleared=$('daily-inputs').querySelector('input');cleared.value='   ';cleared.dispatchEvent(new w.Event('input'));
  assert.equal($('daily-form').checkValidity(),true,'erasing the final title can also clear the list');
  $('daily-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>saved.tasks.length===0&&!$('daily-save').disabled);
} finally {await app.w.happyDOM.close();}
for(const view of ['workout','library','connections']) {
  app=await setup({view});try {
    await new Promise(r=>setTimeout(r,15));assert.equal(app.$('daily-panel').hidden,true);assert.equal(app.rpcs(),0,'non-calendar views do not fetch daily tasks');
    app.setView('calendar');await until(()=>!app.$('daily-save').disabled);assert.equal(app.$('daily-panel').hidden,false);
  } finally {await app.w.happyDOM.close();}
}
app=await setup();try {
  const {w,$}=app;await until(()=>!$('daily-save').disabled);
  const input=$('daily-inputs').querySelector('input');input.value='작성 중';input.dispatchEvent(new w.Event('input'));
  app.setFail(true);$('daily-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>$('daily-error').textContent&&!$('daily-retry').disabled);
  assert.equal($('daily-inputs').querySelector('input').value,'작성 중');app.setView('library');app.setView('calendar');
  assert.equal($('daily-inputs').querySelector('input').value,'작성 중','view switches preserve unsaved input');
  app.setFail(false);$('daily-retry').click();await until(()=>!$('daily-save').disabled);
} finally {await app.w.happyDOM.close();}
app=await setup({deferred:true});try {
  await until(app.hasPending);app.setView('library');app.resolve(seed());await new Promise(r=>setTimeout(r,15));
  assert.equal(app.$('daily-panel').hidden,true,'late reads cannot open a panel in another dungeon');
} finally {await app.w.happyDOM.close();}
app=await setup({deferred:true});try {
  await until(app.hasPending);app.account(null);app.resolve({...seed(),tasks:[{id:'private',title:'Private',completed:true}]});
  await new Promise(r=>setTimeout(r,15));assert.equal(app.$('daily-panel').hidden,true);assert.equal(app.$('daily-list').children.length,0);
} finally {await app.w.happyDOM.close();}
app=await setup({page:'index.html',view:'map',saved:{...seed(),level:4}});try {
  await until(()=>app.w.document.querySelector('[data-player-level]').textContent==='LV. 4');
  assert.equal(app.$('daily-panel'),null);assert.equal(app.$('daily-dialog'),null);assert.equal(app.$('daily-open'),null);
  app.account(null);assert.equal(app.w.document.querySelector('[data-player-level]').textContent,'LV. 1');
} finally {await app.w.happyDOM.close();}
app=await setup({saved:{...seed(),reward_policy:undefined}});try {
  await until(()=>app.$('daily-error').textContent.includes('자정 정산 설정'));
  assert.equal(app.$('daily-save').disabled,true,'old instant-reward backends cannot receive new-client writes');
} finally {await app.w.happyDOM.close();}
console.log('PASS: persistent calendar-only panel, no popups or focus theft, reversible checks, midnight refresh, draft retention, other-dungeon isolation, private responses and map level display.');

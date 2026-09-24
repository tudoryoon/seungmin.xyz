import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {STATIONS} from '../stations.js';
import {createSpin,TAU} from '../roulette-core.js';
import {createRouletteStore,remainingStations} from '../roulette-store.js';
import {validProfile} from '../profile.js';
import {parseAvatar,validAvatar,DEFAULT_PROMPT} from '../avatar.js';
const {Window}=await import(process.env.DOM_MODULE || 'happy-dom');
const w=new Window({url:'https://seungmin.xyz/roulette',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
const $=id=>w.document.getElementById(id);
async function until(check){for(let i=0;i<200;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,2));}assert.ok(check(),`UI settles: ${$('roulette-odds')?.textContent}; ${$('roulette-error')?.textContent}; reads=${reads}`);}
let user={id:'owner',user_metadata:{realm_profile:{version:1,name:'Fixture',age:30,gender:'unspecified',mbti:'',blood:''},realm_avatar:parseAvatar(DEFAULT_PROMPT)}};
let callback,choices=[],cancellations=[],fail=false,saveCount=0,cancelCount=0,reads=0,defer=false,late=[];
const stations=STATIONS.slice(0,3);
w.document.write(await readFile(new URL('../roulette.html',import.meta.url),'utf8'));
w.localStorage.setItem('seungmin-realm-motion','off');w.confirm=()=>true;w.lucide={createIcons(){}};
w.HTMLCanvasElement.prototype.getContext=()=>null;
w.realmClient={auth:{onAuthStateChange(cb){callback=cb;},getSession:async()=>({data:{session:{user}}})},
  from(table){return {select(){return this},eq(){return this},order(){return this},range(){return this},then(resolve){reads++;if(defer)late.push(resolve);else resolve({data:structuredClone(table==='roulette_cancellations'?cancellations:choices),error:fail?Error('offline'):null});}};},
  async rpc(name,args){if(fail)return {error:Error('offline')};
    if(name==='roulette_cancel') {
      cancelCount++;const choice=choices.find(c=>c.station_id===args.p_station_id&&c.selected_at===args.p_selected_at);
      assert.ok(choice);const row={...choice,cancelled_at:'2026-09-24T12:30:00Z'};
      cancellations.push(row);choices=choices.filter(c=>c!==choice);return {data:[row]};
    }
    assert.equal(name,'roulette_choose');saveCount++;
    const existing=choices.find(choice=>choice.station_id===args.p_station_id);
    const row=existing||{station_id:args.p_station_id,station_name:args.p_station_name,lines:args.p_lines,day:'2026-09-14',selected_at:'2026-09-13T15:01:00Z'};
    if(!existing)choices.push(row);return {data:[row]};}
};
w.testRoulette={STATIONS:stations,TAU,createSpin:options=>createSpin({...options,pick:()=>0,frame:cb=>w.requestAnimationFrame(cb),cancelFrame:id=>w.cancelAnimationFrame(id)}),validAvatar,validProfile,createRouletteStore,remainingStations};
try {
  const source=(await readFile(new URL('../roulette.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
  w.eval(`(()=>{const {STATIONS,TAU,createSpin,validAvatar,validProfile,createRouletteStore,remainingStations}=window.testRoulette;${source}\n})()`);
  await until(()=>!$('spin').disabled);
  assert.equal($('roulette-odds').textContent,'3역 · 각 1/3');
  $('spin').click();await until(()=>!$('choose-station').hidden&&!$('choose-station').disabled);
  const first=$('rolling-name').textContent;
  assert.equal(saveCount,0,'spinning alone does not fix a station');
  $('choose-station').click();$('choose-station').click();await until(()=>saveCount===1&&!$('refresh-choices').disabled);
  assert.equal($('choices-list').querySelector('h3').textContent,'2026.09.14');
  assert.equal($('choices-list').querySelector('strong').textContent,first);
  assert.equal($('choose-station').disabled,true);
  assert.equal($('roulette-odds').textContent,'2역 · 각 1/2');
  const before=reads;$('spin').click();await until(()=>!$('choose-station').disabled);
  assert.ok(reads>before,'re-read history before each spin');assert.notEqual($('rolling-name').textContent,first);
  fail=true;$('choose-station').click();await until(()=>$('roulette-error').textContent.includes('저장 여부'));
  assert.equal($('spin').disabled,true,'ambiguous saves block new spins until reload');
  fail=false;$('refresh-choices').click();await until(()=>!$('choose-station').disabled);
  $('choose-station').click();await until(()=>saveCount===2&&!$('refresh-choices').disabled);
  $('spin').click();await until(()=>!$('choose-station').disabled);$('choose-station').click();await until(()=>saveCount===3&&!$('refresh-choices').disabled);
  assert.equal($('roulette-odds').textContent,'모든 역을 선택했습니다.');assert.equal($('spin').disabled,true);
  const cancelButton=()=>$('choices-list').querySelector('.choice-cancel');
  cancelButton().click();assert.equal($('cancel-choice-dialog').open,true);assert.equal(w.document.activeElement,$('keep-choice'));
  $('keep-choice').click();assert.equal($('cancel-choice-dialog').open,false);assert.equal(cancelCount,0);
  cancelButton().click();fail=true;$('confirm-cancel-choice').click();await until(()=>$('roulette-error').textContent.includes('취소 여부'));
  assert.equal(choices.length,3);assert.equal($('spin').disabled,true);assert.equal($('cancelled-list').children.length,0);
  fail=false;$('refresh-choices').click();await until(()=>!$('refresh-choices').disabled&&!cancelButton().disabled);
  const cancelledName=$('choices-list').querySelector('strong').textContent;
  cancelButton().click();$('confirm-cancel-choice').click();$('confirm-cancel-choice').click();await until(()=>cancelCount===1&&!$('refresh-choices').disabled);
  assert.equal($('cancel-choice-dialog').open,false);assert.equal($('choices-list').querySelectorAll('.choice-row').length,2);
  assert.equal($('cancelled-list').querySelector('strong').textContent,cancelledName);
  assert.equal($('cancelled-list').querySelector('time').dateTime,'2026-09-24T12:30:00Z');
  assert.match($('cancelled-list').textContent,/선택 2026.09.14/);
  assert.equal($('roulette-odds').textContent,'1역 · 각 1/1');assert.equal($('spin').disabled,false);
  $('refresh-choices').click();await until(()=>!$('refresh-choices').disabled);assert.equal($('cancelled-list').children.length,1,'history survives reload');
  $('spin').click();await until(()=>!$('choose-station').disabled);assert.equal($('rolling-name').textContent,cancelledName,'cancelled station can be drawn again');
  defer=true;$('refresh-choices').click();await until(()=>late.length===2);
  callback('SIGNED_OUT',null);late.forEach(resolve=>resolve({data:choices}));await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal($('choices-list').children.length,0);assert.equal($('rolling-name').textContent,'?');assert.equal($('spin').disabled,true);
  assert.equal($('cancelled-list').children.length,0);
  console.log('PASS: dated choices, cancellation confirmation/dismissal, failures, duplicate clicks, persistent audit history, restored pool, remaining odds, stale loads and account isolation.');
} finally {await w.happyDOM.close();}

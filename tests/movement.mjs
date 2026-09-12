import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDungeon} from '../dungeon.js';
const {Window} = await import(process.env.DOM_MODULE || 'happy-dom');
const window=new Window({url:'http://localhost/',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
const saved={window:globalThis.window,document:globalThis.document,location:globalThis.location,matchMedia:globalThis.matchMedia,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
let active=true,time=1,next=0,frames=new Map(),destinations=[];
Object.assign(globalThis,{window,document:window.document,location:{assign:url=>destinations.push(url)},matchMedia:()=>({matches:false,addEventListener(){}}),requestAnimationFrame:callback=>{frames.set(++next,callback);return next;},cancelAnimationFrame:id=>frames.delete(id)});
try {
  window.document.write(await readFile(new URL('../index.html',import.meta.url),'utf8'));
  const stage=window.document.getElementById('map'),actor=window.document.getElementById('map-actor');stage.hidden=false;
  Object.defineProperty(stage,'clientWidth',{value:1440});Object.defineProperty(stage,'clientHeight',{value:900});
  stage.getBoundingClientRect=()=>({x:0,y:0,width:1440,height:900});
  actor.getBoundingClientRect=()=>({x:parseFloat(actor.style.left)/100*1440-44,y:parseFloat(actor.style.top)/100*900-97*.85,width:88,height:97});
  const coords={calendar:[26,37],workout:[78,41],library:[68,82]};
  for(const link of stage.querySelectorAll('[data-location]'))link.getBoundingClientRect=()=>({x:coords[link.dataset.location][0]/100*1440-68,y:coords[link.dataset.location][1]/100*900-50,width:136,height:100});
  for(const button of stage.querySelectorAll('[data-move]'))button.setPointerCapture=()=>{};
  const dungeon=createDungeon(stage,()=>active);dungeon.reset();
  const key=(name,type='keydown',target=window,options={})=>{const e=new window.KeyboardEvent(type,{key:name,bubbles:true,cancelable:true,...options});target.dispatchEvent(e);return e;};
  function step(count=1){for(let i=0;i<count;i++){time+=16;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(time));}}
  const position=()=>({x:parseFloat(actor.style.left),y:parseFloat(actor.style.top)});
  key('ArrowRight');step(10);key('ArrowRight','keyup');assert.ok(position().x>50);assert.equal(frames.size,0);
  const stopped=position();step(20);assert.deepEqual(position(),stopped);
  key('ArrowLeft');step(2);window.dispatchEvent(new window.Event('blur'));const blurred=position();step(20);assert.deepEqual(position(),blurred);
  active=false;key('ArrowRight');step(20);assert.deepEqual(position(),blurred);active=true;
  const input=window.document.querySelector('input[type=email]');key('ArrowRight','keydown',input);step(20);assert.deepEqual(position(),blurred);
  key('ArrowRight','keydown',window,{ctrlKey:true});step(20);assert.deepEqual(position(),blurred);
  for(const [name,[x,y]] of Object.entries(coords)) {
    dungeon.reset();
    const count=destinations.length;
    for(const node of stage.querySelectorAll('[data-location]')) {
      assert.equal(node.tagName,'DIV');assert.equal(node.hasAttribute('href'),false);node.click();
    }
    key('Enter');stage.querySelector('#nearby-enter').click();step(10);
    assert.equal(destinations.length,count,'clicks and distant Enter cannot enter');
    assert.deepEqual(position(),{x:50,y:51},'clicks cannot auto-walk');
    const horizontal=x<50?'ArrowLeft':'ArrowRight';key(horizontal);
    step(Math.round(Math.abs(x-50)/100*1440/3.2));key(horizontal,'keyup');
    const targetY=y-10/900*100,vertical=targetY<51?'ArrowUp':'ArrowDown';key(vertical);
    step(Math.round(Math.abs(targetY-51)/100*900/3.2));key(vertical,'keyup');
    assert.equal(stage.querySelector('.nearby').dataset.location,name,'nearest entrance: '+name);
    key('Enter','keydown',window.document.getElementById('map-title'));
    assert.equal(new URL(destinations.at(-1),'http://localhost').hash,'#'+name);
    key('Enter');assert.equal(destinations.length,count+1,'entrance is dispatched only once');
  }
  dungeon.reset();
  const right=stage.querySelector('[data-move=ArrowRight]');right.dispatchEvent(new window.PointerEvent('pointerdown',{pointerId:1,bubbles:true}));step(10);
  assert.ok(position().x>50);right.dispatchEvent(new window.PointerEvent('pointercancel',{pointerId:1}));assert.equal(frames.size,0);
  dungeon.reset();key('ArrowDown');step(1000);key('ArrowDown','keyup');assert.equal(position().y,94);
  console.log('PASS: arrow movement, release/blur/input guards, three nearby Enter entrances, blocked click/distant entrance, touch input, and map bounds.');
}finally{await window.happyDOM.close();for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}

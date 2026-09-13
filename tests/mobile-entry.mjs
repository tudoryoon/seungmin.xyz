import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDungeon} from '../dungeon.js';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
for(const {width,height,coarse}of [{width:390,height:844,coarse:false},{width:320,height:740,coarse:true},{width:844,height:390,coarse:true},{width:1024,height:1366,coarse:true},{width:760,height:800,coarse:false},{width:761,height:800,coarse:false},{width:1440,height:900,coarse:false}]) {
  const window=new Window({url:'http://localhost/',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  const saved=Object.fromEntries(['window','document','location','matchMedia','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,globalThis[key]]));
  const touch=new window.EventTarget(),portrait=new window.EventTarget();touch.matches=coarse||width<=760;portrait.matches=width<=height;
  const destinations=[],frames=new Map();let active=true,next=0,hidden=false;
  Object.assign(globalThis,{window,document:window.document,location:{assign:url=>destinations.push(url)},matchMedia:query=>query.includes('any-pointer')?touch:portrait,requestAnimationFrame:callback=>{frames.set(++next,callback);return next;},cancelAnimationFrame:id=>frames.delete(id)});
  try {
    document.write(html);Object.defineProperty(document,'hidden',{get:()=>hidden});
    const stage=document.getElementById('map');stage.hidden=false;
    Object.defineProperties(stage,{clientWidth:{get:()=>width},clientHeight:{get:()=>height}});
    const dungeon=createDungeon(stage,()=>active);dungeon.reset();
    const links=[...stage.querySelectorAll('[data-location]')];
    const click=element=>{const e=new window.MouseEvent('click',{bubbles:true,cancelable:true});element.dispatchEvent(e);assert.equal(e.defaultPrevented,true);};
    assert.equal(stage.dataset.entryMode,touch.matches?'touch':'walk');
    for(const link of links) {
      dungeon.reset();const before=destinations.length;
      assert.equal(link.tagName,'A');assert.equal(link.hasAttribute('href'),touch.matches);
      if(touch.matches)assert.equal(link.getAttribute('aria-label'),link.textContent.trim()+' 입장');
      click(link.querySelector('.node-pin'));click(link.querySelector('.node-label'));
      assert.equal(destinations.length,before+(touch.matches?1:0),'tap works from spawn and double tap cannot navigate twice');
      if(touch.matches)assert.equal(destinations.at(-1),link.dataset.destination);
    }
    touch.matches=true;touch.dispatchEvent(new window.Event('change'));dungeon.reset();
    const first=links[0],before=destinations.length;
    active=false;click(first);assert.equal(destinations.length,before,'inactive/auth/settings guard');active=true;
    stage.hidden=true;click(first);assert.equal(destinations.length,before);stage.hidden=false;
    hidden=true;click(first);assert.equal(destinations.length,before);hidden=false;
    window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(frames.size,1);
    click(first);assert.equal(frames.size,0,'navigation cancels movement');assert.equal(destinations.length,before+1);
    window.dispatchEvent(new window.Event('pageshow'));click(first);assert.equal(destinations.length,before+2,'returning from a dungeon enables tapping again');
    dungeon.reset();first.focus();touch.matches=false;touch.dispatchEvent(new window.Event('change'));
    assert.equal(document.activeElement,stage.querySelector('#map-title'));
    for(const link of links)assert.equal(link.hasAttribute('href'),false,'desktop restores inert map markers');
    const count=destinations.length;click(first);assert.equal(destinations.length,count);
  }finally{await window.happyDOM.close();for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
}
console.log('PASS: all four mobile destinations, 7 layouts, touch tablets/landscape, desktop guard, double taps, auth/hidden guards, movement cancellation and return/resize.');

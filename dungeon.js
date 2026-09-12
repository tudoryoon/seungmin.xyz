import {createRoads,roadSpawn,roadPosition,moveOnRoad,nearbyRoad} from './roads.js?v=20260912-4';
export function createDungeon(stage, isActive) {
  const actor = stage.querySelector('#map-actor');
  const portrait = matchMedia('(max-aspect-ratio: 1/1)');
  const links = [...stage.querySelectorAll('[data-location]')];
  const keys = new Set(), arrows = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
  let navigating = false, raf = 0, lastTime = 0, nearby = null;
  let roads, position, progress=roadSpawn();
  function measureRoads() {roads=createRoads(portrait.matches,stage.clientWidth||1,stage.clientHeight||1);}
  function updateNearby() {
    const destination=nearbyRoad(roads,progress);
    nearby=links.find(link=>link.dataset.location===destination)||null;
    for (const link of links) link.classList.toggle('nearby',link===nearby);
    const enter = stage.querySelector('#nearby-enter');enter.hidden=!nearby;
    if(nearby)enter.setAttribute('aria-label',nearby.textContent.trim()+' 입장');
  }
  function place() {position=roadPosition(roads,progress);actor.style.left=position.x+'%';actor.style.top=position.y+'%';updateNearby();}
  function stopKeys() {keys.clear();cancelAnimationFrame(raf);raf=0;lastTime=0;actor.dataset.walking='false';}
  function reset() {stopKeys();navigating=false;progress=roadSpawn();measureRoads();actor.dataset.facing='right';place();}
  function enter() {
    if(!isActive()||navigating)return;
    updateNearby();
    if(!nearby)return;
    stopKeys();
    navigating=true;
    location.assign(nearby.dataset.destination);
  }
  function tick(time) {
    raf=0;
    if(!isActive()||navigating||document.hidden){stopKeys();return;}
    const delta=lastTime?Math.min((time-lastTime)/1000,.05):1/60;lastTime=time;
    const direction={x:Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')),y:Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp'))};
    const before=position;
    progress=moveOnRoad(roads,progress,direction,delta);place();
    if(Math.abs(position.x-before.x)>.0001)actor.dataset.facing=position.x<before.x?'left':'right';
    actor.dataset.walking=String(Math.hypot(position.x-before.x,position.y-before.y)>.0001);
    if(keys.size)raf=requestAnimationFrame(tick);else stopKeys();
  }
  window.addEventListener('keydown',event=>{
    if(!isActive()||navigating||event.altKey||event.ctrlKey||event.metaKey||event.isComposing)return;
    if(event.target?.closest?.('input,textarea,select,[contenteditable=true],dialog'))return;
    if(arrows.includes(event.key)) {
      event.preventDefault();
      stage.querySelector('#map-title').focus({preventScroll:true});
      keys.add(event.key);if(!raf)raf=requestAnimationFrame(tick);
    } else if(event.key==='Enter'&&nearby&&!event.repeat&&!event.target?.closest?.('a,button')) {
      event.preventDefault();enter();
    }
  });
  window.addEventListener('keyup',event=>{if(arrows.includes(event.key)){keys.delete(event.key);if(!keys.size)stopKeys();}});
  window.addEventListener('blur',stopKeys);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopKeys();});
  stage.querySelector('#nearby-enter').addEventListener('click',enter);
  // Touch controls use the same movement loop as the physical arrow keys.
  stage.querySelectorAll('[data-move]').forEach(button=>{
    button.addEventListener('pointerdown',event=>{
      if(!isActive()||navigating)return;event.preventDefault();
      button.setPointerCapture(event.pointerId);keys.add(button.dataset.move);if(!raf)raf=requestAnimationFrame(tick);
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>{keys.delete(button.dataset.move);if(!keys.size)stopKeys();});
  });
  portrait.addEventListener('change',reset);
  window.addEventListener('resize',()=>{stopKeys();measureRoads();if(isActive())place();});
  window.addEventListener('pageshow',reset);
  return {reset};
}

export function movePosition(position, direction, seconds, width, height) {
  const length = Math.hypot(direction.x,direction.y);
  if (!length || !width || !height) return position;
  const distance = 200 * Math.min(seconds,.05);
  const marginX = Math.min(12,44/width*100), marginTop = Math.min(32,140/height*100);
  return {
    x:Math.max(marginX,Math.min(100-marginX,position.x+direction.x/length*distance/width*100)),
    y:Math.max(marginTop,Math.min(94,position.y+direction.y/length*distance/height*100))
  };
}
export function createDungeon(stage, isActive) {
  const actor = stage.querySelector('#map-actor');
  const portrait = matchMedia('(max-aspect-ratio: 1/1)');
  const links = [...stage.querySelectorAll('[data-location]')];
  const keys = new Set(), arrows = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
  let navigating = false, raf = 0, lastTime = 0, nearby = null;
  let position = spawn();
  function spawn() {return portrait.matches?{x:48,y:52}:{x:50,y:51};}
  function updateNearby() {
    const bounds = stage.getBoundingClientRect();
    let nearest = null, distance = Math.min(110,Math.max(68,bounds.width*.075));
    for (const link of links) {
      const box = link.getBoundingClientRect();
      const x = box.x-bounds.x+box.width/2, y = box.y-bounds.y+box.height*.4;
      const delta = Math.hypot(position.x/100*bounds.width-x,position.y/100*bounds.height-y);
      if (delta<distance) {nearest=link;distance=delta;}
    }
    nearby = nearest;
    for (const link of links) link.classList.toggle('nearby',link===nearby);
    const enter = stage.querySelector('#nearby-enter');enter.hidden=!nearby;
    if(nearby)enter.setAttribute('aria-label',nearby.textContent.trim()+' 입장');
  }
  function place() {actor.style.left=position.x+'%';actor.style.top=position.y+'%';updateNearby();}
  function stopKeys() {keys.clear();cancelAnimationFrame(raf);raf=0;lastTime=0;actor.dataset.walking='false';}
  function reset() {stopKeys();navigating=false;position=spawn();actor.dataset.facing='right';place();}
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
    if(direction.x)actor.dataset.facing=direction.x<0?'left':'right';
    actor.dataset.walking=String(Boolean(direction.x||direction.y));
    position=movePosition(position,direction,delta,stage.clientWidth,stage.clientHeight);place();
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
  window.addEventListener('resize',()=>{stopKeys();if(isActive())place();});
  window.addEventListener('pageshow',reset);
  return {reset};
}

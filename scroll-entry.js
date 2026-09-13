// Mobile scroll offsets and layout heights can round to different subpixels.
export const entryProgress = (offset, distance) => offset>0 && distance-offset<=1 ? 1 : Math.max(0, Math.min(1, offset / Math.max(1, distance)));

export function entryScene(progress) {
  const blend=(start,end)=>{const t=Math.max(0,Math.min(1,(progress-start)/(end-start)));return t*t*(3-2*t);};
  return {
    'earth-scale':1+blend(0,.5)*9,
    'earth-opacity':1-blend(.22,.42),
    'korea-scale':1+blend(.25,.78)*5,
    'korea-opacity':blend(.2,.38)*(1-blend(.57,.76)),
    'seoul-scale':1+blend(.55,1)*.3,
    'seoul-opacity':blend(.57,.76)
  };
}

export function createScrollEntry({section,button,isActive,motion,render,onEnter,onLeave}) {
  const view=section.ownerDocument.defaultView;
  let progress=0,atEnd=false,frame=0;
  const distance=()=>Math.max(1,section.offsetHeight-view.innerHeight);
  function update() {
    frame=0;
    if(!isActive())return;
    progress=entryProgress(view.scrollY-section.offsetTop,distance());
    render(progress);
    const complete=progress>=1;
    button.disabled=complete;
    if(complete!==atEnd){atEnd=complete;if(complete)onEnter();else onLeave();}
  }
  const schedule=()=>{if(!frame && isActive())frame=view.requestAnimationFrame(update);};
  view.addEventListener('scroll',schedule,{passive:true});
  view.addEventListener('resize',()=>{
    if(!isActive())return;
    // Keep the form reached when mobile browser chrome or the keyboard changes the viewport.
    if(atEnd)view.scrollTo({top:section.offsetTop+distance(),behavior:'instant'});
    schedule();
  },{passive:true});
  button.addEventListener('click',()=>{
    if(!isActive() || atEnd)return;
    view.scrollTo({top:section.offsetTop+distance(),behavior:motion()?'smooth':'instant'});
    schedule();
  });
  return {
    get progress(){return progress;},
    reset(value=0){
      view.cancelAnimationFrame(frame);frame=0;progress=Math.max(0,Math.min(1,value));atEnd=progress===1;
      button.disabled=atEnd;render(progress);
      view.scrollTo({top:section.offsetTop+distance()*progress,behavior:'instant'});
    },
    update:schedule
  };
}

// Mobile scroll offsets and layout heights can round to different subpixels.
export const entryProgress = (offset, distance) => offset>0 && distance-offset<=1 ? 1 : Math.max(0, Math.min(1, offset / Math.max(1, distance)));

export function createScrollEntry({section,button,isActive,motion,render,onEnter}) {
  const view=section.ownerDocument.defaultView;
  let progress=0,committed=false,frame=0;
  const distance=()=>Math.max(1,section.offsetHeight-section.querySelector('.entry-copy').offsetHeight);
  function update() {
    frame=0;
    if(!isActive() || committed)return;
    progress=entryProgress(view.scrollY-section.offsetTop,distance());
    render(progress);
    if(progress>=1){committed=true;button.disabled=true;onEnter();}
  }
  const schedule=()=>{if(!frame && isActive())frame=view.requestAnimationFrame(update);};
  view.addEventListener('scroll',schedule,{passive:true});
  view.addEventListener('resize',schedule,{passive:true});
  button.addEventListener('click',()=>{
    if(!isActive() || committed)return;
    view.scrollTo({top:section.offsetTop+distance(),behavior:motion()?'smooth':'instant'});
    schedule();
  });
  return {
    get progress(){return progress;},
    reset(){view.cancelAnimationFrame(frame);frame=0;progress=0;committed=false;button.disabled=false;render(0);},
    update:schedule
  };
}

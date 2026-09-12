export function createDungeon(stage, canMove, isActive) {
  const actor = stage.querySelector('#map-actor');
  const portrait = matchMedia('(max-aspect-ratio: 1/1)');
  const links = [...stage.querySelectorAll('[data-location]')];
  let animation = null, revision = 0, navigating = false;
  const paths = {
    wide: {
      calendar: [[50,51],[43,46],[34,39],[27,33]],
      workout: [[50,51],[60,46],[68,40],[76,35]],
      projects: [[50,51],[53,59],[60,66],[66,75]]
    },
    tall: {
      calendar: [[48,52],[39,43],[37,34],[42,28],[32,22]],
      workout: [[48,52],[57,50],[66,48],[76,45]],
      projects: [[48,52],[53,59],[43,64],[33,75]]
    }
  };
  function reset() {
    revision++;
    animation?.cancel();
    animation = null;
    navigating = false;
    stage.removeAttribute('aria-busy');
    links.forEach(link => link.removeAttribute('aria-current'));
  }
  for (const link of links) link.addEventListener('click', async event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!isActive()) { event.preventDefault(); return; }
    event.preventDefault();
    if (navigating) return;
    if (!canMove() || typeof actor.animate !== 'function') { location.assign(link.href); return; }
    navigating = true;
    const current = ++revision;
    stage.setAttribute('aria-busy', 'true');
    link.setAttribute('aria-current', 'true');
    const path = paths[portrait.matches ? 'tall' : 'wide'][link.dataset.location];
    animation = actor.animate(path.map(([x,y]) => ({ left: x + '%', top: y + '%' })), {
      duration: 650, easing: 'linear', fill: 'forwards'
    });
    try {
      await animation.finished;
      if (current === revision && isActive()) location.assign(link.href);
    } catch { /* Leaving the map cancels an in-flight transition. */ }
  });
  portrait.addEventListener('change', reset);
  window.addEventListener('pageshow', reset);
  return { reset };
}

// Keep the fitted atlas at 100%; layout zoom repaints text at its displayed size.
export function createSectorCamera(viewport, content, { zoomIn, zoomOut, fit, readout }) {
  const window = viewport.ownerDocument.defaultView, listeners = [], pointers = new Map();
  let scale = 1, fitScale = 1, x = 0, y = 0, overview = true, ready = false, frame = 0, disposed = false, dragging = false, suppressClick = false;
  const minZoom = .2, maxZoom = 3;
  const listen = (target, type, handler, options) => { target.addEventListener(type, handler, options); listeners.push(() => target.removeEventListener(type, handler, options)); };
  const clamp = value => Math.max(fitScale * minZoom, Math.min(fitScale * maxZoom, value));
  const size = () => ({ width: viewport.clientWidth, height: viewport.clientHeight, contentWidth: content.offsetWidth, contentHeight: content.offsetHeight });
  function paint() {
    // CSS zoom lays out/rasterizes glyphs and SVG at the target resolution,
    // avoiding a permanently composited bitmap scaled by a CSS transform.
    content.style.zoom = String(scale);
    content.style.left = x / scale + 'px'; content.style.top = y / scale + 'px';
    content.style.setProperty('--sector-scale', String(scale));
    content.dataset.detail = scale < .6 ? 'overview' : scale < .85 ? 'compact' : 'full';
    readout.textContent = Math.round(scale / fitScale * 100) + '%';
    zoomOut.disabled = scale <= fitScale * minZoom; zoomIn.disabled = scale >= fitScale * maxZoom;
  }
  function fitContent() {
    const s = size();
    if (!s.width || !s.height || !s.contentWidth || !s.contentHeight) return;
    fitScale = Math.min(1, Math.max(1, s.width - 24) / s.contentWidth, Math.max(1, s.height - 24) / s.contentHeight);
    scale = fitScale;
    x = (s.width - s.contentWidth * scale) / 2; y = (s.height - s.contentHeight * scale) / 2;
    ready = true; paint();
  }
  function refresh() {
    if (disposed || frame) return;
    frame = window.requestAnimationFrame(() => { frame = 0; if (!disposed && (overview || !ready)) fitContent(); });
  }
  function zoom(factor, point = {x:viewport.clientWidth / 2,y:viewport.clientHeight / 2}) {
    if (!ready) fitContent();
    if (!ready) return;
    const next = clamp(scale * factor), ratio = next / scale;
    x = point.x - (point.x - x) * ratio; y = point.y - (point.y - y) * ratio;
    scale = next; overview = false; paint();
  }
  const local = event => { const rect = viewport.getBoundingClientRect(); return {x:event.clientX-rect.left,y:event.clientY-rect.top}; };
  const center = points => ({x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2});
  const distance = points => Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
  function capture() { for (const id of pointers.keys()) try { viewport.setPointerCapture(id); } catch { /* Pointer may already have ended. */ } }
  function end(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    try { if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId); } catch { /* Optional in older browsers. */ }
    if (!pointers.size) { dragging = false; viewport.classList.remove('is-dragging'); }
  }
  listen(zoomIn, 'click', () => zoom(1.25)); listen(zoomOut, 'click', () => zoom(.8));
  listen(fit, 'click', () => { overview = true; fitContent(); });
  listen(viewport, 'wheel', event => {
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
    zoom(Math.exp(-Math.max(-600, Math.min(600, delta)) * .002), local(event));
  }, {passive:false});
  listen(viewport, 'pointerdown', event => {
    if (event.button !== 0 || !ready) return;
    if (!pointers.size) suppressClick = false;
    const point = local(event); pointers.set(event.pointerId, {...point,start:point});
    if (pointers.size > 1) { dragging = true; suppressClick = true; overview = false; capture(); }
  });
  listen(window, 'pointermove', event => {
    const previous = pointers.get(event.pointerId); if (!previous) return;
    const before = [...pointers.values()].slice(0,2), point = local(event);
    pointers.set(event.pointerId, {...point,start:previous.start});
    if (pointers.size > 1) {
      const after = [...pointers.values()].slice(0,2), oldCenter = center(before), nextCenter = center(after);
      const oldDistance = distance(before); if (!oldDistance) return;
      const next = clamp(scale * distance(after) / oldDistance), ratio = next / scale;
      x = nextCenter.x - (oldCenter.x - x) * ratio; y = nextCenter.y - (oldCenter.y - y) * ratio; scale = next;
    } else {
      if (!dragging && Math.hypot(point.x-previous.start.x,point.y-previous.start.y) < 5) return;
      // Include the threshold distance on the first movement, then use deltas.
      const from = dragging ? previous : previous.start; x += point.x-from.x; y += point.y-from.y;
    }
    event.preventDefault(); dragging = true; suppressClick = true; overview = false; capture();
    viewport.classList.add('is-dragging'); paint();
  }, {passive:false});
  listen(window, 'pointerup', end); listen(window, 'pointercancel', end);
  listen(window, 'blur', () => { for (const id of [...pointers.keys()]) end({pointerId:id}); });
  listen(viewport, 'click', event => { if (suppressClick && event.detail) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; } }, true);
  listen(viewport, 'keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (['+','='].includes(event.key)) zoom(1.25);
    else if (event.key === '-') zoom(.8);
    else if (['0','Home'].includes(event.key)) { overview = true; fitContent(); }
    else if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
      overview = false; x += event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0;
      y += event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0; paint();
    } else return;
    event.preventDefault();
  });
  const observer = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(refresh) : null;
  observer?.observe(viewport); observer?.observe(content); refresh();
  return { get scale() { return scale; }, refresh,
    destroy() { disposed = true; observer?.disconnect(); if (frame) window.cancelAnimationFrame(frame); for (const id of [...pointers.keys()]) end({pointerId:id}); listeners.forEach(dispose => dispose()); }
  };
}

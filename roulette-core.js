const RANGE = 2 ** 32;
export const TAU = Math.PI * 2;

export function uniformIndex(count, fill = values => crypto.getRandomValues(values)) {
  if (!Number.isSafeInteger(count) || count < 1 || count > RANGE) throw new RangeError('Invalid station count');
  const limit = RANGE - RANGE % count;
  const values = new Uint32Array(1);
  // Discard the incomplete remainder: modulo alone would favor some stations.
  do { fill(values); } while (values[0] >= limit);
  return values[0] % count;
}

export function pointerIndex(angle, count) {
  const position = ((-angle % TAU) + TAU) % TAU;
  return Math.min(count - 1, Math.floor(position / TAU * count));
}

export function landingAngle(current, index, count) {
  const target = TAU - (index + .5) / count * TAU;
  const start = ((current % TAU) + TAU) % TAU;
  return current + TAU * 6 + ((target - start + TAU) % TAU);
}

export function createSpin({count, draw, result, state, motion, pick = uniformIndex,
  frame = callback => requestAnimationFrame(callback), cancelFrame = id => cancelAnimationFrame(id)}) {
  let angle = 0, pending = null, request = 0, started = null, from = 0, target = 0;
  function finish() {
    if (pending === null) return;
    cancelFrame(request);
    const index = pending;
    pending = null;
    angle = ((target % TAU) + TAU) % TAU;
    draw(angle, index);
    result(index);
    state(false);
  }
  function tick(time) {
    if (pending === null) return;
    started ??= time;
    const progress = Math.min(1, (time - started) / 4200);
    angle = from + (target - from) * (1 - (1 - progress) ** 4);
    draw(angle, pointerIndex(angle, count));
    if (progress === 1 || !motion()) finish();
    else request = frame(tick);
  }
  return {
    start() {
      if (pending !== null) return false;
      const index = pick(count);
      pending = index;
      from = angle;
      target = landingAngle(angle, index, count);
      started = null;
      state(true);
      if (!motion()) finish();
      else request = frame(tick);
      return true;
    },
    finish,
    cancel() {
      cancelFrame(request);
      pending = null;
      state(false);
    }
  };
}

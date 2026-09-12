import * as THREE from './vendor/three.module.js';

export function createPortal(canvas, motion) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
  } catch {
    canvas.hidden = true;
    return { setMotion() {}, setStage() {}, async travel() {} };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, .1, 120);
  camera.position.z = 14;
  const gate = new THREE.Group();
  gate.position.y = 1.65;
  scene.add(gate);
  const gold = new THREE.MeshBasicMaterial({ color: 0xd5c094, transparent: true, opacity: .65 });
  const jade = new THREE.MeshBasicMaterial({ color: 0x87dbcd, transparent: true, opacity: .5 });
  const rings = [];
  for (let i = 0; i < 15; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.18, i === 0 ? .014 : .008, 4, 128, Math.PI * (i % 2 ? 1.4 : 1.8)), i % 3 ? jade : gold);
    ring.position.z = -i * 2.7;
    ring.rotation.z = i * .8;
    gate.add(ring);
    rings.push(ring);
  }
  const runes = new THREE.Group();
  gate.add(runes);
  const runeGeometry = new THREE.BoxGeometry(.027, .12, .025);
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2;
    const rune = new THREE.Mesh(runeGeometry, i % 4 ? jade : gold);
    rune.position.set(Math.cos(a) * 3.45, Math.sin(a) * 3.45, 0);
    rune.rotation.z = a - Math.PI / 2;
    runes.add(rune);
  }
  const count = innerWidth < 760 ? 700 : 1300;
  const points = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 3.1 + Math.random() * 8;
    points[i * 3] = Math.cos(angle) * radius;
    points[i * 3 + 1] = Math.sin(angle) * radius + 1.65;
    points[i * 3 + 2] = -Math.random() * 65;
    const color = new THREE.Color(i % 7 === 0 ? 0xf3cbb0 : 0xa3e8db);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const particles = new THREE.Points(geometry, new THREE.PointsMaterial({ size: .035, vertexColors: true, transparent: true, opacity: .75, depthWrite: false }));
  scene.add(particles);
  let active = motion, stage = 'entry', previous = 0, elapsed = 0, traveling = false, travelStart = 0, finishTravel;
  function render(time = 0) {
    const dt = previous ? Math.min((time - previous) / 1000, .04) : 0;
    previous = time;
    elapsed += dt;
    if (active) {
      runes.rotation.z = elapsed * .045;
      rings.forEach((ring, i) => { ring.rotation.z = i * .8 + elapsed * (i % 2 ? -.1 : .12); });
      particles.rotation.z = Math.sin(elapsed * .07) * .06;
    }
    if (traveling) {
      const p = Math.min(1, (performance.now() - travelStart) / 1800);
      const ease = p * p * p;
      camera.position.z = 14 - ease * 58;
      camera.position.y = 1.65 * Math.min(1, p * 3);
      camera.fov = 55 + ease * 30;
      camera.updateProjectionMatrix();
      if (p === 1) finishTravel();
    }
    renderer.render(scene, camera);
  }
  function loop() {
    previous = 0;
    renderer.setAnimationLoop((active || traveling) && !document.hidden ? render : null);
    render();
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    render();
  }
  resize();
  loop();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', loop);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    canvas.hidden = true;
    if (traveling) finishTravel();
  });
  return {
    setMotion(value) { active = value; if (!active && traveling) finishTravel(); loop(); },
    setStage(value) { stage = value; gate.visible = stage === 'entry'; render(); },
    travel() {
      if (!active || canvas.hidden) return Promise.resolve();
      traveling = true;
      travelStart = performance.now();
      return new Promise(resolve => {
        const timeout = setTimeout(() => finishTravel(), 2000);
        finishTravel = () => {
          if (!traveling) return;
          traveling = false;
          clearTimeout(timeout);
          camera.position.set(0, 0, 14);
          camera.fov = 55;
          camera.updateProjectionMatrix();
          resolve();
          loop();
        };
        loop();
      });
    }
  };
}

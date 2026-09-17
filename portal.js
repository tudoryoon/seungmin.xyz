import * as THREE from './vendor/three.module.js';
import { createEntryParticles } from './entry-particles.js?v=20260918-2';

// One renderer and one star field remain alive across every onboarding stage.
export function createPortal(canvas, motion) {
  let renderer;
  function useFallback() {
    canvas.hidden = true;
    document.body.dataset.renderer = 'fallback';
    document.body.dataset.entryRenderer = 'fallback';
    renderer?.setAnimationLoop(null);
  }
  try {
    renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'default'});
  } catch {
    useFallback();
    return {setMotion(){},setStage(){},setEntryProgress(){}};
  }
  renderer.debug.onShaderError = useFallback;
  const viewport=()=>({width:Math.max(1,canvas.clientWidth||innerWidth),height:Math.max(1,canvas.clientHeight||innerHeight)});
  const renderRatio = () => {const {width,height}=viewport();return Math.min(devicePixelRatio,2,Math.sqrt((width<760?2400000:5000000)/(width*height)));};
  const pixelRatio = renderRatio();
  renderer.setPixelRatio(pixelRatio);
  renderer.autoClear = false;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  const scene = new THREE.Scene();
  const sky = new THREE.Scene();
  const skyCamera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const camera = new THREE.PerspectiveCamera(55,1,.1,450);
  const poses = {
    entry:[0,0,14,55], auth:[0,1.65,-13,60], profile:[3,2,-19,58],
    avatar:[-3,1,-25,57], complete:[-1,3,-28,57], map:[0,5,-34,64]
  };
  let stage = 'entry', active = motion, elapsed = 0, lastTime = 0, entryProgress = 0;
  const base = new THREE.Vector3(0,0,14);
  const target = new THREE.Vector3(0,0,14);
  const pointer = new THREE.Vector2();
  const drift = new THREE.Vector2();
  let targetFov = 55;
  function entryPose(){
    if(stage!=='entry')return;
    const p=active ? entryProgress : 0,ease=p*p*(3-2*p);
    target.set(Math.sin(p*Math.PI)*.65,1.65*ease,14-27*ease);
    targetFov=55+Math.sin(p*Math.PI)*14+p*5;
  }

  const skyMaterial = new THREE.ShaderMaterial({
    depthWrite:false,depthTest:false,
    uniforms:{uTime:{value:0},uAspect:{value:1},uOffset:{value:new THREE.Vector2()}},
    vertexShader:`
      varying vec2 vUv;
      void main() {vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}
    `,
    fragmentShader:`
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uAspect;
      uniform vec2 uOffset;
      float hash(vec2 p) {
        vec3 q=fract(vec3(p.xyx)*.1031);
        q+=dot(q,q.yzx+33.33);
        return fract((q.x+q.y)*q.z);
      }
      float noise(vec2 p) {
        vec2 i=floor(p),f=fract(p);
        f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                   mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }
      float fbm(vec2 p) {
        float f=0.0,a=.5;
        mat2 r=mat2(.8,-.6,.6,.8);
        for(int i=0;i<4;i++){f+=a*noise(p);p=r*p*2.03+2.3;a*=.5;}
        return f;
      }
      void main() {
        vec2 p=(vUv-.5)*vec2(uAspect,1.0);
        p+=uOffset+vec2(uTime*.0015,-uTime*.0007);
        p=mat2(.91,-.41,.41,.91)*p;
        float n=fbm(p*3.8+4.0);
        float clouds=fbm(p*5.0+vec2(n*2.3,n*.7));
        // GLSL pow is undefined for negative bases, including a square.
        float bandPosition=(p.y+.12+n*.25)*2.4;
        float band=exp(-bandPosition*bandPosition);
        float dust=smoothstep(.35,.83,clouds)*band;
        float ridges=pow(max(0.0,fbm(p*16.0+n)-.35),2.0)*band;
        vec3 blue=vec3(.055,.09,.19);
        vec3 rose=vec3(.15,.075,.14);
        vec3 tint=mix(blue,rose,smoothstep(-.6,.6,p.x));
        vec3 color=vec3(.007,.013,.032)+tint*dust*2.2;
        color+=vec3(.12,.25,.26)*ridges*.65;
        color*=.76+.24*(1.0-length(vUv-.5));
        gl_FragColor=vec4(color,1.0);
      }
    `
  });
  sky.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),skyMaterial));

  const count = innerWidth < 760 ? 4200 : 9000;
  const positions = new Float32Array(count*3);
  const colors = new Float32Array(count*3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  for(let i=0;i<count;i++){
    const theta=Math.random()*Math.PI*2, z=Math.random()*2-1;
    const radius=35+Math.random()*150, plane=Math.sqrt(1-z*z);
    positions.set([Math.cos(theta)*plane*radius,Math.sin(theta)*plane*radius,z*radius-35],i*3);
    const color=new THREE.Color(i%9===0?0xe3b5ca:i%5===0?0xa3dcd4:i%3===0?0xd6d4ea:0xb0c4e7);
    colors.set([color.r,color.g,color.b],i*3);
    sizes[i]=i%31===0?1.4:.25+Math.random()*.55;
    phases[i]=Math.random()*6.28;
  }
  const starGeometry=new THREE.BufferGeometry();
  starGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  starGeometry.setAttribute('aTint',new THREE.BufferAttribute(colors,3));
  starGeometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
  starGeometry.setAttribute('aPhase',new THREE.BufferAttribute(phases,1));
  const starMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uTime:{value:0},uPixelRatio:{value:pixelRatio}},
    vertexShader:`
      attribute vec3 aTint;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vTint;
      varying float vLight;
      void main(){
        vec4 mv=modelViewMatrix*vec4(position,1.0);
        vTint=aTint;
        vLight=.75+.15*sin(uTime*.45+aPhase);
        gl_PointSize=clamp(aSize*240.0/max(10.0,-mv.z),1.0,7.0)*uPixelRatio;
        gl_Position=projectionMatrix*mv;
      }
    `,
    fragmentShader:`
      varying vec3 vTint;
      varying float vLight;
      void main(){
        vec2 p=gl_PointCoord-.5;
        float r=length(p)*2.0;
        if(r>1.0) discard;
        float core=pow(1.0-r,3.0);
        float crossLight=exp(-abs(p.x)*36.0)*exp(-abs(p.y)*9.0)+exp(-abs(p.y)*36.0)*exp(-abs(p.x)*9.0);
        gl_FragColor=vec4(vTint,(core+crossLight*.12)*vLight);
      }
    `
  });
  const stars=new THREE.Points(starGeometry,starMaterial);
  scene.add(stars);
  const entryParticles=createEntryParticles(renderer,loop);
  function applyPose(){
    camera.position.copy(base);
    camera.position.x+=drift.x*.35;
    camera.position.y+=drift.y*.22;
    camera.rotation.set(-drift.y*.008,drift.x*.012,0);
    skyMaterial.uniforms.uOffset.value.set(base.x*.004+drift.x*.01,base.z*.001+drift.y*.008);
    camera.updateProjectionMatrix();
  }
  function render(time=0){
    if(canvas.hidden)return;
    if(time && lastTime && time-lastTime<(stage==='entry' && innerWidth>=760?14:30)) return;
    const dt=lastTime&&time?Math.min((time-lastTime)/1000,.06):0;
    lastTime=time;
    if(active){
      elapsed+=dt;
      drift.lerp(pointer,Math.min(1,dt*2.5));
      base.lerp(target,Math.min(1,dt*(stage==='entry'?7:1.6)));
      camera.fov+=(targetFov-camera.fov)*Math.min(1,dt*(stage==='entry'?7:1.6));
      stars.rotation.y=elapsed*.0015;
      stars.rotation.z=Math.sin(elapsed*.02)*.012;
    }
    starMaterial.uniforms.uTime.value=elapsed;
    skyMaterial.uniforms.uTime.value=elapsed;
    if(stage==='entry' && entryParticles.ready){entryParticles.render(entryProgress,elapsed,drift,active);return;}
    applyPose();
    renderer.clear();
    renderer.render(sky,skyCamera);
    renderer.clearDepth();
    renderer.render(scene,camera);
  }
  function loop(){
    lastTime=0;
    renderer.setAnimationLoop(active&&!document.hidden&&!canvas.hidden?render:null);
    render();
  }
  function resize(){
    const {width,height}=viewport();
    const ratio=renderRatio();
    renderer.setPixelRatio(ratio);
    starMaterial.uniforms.uPixelRatio.value=ratio;
    renderer.setSize(width,height,false);
    camera.aspect=width/height;
    skyMaterial.uniforms.uAspect.value=camera.aspect;
    entryParticles.resize();
    render();
  }
  function setStage(next){
    stage=Object.hasOwn(poses,next)?next:'auth';
    const pose=poses[stage];
    target.set(pose[0],pose[1],pose[2]);targetFov=pose[3];
    entryPose();
    if(!active){base.copy(target);camera.fov=targetFov;drift.set(0,0);}
    loop();
  }
  window.addEventListener('pointermove',event=>{
    if(!active||event.pointerType==='touch') return;
    pointer.set(event.clientX/innerWidth-.5,.5-event.clientY/innerHeight);
  },{passive:true});
  window.addEventListener('blur',()=>pointer.set(0,0));
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',loop);
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();useFallback();
  });
  resize();loop();
  return {
    setMotion(value){
      active=value;
      entryPose();
      if(!active){drift.set(0,0);base.copy(target);camera.fov=targetFov;}
      loop();
    },
    setStage,
    setEntryProgress(value){entryProgress=Math.max(0,Math.min(1,value));entryPose();if(!active)render();}
  };
}

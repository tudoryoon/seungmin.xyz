import * as THREE from './vendor/three.module.js';

export const BLOSSOMS = {
  wide:{size:[1586,992],crowns:[[210,190,118,82],[227,284,79,52],[1150,185,88,70],[1410,200,119,87]]},
  tall:{size:[941,1672],crowns:[[130,220,135,115],[220,310,75,72],[637,635,85,88],[867,650,100,100]]}
};

export function createMapWind(stage, canvas, image) {
  const portrait=matchMedia('(max-aspect-ratio: 1/1)');
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const scene=new THREE.Scene();
  let renderer=null, texture=null, source='', frame=0, lastTime=0, elapsed=0;
  let failed=false, lost=false, disposed=false;
  const material=new THREE.ShaderMaterial({
    depthTest:false,depthWrite:false,
    uniforms:{uMap:{value:null},uSize:{value:new THREE.Vector2()},uTime:{value:0},uCrowns:{value:Array.from({length:4},()=>new THREE.Vector4())}},
    vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader:`
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uMap;
      uniform vec2 uSize;
      uniform float uTime;
      uniform vec4 uCrowns[4];
      void main(){
        vec2 pixel=vec2(vUv.x,1.0-vUv.y)*uSize;
        vec2 offset=vec2(0.0);
        // Local image displacement keeps trunks, buildings and roads stationary.
        for(int i=0;i<4;i++){
          vec2 local=(pixel-uCrowns[i].xy)/uCrowns[i].zw;
          float edge=max(0.0,1.0-dot(local,local));
          float weight=edge*edge;
          float phase=float(i)*1.73;
          float breeze=sin(uTime*.85+phase)*3.8+sin(uTime*1.43+phase)*1.1;
          offset.x+=weight*breeze;
          offset.y+=weight*sin(uTime*1.1+local.x*2.0+phase)*1.1;
        }
        vec2 sampleUv=vUv+vec2(offset.x,-offset.y)/uSize;
        vec3 color=texture2D(uMap,sampleUv).rgb;
        // A few small petals drift only around the flowering trees.
        for(int i=0;i<4;i++){
          for(int j=0;j<3;j++){
            float seed=float(i*3+j);
            float cycle=fract(uTime*(.07+float(j)*.009)+seed*.271);
            vec2 start=uCrowns[i].xy+vec2((float(j)-1.0)*24.0,-15.0+float(j)*8.0);
            vec2 petal=start+vec2(cycle*38.0+sin(uTime+seed)*7.0,cycle*86.0);
            vec2 p=(pixel-petal)/vec2(1.6,1.0);
            float angle=uTime*.8+seed;
            p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p;
            float shape=1.0-smoothstep(.35,1.0,dot(p,p));
            float fade=smoothstep(0.0,.15,cycle)*(1.0-smoothstep(.65,1.0,cycle));
            vec3 tint=i<2?vec3(.8,.83,.83):vec3(.76,.48,.57);
            color=mix(color,tint,shape*fade*.6);
          }
        }
        gl_FragColor=vec4(color,1.0);
      }`
  });
  const geometry=new THREE.PlaneGeometry(2,2);
  scene.add(new THREE.Mesh(geometry,material));
  const enabled=()=>!disposed&&!failed&&!lost&&!document.hidden&&!stage.hidden&&document.body.dataset.stage==='map'&&!document.body.classList.contains('reduced-motion');
  function stop(state='paused') {
    cancelAnimationFrame(frame);frame=0;lastTime=0;
    canvas.hidden=true;canvas.dataset.windState=state;
  }
  function fallback() {failed=true;stop('unavailable');}
  function draw(time) {
    frame=0;
    if(!enabled()) {stop();return;}
    if(!lastTime||time-lastTime>=1000/30) {
      elapsed+=lastTime?Math.min((time-lastTime)/1000,.1):0;
      lastTime=time;material.uniforms.uTime.value=elapsed;
      try {renderer.render(scene,camera);} catch {fallback();return;}
      if(failed)return;
      canvas.hidden=false;canvas.dataset.windState='running';
    }
    frame=requestAnimationFrame(draw);
  }
  function sync() {
    if(!enabled()) {stop(failed?'unavailable':'paused');return;}
    const nextSource=image.currentSrc||image.src;
    const layout=portrait.matches?'tall':'wide';
    if(!image.complete||!image.naturalWidth||!nextSource.includes('dungeon-'+layout)) {stop('loading');return;}
    if(!renderer) {
      try {renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:false,powerPreference:'low-power'});}
      catch {fallback();return;}
      renderer.debug.onShaderError=fallback;
    }
    if(source!==nextSource) {
      stop('loading');texture?.dispose();
      texture=new THREE.Texture(image);texture.generateMipmaps=false;
      texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
      material.uniforms.uMap.value=texture;source=nextSource;
      const config=BLOSSOMS[layout];
      material.uniforms.uSize.value.set(...config.size);
      config.crowns.forEach((c,i)=>material.uniforms.uCrowns.value[i].set(...c));
      canvas.dataset.windLayout=layout;
    }
    const width=stage.clientWidth,height=stage.clientHeight;
    if(!width||!height)return;
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5,Math.sqrt(2200000/(width*height))));
    renderer.setSize(width,height,false);
    if(!frame)frame=requestAnimationFrame(draw);
  }
  const observer=new MutationObserver(sync);
  const pageHide=()=>stop();
  observer.observe(document.body,{attributes:true,attributeFilter:['class','data-stage']});
  observer.observe(stage,{attributes:true,attributeFilter:['hidden']});
  image.addEventListener('load',sync);
  window.addEventListener('resize',sync);
  window.addEventListener('realm-view',sync);
  window.addEventListener('pageshow',sync);
  window.addEventListener('pagehide',pageHide);
  document.addEventListener('visibilitychange',sync);
  portrait.addEventListener('change',sync);
  const contextLost=event=>{event.preventDefault();lost=true;stop('unavailable');};
  const contextRestored=()=>{lost=false;sync();};
  canvas.addEventListener('webglcontextlost',contextLost);
  canvas.addEventListener('webglcontextrestored',contextRestored);
  sync();
  return {dispose(){
    disposed=true;stop();observer.disconnect();
    image.removeEventListener('load',sync);
    window.removeEventListener('resize',sync);window.removeEventListener('realm-view',sync);
    window.removeEventListener('pageshow',sync);window.removeEventListener('pagehide',pageHide);
    document.removeEventListener('visibilitychange',sync);portrait.removeEventListener('change',sync);
    canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);
    texture?.dispose();material.dispose();geometry.dispose();renderer?.dispose();
  }};
}

const stage=document.getElementById('map'),canvas=document.getElementById('map-wind');
if(stage&&canvas)createMapWind(stage,canvas,stage.querySelector('.dungeon-art img'));

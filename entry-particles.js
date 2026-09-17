import * as THREE from './vendor/three.module.js';

export const ease=(p,a,b)=>{const t=THREE.MathUtils.clamp((p-a)/(b-a),0,1);return t*t*(3-2*t);};
export function randomSequence(seed=1249){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function helixPoint(t,arm=0){
  const angle=t*Math.PI*7+arm*Math.PI*2/3;
  const radius=6.5+Math.sin(t*Math.PI)*3.4;
  return [Math.cos(angle)*radius,Math.sin(angle)*radius,-t*125+10];
}
export function particleCamera(progress,aspect){
  const p=THREE.MathUtils.clamp(Number.isFinite(progress)?progress:0,0,1);
  const fit=aspect<.8?32:24;
  return {z:THREE.MathUtils.lerp(fit,-42,ease(p,0,1)),earthOpacity:1-ease(p,.08,.42)};
}

function pointMaterial(pixelRatio,size=1){
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{time:{value:0},opacity:{value:1},ratio:{value:pixelRatio},size:{value:size}},
    vertexShader:`attribute vec3 aColor;attribute float aSize;attribute float aPhase;
      varying vec3 vColor;varying float vLight;uniform float time;uniform float ratio;uniform float size;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);vColor=aColor;vLight=.8+.2*sin(time*.55+aPhase);
      gl_PointSize=clamp(aSize*size*ratio*70./max(7.,-p.z),ratio*.65,ratio*4.5);gl_Position=projectionMatrix*p;}`,
    fragmentShader:`varying vec3 vColor;varying float vLight;uniform float opacity;
      void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
      float core=1.-smoothstep(.12,.7,r);float halo=pow(max(0.,1.-r),3.)*.18;
      gl_FragColor=vec4(vColor,(core+halo)*vLight*opacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
}
function cloud(scene,positions,colors,sizes,phases,ratio,size=1){
  const geometry=new THREE.BufferGeometry();
  for(const [name,values,count] of [['position',positions,3],['aColor',colors,3],['aSize',sizes,1],['aPhase',phases,1]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,count));
  const object=new THREE.Points(geometry,pointMaterial(ratio,size));scene.add(object);return object;
}
function tint(random){
  const colors=[0xf2e9d4,0x98cbd0,0xdcc1a0,0xb1c7d4,0xceb6c8];return new THREE.Color(colors[Math.floor(random()*colors.length)]).toArray();
}

export function createEntryParticles(renderer,onReady){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#03070b');
  const camera=new THREE.PerspectiveCamera(48,1,.1,600),random=randomSequence(),mobile=innerWidth<760,ratio=renderer.getPixelRatio();
  const objects=[];
  let points=[],colors=[],sizes=[],phases=[];
  for(let i=0;i<(mobile?1700:3100);i++){
    points.push((random()-.5)*190,(random()-.5)*130,20-random()*250);
    colors.push(...tint(random));sizes.push(i%29===0?1.9:.5+random()*.9);phases.push(random()*6.28);
  }
  const stars=cloud(scene,points,colors,sizes,phases,ratio);objects.push(stars);
  const globeGroup=new THREE.Group();scene.add(globeGroup);globeGroup.position.set(0,.4,-2);
  const lat=37.566*Math.PI/180,lon=126.978*Math.PI/180;
  const normal=new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),-Math.cos(lat)*Math.sin(lon));
  const east=new THREE.Vector3(-Math.sin(lon),0,-Math.cos(lon)),north=normal.clone().cross(east);
  const orientation=new THREE.Matrix4().makeBasis(east,north,normal).invert();
  points=[];colors=[];sizes=[];phases=[];
  const uv=[],count=mobile?8500:17000;
  for(let i=0;i<count;i++){
    const y=1-2*(i+.5)/count,angle=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y);
    const point=new THREE.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r);
    const longitude=Math.atan2(-point.z,point.x),latitude=Math.asin(y);
    uv.push([(longitude+Math.PI)/(2*Math.PI),(.5-latitude/Math.PI)]);
    points.push(...point.multiplyScalar(4).applyMatrix4(orientation).toArray());
    colors.push(.3,.55,.6);sizes.push(.55+random()*.5);phases.push(random()*6.28);
  }
  const earth=cloud(globeGroup,points,colors,sizes,phases,ratio,1.1);objects.push(earth);
  // A small NASA map colors the points only; no enlarged image is drawn on screen.
  const image=new Image();image.decoding='async';
  image.onload=()=>{
    try {
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,0,image.width,image.height).data;
      const color=earth.geometry.attributes.aColor,size=earth.geometry.attributes.aSize;
      for(let i=0;i<count;i++){
        const [u,v]=uv[i],index=(Math.min(image.height-1,Math.floor(v*image.height))*image.width+Math.min(image.width-1,Math.floor(u*image.width)))*4;
        const land=pixels[index+1]>pixels[index+2]*.84 && pixels[index]>pixels[index+2]*.6;
        const c=new THREE.Color(land?0xd8e2c5:0x245560);color.setXYZ(i,c.r,c.g,c.b);size.setX(i,land?.85:.42);
      }
      color.needsUpdate=true;size.needsUpdate=true;onReady();
    }catch{ /* A failed texture leaves a complete point globe. */ }
  };
  image.src=new URL('./assets/earth-2048.webp',import.meta.url).href;
  const spiral=new THREE.Group();scene.add(spiral);
  points=[];colors=[];sizes=[];phases=[];
  for(let arm=0;arm<3;arm++){
    const path=[];
    for(let i=0;i<=900;i++)path.push(new THREE.Vector3(...helixPoint(i/900,arm)));
    const strand=new THREE.Line(new THREE.BufferGeometry().setFromPoints(path),new THREE.LineBasicMaterial({color:[0x81b9bd,0xc0b397,0xaab9c9][arm],transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending}));spiral.add(strand);
    for(let i=0;i<(mobile?1200:2300);i++){
      const t=random(),point=helixPoint(t,arm),spread=.035+random()*.13;
      points.push(point[0]+(random()-.5)*spread,point[1]+(random()-.5)*spread,point[2]+(random()-.5)*.6);
      colors.push(...tint(random));sizes.push(.45+random()*.7);phases.push(random()*6.28);
    }
  }
  const trails=cloud(spiral,points,colors,sizes,phases,ratio,1.35);objects.push(trails);
  const galaxy=new THREE.Group();galaxy.position.z=-110;galaxy.rotation.x=.28;scene.add(galaxy);
  points=[];colors=[];sizes=[];phases=[];
  for(let i=0;i<(mobile?4500:8500);i++){
    const radius=.55+random()**.8*25,angle=(i%4)*Math.PI/2+Math.log(radius+1)*2.7;
    const scatter=(random()-.5)*(.25+radius*.024);
    points.push(Math.cos(angle+scatter)*radius,Math.sin(angle+scatter)*radius,(random()-.5)*1.3);
    colors.push(...tint(random));sizes.push(.6+random()*.9);phases.push(random()*6.28);
  }
  const arms=cloud(galaxy,points,colors,sizes,phases,ratio,2.1);objects.push(arms);
  document.body.dataset.entryRenderer='particles';
  function resize(){
    camera.aspect=(renderer.domElement.clientWidth||innerWidth)/Math.max(1,renderer.domElement.clientHeight||innerHeight);camera.updateProjectionMatrix();
    objects.forEach(object=>{object.material.uniforms.ratio.value=renderer.getPixelRatio();});
  }
  resize();
  return {
    ready:true,resize,
    render(progress,time,pointer,motion){
      const pose=particleCamera(progress,camera.aspect),p=THREE.MathUtils.clamp(progress,0,1);
      camera.position.set(motion?pointer.x*.65:0,motion?pointer.y*.4:0,motion?pose.z:24);
      camera.lookAt(0,0,camera.position.z-35);
      globeGroup.rotation.y=motion?-.2+time*.012:0;earth.material.uniforms.opacity.value=pose.earthOpacity;
      globeGroup.visible=pose.earthOpacity>.002;
      spiral.rotation.z=motion?time*.025+p*.8:0;
      galaxy.rotation.z=motion?-time*.018-p*.4:0;
      objects.forEach(object=>{object.material.uniforms.time.value=motion?time:0;});
      // Keep the form quiet while retaining the outer spiral and depth.
      arms.material.uniforms.opacity.value=1-ease(p,.75,1)*.32;
      renderer.setRenderTarget(null);renderer.clear();renderer.render(scene,camera);
    }
  };
}

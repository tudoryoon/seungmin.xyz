import * as THREE from './vendor/three.module.js';
import {SEOUL,project,globePoint,geographicJourney,buildGeography} from './entry-geography.js?v=20260919-1';

export const ease=(p,a,b)=>{const t=THREE.MathUtils.clamp((p-a)/(b-a),0,1);return t*t*(3-2*t);};
export function randomSequence(seed=1249){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function helixPoint(t,arm=0,strand=0){
  const angle=t*Math.PI*9+arm*Math.PI*2/3;
  const braid=t*Math.PI*16+arm*1.7;
  const radius=6.8+Math.sin(t*Math.PI)*3.8+strand*Math.cos(braid)*.22;
  return [Math.cos(angle)*radius,Math.sin(angle)*radius,-t*195+10+strand*Math.sin(braid)*.22];
}
export function particleCamera(progress,aspect){
  const p=THREE.MathUtils.clamp(Number.isFinite(progress)?progress:0,0,1);
  const fit=aspect<.8?32:24;
  // Overlapping eased legs keep velocity continuous at the three scene boundaries.
  const travel=.16*ease(p,0,.3)+.56*ease(p,.2,.74)+.28*ease(p,.64,1);
  const bend=Math.sin(travel*Math.PI);
  return {
    x:Math.sin(travel*Math.PI*2)*bend*.85,
    y:Math.sin(travel*Math.PI*3)*bend*.35,
    z:THREE.MathUtils.lerp(fit,-96,travel),
    fov:48+Math.sin(p*Math.PI)*2,
    strandOpacity:1-.42*ease(p,.76,1)
  };
}

function pointMaterial(pixelRatio,size=1){
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{time:{value:0},opacity:{value:1},ratio:{value:pixelRatio},size:{value:size},surface:{value:0},flow:{value:0},geographic:{value:0},flatten:{value:0},globeScale:{value:1},mapScale:{value:1},scatter:{value:0}},
    vertexShader:`attribute vec3 aColor;attribute float aSize;attribute float aPhase;attribute vec3 aSphere;
      varying vec3 vColor;varying float vLight;uniform float time;uniform float ratio;uniform float size;uniform float surface;uniform float flow;
      uniform float geographic;uniform float flatten;uniform float globeScale;uniform float mapScale;uniform float scatter;
      void main(){
        vec3 q=position;
        if(geographic>.5)q=mix(aSphere*globeScale+vec3(0.,0.,-4.*globeScale),position*mapScale,flatten);
        q.xy*=1.+scatter*(12.+sin(aPhase)*2.);q.z+=scatter*(8.+aPhase);
        vec4 p=modelViewMatrix*vec4(q,1.);vColor=aColor;
        vec3 n=normalMatrix*(position/max(length(position),.00001));
        float facing=smoothstep(-.08,.65,(n/max(length(n),.00001)).z);
        float pulse=pow(.5+.5*sin(position.z*.19+time*.42),24.);
        vLight=(.88+.12*sin(time*.4+aPhase)+flow*pulse*.65)*mix(1.,.045+.955*facing,surface);
        vLight*=smoothstep(.8,3.,-p.z)*(1.-smoothstep(180.,330.,-p.z));
        gl_PointSize=clamp(aSize*size*ratio*70./max(7.,-p.z),ratio*.65,ratio*4.5);
        gl_Position=projectionMatrix*p;
      }`,
    fragmentShader:`varying vec3 vColor;varying float vLight;uniform float opacity;
      void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
      float core=1.-smoothstep(.12,.7,r);float halo=pow(max(0.,1.-r),3.)*.18;
      gl_FragColor=vec4(vColor,(core+halo)*vLight*opacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
}
function filament(points,color,opacity){
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{color:{value:new THREE.Color(color)},opacity:{value:opacity}},
    vertexShader:`varying float vFade;void main(){vec4 p=modelViewMatrix*vec4(position,1.);
      vFade=smoothstep(1.,6.,-p.z)*(1.-smoothstep(130.,240.,-p.z));gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform vec3 color;uniform float opacity;varying float vFade;
      void main(){gl_FragColor=vec4(color,opacity*vFade);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  const geometry=new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry,material);
}
function cloud(scene,positions,colors,sizes,phases,ratio,size=1,spheres=positions){
  const geometry=new THREE.BufferGeometry();
  for(const [name,values,count] of [['position',positions,3],['aColor',colors,3],['aSize',sizes,1],['aPhase',phases,1]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,count));
  geometry.setAttribute('aSphere',new THREE.Float32BufferAttribute(spheres,3));
  const object=new THREE.Points(geometry,pointMaterial(ratio,size));scene.add(object);return object;
}
const palette=[0xf2e9d4,0x98cbd0,0xdcc1a0,0xb1c7d4,0xceb6c8].map(color=>new THREE.Color(color).toArray());
function tint(random){return palette[Math.floor(random()*palette.length)];}

export function createEntryParticles(renderer,onReady){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#03070b');
  const camera=new THREE.PerspectiveCamera(48,1,.1,600),random=randomSequence(),mobile=innerWidth<760,ratio=renderer.getPixelRatio();
  const objects=[];
  let points=[],colors=[],sizes=[],phases=[];
  for(let i=0;i<(mobile?2400:4200);i++){
    points.push((random()-.5)*210,(random()-.5)*150,20-random()*340);
    colors.push(...tint(random));sizes.push(i%29===0?1.9:.5+random()*.9);phases.push(random()*6.28);
  }
  const stars=cloud(scene,points,colors,sizes,phases,ratio);objects.push(stars);
  const geographyRoot=new THREE.Group();scene.add(geographyRoot);
  const globeGroup=new THREE.Group();geographyRoot.add(globeGroup);
  const lat=SEOUL[1]*Math.PI/180,lon=SEOUL[0]*Math.PI/180;
  const normal=new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),-Math.cos(lat)*Math.sin(lon));
  const east=new THREE.Vector3(-Math.sin(lon),0,-Math.cos(lon)),north=normal.clone().cross(east);
  const orientation=new THREE.Matrix4().makeBasis(east,north,normal).invert();
  points=[];colors=[];sizes=[];phases=[];
  const uv=[],count=mobile?9500:19000;
  for(let i=0;i<count;i++){
    const y=1-2*(i+.5)/count,angle=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y);
    const point=new THREE.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r);
    const longitude=Math.atan2(-point.z,point.x),latitude=Math.asin(y);
    uv.push([(longitude+Math.PI)/(2*Math.PI),(.5-latitude/Math.PI)]);
    points.push(...point.multiplyScalar(4).applyMatrix4(orientation).toArray());
    colors.push(.3,.55,.6);sizes.push(.55+random()*.5);phases.push(random()*6.28);
  }
  const earth=cloud(globeGroup,points,colors,sizes,phases,ratio,1.1);objects.push(earth);
  earth.material.uniforms.surface.value=1;
  // A small NASA map colors the points only; no enlarged image is drawn on screen.
  const image=new Image();image.decoding='async';
  image.onload=()=>{
    try {
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,0,image.width,image.height).data;
      const color=earth.geometry.attributes.aColor,size=earth.geometry.attributes.aSize;
      const landColor=new THREE.Color(0xd8e2c5),seaColor=new THREE.Color(0x245560);
      for(let i=0;i<count;i++){
        const [u,v]=uv[i],index=(Math.min(image.height-1,Math.floor(v*image.height))*image.width+Math.min(image.width-1,Math.floor(u*image.width)))*4;
        const land=pixels[index+1]>pixels[index+2]*.84 && pixels[index]>pixels[index+2]*.6;
        const c=land?landColor:seaColor;color.setXYZ(i,c.r,c.g,c.b);size.setX(i,land?.9:.4);
      }
      color.needsUpdate=true;size.needsUpdate=true;onReady();
    }catch{ /* A failed texture leaves a complete point globe. */ }
  };
  image.src=new URL('./assets/earth-2048.webp',import.meta.url).href;
  const spiral=new THREE.Group();scene.add(spiral);const strands=[];
  points=[];colors=[];sizes=[];phases=[];
  for(let arm=0;arm<3;arm++){
    for(const braid of [-1,0,1]){
      const path=[];
      for(let i=0;i<=1400;i++)path.push(new THREE.Vector3(...helixPoint(i/1400,arm,braid)));
      const opacity=braid===0?.24:.075;
      const strand=filament(path,[0x98c8ca,0xd3b99a,0xbdc9dd][arm],opacity);
      strand.userData.opacity=opacity;strands.push(strand);spiral.add(strand);
    }
    for(let i=0;i<(mobile?1900:3400);i++){
      const t=random(),point=helixPoint(t,arm,i%3-1),spread=.05+random()**3*.5;
      points.push(point[0]+(random()-.5)*spread,point[1]+(random()-.5)*spread,point[2]+(random()-.5)*.8);
      colors.push(...tint(random));sizes.push(.45+random()*.7);phases.push(random()*6.28);
    }
  }
  const trails=cloud(spiral,points,colors,sizes,phases,ratio,1.45);objects.push(trails);trails.material.uniforms.flow.value=1;
  const shapes=buildGeography(random,mobile),koreaObjects=[],cityObjects=[];
  const cityGroup=new THREE.Group();geographyRoot.add(cityGroup);
  function geographicCloud(parent,coordinates,scale,color,size,spherical=false){
    const positions=[],spheres=[],colors=[],sizes=[],phases=[],tint=new THREE.Color(color).toArray();
    coordinates.forEach(p=>{positions.push(...project(p,scale));spheres.push(...globePoint(p));colors.push(...tint);sizes.push(size*(.72+random()*.5));phases.push(random()*6.28);});
    const object=cloud(parent,positions,colors,sizes,phases,ratio,1,spheres);
    object.material.uniforms.geographic.value=spherical?1:0;
    // The vertex shader morphs/scatters beyond the initial geometry bounds.
    object.frustumCulled=false;objects.push(object);return object;
  }
  koreaObjects.push(geographicCloud(geographyRoot,shapes.korea,1.5,0xc5d9d1,.72,true));
  koreaObjects.push(geographicCloud(geographyRoot,shapes.coast,1.5,0xe4d4ad,1.05,true));
  cityObjects.push(geographicCloud(cityGroup,shapes.city,56,0xc0d3ce,.85));
  cityObjects.push(geographicCloud(cityGroup,shapes.cityCoast,56,0xe4d4ad,1.05));
  const river=geographicCloud(cityGroup,shapes.river,56,0x88cfd8,1.1);cityObjects.push(river);
  const marker=geographicCloud(geographyRoot,[SEOUL],1.5,0xffdf9b,3.2);
  marker.position.z=.15;
  points=[];colors=[];sizes=[];phases=[];
  for(let ray=0;ray<(mobile?65:110);ray++){
    const angle=random()*Math.PI*2,r=.15+random()*2.5;
    for(let i=0;i<12;i++){
      const radius=r+i*.025;
      points.push(Math.cos(angle)*radius,Math.sin(angle)*radius,0);
      colors.push(...tint(random));sizes.push(.35+i*.045);phases.push(angle);
    }
  }
  const burst=cloud(geographyRoot,points,colors,sizes,phases,ratio,1.2);objects.push(burst);burst.frustumCulled=false;
  document.body.dataset.entryRenderer='particles';
  function resize(){
    camera.aspect=(renderer.domElement.clientWidth||innerWidth)/Math.max(1,renderer.domElement.clientHeight||innerHeight);camera.updateProjectionMatrix();
    objects.forEach(object=>{object.material.uniforms.ratio.value=renderer.getPixelRatio();});
  }
  resize();
  return {
    ready:true,resize,
    render(progress,time,pointer,motion){
      const p=THREE.MathUtils.clamp(Number.isFinite(progress)?progress:0,0,1),pose=particleCamera(p,camera.aspect);
      const arrival=geographicJourney(p,camera.aspect,motion);
      camera.position.set(motion?pose.x+pointer.x*.5:0,motion?pose.y+pointer.y*.3:0,motion?pose.z:particleCamera(0,camera.aspect).z);
      const fov=motion?pose.fov:48;
      if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
      camera.lookAt(0,0,camera.position.z-55);
      geographyRoot.position.z=camera.position.z-particleCamera(0,camera.aspect).z;
      globeGroup.position.z=-4*arrival.globeScale;
      globeGroup.scale.setScalar(arrival.globeScale);
      earth.material.uniforms.opacity.value=arrival.earthOpacity;
      globeGroup.visible=arrival.earthOpacity>.002;
      for(const object of koreaObjects){
        const u=object.material.uniforms;
        u.flatten.value=arrival.flatten;u.globeScale.value=arrival.globeScale;u.mapScale.value=arrival.mapScale;
        u.opacity.value=arrival.koreaOpacity;object.visible=arrival.koreaOpacity>.002;
      }
      cityGroup.scale.setScalar(arrival.cityScale);
      cityGroup.visible=arrival.cityOpacity>.002;
      for(const object of cityObjects){object.material.uniforms.opacity.value=arrival.cityOpacity;object.material.uniforms.scatter.value=arrival.burst;}
      river.material.uniforms.opacity.value*=.72;
      marker.material.uniforms.opacity.value=arrival.markerOpacity;
      burst.material.uniforms.opacity.value=arrival.burstOpacity*.8;
      burst.material.uniforms.scatter.value=arrival.burst;
      burst.visible=arrival.burstOpacity>.002;
      spiral.rotation.z=motion?time*.012+p*1.1:0;
      objects.forEach(object=>{object.material.uniforms.time.value=motion?time:0;});
      trails.material.uniforms.opacity.value=pose.strandOpacity*arrival.spiralOpacity;
      strands.forEach(strand=>{strand.material.uniforms.opacity.value=strand.userData.opacity*pose.strandOpacity*arrival.spiralOpacity;});
      renderer.setRenderTarget(null);renderer.clear();renderer.render(scene,camera);
    }
  };
}

import * as THREE from './vendor/three.module.js';
import {globePoint,geographicJourney,buildGeography} from './entry-geography.js?v=20260924-1';

export const ease=(p,a,b)=>{const t=THREE.MathUtils.clamp((p-a)/(b-a),0,1);return t*t*(3-2*t);};
export function randomSequence(seed=1249){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function helixPoint(t,arm=0,strand=0){
  const radius=.15+2.7*t,angle=t*Math.PI*4+arm*Math.PI*2/3+strand*.024;
  return [Math.cos(angle)*radius,Math.sin(angle)*radius,-t*.8+strand*.015];
}

function material(ratio){
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{ratio:{value:ratio},time:{value:0},opacity:{value:1},altitude:{value:1},landing:{value:.022},curl:{value:0},flight:{value:0}},
    vertexShader:`attribute vec3 aColor;attribute vec3 aNormal;attribute float aSize;attribute float aPhase;attribute float aWeight;attribute vec3 aSpiral;
      uniform float ratio,time,opacity,altitude,landing,curl,flight;varying vec3 vColor;varying float vAlpha;
      void main(){
        // All levels stay on one sphere. Camera-relative scaling preserves precision near Seoul.
        vec3 q=position/altitude;
        float horizon=4./(4.+altitude);
        float facing=smoothstep(horizon-.015,horizon+.01,aNormal.z);
        float coverage=1.-smoothstep(1.2,2.8,length(position.xy)/landing);
        float angle=curl*(6.2831853+min(length(q.xy),3.)*.7);
        q.xy=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q.xy;
        vec3 target=aSpiral;
        float turn=time*.07;
        target.xy=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*target.xy;
        q=mix(q,target,curl);
        q.xy*=1.+flight*.65;q.z+=flight*3.6;
        vec4 view=modelViewMatrix*vec4(q,1.);
        float nearFade=smoothstep(.015,.18,-view.z);
        vAlpha=opacity*aWeight*mix(facing,coverage,curl)*nearFade*(1.25+.1*sin(time*.35+aPhase));
        vColor=aColor;
        gl_PointSize=ratio*aSize*1.65*mix(1.,clamp(1.7/max(.4,-view.z),.65,2.),curl);
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader:`varying vec3 vColor;varying float vAlpha;
      void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
        gl_FragColor=vec4(vColor,(1.-smoothstep(.1,1.,r))*vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
}

export function createEntryParticles(renderer,onReady){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#03070b');
  const camera=new THREE.PerspectiveCamera(48,1,.005,100000);camera.position.z=1;
  const random=randomSequence(),mobile=innerWidth<760,objects=[];
  function cloud(name,coordinates,color,size,bounds){
    const positions=[],normals=[],colors=[],sizes=[],phases=[],weights=[],spirals=[],tint=new THREE.Color(color).toArray();
    coordinates.forEach((coordinate,i)=>{
      const p=globePoint(coordinate);
      positions.push(p[0],p[1],p[2]-4);normals.push(...p.map(v=>v/4));
      colors.push(...tint);sizes.push(size*(.85+random()*.3));phases.push(random()*Math.PI*2);
      let weight=1;
      if(bounds){
        const [west,south,east,north]=bounds,dx=(east-west)*.2,dy=(north-south)*.2,[lon,lat]=coordinate;
        weight=THREE.MathUtils.smoothstep(lon,west,west+dx)*(1-THREE.MathUtils.smoothstep(lon,east-dx,east))*THREE.MathUtils.smoothstep(lat,south,south+dy)*(1-THREE.MathUtils.smoothstep(lat,north-dy,north));
      }
      weights.push(weight);
      const t=random(),target=helixPoint(t,i%3,(i%7-3)/3);
      spirals.push(target[0]+(random()-.5)*.055,target[1]+(random()-.5)*.055,target[2]);
    });
    const geometry=new THREE.BufferGeometry();
    for(const [name,array,n] of [['position',positions,3],['aNormal',normals,3],['aColor',colors,3],['aSize',sizes,1],['aPhase',phases,1],['aWeight',weights,1],['aSpiral',spirals,3]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(array,n));
    const object=new THREE.Points(geometry,material(renderer.getPixelRatio()));
    object.name=name;object.frustumCulled=false;scene.add(object);objects.push(object);return object;
  }
  const globeCoordinates=[],count=mobile?17000:30000;
  for(let i=0;i<count;i++){
    const y=1-2*(i+.5)/count,angle=i*Math.PI*(3-Math.sqrt(5));
    globeCoordinates.push([((angle*180/Math.PI+180)%360)-180,Math.asin(y)*180/Math.PI]);
  }
  const earth=cloud('earth',globeCoordinates,0x637b73,1.4);
  const shapes=buildGeography(random,mobile);
  cloud('world-coast',shapes.worldCoast,0xa0c7c1,1.4);
  cloud('regional',shapes.regional,0xb6c9bb,1.25,[110,27,142,47]);
  cloud('korea',shapes.korea,0xc3d1c3,1.3);
  cloud('korea-coast',shapes.coast,0xd7d2b6,1.6);
  cloud('metro',shapes.metro,0xc3d1c3,1.25,[125.5,36.4,128.5,38.8]);
  cloud('local',shapes.local,0xd0d7cd,1.35,[126.5,37.2,127.45,37.93]);
  cloud('river',shapes.river,0x75bcc9,1.9);
  const image=new Image();image.decoding='async';
  image.onload=()=>{
    try{
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);
      const pixels=context.getImageData(0,0,image.width,image.height).data,color=earth.geometry.attributes.aColor,size=earth.geometry.attributes.aSize;
      const land=new THREE.Color(0xc3d1b7),sea=new THREE.Color(0x21434c);
      globeCoordinates.forEach(([lon,lat],i)=>{
        const x=Math.min(image.width-1,Math.floor((lon+180)/360*image.width)),y=Math.min(image.height-1,Math.floor((.5-lat/180)*image.height)),j=(y*image.width+x)*4;
        const isLand=pixels[j+1]>pixels[j+2]*.84&&pixels[j]>pixels[j+2]*.6,c=isLand?land:sea;
        color.setXYZ(i,c.r,c.g,c.b);size.setX(i,isLand?1.6:1.1);
      });color.needsUpdate=true;size.needsUpdate=true;onReady();
    }catch{/* Geographic outlines remain available if the color texture fails. */}
  };
  image.src=new URL('./assets/earth-2048.webp',import.meta.url).href;
  const lines=[];
  for(let arm=0;arm<3;arm++)for(const strand of [-1,0,1]){
    const geometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:900},(_,i)=>new THREE.Vector3(...helixPoint(i/899,arm,strand))));
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:[0x8fb8b7,0xc8bda4,0xabbfd1][arm],transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    line.userData.strength=strand===0?.25:.07;scene.add(line);lines.push(line);
  }
  document.body.dataset.entryRenderer='particles';
  function resize(){
    camera.aspect=(renderer.domElement.clientWidth||innerWidth)/Math.max(1,renderer.domElement.clientHeight||innerHeight);camera.updateProjectionMatrix();
    objects.forEach(object=>object.material.uniforms.ratio.value=renderer.getPixelRatio());
  }
  resize();
  return {ready:true,resize,render(progress,time,pointer,motion){
    const state=geographicJourney(progress,camera.aspect,motion),clock=motion?time:0;
    const levels=[state.earthOpacity,state.earthOpacity*.65,state.regionOpacity,state.koreaOpacity,state.koreaOpacity*.7,state.metroOpacity,state.localOpacity,state.riverOpacity*.85];
    for(let i=0;i<objects.length;i++){
      const object=objects[i],u=object.material.uniforms;
      u.altitude.value=state.altitude;u.landing.value=state.landing;u.curl.value=state.curl;u.flight.value=state.flight;
      u.time.value=clock;u.opacity.value=levels[i]*state.endOpacity;object.visible=u.opacity.value>.001;
    }
    lines.forEach(line=>{
      line.material.opacity=ease(state.curl,.55,1)*line.userData.strength*state.endOpacity;
      line.visible=line.material.opacity>.001;line.rotation.z=-clock*.07;
      line.scale.set(1+state.flight*.65,1+state.flight*.65,1);line.position.z=state.flight*3.6;
    });
    renderer.setRenderTarget(null);renderer.clear();renderer.render(scene,camera);
  }};
}

import * as THREE from './vendor/three.module.js';

// Leaflet owns pan/pinch and the accessible markers; Three adds lit, raised tracks.
// Rendering is event-driven, with the SVG routes remaining a complete no-WebGL fallback.
export function createSubwayDepth({map,container,edges,colors}) {
  const canvas=container.ownerDocument.createElement('canvas');
  canvas.className='subway-depth';canvas.setAttribute('aria-hidden','true');
  let renderer;
  try { renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'}); }
  catch {return {update(){},show(){},hide(){},destroy(){}};}
  renderer.setPixelRatio(Math.min(container.ownerDocument.defaultView.devicePixelRatio||1,2));
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,3000);
  camera.position.set(0,0,1500);camera.lookAt(0,0,0);
  scene.add(new THREE.AmbientLight(0xffffff,3));
  const light=new THREE.DirectionalLight(0xffffff,3.2);light.position.set(-300,500,900);scene.add(light);
  const cylinder=new THREE.CylinderGeometry(1,1,1,10),sphere=new THREE.SphereGeometry(1,10,6);
  const segments=edges.flatMap(edge=>edge.points.slice(1).map((point,i)=>({a:edge.points[i],b:point,line:edge.line})));
  const material=new THREE.MeshStandardMaterial({roughness:.4,metalness:.12});
  const rails=new THREE.InstancedMesh(cylinder,material,segments.length);
  const joins=new THREE.InstancedMesh(sphere,material,segments.length*2);
  rails.frustumCulled=false;joins.frustumCulled=false;scene.add(rails,joins);
  const object=new THREE.Object3D(),color=new THREE.Color();
  let frame=0,active=true,destroyed=false,line='',zooming=false,lost=false,lastRadius=-1,lastLine=null,lastWidth=0,lastHeight=0;
  const view=container.ownerDocument.defaultView;
  function draw(){
    frame=0;if(!active||destroyed||zooming||lost)return;
    const size=map.getSize();if(!size.x||!size.y)return;
    const origin=map.containerPointToLayerPoint([0,0]);canvas.style.transform=`translate3d(${origin.x}px,${origin.y}px,0)`;
    if(size.x!==lastWidth||size.y!==lastHeight){renderer.setSize(size.x,size.y);lastWidth=size.x;lastHeight=size.y;}
    const bounds=map.getBounds();
    camera.left=bounds.getWest();camera.right=bounds.getEast();camera.top=bounds.getNorth();camera.bottom=bounds.getSouth();camera.updateProjectionMatrix();
    const scale=size.x/(camera.right-camera.left),radius=Math.max(1.6,Math.min(5,4.5+map.getZoom()*.8))/2/scale;
    if(Math.abs(radius-lastRadius)>1e-7||line!==lastLine){segments.forEach((segment,i)=>{
      const [ax,ay]=segment.a,[bx,by]=segment.b,visible=!line||segment.line===line;
      object.position.set((ax+bx)/2,(ay+by)/2,3);object.rotation.set(0,0,Math.atan2(by-ay,bx-ax)-Math.PI/2);
      object.scale.set(visible?radius:0,Math.hypot(bx-ax,by-ay),radius);object.updateMatrix();rails.setMatrixAt(i,object.matrix);
      color.set(colors[segment.line]);rails.setColorAt(i,color);
      for(let end=0;end<2;end++){
        object.position.set(...(end?segment.b:segment.a),3);object.rotation.set(0,0,0);object.scale.setScalar(visible?radius:0);object.updateMatrix();
        joins.setMatrixAt(i*2+end,object.matrix);joins.setColorAt(i*2+end,color);
      }
    });
    rails.instanceMatrix.needsUpdate=true;rails.instanceColor.needsUpdate=true;joins.instanceMatrix.needsUpdate=true;joins.instanceColor.needsUpdate=true;
    lastRadius=radius;lastLine=line;}
    renderer.render(scene,camera);canvas.hidden=false;container.dataset.depth='ready';
  }
  function request(){if(active&&!frame&&!destroyed)frame=view.requestAnimationFrame(draw);}
  function zoomStart(){zooming=true;canvas.hidden=true;container.dataset.depth='flat';}
  function zoomEnd(){zooming=false;request();}
  function contextLost(event){event.preventDefault();lost=true;canvas.hidden=true;container.dataset.depth='flat';}
  function contextRestored(){lost=false;lastRadius=-1;request();}
  canvas.addEventListener('webglcontextlost',contextLost);
  canvas.addEventListener('webglcontextrestored',contextRestored);
  map.getPane('mapPane').append(canvas);map.on('move resize',request);map.on('zoomstart',zoomStart);map.on('zoomend',zoomEnd);request();
  return {
    update(value){line=value;request();},show(){active=true;request();},
    hide(){active=false;view.cancelAnimationFrame(frame);frame=0;},
    destroy(){destroyed=true;view.cancelAnimationFrame(frame);map.off('move resize',request);map.off('zoomstart',zoomStart);map.off('zoomend',zoomEnd);canvas.remove();cylinder.dispose();sphere.dispose();material.dispose();renderer.dispose();}
  };
}

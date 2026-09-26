import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createFoodMap,schematicPoint} from '../food-map.js';
import {MAP_STATIONS,stationTitle} from '../food-map-core.js';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function fakeLibrary(document){
  const state={markers:[],paths:[],fit:null,center:null,zoom:-1,ready:false};
  const instance={fitBounds(bounds){state.fit=bounds;state.ready=true;return this;},setMaxBounds(){},setView(center,zoom){state.center=center;state.zoom=zoom;return this;},getZoom:()=>state.zoom,on(){return this;},invalidateSize(){},zoomIn(){state.zoom+=.5;},zoomOut(){state.zoom-=.5;},remove(){state.ready=false;},getSize:()=>({x:1000,y:700}),latLngToContainerPoint:([y,x])=>({x:x/4+500,y:350-y/4})};
  const library={
    CRS:{Simple:{}},latLngBounds:()=>({pad(){return this;}}),
    map:(_container,options)=>{assert.equal(options.crs,library.CRS.Simple);assert.equal(options.zoomDelta,.5);return instance;},
    layerGroup:()=>({children:[],addTo(){return this;},clearLayers(){for(const child of this.children)child.el?.remove();this.children=[];state.markers=state.markers.filter(marker=>marker.el.isConnected);}}),divIcon:options=>options,
    polyline:(points,options)=>({addTo(group){group.children.push(this);state.paths.push({points,options});return this;}}),
    marker:(point,options)=>{
      const el=document.createElement('div');el.className='food-station-marker';el.append(options.icon.html);
      const handlers={};const marker={el,options,point,on(type,handler){handlers[type]=handler;return this;},fire(type){handlers[type]?.();},bindTooltip(){return this;},addTo(group){assert.ok(state.ready);group.children.push(this);state.markers.push(this);document.getElementById('food-map-canvas').append(el);return this;},getElement:()=>el,setZIndexOffset(){}};return marker;
    },DomEvent:{disableScrollPropagation(){},disableClickPropagation(){}}
  };return {library,state};
}
function createWindow(){const window=new Window({url:'http://localhost/#food-map',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});window.document.write(html);window.ResizeObserver=class{observe(){}disconnect(){}};return window;}
const window=createWindow(),doc=window.document,root=doc.getElementById('food-map-content'),$=id=>doc.getElementById(id);
const {library,state}=fakeLibrary(doc);let calls=0,depthHidden=0,depthShown=0,depthLine='';
const reader=createFoodMap(root,{loadLibrary:async()=>{calls++;return library;},loadDepth:async()=>({createSubwayDepth:()=>({update(value){depthLine=value;},hide(){depthHidden++;},show(){depthShown++;},destroy(){}})})});
try{
  assert.equal(calls,0,'map engine is lazy');assert.equal($('food-station-list').children.length,448);
  await reader.show();assert.equal(calls,1);assert.equal(state.markers.length,448);assert.equal(state.paths.length,1016);
  for(const marker of state.markers){
    const station=MAP_STATIONS.find(s=>s.id===marker.el.dataset.stationId);marker.fire('click');
    assert.equal($('food-station-title').textContent,stationTitle(station));assert.deepEqual(state.center,schematicPoint(station));assert.equal(state.zoom,1);
    assert.equal($('food-station-list').hidden,true);assert.equal($('food-station-detail').hidden,false);assert.ok(marker.el.classList.contains('is-selected'));
    $('food-station-back').click();assert.equal($('food-station-list').hidden,false);
  }
  const search=$('food-station-search');search.value='신촌역';search.dispatchEvent(new window.Event('input'));
  assert.equal(state.markers.length,2);assert.equal($('food-station-list').children.length,2);
  $('food-line').value='2호선';$('food-line').dispatchEvent(new window.Event('change'));assert.equal(depthLine,'2호선');
  assert.equal(state.markers.length,1);assert.equal(state.fit.length,1);
  search.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter'}));assert.equal($('food-station-title').textContent,'신촌역');
  search.value='없음';search.dispatchEvent(new window.Event('input'));assert.equal(state.markers.length,0);assert.equal($('food-no-results').hidden,false);
  $('food-filter-reset').click();assert.equal(state.markers.length,448);assert.equal($('food-line').value,'');
  const seoul=state.markers.find(m=>m.el.dataset.stationId==='station-0150');seoul.el.dispatchEvent(new window.KeyboardEvent('keydown',{key:' ',cancelable:true}));assert.equal($('food-station-title').textContent,'서울역');
  $('food-station-back').click();root.querySelector('[data-map-scope=all]').click();assert.equal(state.fit.length,448);
  $('food-zoom-in').click();assert.equal(state.zoom,1.5);$('food-zoom-out').click();assert.equal(state.zoom,1);
  reader.hide();assert.equal(depthHidden,1);await reader.show();assert.ok(depthShown>=2);assert.equal(calls,1);
  console.log('PASS: 448 schematic marker clicks, 508 tracks, search, line/depth filters, selection/back/keyboard, fit/zoom and visible-only rendering.');
}finally{reader.destroy();await window.happyDOM.close();}
const failed=createWindow();
try{
  const failedRoot=failed.document.getElementById('food-map-content');
  const reader=createFoodMap(failedRoot,{loadLibrary:async()=>{throw new Error('offline');}});await reader.show();
  assert.equal(failed.document.getElementById('food-map-retry').hidden,false);
  failedRoot.querySelector('#food-station-list button').click();assert.equal(failed.document.getElementById('food-station-detail').hidden,false);reader.destroy();
}finally{await failed.happyDOM.close();}
const racing=createWindow();
try{
  const {library,state}=fakeLibrary(racing.document);let release;
  const reader=createFoodMap(racing.document.getElementById('food-map-content'),{loadLibrary:()=>new Promise(resolve=>{release=()=>resolve(library);})});
  const pending=reader.show();reader.hide();release();await pending;assert.equal(state.ready,false);reader.destroy();
}finally{await racing.happyDOM.close();}
const noDepth=createWindow();
try{
  const {library,state}=fakeLibrary(noDepth.document);
  const reader=createFoodMap(noDepth.document.getElementById('food-map-content'),{loadLibrary:async()=>library,loadDepth:async()=>{throw Error('GPU unavailable');}});
  await reader.show();await Promise.resolve();assert.equal(state.markers.length,448);assert.equal(state.paths.length,1016);reader.destroy();
}finally{await noDepth.happyDOM.close();}

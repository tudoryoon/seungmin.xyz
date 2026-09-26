import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createFoodMap} from '../food-map.js';
import {MAP_STATIONS,stationTitle,latLng} from '../food-map-core.js';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function fakeLibrary(document){
  const state={markers:[],tileAdds:0,tileRemoves:0,fit:null,center:null,zoom:11,ready:false};
  const instance={attributionControl:{setPrefix(){}},fitBounds(bounds){state.fit=bounds;state.ready=true;return this;},setView(center,zoom){state.center=center;state.zoom=zoom;return this;},getZoom:()=>state.zoom,on(){return this;},invalidateSize(){},zoomIn(){state.zoom++;},zoomOut(){state.zoom--;},remove(){state.ready=false;},hasLayer:layer=>layer.active,removeLayer(layer){layer.active=false;state.tileRemoves++;}};
  let current=[];
  const group={addTo(){return this;},clearLayers(){current.forEach(marker=>marker.el.remove());current=[];state.markers=[];}};
  const library={
    map:()=>instance,layerGroup:()=>group,divIcon:options=>options,
    marker:(point,options)=>{
      const el=document.createElement('div');el.className='food-station-marker';el.append(options.icon.html);
      const handlers={};const marker={el,options,point,on(type,handler){handlers[type]=handler;return this;},fire(type){handlers[type]?.();},bindTooltip(){return this;},addTo(){assert.ok(state.ready,'view must be initialized before marker elements are accessed');current.push(this);state.markers.push(this);document.getElementById('food-map-canvas').append(el);return this;},getElement:()=>el,setZIndexOffset(){}};return marker;
    },
    tileLayer:(url,options)=>{
      assert.equal(url,'https://tile.openstreetmap.org/{z}/{x}/{y}.png');assert.equal(options.referrerPolicy,'strict-origin-when-cross-origin');assert.match(options.attribution,/OpenStreetMap/);
      const handlers={};const tile={active:false,on(event,handler){handlers[event]=handler;return this;},addTo(){this.active=true;state.tileAdds++;return this;},redraw(){state.redraw=true;},fire(event){handlers[event]?.();}};state.tiles=tile;return tile;
    },DomEvent:{disableScrollPropagation(){},disableClickPropagation(){}}
  };return {library,state};
}
const window=new Window({url:'http://localhost/#food-map',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
window.document.write(html);window.ResizeObserver=class{observe(){}disconnect(){}};
const doc=window.document,root=doc.getElementById('food-map-content'),$=id=>doc.getElementById(id);
const {library,state}=fakeLibrary(doc);let calls=0;
const reader=createFoodMap(root,{loadLibrary:async()=>{calls++;return library;}});
try{
  assert.equal(calls,0,'map engine and tiles are lazy');
  assert.equal($('food-station-list').children.length,448);
  await reader.show();assert.equal(calls,1);assert.equal(state.markers.length,448);assert.equal(state.tileAdds,1);
  for(const marker of state.markers){
    const station=MAP_STATIONS.find(s=>s.id===marker.el.dataset.stationId);
    marker.fire('click');
    assert.equal($('food-station-title').textContent,stationTitle(station));
    assert.deepEqual(state.center,latLng(station));assert.equal(state.zoom,15);
    assert.equal($('food-station-list').hidden,true);assert.equal($('food-station-detail').hidden,false);
    assert.ok(marker.el.classList.contains('is-selected'));
    $('food-station-back').click();assert.equal($('food-station-list').hidden,false);
  }
  const search=$('food-station-search');search.value='신촌역';search.dispatchEvent(new window.Event('input'));
  assert.equal(state.markers.length,2);assert.equal($('food-station-list').children.length,2);
  $('food-line').value='2호선';$('food-line').dispatchEvent(new window.Event('change'));
  assert.equal(state.markers.length,1);assert.equal(state.fit.length,1);
  search.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter'}));assert.equal($('food-station-title').textContent,'신촌역');
  search.value='없음';search.dispatchEvent(new window.Event('input'));assert.equal(state.markers.length,0);assert.equal($('food-no-results').hidden,false);
  $('food-filter-reset').click();assert.equal(state.markers.length,448);assert.equal($('food-line').value,'');
  const seoul=state.markers.find(m=>m.el.dataset.stationId==='station-0150');seoul.el.dispatchEvent(new window.KeyboardEvent('keydown',{key:' ',cancelable:true}));assert.equal($('food-station-title').textContent,'서울역');
  $('food-station-back').click();
  root.querySelector('[data-map-scope=all]').click();assert.equal(state.fit.length,448);
  $('food-zoom-in').click();assert.equal(state.zoom,16);$('food-zoom-out').click();assert.equal(state.zoom,15);
  reader.hide();assert.equal(state.tileRemoves,1);await reader.show();assert.equal(state.tileAdds,2);assert.equal(calls,1,'reopening does not recreate the map');
  state.tiles.fire('tileerror');assert.equal($('food-map-retry').hidden,false);assert.equal($('food-station-list').children.length,448);
  $('food-map-retry').click();assert.equal(state.redraw,true);
  console.log('PASS: all 448 marker clicks, lazy initialization, search/line filters, selection/back/keyboard, fit/zoom, visible-only tiles and tile failure recovery.');
}finally{reader.destroy();await window.happyDOM.close();}
const failed=new Window({url:'http://localhost/#food-map',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});failed.document.write(html);
try{
  const failedRoot=failed.document.getElementById('food-map-content');
  const reader=createFoodMap(failedRoot,{loadLibrary:async()=>{throw new Error('offline');}});await reader.show();
  assert.equal(failed.document.getElementById('food-map-retry').hidden,false);
  failedRoot.querySelector('#food-station-list button').click();assert.equal(failed.document.getElementById('food-station-detail').hidden,false,'list stays usable without map library');reader.destroy();
}finally{await failed.happyDOM.close();}
const racing=new Window({url:'http://localhost/#food-map',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});racing.document.write(html);racing.ResizeObserver=class{observe(){}disconnect(){}};
try{
  const {library,state}=fakeLibrary(racing.document);let release;
  const reader=createFoodMap(racing.document.getElementById('food-map-content'),{loadLibrary:()=>new Promise(resolve=>{release=()=>resolve(library);})});
  const pending=reader.show();reader.hide();release();await pending;
  assert.equal(state.tileAdds,0,'leaving during import never requests hidden tiles');reader.destroy();
}finally{await racing.happyDOM.close();}

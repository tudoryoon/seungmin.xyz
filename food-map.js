import {MAP_STATIONS,LINES,SEOUL_BOUNDS,filterStations,stationTitle,latLng,externalStationURL} from './food-map-core.js?v=20260926-1';

export function createFoodMap(root,{stations=MAP_STATIONS,loadLibrary=()=>import('./vendor/leaflet/leaflet.mjs')}={}) {
  const doc=root.ownerDocument,view=doc.defaultView,$=id=>root.querySelector('#'+id);
  const search=$('food-station-search'),line=$('food-line'),list=$('food-station-list');
  const detail=$('food-station-detail'),status=$('food-map-status'),retry=$('food-map-retry');
  const canvas=$('food-map-canvas'),markers=new Map();
  let L,map,layer,tiles,pending,visible=false,selected=null,filtered=[],resizeObserver,scope='seoul';
  function badges(station) {
    const group=doc.createElement('span');group.className='station-lines';
    for(const name of station.lines){
      const badge=doc.createElement('span');badge.className='station-line';
      badge.style.setProperty('--line-color',LINES[name]);badge.textContent=name;group.append(badge);
    }
    return group;
  }
  for(const name of Object.keys(LINES)){
    const option=doc.createElement('option');option.value=name;option.textContent=name;line.append(option);
  }
  function highlight() {
    for(const [id,marker] of markers){
      const active=id===selected?.id;
      marker.getElement()?.classList.toggle('is-selected',active);
      marker.setZIndexOffset(active?1000:0);
    }
  }
  function selectStation(station) {
    selected=station;list.hidden=true;detail.hidden=false;$('food-no-results').hidden=true;
    $('food-station-title').textContent=stationTitle(station);
    $('food-station-lines').replaceChildren(badges(station));
    $('food-station-note').textContent=station.note||'';
    $('food-station-external').href=externalStationURL(station);
    highlight();
    if(map){map.setView(latLng(station),Math.max(map.getZoom(),15),{animate:false});setScope(null);}
    $('food-station-title').focus({preventScroll:true});
  }
  function renderMarkers() {
    if(!map)return;
    layer.clearLayers();markers.clear();
    for(const station of filtered){
      const dot=doc.createElement('span');dot.className='station-dot';
      dot.style.setProperty('--station-color',LINES[station.lines[0]]);
      if(station.lines.length>1)dot.classList.add('is-transfer');
      const marker=L.marker(latLng(station),{
        icon:L.divIcon({html:dot,className:'food-station-marker',iconSize:[24,24],iconAnchor:[12,12]}),
        title:stationTitle(station)+' · '+station.lines.join(' · '),keyboard:true,riseOnHover:true
      });
      const label=doc.createElement('span');label.textContent=stationTitle(station);
      marker.bindTooltip(label,{direction:'top',offset:[0,-10],className:'food-station-tooltip'});
      marker.on('click',()=>selectStation(station));marker.addTo(layer);
      marker.getElement().setAttribute('aria-label',marker.options.title);
      marker.getElement().addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();selectStation(station);}});
      marker.getElement().dataset.stationId=station.id;
      markers.set(station.id,marker);
    }
    highlight();root.dataset.markerCount=String(markers.size);
  }
  function applyFilters() {
    filtered=filterStations(stations,search.value,line.value);selected=null;
    detail.hidden=true;list.hidden=false;
    $('food-station-count').textContent=filtered.length===stations.length?`${stations.length}개 역`:`${filtered.length} / ${stations.length}개 역`;
    $('food-no-results').hidden=filtered.length>0;
    $('food-filter-reset').disabled=!search.value&&!line.value;
    const fragment=doc.createDocumentFragment();
    for(const station of filtered){
      const item=doc.createElement('li'),button=doc.createElement('button'),name=doc.createElement('span');
      button.type='button';button.dataset.stationId=station.id;name.textContent=stationTitle(station);name.className='station-result-name';
      button.append(name,badges(station));button.addEventListener('click',()=>selectStation(station));
      item.append(button);fragment.append(item);
    }
    list.replaceChildren(fragment);list.scrollTop=0;renderMarkers();
  }
  function setScope(value){
    scope=value;
    for(const button of root.querySelectorAll('[data-map-scope]'))button.setAttribute('aria-pressed',String(button.dataset.mapScope===value));
  }
  function fit(scope) {
    if(!map)return;
    const bounds=scope==='seoul'?SEOUL_BOUNDS:filtered.map(latLng);
    if(!bounds.length)return;
    map.fitBounds(bounds,{padding:[26,26],maxZoom:14,animate:false});setScope(scope);
  }
  function tileStatus() {
    const images=[...canvas.querySelectorAll('.leaflet-tile')];
    const failed=images.some(image=>image.complete&&!image.naturalWidth);
    const loaded=images.some(image=>image.complete&&image.naturalWidth>0);
    status.textContent=failed?(loaded?'일부 배경 지도를 불러오지 못했습니다.':'배경 지도를 불러오지 못했습니다.') : '';
    retry.hidden=!failed;
  }
  async function ensureMap() {
    if(map){map.invalidateSize({pan:false});if(scope)fit(scope);return;}
    if(pending)return pending;
    status.textContent='지도 불러오는 중…';retry.hidden=true;
    pending=(async()=>{
      try {
        L=await loadLibrary();
        // A tab may have been closed while the library was loading. Do not load hidden tiles.
        if(!visible)return;
        map=L.map(canvas,{zoomControl:false,minZoom:6,maxZoom:18,scrollWheelZoom:true,attributionControl:true});
        layer=L.layerGroup().addTo(map);
        map.attributionControl.setPrefix(false);
        tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
          maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',updateWhenIdle:true,keepBuffer:1,
          attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
        });
        tiles.on('load',tileStatus);tiles.on('tileerror',()=>{status.textContent='배경 지도를 불러오지 못했습니다.';retry.hidden=false;});
        map.on('dragstart zoomstart',()=>setScope(null));
        L.DomEvent.disableScrollPropagation(root);L.DomEvent.disableClickPropagation($('food-map-tools'));
        fit('seoul');renderMarkers();tiles.addTo(map);
        if(selected){map.setView(latLng(selected),15,{animate:false});setScope(null);}
        status.textContent='';
        resizeObserver=new view.ResizeObserver(()=>{if(visible){map.invalidateSize({pan:false});if(scope)fit(scope);}});resizeObserver.observe(canvas);
      } catch {
        map?.remove();map=null;markers.clear();root.dataset.markerCount='0';
        status.textContent='지도를 불러오지 못했습니다.';retry.hidden=false;
      } finally {pending=null;}
    })();
    return pending;
  }
  search.addEventListener('input',applyFilters);
  search.addEventListener('keydown',event=>{if(event.key==='Enter'&&filtered.length){event.preventDefault();selectStation(filtered[0]);}});
  line.addEventListener('change',()=>{applyFilters();fit('all');});
  $('food-filter-reset').addEventListener('click',()=>{search.value='';line.value='';applyFilters();fit('seoul');search.focus();});
  $('food-station-back').addEventListener('click',()=>{const id=selected?.id;selected=null;detail.hidden=true;list.hidden=false;$('food-no-results').hidden=filtered.length>0;highlight();[...list.querySelectorAll('button')].find(button=>button.dataset.stationId===id)?.focus({preventScroll:true});});
  for(const button of root.querySelectorAll('[data-map-scope]'))button.addEventListener('click',()=>fit(button.dataset.mapScope));
  $('food-zoom-in').addEventListener('click',()=>map?.zoomIn());
  $('food-zoom-out').addEventListener('click',()=>map?.zoomOut());
  retry.addEventListener('click',()=>{if(map){status.textContent='';retry.hidden=true;tiles.redraw();}else void ensureMap();});
  // Contain the list and map's scroll gestures within this tab, not the entrance runway.
  root.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  applyFilters();
  return {
    async show(){visible=true;await ensureMap();if(visible&&map&&!map.hasLayer(tiles))tiles.addTo(map);},
    hide(){visible=false;if(map&&tiles)map.removeLayer(tiles);},
    destroy(){visible=false;resizeObserver?.disconnect();map?.remove();}
  };
}

if(typeof document!=='undefined'&&document.getElementById('food-map-content')){
  let reader;
  const update=()=>{
    if(document.body.dataset.stage==='food-map'&&!document.hidden){
      reader ||= createFoodMap(document.getElementById('food-map-content'));void reader.show();
    }else reader?.hide();
  };
  window.addEventListener('realm-view',update);document.addEventListener('visibilitychange',update);update();
}

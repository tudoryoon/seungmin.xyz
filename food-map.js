import {MAP_STATIONS,LINES,SEOUL_BOUNDS,filterStations,stationTitle,externalStationURL} from './food-map-core.js?v=20260926-2';
import {SUBWAY_LAYOUT} from './data/subway-layout.js?v=20260926-2';
import {TERMINALS} from './subway-topology.js?v=20260926-2';

export const DISPLAY_COLORS={'1호선':'#5296eb','2호선':'#48cd8c','3호선':'#ffab64','4호선':'#52ccee','5호선':'#b99ae7','6호선':'#de9a64','7호선':'#b7c668','8호선':'#f078ac','9호선':'#cdbb80','경의중앙선':'#8ed6c6'};
export const schematicPoint=station=>{const [x,y]=SUBWAY_LAYOUT.positions[station.id];return [y,x];};

export function createFoodMap(root,{stations=MAP_STATIONS,loadLibrary=()=>import('./vendor/leaflet/leaflet.mjs'),loadDepth=()=>import('./subway-depth.js?v=20260926-2')}={}) {
  const doc=root.ownerDocument,view=doc.defaultView,$=id=>root.querySelector('#'+id);
  const search=$('food-station-search'),line=$('food-line'),list=$('food-station-list');
  const detail=$('food-station-detail'),status=$('food-map-status'),retry=$('food-map-retry');
  const canvas=$('food-map-canvas'),markers=new Map();
  let L,map,layer,tracks,depth,pending,visible=false,destroyed=false,selected=null,filtered=[],resizeObserver,scope='seoul',labelFrame=0,trackLine=null;
  const reducedMotion=view.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function badges(station) {
    const group=doc.createElement('span');group.className='station-lines';
    for(const name of station.lines){
      const badge=doc.createElement('span');badge.className='station-line';
      badge.style.setProperty('--line-color',DISPLAY_COLORS[name]);badge.textContent=name;group.append(badge);
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
    if(map){map.setView(schematicPoint(station),Math.max(map.getZoom(),1),{animate:!reducedMotion});setScope(null);queueLabels();}
    $('food-station-title').focus({preventScroll:true});
  }
  function placeLabels(){
    labelFrame=0;if(!visible||!map)return;
    const zoom=map.getZoom(),dotSize=Math.max(4,Math.min(10,9+zoom*1.4));
    canvas.style.setProperty('--station-size',`${dotSize}px`);canvas.style.setProperty('--transfer-size',`${dotSize+3}px`);
    canvas.style.setProperty('--track-width',`${Math.max(1.6,Math.min(5,4.5+zoom*.8))}px`);
    const size=map.getSize(),occupied=filtered.map(station=>{
      const p=map.latLngToContainerPoint(schematicPoint(station)),r=(station.lines.length>1?dotSize+3:dotSize)/2;return {x:p.x-r,y:p.y-r,w:r*2,h:r*2};
    });
    const order=[...filtered].sort((a,b)=>priority(b)-priority(a)||a.id.localeCompare(b.id));
    function priority(station){return (station.id===selected?.id?100:0)+(station.lines.length>1?10:0)+(TERMINALS.has(station.id)?5:0);}
    for(const station of order){
      const element=markers.get(station.id)?.getElement(),label=element?.querySelector('.station-name');if(!label)continue;
      label.hidden=true;
      const point=map.latLngToContainerPoint(schematicPoint(station));
      if(point.x<12||point.x>size.x-12||point.y<12||point.y>size.y-12)continue;
      const width=label.textContent.length*11+8,height=19;
      const options=[[13,-height/2],[-width-13,-height/2],[-width/2,-29],[-width/2,13]];
      for(const [dx,dy] of options){
        const box={x:point.x+dx,y:point.y+dy,w:width,h:height};
        if(box.x<3||box.y<3||box.x+width>size.x-3||box.y+height>size.y-3)continue;
        if(occupied.some(b=>box.x<b.x+b.w+5&&box.x+width+5>b.x&&box.y<b.y+b.h+3&&box.y+height+3>b.y))continue;
        occupied.push(box);label.style.left=`${12+dx}px`;label.style.top=`${12+dy}px`;label.hidden=false;break;
      }
    }
  }
  function queueLabels(){if(!labelFrame&&visible)labelFrame=view.requestAnimationFrame(placeLabels);}
  function renderTracks(){
    if(!map||trackLine===line.value)return;tracks.clearLayers();trackLine=line.value;
    for(const edge of SUBWAY_LAYOUT.edges){
      if(line.value&&edge.line!==line.value)continue;
      const points=edge.points.map(([x,y])=>[y,x]);
      L.polyline(points,{color:'#000000',weight:9,opacity:.4,interactive:false,className:'subway-track-shadow'}).addTo(tracks);
      L.polyline(points,{color:DISPLAY_COLORS[edge.line],weight:4.5,opacity:.95,interactive:false,className:'subway-track'}).addTo(tracks);
    }
    depth?.update(line.value);
  }
  function renderMarkers() {
    if(!map)return;
    layer.clearLayers();markers.clear();
    for(const station of filtered){
      const wrapper=doc.createElement('span'),dot=doc.createElement('span'),name=doc.createElement('span');dot.className='station-dot';
      dot.style.setProperty('--station-color',DISPLAY_COLORS[station.lines[0]]);
      if(station.lines.length>1)dot.classList.add('is-transfer');
      name.className='station-name';name.textContent=station.name;name.hidden=true;wrapper.append(dot,name);
      const marker=L.marker(schematicPoint(station),{
        icon:L.divIcon({html:wrapper,className:'food-station-marker',iconSize:[24,24],iconAnchor:[12,12]}),
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
    highlight();queueLabels();root.dataset.markerCount=String(markers.size);
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
    list.replaceChildren(fragment);list.scrollTop=0;renderMarkers();renderTracks();
  }
  function setScope(value){
    scope=value;
    for(const button of root.querySelectorAll('[data-map-scope]'))button.setAttribute('aria-pressed',String(button.dataset.mapScope===value));
  }
  function fit(scope) {
    if(!map)return;
    const bounds=(scope==='seoul'?stations.filter(station=>{
      const [lng,lat]=station.coordinates;return lat>=SEOUL_BOUNDS[0][0]&&lat<=SEOUL_BOUNDS[1][0]&&lng>=SEOUL_BOUNDS[0][1]&&lng<=SEOUL_BOUNDS[1][1];
    }):filtered).map(schematicPoint);
    if(!bounds.length)return;
    map.fitBounds(bounds,{padding:[38,38],maxZoom:1,animate:false});setScope(scope);queueLabels();
  }
  async function ensureMap() {
    if(map){map.invalidateSize({pan:false});if(scope)fit(scope);return;}
    if(pending)return pending;
    status.textContent='지도 불러오는 중…';retry.hidden=true;
    pending=(async()=>{
      try {
        L=await loadLibrary();
        // A tab may have been closed while the library was loading. Do not load hidden tiles.
        if(!visible||destroyed)return;
        map=L.map(canvas,{crs:L.CRS.Simple,zoomControl:false,minZoom:-5,maxZoom:2.5,zoomSnap:.25,zoomDelta:.5,wheelPxPerZoomLevel:160,scrollWheelZoom:true,attributionControl:false,zoomAnimation:!reducedMotion});
        layer=L.layerGroup().addTo(map);
        tracks=L.layerGroup().addTo(map);trackLine=null;
        map.setMaxBounds(L.latLngBounds(stations.map(schematicPoint)).pad(.4));
        map.on('dragstart zoomstart',()=>setScope(null));
        map.on('move zoomend resize',queueLabels);
        L.DomEvent.disableScrollPropagation(root);L.DomEvent.disableClickPropagation($('food-map-tools'));
        fit('seoul');renderTracks();renderMarkers();
        if(selected){map.setView(schematicPoint(selected),1,{animate:false});setScope(null);}
        status.textContent='';
        resizeObserver=new view.ResizeObserver(()=>{if(visible){map.invalidateSize({pan:false});if(scope)fit(scope);}});resizeObserver.observe(canvas);
        // Failure or a disabled GPU only removes depth, never the usable route map.
        void loadDepth().then(module=>{
          if(destroyed||!map)return;
          depth=module.createSubwayDepth({map,container:canvas,edges:SUBWAY_LAYOUT.edges,colors:DISPLAY_COLORS});depth.update(line.value);if(!visible)depth.hide();
        }).catch(()=>{});
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
  retry.addEventListener('click',()=>void ensureMap());
  // Contain the list and map's scroll gestures within this tab, not the entrance runway.
  root.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  applyFilters();
  return {
    async show(){visible=true;await ensureMap();if(visible){depth?.show();queueLabels();}},
    hide(){visible=false;depth?.hide();view.cancelAnimationFrame(labelFrame);labelFrame=0;},
    destroy(){destroyed=true;visible=false;view.cancelAnimationFrame(labelFrame);resizeObserver?.disconnect();depth?.destroy();map?.remove();}
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

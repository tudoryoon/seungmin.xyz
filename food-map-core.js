import {STATIONS} from './stations.js?v=20260913';

export const LINES = Object.freeze({
  '1호선':'#0052a4','2호선':'#00a84d','3호선':'#ef7c1c','4호선':'#00a5de',
  '5호선':'#996cac','6호선':'#cd7c2f','7호선':'#747f00','8호선':'#e6186c',
  '9호선':'#a49e69','경의중앙선':'#77b6a5'
});
// Building centre from OSM way 181444733; the fare-master omits Dorasan.
const locations = {'station-korail-dorasan':[126.7098703,37.8986390]};
export const MAP_STATIONS = Object.freeze(STATIONS.map(station => Object.freeze({
  ...station,coordinates:Object.freeze([...(station.coordinates || locations[station.id])])
})));
export const SEOUL_BOUNDS = [[37.43,126.76],[37.71,127.19]];
export const stationTitle = station => station.name.endsWith('역') ? station.name : station.name+'역';
const normalize = value => value.normalize('NFKC').replace(/\s/g,'').toLowerCase();
export function filterStations(stations,query='',line='') {
  const text=normalize(query),exact=text.length>1&&text.endsWith('역'),needle=text.replace(/역$/,'');
  return stations.filter(station=>(!line||station.lines.includes(line))&&(exact?normalize(station.name).replace(/역$/,'')===needle:normalize(station.name).includes(needle)))
    .sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.id.localeCompare(b.id));
}
export const latLng = station => [station.coordinates[1],station.coordinates[0]];
export function externalStationURL(station) {
  return 'https://map.naver.com/p/search/'+encodeURIComponent(stationTitle(station)+' '+station.lines.join(' '));
}

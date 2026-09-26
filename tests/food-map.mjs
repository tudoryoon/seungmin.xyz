import assert from 'node:assert/strict';
import {STATIONS} from '../stations.js';
import {MAP_STATIONS,LINES,filterStations,latLng,stationTitle,externalStationURL} from '../food-map-core.js';
assert.equal(MAP_STATIONS.length,448);
assert.deepEqual(MAP_STATIONS.map(s=>s.id),STATIONS.map(s=>s.id),'all roulette IDs retained in the same order');
assert.equal(new Set(MAP_STATIONS.map(s=>s.id)).size,448);
for(const station of MAP_STATIONS){
  assert.equal(station.coordinates.length,2);
  const [lng,lat]=station.coordinates;
  assert.ok(Number.isFinite(lng)&&lng>126&&lng<128);
  assert.ok(Number.isFinite(lat)&&lat>36.7&&lat<38.2);
  assert.deepEqual(latLng(station),[lat,lng]);
  assert.ok(station.lines.every(line=>line in LINES));
  assert.ok(Object.isFrozen(station.coordinates));
  assert.equal(new URL(externalStationURL(station)).origin,'https://map.naver.com');
}
assert.equal(STATIONS.find(s=>s.name==='도라산').coordinates,undefined,'map override does not mutate roulette data');
assert.match(MAP_STATIONS.find(s=>s.name==='도라산').note,/예약/);
for(const name of ['신촌','양평']){
  const matches=filterStations(MAP_STATIONS,name+'역');assert.equal(matches.length,2);
  assert.notDeepEqual(matches[0].coordinates,matches[1].coordinates);
}
assert.deepEqual(filterStations(MAP_STATIONS,'서 울 역').map(s=>s.name),['서울역']);
assert.equal(stationTitle(filterStations(MAP_STATIONS,'서울역')[0]),'서울역');
assert.equal(filterStations(MAP_STATIONS,'존재하지않는역').length,0);
assert.equal(filterStations(MAP_STATIONS,'<script>').length,0);
assert.equal(filterStations(MAP_STATIONS,'강남','1호선').length,0);
for(const [index,count] of [102,51,44,51,56,39,53,24,38,58].entries())assert.equal(filterStations(MAP_STATIONS,'',Object.keys(LINES)[index]).length,count);
console.log('PASS: 448 complete coordinates, original IDs, 10 line counts, homonym separation, search, bounds, external links and no roulette mutation.');

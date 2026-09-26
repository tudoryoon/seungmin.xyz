import assert from 'node:assert/strict';
import {MAP_STATIONS,LINES} from '../food-map-core.js';
import {EDGES,ROUTES} from '../subway-topology.js';
import {SUBWAY_LAYOUT} from '../data/subway-layout.js';
const stations=new Map(MAP_STATIONS.map(station=>[station.id,station]));
assert.equal(Object.keys(SUBWAY_LAYOUT.positions).length,448);
assert.equal(new Set(Object.values(SUBWAY_LAYOUT.positions).map(p=>p.join(','))).size,448,'all markers have distinct positions');
assert.equal(EDGES.length,508);assert.equal(SUBWAY_LAYOUT.edges.length,508);
for(const line of Object.keys(LINES)){
  const members=[...new Set(ROUTES.filter(route=>route.line===line).flatMap(route=>route.ids))].sort();
  assert.deepEqual(members,MAP_STATIONS.filter(station=>station.lines.includes(line)).map(station=>station.id).sort());
}
const close=(a,b)=>assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7);
for(const edge of SUBWAY_LAYOUT.edges){
  assert.notEqual(edge.source,edge.target);
  for(const id of [edge.source,edge.target])assert.ok(stations.get(id).lines.includes(edge.line));
  close(edge.points[0],SUBWAY_LAYOUT.positions[edge.source]);close(edge.points.at(-1),SUBWAY_LAYOUT.positions[edge.target]);
  for(let i=1;i<edge.points.length;i++){
    const dx=Math.abs(edge.points[i][0]-edge.points[i-1][0]),dy=Math.abs(edge.points[i][1]-edge.points[i-1][1]);
    assert.ok(dx<1e-7||dy<1e-7||Math.abs(dx-dy)<1e-7,'only horizontal, vertical and 45-degree tracks');
  }
}
const adjacent=(line,a,b)=>EDGES.some(edge=>edge.line===line&&[stations.get(edge.source).name,stations.get(edge.target).name].sort().join('|')===[a,b].sort().join('|'));
for(const [line,a,b] of [['1호선','동묘앞','신설동'],['1호선','금천구청','광명'],['1호선','병점','서동탄'],['1호선','구로','구일'],['2호선','성수','용답'],['2호선','신답','용두'],['2호선','신정네거리','까치산'],['3호선','삼송','원흥'],['4호선','산본','수리산'],['5호선','강동','둔촌동'],['5호선','상일동','강일'],['6호선','구산','응암'],['8호선','복정','남위례'],['경의중앙선','문산','운천'],['경의중앙선','운천','임진강'],['경의중앙선','가좌','신촌']])assert.ok(adjacent(line,a,b),`${line} ${a} - ${b}`);
assert.equal(adjacent('1호선','청량리','동묘앞'),false);assert.equal(adjacent('5호선','상일동','둔촌동'),false);
const visited=new Set([MAP_STATIONS[0].id]);let changed=true;
while(changed){changed=false;for(const edge of EDGES)if(visited.has(edge.source)!==visited.has(edge.target)){visited.add(edge.source);visited.add(edge.target);changed=true;}}
assert.equal(visited.size,448,'the entire station network is connected');
console.log('PASS: 448 unique station positions; complete, connected 10-line topology; 508 octilinear edges; branches, infills and loop regressions.');

import {writeFile} from 'node:fs/promises';
import {MAP_STATIONS} from '../food-map-core.js';
import {EDGES,ROUTES} from '../subway-topology.js';
const {forceSimulation,forceLink,forceCollide,forceX,forceY}=await import(process.env.D3_FORCE_MODULE||'d3-force');

// Expand the dense centre and compress long suburban tails before relaxing the graph.
const warp=(delta,scale)=>Math.sign(delta)*Math.log1p(Math.abs(delta)*scale)*1000;
const nodes=MAP_STATIONS.map(station=>({id:station.id,
  x:warp(station.coordinates[0]-126.99,5),y:warp(station.coordinates[1]-37.55,6.3)}));
for(const node of nodes){node.homeX=node.x;node.homeY=node.y;}
const links=EDGES.map(edge=>({...edge}));
const simulation=forceSimulation(nodes).stop()
  .force('link',forceLink(links).id(node=>node.id).distance(78).strength(.7))
  .force('collide',forceCollide(36).strength(.9).iterations(3))
  .force('x',forceX(node=>node.homeX).strength(.1))
  .force('y',forceY(node=>node.homeY).strength(.1));
simulation.tick(700);
// Snap to a coarse drawing grid; every edge below uses only horizontal, vertical or 45-degree segments.
const positions=Object.fromEntries(nodes.map(node=>[node.id,[Math.round(node.x/8)*8,Math.round(node.y/8)*8]]));
const occupied=new Set();
for(const [id,position] of Object.entries(positions)){
  while(occupied.has(position.join(',')))position[0]+=8;
  occupied.add(position.join(','));
}
function pointsBetween(a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],x=Math.abs(dx),y=Math.abs(dy);
  if(!x||!y||x===y)return [a,b];
  const d=Math.min(x,y),sx=Math.sign(dx),sy=Math.sign(dy);
  // Centre the diagonal between two parallel straight segments.
  return x>y?[a,[a[0]+sx*(x-d)/2,a[1]],[b[0]-sx*(x-d)/2,b[1]],b]
    :[a,[a[0],a[1]+sy*(y-d)/2],[b[0],b[1]-sy*(y-d)/2],b];
}
const corners=new Set(['수원','천안','평택','동두천','문산','덕소','양평','사당','성수','응암','대화','장암','강동','김포공항','중앙보훈병원','마천','오이도']);
const anchors=new Set(MAP_STATIONS.filter(station=>station.lines.length>1||corners.has(station.name)).map(station=>station.id));
for(const route of ROUTES){anchors.add(route.ids[0]);anchors.add(route.ids.at(-1));}
const runs=[];
for(const route of ROUTES){
  let start=0;
  for(let end=1;end<route.ids.length;end++)if(anchors.has(route.ids[end])){
    runs.push({source:route.ids[start],target:route.ids[end],count:end-start});start=end;
  }
}
const anchorNodes=[...anchors].map(id=>({id,x:positions[id][0],y:positions[id][1],homeX:positions[id][0],homeY:positions[id][1]}));
forceSimulation(anchorNodes).stop()
  .force('link',forceLink(runs).id(node=>node.id).distance(run=>Math.max(95,run.count*65)).strength(.75))
  .force('collide',forceCollide(65).iterations(3))
  .force('x',forceX(node=>node.homeX).strength(.045))
  .force('y',forceY(node=>node.homeY).strength(.045)).tick(850);
for(const node of anchorNodes)positions[node.id]=[Math.round(node.x/8)*8,Math.round(node.y/8)*8];
const shapes=new Map();
const key=(line,a,b)=>`${line}:${a}:${b}`;
function distance(a,b){return Math.hypot(b[0]-a[0],b[1]-a[1]);}
function cutPath(path,from,to){
  const result=[];let travelled=0;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],length=distance(a,b);if(!length)continue;
    const start=Math.max(0,(from-travelled)/length),end=Math.min(1,(to-travelled)/length);
    if(start<=1&&end>=0&&start<=end){
      if(!result.length)result.push([a[0]+(b[0]-a[0])*start,a[1]+(b[1]-a[1])*start]);
      result.push([a[0]+(b[0]-a[0])*end,a[1]+(b[1]-a[1])*end]);
    }
    travelled+=length;
  }
  return result;
}
// Keep each run between interchanges straight and evenly spaced, rather than giving
// every station its own bend. Suburban corners retain the network's orientation.
const placed=[...anchors].map(id=>positions[id]);
for(const route of ROUTES){
  let start=0;
  for(let end=1;end<route.ids.length;end++){
    if(!anchors.has(route.ids[end]))continue;
    const a=positions[route.ids[start]],b=positions[route.ids[end]],path=pointsBetween(a,b);
    const length=path.slice(1).reduce((sum,point,i)=>sum+distance(path[i],point),0),count=end-start;
    const cuts=[0];
    for(let i=1;i<count;i++){
      let best,clearance=-1;
      for(const shift of [0,.12,-.12,.24,-.24,.36,-.36]){
        const t=length*(i+shift)/count,point=cutPath(path,t,t)[0];
        const gap=Math.min(...placed.map(other=>distance(point,other)));
        if(gap>clearance){best={t,point};clearance=gap;}
        if(gap>=32)break;
      }
      cuts.push(best.t);positions[route.ids[start+i]]=best.point;placed.push(best.point);
    }
    cuts.push(length);
    for(let i=0;i<count;i++){
      const points=cutPath(path,cuts[i],cuts[i+1]);
      shapes.set(key(route.line,route.ids[start+i],route.ids[start+i+1]),points);
    }
    start=end;
  }
}
const edges=EDGES.map(edge=>({...edge,points:shapes.get(key(edge.line,edge.source,edge.target))}));
const data={positions,edges};
await writeFile(new URL('../data/subway-layout.js',import.meta.url),`// Generated schematic geometry, not geographic coordinates. See data/food-map.md.\nexport const SUBWAY_LAYOUT=${JSON.stringify(data)};\n`);
console.log(`${nodes.length} stations, ${edges.length} connections, ${ROUTES.length} routes`);

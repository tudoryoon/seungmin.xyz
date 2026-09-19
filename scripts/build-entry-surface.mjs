import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';

const path=process.argv[2];
if(!path)throw new Error('Usage: node scripts/build-entry-surface.mjs countries.geojson');
const countries=JSON.parse(await readFile(path,'utf8'));
const polygons=countries.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates);
let seed=7241;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const rounded=p=>p.map(v=>Math.round(v*1e5)/1e5);
function sampleRegion(bounds,count){
  const [west,south,east,north]=bounds,triangles=[];let area=0;
  for(const polygon of polygons){
    const ring=polygon[0];
    if(Math.max(...ring.map(p=>p[0]))<west||Math.min(...ring.map(p=>p[0]))>east||Math.max(...ring.map(p=>p[1]))<south||Math.min(...ring.map(p=>p[1]))>north)continue;
    const rings=polygon.map(r=>r.slice(0,-1).map(p=>new THREE.Vector2(...p))),vertices=rings.flat();
    for(const indices of THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1))){
      const [a,b,c]=indices.map(i=>vertices[i]);
      if(Math.max(a.x,b.x,c.x)<west||Math.min(a.x,b.x,c.x)>east||Math.max(a.y,b.y,c.y)<south||Math.min(a.y,b.y,c.y)>north)continue;
      area+=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2;
      triangles.push({a,b,c,end:area});
    }
  }
  const points=[];
  for(let attempts=0;points.length<count&&attempts<count*200;attempts++){
    const target=random()*area;let lo=0,hi=triangles.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(triangles[mid].end<target)lo=mid+1;else hi=mid;}
    const {a,b,c}=triangles[lo],u=Math.sqrt(random()),v=random();
    const p=[a.x*(1-u)+b.x*u*(1-v)+c.x*u*v,a.y*(1-u)+b.y*u*(1-v)+c.y*u*v];
    if(p[0]>=west&&p[0]<=east&&p[1]>=south&&p[1]<=north)points.push(rounded(p));
  }
  if(points.length!==count)throw new Error('Insufficient geographic samples');
  return points;
}
const edges=new Map();
for(const polygon of polygons)for(const ring of polygon)for(let i=1;i<ring.length;i++){
  const a=ring[i-1],b=ring[i],key=[a.join(','),b.join(',')].sort().join('|');
  if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);
}
const segments=[...edges.values()];let total=0;
const ends=segments.map(([a,b])=>total+=Math.hypot((b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360),b[1]-a[1]));
let cursor=0;
const coast=Array.from({length:10000},(_,i)=>{
  const distance=(i+.5)/10000*total;
  while(cursor<segments.length-1&&ends[cursor]<distance)cursor++;
  const [a,b]=segments[cursor],start=cursor?ends[cursor-1]:0,t=(distance-start)/(ends[cursor]-start);
  return rounded([THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t)]);
});
const data={coast,regional:sampleRegion([110,27,142,47],14000),metro:sampleRegion([125.5,36.4,128.5,38.8],18000),local:sampleRegion([126.5,37.2,127.45,37.93],14000)};
const body='// Generated from Natural Earth; see assets/entry-particles.md.\nexport default '+JSON.stringify(data)+';\n';
await writeFile(new URL('../data/entry-surface-20260919.js',import.meta.url),body);
console.log('Generated continuous globe surface:',Buffer.byteLength(body),'bytes');

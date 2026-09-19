import * as THREE from './vendor/three.module.js';
import geography from './data/entry-geography-20260919.js';

export const SEOUL=[126.978,37.5665];
const rad=Math.PI/180,latitude=SEOUL[1]*rad,longitude=SEOUL[0]*rad;
const normal=new THREE.Vector3(Math.cos(latitude)*Math.cos(longitude),Math.sin(latitude),-Math.cos(latitude)*Math.sin(longitude));
const east=new THREE.Vector3(-Math.sin(longitude),0,-Math.cos(longitude)),north=normal.clone().cross(east);
export const project=([lon,lat],scale=1.5)=>[(lon-SEOUL[0])*Math.cos(latitude)*scale,(lat-SEOUL[1])*scale,0];
function extents(polygons,scale){
  const points=polygons.flat(2).map(p=>project(p,scale));
  return {x:Math.max(...points.map(p=>Math.abs(p[0]))),y:Math.max(...points.map(p=>Math.abs(p[1])))};
}
export const KOREA_EXTENTS=extents(geography.korea,1.5),CITY_EXTENTS=extents(geography.seoul,56);
export function globePoint([lon,lat]){
  const p=new THREE.Vector3(Math.cos(lat*rad)*Math.cos(lon*rad),Math.sin(lat*rad),-Math.cos(lat*rad)*Math.sin(lon*rad)).multiplyScalar(4);
  return [p.dot(east),p.dot(north),p.dot(normal)];
}
const ease=(p,a,b)=>{const t=THREE.MathUtils.clamp((p-a)/(b-a),0,1);return t*t*(3-2*t);};
export function geographicJourney(progress,aspect=1,motion=true){
  const p=THREE.MathUtils.clamp(Number.isFinite(progress)?progress:0,0,1);
  const zoom=1+20.5*ease(p,.025,.4),halfY=(aspect<.8?32:24)*Math.tan(24*rad);
  const fit=Math.min(1,halfY*aspect*.88/KOREA_EXTENTS.x,halfY*.8/KOREA_EXTENTS.y);
  const cityFit=Math.min(1,halfY*aspect*.88/CITY_EXTENTS.x,halfY*.8/CITY_EXTENTS.y);
  return {
    globeScale:motion?zoom:1,
    flatten:motion?ease(p,.2,.42):1,
    mapScale:motion?(zoom/21.5)*(1+15*ease(p,.5,.76))*fit:fit,
    earthOpacity:1-ease(p,.25,.4),
    koreaOpacity:ease(p,.06,.29)*(1-ease(p,.64,.77)),
    cityOpacity:ease(p,.65,.77)*(1-ease(p,.85,.97)),
    cityScale:(motion?.52+.48*ease(p,.65,.81):1)*cityFit,
    markerOpacity:ease(p,.29,.4)*(1-ease(p,.82,.9)),
    burst:motion?ease(p,.84,.975):0,
    burstOpacity:motion?ease(p,.82,.87)*(1-ease(p,.92,1)):0,
    spiralOpacity:1-.78*ease(p,.27,.44)+.45*ease(p,.8,.9)-.48*ease(p,.9,1)
  };
}

function polygonSampler(polygons){
  const triangles=[];let area=0;
  for(const polygon of polygons){
    const rings=polygon.map(ring=>ring.slice(0,-1).map(p=>new THREE.Vector2(...p)));
    const vertices=rings.flat();
    for(const indices of THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1))){
      const [a,b,c]=indices.map(i=>vertices[i]);
      const size=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2;
      if(size>0){area+=size;triangles.push({a,b,c,end:area});}
    }
  }
  return random=>{
    const target=random()*area;let lo=0,hi=triangles.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(triangles[mid].end<target)lo=mid+1;else hi=mid;}
    const {a,b,c}=triangles[lo],u=Math.sqrt(random()),v=random();
    return [a.x*(1-u)+b.x*u*(1-v)+c.x*u*v,a.y*(1-u)+b.y*u*(1-v)+c.y*u*v];
  };
}
function boundarySegments(polygons){
  const edges=new Map();
  for(const polygon of polygons)for(const ring of polygon)for(let i=1;i<ring.length;i++){
    const a=ring[i-1],b=ring[i],key=[a.join(','),b.join(',')].sort().join('|');
    if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);
  }
  return [...edges.values()];
}
function pathSamples(segments,count){
  let total=0;const lengths=segments.map(([a,b])=>{total+=Math.hypot(b[0]-a[0],b[1]-a[1]);return total;});
  const result=[];let segment=0;
  for(let i=0;i<count;i++){
    const distance=(i+.5)/count*total;
    while(segment<segments.length-1&&lengths[segment]<distance)segment++;
    const start=segment?lengths[segment-1]:0,t=(distance-start)/Math.max(.000001,lengths[segment]-start),[a,b]=segments[segment];
    result.push([THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t)]);
  }
  return result;
}
export function buildGeography(random,mobile){
  const sampleKorea=polygonSampler(geography.korea),sampleSeoul=polygonSampler(geography.seoul);
  const korea=Array.from({length:mobile?5500:9000},()=>sampleKorea(random));
  const coast=pathSamples(boundarySegments(geography.korea),mobile?1400:2400);
  const city=Array.from({length:mobile?4200:7000},()=>sampleSeoul(random));
  const cityCoast=pathSamples(boundarySegments(geography.seoul),mobile?650:1000);
  const river=geography.han.flatMap(line=>new THREE.CatmullRomCurve3(line.map(([lon,lat])=>new THREE.Vector3(lon,lat,0)),false,'centripetal').getSpacedPoints(mobile?500:850).map(p=>[p.x,p.y]));
  return {korea,coast,city,cityCoast,river};
}

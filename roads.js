import {Line3, Vector3} from './vendor/three.module.js';

// Walkable corridors and plazas, measured in each artwork's native pixels.
export const WALK_SPEED = 300;
export const ROAD_MAPS = {
  wide: {
    size:[1586,992],
    radius:42,
    plazas:[[792,483,112,64],[1238,278,176,88],[410,326,91,46],[994,797,140,64]],
    entrances:{calendar:[[399,296,78,56]],workout:[[1238,278,158,84],[1278,356,58,48]],library:[[975,696,67,47],[1020,799,115,56]]},
    paths:[
      [[980,694],[963,720],[932,744],[909,767],[948,791],[993,804],[1032,793]],
      [[991,808],[951,838],[920,863],[884,883],[843,899],[793,910],[748,919],[701,936],[655,951],[614,951],[590,924],[582,892],[580,868],[551,848],[506,831],[452,814],[409,787],[381,758],[378,729],[363,704],[327,679],[283,663],[246,665],[228,687],[216,719]],
      [[327,679],[384,654],[436,641],[481,618]],
      [[1238,278],[1279,326],[1300,365],[1314,398]],
      [[1084,807],[1143,797],[1200,768],[1232,726],[1240,684],[1280,662],[1330,642],[1370,644],[1392,674]]
    ],
    routes:{
      calendar:[[792,483],[725,461],[671,444],[639,418],[630,388],[609,368],[564,356],[514,359],[466,357],[434,338],[415,311],[397,285],[383,273]],
      workout:[[792,483],[865,468],[929,456],[980,445],[1017,423],[1042,390],[1091,366],[1135,337],[1180,310],[1238,278]],
      library:[[792,483],[807,535],[822,581],[844,609],[886,632],[930,655],[961,683],[980,694]]
    }
  },
  tall: {
    size:[941,1672],
    radius:44,
    plazas:[[452,859,100,60],[728,738,157,79],[301,357,102,50],[262,1342,141,59]],
    entrances:{calendar:[[287,333,86,67]],workout:[[728,738,151,78],[761,818,58,62]],library:[[434,1110,65,61],[278,1328,113,65]]},
    paths:[
      [[452,859],[397,883],[342,899],[291,905],[251,891],[222,868],[204,841],[176,815],[139,801],[98,805],[66,829],[39,860],[14,877]],
      [[735,729],[749,788],[767,841],[785,894],[825,922]],
      [[434,1107],[433,1150],[435,1193],[426,1241],[413,1291],[386,1332],[337,1354],[286,1354],[250,1337]],
      [[435,1186],[483,1167],[529,1164],[576,1173],[621,1189],[656,1212],[672,1251]]
    ],
    routes:{
      calendar:[[452,859],[443,819],[415,783],[386,751],[372,708],[373,673],[364,631],[345,598],[347,573],[377,552],[416,534],[445,512],[456,478],[436,445],[410,425],[378,414],[343,397],[319,366],[292,335],[280,317]],
      workout:[[452,859],[514,842],[557,828],[584,803],[606,777],[646,754],[689,735],[735,729]],
      library:[[452,859],[452,906],[467,936],[494,966],[504,1000],[488,1036],[458,1072],[434,1107]]
    }
  }
};

export function roadSpawn(roads) {
  const [x,y]=roads.map.routes.calendar[0];
  return {x:x/roads.map.size[0]*100,y:y/roads.map.size[1]*100};
}

export function createRoads(portrait,width,height) {
  const map=ROAD_MAPS[portrait?'tall':'wide'];
  const corridors=[...Object.values(map.routes),...map.paths].flatMap(points=>points.slice(1).map(([x,y],index)=>
    new Line3(new Vector3(...points[index],0),new Vector3(x,y,0))));
  return {width,height,map,corridors};
}

const nativePoint=(roads,position)=>new Vector3(position.x/100*roads.map.size[0],position.y/100*roads.map.size[1],0);
const inEllipse=(point,[x,y,rx,ry])=>((point.x-x)/rx)**2+((point.y-y)/ry)**2<=1+1e-9;
function allowed(roads,point) {
  if(point.x<0||point.y<0||point.x>roads.map.size[0]||point.y>roads.map.size[1])return false;
  if(roads.map.plazas.some(ellipse=>inEllipse(point,ellipse)))return true;
  const closest=new Vector3();
  return roads.corridors.some(line=>line.closestPointToPoint(point,true,closest).distanceToSquared(point)<=roads.map.radius**2+1e-7);
}
export const isWalkable=(roads,position)=>allowed(roads,nativePoint(roads,position));

export function nearbyRoad(roads,position) {
  const point=nativePoint(roads,position);
  return Object.keys(roads.map.entrances).find(name=>roads.map.entrances[name].some(ellipse=>inEllipse(point,ellipse)))||null;
}

function project(roads,point) {
  let closest=null,distance=Infinity;
  const consider=candidate=>{
    candidate.x=Math.max(0,Math.min(roads.map.size[0],candidate.x));
    candidate.y=Math.max(0,Math.min(roads.map.size[1],candidate.y));
    const d=((candidate.x-point.x)*roads.width/roads.map.size[0])**2+((candidate.y-point.y)*roads.height/roads.map.size[1])**2;
    if(d<distance){distance=d;closest=candidate;}
  };
  for(const line of roads.corridors) {
    const center=line.closestPointToPoint(point,true,new Vector3());
    const delta=point.clone().sub(center).clampLength(0,roads.map.radius);
    consider(center.add(delta));
  }
  for(const [x,y,rx,ry] of roads.map.plazas) {
    const dx=point.x-x,dy=point.y-y,scale=Math.max(1,Math.hypot(dx/rx,dy/ry));
    consider(new Vector3(x+dx/scale,y+dy/scale,0));
  }
  return closest;
}

export function moveOnRoad(roads,position,direction,seconds) {
  const length=Math.hypot(direction.x,direction.y);
  if(!roads.width||!roads.height||!length||!Number.isFinite(seconds)||seconds<=0)return position;
  const distance=WALK_SPEED*Math.min(seconds,.05),steps=Math.ceil(distance/2);
  const delta=new Vector3(direction.x/length*distance/steps/roads.width*roads.map.size[0],direction.y/length*distance/steps/roads.height*roads.map.size[1],0);
  let point=nativePoint(roads,position);
  // Small swept steps prevent jumping narrow walls; projection permits wall sliding.
  for(let step=0;step<steps;step++) {
    const desired=point.clone().add(delta);
    let next=allowed(roads,desired)?desired:project(roads,desired);
    const dx=(next.x-point.x)*roads.width/roads.map.size[0],dy=(next.y-point.y)*roads.height/roads.map.size[1];
    const travel=Math.hypot(dx,dy);
    if(travel>distance/steps)next=point.clone().lerp(next,distance/steps/travel);
    if(allowed(roads,next)&&allowed(roads,point.clone().lerp(next,.5)))point=next;
  }
  return {x:point.x/roads.map.size[0]*100,y:point.y/roads.map.size[1]*100};
}

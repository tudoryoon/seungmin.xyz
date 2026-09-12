import {LineCurve, Vector2} from './vendor/three.module.js';

// Ground-level centerlines traced against each map asset's native pixels.
export const ROAD_MAPS = {
  wide: {
    size:[1586,992],
    routes:{
      calendar:[[792,483],[725,461],[671,444],[639,418],[630,388],[609,368],[564,356],[514,359],[466,357],[434,338],[415,311],[397,285],[383,273]],
      workout:[[792,483],[865,468],[929,456],[980,445],[1017,423],[1042,390],[1091,366],[1135,337],[1180,310],[1238,278]],
      library:[[792,483],[807,535],[822,581],[844,609],[886,632],[930,655],[961,683],[980,694]]
    }
  },
  tall: {
    size:[941,1672],
    routes:{
      calendar:[[452,859],[443,819],[415,783],[386,751],[372,708],[373,673],[364,631],[345,598],[347,573],[377,552],[416,534],[445,512],[456,478],[436,445],[410,425],[378,414],[343,397],[319,366],[292,335],[280,317]],
      workout:[[452,859],[514,842],[557,828],[584,803],[606,777],[646,754],[689,735],[735,729]],
      library:[[452,859],[452,906],[467,936],[494,966],[504,1000],[488,1036],[458,1072],[434,1107]]
    }
  }
};

export const roadSpawn = () => ({route:null,segment:0,t:0});

export function createRoads(portrait,width,height) {
  const map=ROAD_MAPS[portrait?'tall':'wide'];
  const routes=Object.fromEntries(Object.entries(map.routes).map(([name,points])=>{
    const vertices=points.map(([x,y])=>new Vector2(x/map.size[0]*width,y/map.size[1]*height));
    return [name,vertices.slice(1).map((end,index)=>new LineCurve(vertices[index],end))];
  }));
  return {width,height,routes};
}

export function roadPosition(roads,state) {
  const edge=roads.routes[state.route||'calendar'][state.route?state.segment:0];
  const point=edge.getPoint(state.route?state.t:0);
  return {x:point.x/roads.width*100,y:point.y/roads.height*100};
}

export function nearbyRoad(roads,state) {
  if(!state.route)return null;
  const edges=roads.routes[state.route];
  const remaining=edges[state.segment].getLength()*(1-state.t)+edges.slice(state.segment+1).reduce((sum,edge)=>sum+edge.getLength(),0);
  return remaining<=Math.min(40,edges.reduce((sum,edge)=>sum+edge.getLength(),0)*.15)?state.route:null;
}

export function moveOnRoad(roads,state,direction,seconds) {
  if(!roads.width||!roads.height||!Number.isFinite(seconds)||seconds<=0)return state;
  const input=new Vector2(direction.x,direction.y);
  if(!input.lengthSq())return state;
  input.normalize();
  let next={...state}, distance=200*Math.min(seconds,.05);
  // Traverse connected segments only, preserving unused distance at bends.
  for(let step=0;step<64&&distance>1e-7;step++) {
    const candidates=[];
    const add=(route,segment,t,sign)=>{
      const edge=roads.routes[route][segment];
      const score=edge.getTangent().multiplyScalar(sign).dot(input);
      if(score>.12)candidates.push({route,segment,t,sign,edge,score});
    };
    if(!next.route||(next.segment===0&&next.t===0)) {
      for(const route of Object.keys(roads.routes))add(route,0,0,1);
    } else {
      const edges=roads.routes[next.route];
      if(next.t<1)add(next.route,next.segment,next.t,1);
      else if(next.segment+1<edges.length)add(next.route,next.segment+1,0,1);
      if(next.t>0)add(next.route,next.segment,next.t,-1);
      else if(next.segment>0)add(next.route,next.segment-1,1,-1);
    }
    const chosen=candidates.sort((a,b)=>b.score-a.score)[0];
    if(!chosen)break;
    const length=chosen.edge.getLength();
    const available=length*(chosen.sign>0?1-chosen.t:chosen.t);
    const travel=Math.min(distance,available);
    const t=travel===available?(chosen.sign>0?1:0):chosen.t+chosen.sign*travel/length;
    next={route:chosen.route,segment:chosen.segment,t};
    distance-=travel;
    if(next.segment===0&&next.t===0){next=roadSpawn();break;}
  }
  return next;
}

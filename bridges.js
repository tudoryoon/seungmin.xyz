const NS = 'http://www.w3.org/2000/svg';
function element(name, attributes) {
  const node = document.createElementNS(NS, name);
  for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,String(value));
  return node;
}

// Draw in the same native map coordinates used by the walking corridors.
export function renderBridges(layer, map) {
  if (!layer) return;
  layer.setAttribute('viewBox', `0 0 ${map.size.join(' ')}`);
  layer.replaceChildren();
  const defs=element('defs',{}), texture=element('filter',{id:'bridge-stone',x:'-10%',y:'-10%',width:'120%',height:'120%'});
  texture.append(element('feTurbulence',{type:'fractalNoise',baseFrequency:'.28',numOctaves:3,seed:7,result:'grain'}));
  const tones=element('feComponentTransfer',{in:'grain',result:'stone'});
  for(const channel of ['R','G','B']) tones.append(element('feFunc'+channel,{type:'linear',slope:'.55',intercept:'.3'}));
  texture.append(tones,element('feBlend',{in:'SourceGraphic',in2:'stone',mode:'multiply',result:'textured'}),element('feComposite',{in:'textured',in2:'SourceGraphic',operator:'in'}));
  defs.append(texture); layer.append(defs);
  const art=element('g',{filter:'url(#bridge-stone)'});layer.append(art);
  for (const bridge of map.bridges) {
    const [ax,ay]=bridge.from, [bx,by]=bridge.to;
    const length=Math.hypot(bx-ax,by-ay), ux=(bx-ax)/length, uy=(by-ay)/length;
    const point=(along,across,drop=0)=>[ax+ux*along-uy*across,ay+uy*along+ux*across+drop];
    const polygon=(points,fill,stroke='#293733',width=1)=>art.append(element('polygon',{points:points.map(p=>p.join(',')).join(' '),fill,stroke,'stroke-width':width,'stroke-linejoin':'round'}));
    const half=bridge.width/2;
    const corners=[point(0,half),point(length,half),point(length,-half),point(0,-half)];
    polygon(corners.map(([x,y])=>[x+7,y+34]),'#030d1099','none');
    polygon([point(0,-half),point(length,-half),point(length,-half,32),point(0,-half,32)],'#303d38');
    const bays=Math.max(2,Math.floor(length/68));
    for(let i=0;i<bays;i++) {
      const center=(i+.5)*length/bays, span=length/bays*.3;
      const left=point(center-span,-half,32),right=point(center+span,-half,32),top=point(center,-half,-8);
      art.append(element('path',{d:`M ${left} Q ${top} ${right} Z`,fill:'#13272b',stroke:'#59625a','stroke-width':2}));
    }
    polygon(corners,'#535c50','#71806b',2);
    const tiles=Math.ceil(length/23), rows=4, tile=length/tiles, row=(bridge.width-16)/rows;
    const shades=['#68736c','#576561','#718178','#596a64','#61706a'];
    for(let i=0;i<tiles;i++) for(let j=0;j<rows;j++) {
      const start=i*tile+1,end=(i+1)*tile-1,side=-half+8+j*row;
      polygon([point(start,side+1),point(end,side+1),point(end,side+row-1),point(start,side+row-1)],shades[(i*7+j*3)%shades.length],'#35463a',1);
      if((i+j)%3===0) polygon([point(start,side+2),point(start+8,side+3),point(start+4,side+7)],'#334e3b','none');
    }
    for(const side of [-1,1]) {
      const outer=side*half,inner=side*(half-8);
      polygon([point(0,outer,-12),point(length,outer,-12),point(length,outer),point(0,outer)],'#384940');
      polygon([point(0,outer,-12),point(length,outer,-12),point(length,inner,-12),point(0,inner,-12)],'#71806a','#425442');
      for(let i=0;i<=bays+1;i++) {
        const at=i*length/(bays+1), p=point(at,side*(half-4),-12);
        polygon([[p[0]-6,p[1]-13],[p[0]+6,p[1]-13],[p[0]+6,p[1]+2],[p[0]-6,p[1]+2]],'#435643');
        polygon([[p[0]-8,p[1]-16],[p[0]+5,p[1]-18],[p[0]+9,p[1]-13],[p[0]-5,p[1]-11]],'#829077','#394d3c');
      }
    }
  }
}

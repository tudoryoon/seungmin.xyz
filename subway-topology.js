import {MAP_STATIONS} from './food-map-core.js?v=20260926-2';

const range=(a,b)=>Array.from({length:Math.abs(b-a)+1},(_,i)=>a+i*Math.sign(b-a));
const byCode=new Map(MAP_STATIONS.flatMap(station=>station.sourceIds.map(code=>[code,station.id])));
function route(line,codes,loop=false) {
  const ids=codes.map(code=>{
    const id=byCode.get(String(code).padStart(4,'0'));
    if(!id)throw new Error(`Unknown station code: ${code}`);
    return id;
  });
  return {line,ids,loop};
}
// Source IDs are not travel order. Infill stations and branches are placed explicitly.
export const ROUTES=Object.freeze([
  route('1호선',[...range(1919,1901),412,1021,1020,1019,1018,1017,1016,1015,158,157,156,159,155,154,153,152,151,150,1002,1003,1004,1005,1032,1006,1007,1701,1702,1714,1703,...range(1704,1709),1729,...range(1710,1713),...range(1715,1728),1401,1402,1403,1404,1405,1407,1408]),
  route('1호선',[1701,1813,1801,1802,1821,1803,1814,1804,1822,1805,1815,1806,1807,1808,1816,1809,1823,1810,1817,1811,1812]),
  route('1호선',[1703,1750]),route('1호선',[1716,1749]),
  route('2호선',[...range(201,243),201],true),
  route('2호선',[211,244,245,250,246]),route('2호선',[234,247,248,249,2519]),
  route('3호선',[...range(1958,1951),1948,1950,309,...range(310,342)]),
  route('4호선',[405,406,408,...range(409,434),...range(1450,1458),1751,1763,...range(1752,1762)]),
  route('5호선',[...range(2511,2554),...range(2562,2566)]),
  route('5호선',[2549,...range(2555,2561)]),
  route('6호선',[2611,...range(2612,2616),2611],true),route('6호선',[2611,...range(2617,2649)]),
  route('7호선',[...range(2711,2761),3762,3763]),
  route('8호선',[...range(2805,2821),2828,...range(2822,2827)]),
  route('9호선',range(4101,4138)),
  route('경의중앙선',['korail-dorasan',1285,1286,1284,1283,1282,...range(1280,1272),1953,...range(1271,1261),1003,...range(1008,1014),1015,...range(1201,1220)]),
  route('경의중앙선',[1265,1252,1251])
]);
export const EDGES=Object.freeze(ROUTES.flatMap(route=>route.ids.slice(1).map((id,i)=>({line:route.line,source:route.ids[i],target:id}))));
export const TERMINALS=new Set(ROUTES.filter(route=>!route.loop).flatMap(route=>[route.ids[0],route.ids.at(-1)]));

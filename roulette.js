import {STATIONS} from './stations.js?v=20260913-5';
import {TAU, createSpin} from './roulette-core.js?v=20260913-5';
import {validProfile} from './profile.js?v=20260913-5';
import {validAvatar} from './avatar.js?v=20260913-5';

const $ = id => document.getElementById(id);
const colors = {'1호선':'#688cd9','2호선':'#67c990','3호선':'#f7b36c','4호선':'#79c4ec','5호선':'#b1a0dd','6호선':'#d9a17c','7호선':'#c2c575','8호선':'#df8cac','9호선':'#c8b982','경의중앙선':'#91cbbb'};
const stations = [...STATIONS].sort((a,b) => a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id));
let authorized = false, spinning = false, selected = null, lastLabel = 0;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function motion() {
  try {
    const saved = localStorage.getItem('seungmin-realm-motion');
    return saved === null ? !reduced.matches : saved === 'on';
  } catch { return !reduced.matches; }
}
function badges(station) {
  return station.lines.map(line => {
    const item = document.createElement('span');
    item.className = 'line-badge'; item.style.setProperty('--line-color', colors[line]); item.textContent = line;
    return item;
  });
}
function paintWheel() {
  const canvas = $('wheel-art'), ctx = canvas.getContext('2d');
  if (!ctx) return;
  const center = canvas.width / 2;
  ctx.translate(center, center);
  const ring = (radius, color, width) => {
    ctx.beginPath(); ctx.arc(0,0,radius,0,TAU); ctx.strokeStyle=color; ctx.lineWidth=width; ctx.stroke();
  };
  ring(550, '#405953', 1); ring(570, '#ccb991', 2); ring(516, '#7b8d75', 2); ring(340, '#a8baa0', 2);
  for (let i=0; i<stations.length; i++) {
    const start = i / stations.length * TAU - Math.PI / 2, end = (i+1) / stations.length * TAU - Math.PI / 2;
    ctx.beginPath(); ctx.arc(0,0,500,start,end); ctx.arc(0,0,362,end,start,true); ctx.closePath();
    ctx.fillStyle = colors[stations[i].lines[0]]; ctx.globalAlpha = i % 2 ? .68 : .92; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(Math.cos(start)*515,Math.sin(start)*515);
    ctx.lineTo(Math.cos(start)*(i%8===0?546:530),Math.sin(start)*(i%8===0?546:530));
    ctx.strokeStyle = i%8===0?'#e7d1a0':'#769189'; ctx.lineWidth=i%8===0?3:1; ctx.stroke();
  }
  for(let i=0;i<16;i++) {
    const angle=i/16*TAU; ctx.save(); ctx.rotate(angle); ctx.fillStyle='#e6c998'; ctx.fillRect(-3,-574,6,8); ctx.restore();
  }
}
function showResult(index) {
  selected = stations[index];
  $('rolling-name').textContent = selected.name;
  $('rolling-lines').replaceChildren(...badges(selected));
  $('station-note').textContent = selected.note || '';
  const query = `${selected.name}${selected.name.endsWith('역') ? '' : '역'} ${selected.lines.join(' ')}`;
  $('station-map').href = 'https://map.naver.com/p/search/' + encodeURIComponent(query);
  $('station-map').hidden = false;
  $('roulette-result').textContent = `${selected.name}, ${selected.lines.join(', ')}. ${selected.note || ''}`;
}
const spin = createSpin({count:stations.length, motion,
  state(value) {
    spinning = value;
    $('spin').disabled = !authorized || value;
    $('spin').querySelector('span').textContent = value ? '돌리는 중' : '돌리기';
    $('roulette-wheel').setAttribute('aria-busy', String(value));
    if(value) {
      $('station-map').hidden = true; $('station-note').textContent = '';
      $('rolling-lines').replaceChildren(); $('roulette-result').textContent = '';
    }
  },
  draw(angle,index) {
    $('wheel-art').style.transform = `rotate(${angle}rad)`;
    if(performance.now()-lastLabel>100) { $('rolling-name').textContent=stations[index].name; lastLabel=performance.now(); }
  },
  result:showResult
});
$('spin').addEventListener('click', () => {
  if(!authorized || spinning) return;
  $('roulette-error').textContent = '';
  try { spin.start(); }
  catch { $('roulette-error').textContent = '룰렛을 돌리지 못했습니다. 다시 시도해 주세요.'; }
});
function account(session) {
  const metadata=session?.user?.user_metadata;
  authorized=Boolean(validProfile(metadata?.realm_profile) && validAvatar(metadata?.realm_avatar));
  if(!authorized) {
    spin.cancel(); selected=null;
    $('rolling-name').textContent='?'; $('rolling-lines').replaceChildren();
    $('station-map').hidden=true; $('station-note').textContent=''; $('roulette-result').textContent='';
  }
  $('spin').disabled=!authorized || spinning;
}
window.realmClient.auth.onAuthStateChange((_event,session) => account(session));
window.addEventListener('pagehide', () => spin.finish());
document.addEventListener('visibilitychange', () => { if(document.hidden) spin.finish(); });
window.addEventListener('storage', event => { if(event.key==='seungmin-realm-motion' && !motion()) spin.finish(); });
reduced.addEventListener('change', () => { if(!motion()) spin.finish(); });
$('roulette-odds').textContent=`${stations.length}역 · 각 1/${stations.length}`;
function renderStations() {
  const query=$('station-search').value.trim().toLocaleLowerCase();
  const matches=stations.filter(station => `${station.name} ${station.lines.join(' ')}`.toLocaleLowerCase().includes(query));
  $('station-list').replaceChildren(...matches.map(station => {
    const row=document.createElement('li'), name=document.createElement('strong'), lines=document.createElement('div');
    name.textContent=station.name; lines.className='line-badges'; lines.append(...badges(station)); row.append(name,lines); return row;
  }));
  $('station-count').textContent=`${matches.length}역`;
  $('station-list').scrollTop=0;
}
$('open-stations').addEventListener('click', () => { $('station-search').value=''; renderStations(); $('stations-dialog').showModal(); $('station-search').focus(); });
$('close-stations').addEventListener('click', () => $('stations-dialog').close());
$('station-search').addEventListener('input', renderStations);
paintWheel();
window.lucide?.createIcons();

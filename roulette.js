import {STATIONS} from './stations.js?v=20260914-2';
import {TAU, createSpin} from './roulette-core.js?v=20260914-2';
import {validProfile} from './profile.js?v=20260914-2';
import {validAvatar} from './avatar.js?v=20260914-2';
import {createRouletteStore, remainingStations} from './roulette-store.js?v=20260914-2';

const $ = id => document.getElementById(id);
const colors = {'1호선':'#688cd9','2호선':'#67c990','3호선':'#f7b36c','4호선':'#79c4ec','5호선':'#b1a0dd','6호선':'#d9a17c','7호선':'#c2c575','8호선':'#df8cac','9호선':'#c8b982','경의중앙선':'#91cbbb'};
const stations = [...STATIONS].sort((a,b) => a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id));
let authorized = false, spinning = false, selected = null, lastLabel = 0;
let user = null, epoch = 0, choices = [], pool = [], spin = null, loaded = false, loading = false, saving = false;
const store = createRouletteStore(window.realmClient, () => ({id:user?.id,epoch}));
function controls() {
  const fixed = selected && choices.some(choice => choice.station_id === selected.id);
  $('spin').disabled = !authorized || !loaded || loading || saving || spinning || !remainingStations(stations, choices).length;
  $('choose-station').hidden = !selected || spinning;
  $('choose-station').disabled = !authorized || !loaded || loading || saving || Boolean(fixed);
  $('choose-station').querySelector('span').textContent = saving ? '저장 중' : fixed ? '선택됨' : '선택';
  $('refresh-choices').disabled = !authorized || loading || saving || spinning;
  const count = remainingStations(stations, choices).length;
  $('roulette-odds').textContent = !loaded ? '내역 확인 중…' : count ? `${count}역 · 각 1/${count}` : '모든 역을 선택했습니다.';
}
function mapUrl(station) {
  const query = `${station.name}${station.name.endsWith('역') ? '' : '역'} ${station.lines.join(' ')}`;
  return 'https://map.naver.com/p/search/' + encodeURIComponent(query);
}
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
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height);
  const center = canvas.width / 2;
  ctx.translate(center, center);
  const ring = (radius, color, width) => {
    ctx.beginPath(); ctx.arc(0,0,radius,0,TAU); ctx.strokeStyle=color; ctx.lineWidth=width; ctx.stroke();
  };
  ring(550, '#405953', 1); ring(570, '#ccb991', 2); ring(516, '#7b8d75', 2); ring(340, '#a8baa0', 2);
  for (let i=0; i<pool.length; i++) {
    const start = i / pool.length * TAU - Math.PI / 2, end = (i+1) / pool.length * TAU - Math.PI / 2;
    ctx.beginPath(); ctx.arc(0,0,500,start,end); ctx.arc(0,0,362,end,start,true); ctx.closePath();
    ctx.fillStyle = colors[pool[i].lines[0]]; ctx.globalAlpha = i % 2 ? .68 : .92; ctx.fill();
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
  selected = pool[index];
  $('rolling-name').textContent = selected.name;
  $('rolling-lines').replaceChildren(...badges(selected));
  $('station-note').textContent = selected.note || '';
  $('station-map').href = mapUrl(selected);
  $('station-map').hidden = false;
  $('roulette-result').textContent = `${selected.name}, ${selected.lines.join(', ')}. ${selected.note || ''}`;
  controls();
}
function prepareSpin() {
  spin?.cancel(); pool = remainingStations(stations, choices); paintWheel();
  $('wheel-art').style.transform = 'rotate(0rad)';
  if (!pool.length) {spin = null; return;}
  spin = createSpin({count:pool.length, motion,
  state(value) {
    spinning = value;
    controls();
    $('spin').querySelector('span').textContent = value ? '돌리는 중' : '돌리기';
    $('roulette-wheel').setAttribute('aria-busy', String(value));
    if(value) {
      selected = null;
      $('station-map').hidden = true; $('station-note').textContent = '';
      $('rolling-lines').replaceChildren(); $('roulette-result').textContent = '';
    }
  },
  draw(angle,index) {
    $('wheel-art').style.transform = `rotate(${angle}rad)`;
    if(performance.now()-lastLabel>100) { $('rolling-name').textContent=pool[index].name; lastLabel=performance.now(); }
  },
  result:showResult
});
}
function renderChoices() {
  $('choices-list').replaceChildren();
  const days = new Map();
  for (const choice of [...choices].sort((a,b) => b.selected_at.localeCompare(a.selected_at) || a.station_id.localeCompare(b.station_id))) {
    if (!days.has(choice.day)) {
      const section = document.createElement('section'), heading = document.createElement('h3');
      section.className = 'choice-day'; heading.textContent = choice.day.replaceAll('-', '.');
      section.append(heading); days.set(choice.day, section); $('choices-list').append(section);
    }
    const row = document.createElement('article'), info = document.createElement('div'), name = document.createElement('strong'), lines = document.createElement('div'), link = document.createElement('a');
    row.className = 'choice-row'; name.textContent = choice.station_name; lines.className = 'line-badges';
    lines.append(...badges(choice)); info.append(name,lines);
    link.className = 'icon-button'; link.href = mapUrl({name:choice.station_name,lines:choice.lines});
    link.target = '_blank'; link.rel = 'noopener noreferrer'; link.title = `${choice.station_name} 지도`; link.setAttribute('aria-label', link.title);
    link.innerHTML = '<i data-lucide="map-pin"></i>'; row.append(info,link); days.get(choice.day).append(row);
  }
  $('choices-status').textContent = loading ? '불러오는 중…' : !loaded ? '내역을 불러오지 못했습니다.' : choices.length ? `${choices.length}역 선택` : '선택한 역이 없습니다.';
  window.lucide?.createIcons(); controls();
}
async function loadChoices() {
  if (!authorized || loading || saving || spinning) return false;
  const token = epoch; loading = true; controls();
  $('choices-status').textContent = '불러오는 중…';
  try {
    const rows = await store.list();
    if (token !== epoch) return false;
    choices = rows; loaded = true; $('roulette-error').textContent = '';
    return true;
  } catch {
    if (token === epoch) {loaded = false; $('roulette-error').textContent = '선택 내역을 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.';}
    return false;
  } finally {if (token === epoch) {loading = false; renderChoices();}}
}
$('spin').addEventListener('click', async () => {
  if(!authorized || spinning || loading || saving) return;
  $('roulette-error').textContent = '';
  if (!await loadChoices()) return;
  try { prepareSpin(); spin?.start(); controls(); }
  catch { $('roulette-error').textContent = '룰렛을 돌리지 못했습니다. 다시 시도해 주세요.'; }
});
$('choose-station').addEventListener('click', async () => {
  if (!authorized || !loaded || !selected || spinning || saving || loading || choices.some(choice => choice.station_id === selected.id)) return;
  if (!confirm(`${selected.name}을 선택할까요? 선택한 역은 다음 추첨에서 제외됩니다.`)) return;
  const token = epoch, station = selected; saving = true; controls(); $('roulette-error').textContent = '';
  try {
    const choice = await store.choose(station);
    if (token !== epoch) return;
    choices = choices.filter(item => item.station_id !== choice.station_id).concat(choice);
    $('roulette-result').textContent = `${choice.day}, ${choice.station_name} 선택됨`;
  } catch {
    if (token === epoch) {loaded = false; $('roulette-error').textContent = '저장 여부를 확인하지 못했습니다. 내역을 새로고침해 주세요.';}
  } finally {if (token === epoch) {saving = false; renderChoices();}}
});
$('refresh-choices').addEventListener('click', loadChoices);
function account(session) {
  const metadata=session?.user?.user_metadata;
  const changed = user?.id !== session?.user?.id;
  user = session?.user || null;
  authorized=Boolean(validProfile(metadata?.realm_profile) && validAvatar(metadata?.realm_avatar));
  if(changed || !authorized) {
    epoch++; spin?.cancel(); selected=null; choices=[]; pool=[]; loaded=false; loading=false; saving=false;
    $('rolling-name').textContent='?'; $('rolling-lines').replaceChildren();
    $('station-map').hidden=true; $('station-note').textContent=''; $('roulette-result').textContent='';
    $('roulette-error').textContent=''; renderChoices();
  }
  controls();
  if (authorized && (changed || !loaded)) setTimeout(() => loadChoices(),0);
}
window.realmClient.auth.onAuthStateChange((_event,session) => account(session));
const initialEpoch = epoch;
window.realmClient.auth.getSession().then(({data,error}) => {if (!error && initialEpoch === epoch) account(data.session || null);}).catch(() => {});
window.addEventListener('pagehide', () => spin?.finish());
document.addEventListener('visibilitychange', () => {if (document.hidden) spin?.finish(); else loadChoices();});
window.addEventListener('online', loadChoices);
window.addEventListener('storage', event => { if(event.key==='seungmin-realm-motion' && !motion()) spin?.finish(); });
reduced.addEventListener('change', () => { if(!motion()) spin?.finish(); });
function renderStations() {
  const query=$('station-search').value.trim().toLocaleLowerCase();
  const matches=stations.filter(station => `${station.name} ${station.lines.join(' ')}`.toLocaleLowerCase().includes(query));
  $('station-list').replaceChildren(...matches.map(station => {
    const row=document.createElement('li'), name=document.createElement('strong'), lines=document.createElement('div');
    name.textContent=station.name; row.dataset.chosen=String(choices.some(choice => choice.station_id === station.id)); lines.className='line-badges'; lines.append(...badges(station)); row.append(name,lines); return row;
  }));
  $('station-count').textContent=`${matches.length}역`;
  $('station-list').scrollTop=0;
}
$('open-stations').addEventListener('click', () => { $('station-search').value=''; renderStations(); $('stations-dialog').showModal(); $('station-search').focus(); });
$('close-stations').addEventListener('click', () => $('stations-dialog').close());
$('station-search').addEventListener('input', renderStations);
pool = stations; paintWheel(); controls();
window.lucide?.createIcons();

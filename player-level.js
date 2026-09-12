const client = window.realmClient;
let userId = null, epoch = 0, loading = false, lastRead = -Infinity, timer = 0;
function paint(value) {
  document.querySelectorAll('[data-player-level]').forEach(node => { node.textContent = 'LV. ' + value; });
}
async function refresh() {
  if (!userId || loading || document.hidden) return;
  const token = epoch; loading = true;
  try {
    const {data,error} = await client.rpc('daily_plan_state');
    if (token !== epoch) return;
    if (error) throw error;
    if (data?.reward_policy !== 'kst_midnight') throw new Error('POLICY_PENDING');
    if (!Number.isSafeInteger(data?.level) || data.level < 1) throw new Error('INVALID_LEVEL');
    paint(data.level); lastRead = performance.now();
    const remaining = Date.parse(data.ends_at) - Date.parse(data.server_now);
    clearTimeout(timer);
    if (Number.isFinite(remaining)) timer = setTimeout(refresh,Math.max(1000,remaining+150));
  } catch {} finally { if (token === epoch) loading = false; }
}
function account(next) {
  if (userId !== next) {
    epoch++; clearTimeout(timer); loading = false; lastRead = -Infinity;
    userId = next; paint(next ? '…' : 1);
  }
  if (userId) setTimeout(refresh,0);
}
client.auth.onAuthStateChange((event,session) => account(session?.user?.id || null));
const initialEpoch = epoch;
client.auth.getSession().then(({data,error}) => {
  if (!error && epoch === initialEpoch) account(data.session?.user?.id || null);
}).catch(() => {});
const onReturn = () => { if (performance.now()-lastRead>1000) refresh(); };
window.addEventListener('realm-view',onReturn);
window.addEventListener('focus',onReturn);
window.addEventListener('online',onReturn);
window.addEventListener('pageshow',event => { if (event.persisted) refresh(); });
document.addEventListener('visibilitychange',onReturn);

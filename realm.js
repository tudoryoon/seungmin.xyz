import { parseAvatar, paintAvatar, validAvatar, avatarTraits, avatarTitle, DEFAULT_PROMPT } from './avatar.js?v=20260913-6';
import { validProfile } from './profile.js?v=20260913-6';
import { createDungeon } from './dungeon.js?v=20260913-6';
import { resolveRealmStage } from './realm-route.js?v=20260913-6';

const $ = id => document.getElementById(id);
const client = window.realmClient;
window.lucide?.createIcons();
let user = null, stage = 'entry', authMode = 'login', epoch = 0, entered = false, flipped = false;
let sessionReady = false, recovery = false;
let draft = null, preview = parseAvatar(DEFAULT_PROMPT), frame = 0;
const settings = $('realm-settings'), settingsPanel = $('settings-panel'), settingsToggle = $('settings-toggle');
function setSettings(open, restoreFocus = false) {
  settingsPanel.hidden = !open;
  settingsToggle.setAttribute('aria-expanded', String(open));
  if (open) $('motion').focus({ preventScroll: true });
  else if (restoreFocus) settingsToggle.focus({ preventScroll: true });
}
settingsToggle.addEventListener('click', () => setSettings(settingsPanel.hidden, true));
for (const eventName of ['pointerdown', 'focusin']) {
  document.addEventListener(eventName, event => {
    if (!settingsPanel.hidden && !settings.contains(event.target)) {
      setSettings(false, eventName === 'pointerdown' && settingsPanel.contains(document.activeElement));
    }
  });
}
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || settingsPanel.hidden) return;
  event.preventDefault();
  event.stopPropagation();
  setSettings(false, true);
});
const dungeon = createDungeon($('map'), () => stage === 'map' && !!user && !$('logout').disabled && settingsPanel.hidden && !document.querySelector('dialog[open]'));
let portal = { setMotion() {}, setStage() {}, async travel() {} };
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
let motionPreference = null;
try { motionPreference = localStorage.getItem('seungmin-realm-motion'); } catch {}
let motion = motionPreference === null ? !reducedQuery.matches : motionPreference === 'on';
const setMotion = value => {
  motion = value;
  $('motion').checked = motion;
  document.body.classList.toggle('reduced-motion', !motion);
  portal.setMotion(motion);
  if (!motion) {
    dungeon.reset();
    document.querySelectorAll('.stage').forEach(element => element.getAnimations().forEach(animation => animation.finish()));
    frame = 0; renderAvatar();
  }
};
setMotion(motion);
$('motion').addEventListener('change', event => {
  motionPreference = event.target.checked ? 'on' : 'off';
  try { localStorage.setItem('seungmin-realm-motion', motionPreference); } catch {}
  setMotion(event.target.checked);
});
reducedQuery.addEventListener('change', () => { if (motionPreference === null) setMotion(!reducedQuery.matches); });
// Rendering is optional: a failed GPU or module must never block account access.
import('./portal.js?v=20260913-6').then(({ createPortal }) => {
  portal = createPortal($('portal'), motion);
  portal.setStage(stage);
}).catch(() => {
  $('portal').hidden = true;
  document.body.dataset.renderer = 'fallback';
});

function show(next, {replace=false} = {}) {
  setSettings(false);
  const previous = stage;
  stage = next;
  document.body.dataset.stage = next;
  const hash=next==='entry'?'':'#'+next;
  if(location.hash!==hash)history[replace?'replaceState':'pushState'](null,'',location.pathname+location.search+hash);
  document.querySelectorAll('.stage').forEach(section => { section.hidden = section.id !== next; });
  document.querySelector('.journey').hidden = ['entry','complete','map'].includes(next);
  dungeon.reset();
  document.querySelectorAll('[data-step]').forEach(item => {
    if (item.dataset.step === next) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
  portal.setStage(next);
  document.title = ({entry:'입장',auth:authMode==='signup'?'회원가입':'로그인',profile:'프로필',avatar:'캐릭터',complete:'캐릭터',map:'지도'})[next];
  if (motion && previous !== next) {
    $(next).getAnimations().forEach(animation => animation.cancel());
    $(next).animate([
      {opacity:0,transform:next === 'map' ? 'scale(.94)' : 'translateY(12px)'},
      {opacity:1,transform:next === 'map' ? 'scale(1)' : 'translateY(0)'}
    ], {duration:650,easing:'cubic-bezier(.22,.61,.36,1)'});
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
  $(next + '-title')?.focus({ preventScroll: true });
  renderAvatar();
  window.dispatchEvent(new CustomEvent('realm-view', {detail:next}));
}
function fillProfile() {
  const profile = user?.user_metadata?.realm_profile;
  if (!validProfile(profile)) return;
  for (const key of ['name','age','gender','mbti','blood']) $('profile-' + key).value = profile[key];
}
function prepareAvatar() {
  const stored = user?.user_metadata?.realm_avatar;
  draft = validAvatar(stored) ? { ...stored } : null;
  preview = draft || parseAvatar(DEFAULT_PROMPT);
  $('character-prompt').value = draft?.prompt || '';
  updateCount();
  $('avatar-result').hidden = !draft;
  $('preview-label').textContent = draft ? '저장됨' : '미리보기';
  $('avatar-message').textContent = '';
  describeAvatar();
}
function routeAccount() {
  if(recovery)return;
  const next=resolveRealmStage(user,location.hash,entered);
  if(user){entered=true;fillProfile();prepareAvatar();}
  if(next==='map')showMap({replace:true});
  else if(next==='complete')complete({replace:true});
  else show(next,{replace:true});
}
function clearAccount() {
  $('profile-form').reset();
  $('auth-form').reset();
  $('avatar-form').reset();
  ['auth-message','profile-message','avatar-message','global-message','saved-name','saved-class','map-name'].forEach(id => { $(id).textContent = ''; });
  dungeon.reset();
  $('map-avatar').getContext('2d').clearRect(0,0,160,176);
  draft = null; preview = parseAvatar(DEFAULT_PROMPT); flipped = false;
  $('avatar-result').hidden = true;
  $('character-name').textContent = '캐릭터';
  $('saved-avatar').getContext('2d').clearRect(0,0,320,352);
}
client.auth.onAuthStateChange((event, session) => {
  const changed = user?.id !== session?.user?.id;
  if (changed) { epoch++; clearAccount(); }
  user = session?.user || null;
  $('logout').hidden = !user;
  // Keep the callback synchronous; auth API calls inside it can deadlock.
  if (event === 'PASSWORD_RECOVERY') {recovery=true;location.replace('test.html?recovery=1');return;}
  if (changed && sessionReady) {
    entered=true;
    setTimeout(() => routeAccount(), 0);
  }
});
const initialEpoch=epoch;
const ready = client.auth.getSession().then(({ data, error }) => {
  if (error) throw error;
  if(epoch===initialEpoch)user = data.session?.user || null;
  $('logout').hidden = !user;
}).catch(error => {
  user=null;entered=true;$('logout').hidden=true;
  $('global-message').textContent = window.realmError(error);
}).finally(()=>{
  sessionReady=true;routeAccount();
  document.body.classList.remove('session-checking');
  document.querySelector('main').setAttribute('aria-busy','false');
});
const restoreRoute=()=>{if(sessionReady)routeAccount();};
window.addEventListener('hashchange',restoreRoute);
window.addEventListener('popstate',restoreRoute);
$('enter').addEventListener('click', async () => {
  $('enter').disabled = true;
  try {
    if (motion) document.body.classList.add('entering');
    await portal.travel();
    await ready;
    entered = true;
    routeAccount();
  } finally {
    document.body.classList.remove('entering');
    $('enter').disabled = false;
  }
});
document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => {
  authMode = button.dataset.authMode;
  document.querySelectorAll('[data-auth-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  $('auth-submit').querySelector('span').textContent = authMode === 'signup' ? '회원가입' : '로그인';
  $('auth-title').textContent = authMode === 'signup' ? '회원가입' : '로그인';
  document.title = $('auth-title').textContent;
  $('password').autocomplete = authMode === 'signup' ? 'new-password' : 'current-password';
  $('auth-message').textContent = '';
}));
$('show-password').addEventListener('click', () => {
  const showPassword = $('password').type === 'password';
  $('password').type = showPassword ? 'text' : 'password';
  $('show-password').setAttribute('aria-label', showPassword ? '비밀번호 숨기기' : '비밀번호 표시');
  $('show-password').title = $('show-password').getAttribute('aria-label');
  $('show-password').setAttribute('aria-pressed', String(showPassword));
});
function disable(container, value) { container.querySelectorAll('button, input, select, textarea').forEach(element => { element.disabled = value; }); }
$('auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const credentials = { email: $('email').value.trim(), password: $('password').value };
  const signup = authMode === 'signup';
  disable($('auth'), true);
  $('auth-message').textContent = '계정 확인 중…';
  try {
    const { data, error } = signup
      ? await client.auth.signUp({ ...credentials, options: { emailRedirectTo: 'https://seungmin.xyz/test.html' } })
      : await client.auth.signInWithPassword(credentials);
    if (error) throw error;
    $('password').value = '';
    if (!data.session) {
      $('auth-message').textContent = '메일함의 인증 링크를 누른 뒤 로그인해 주세요.';
    } else {
      user = data.user; routeAccount();
    }
  } catch (error) { $('auth-message').textContent = window.realmError(error); }
  finally { disable($('auth'), false); }
});
$('reset-password').addEventListener('click', async () => {
  if (!$('email').reportValidity()) return;
  $('reset-password').disabled = true;
  try {
    const { error } = await client.auth.resetPasswordForEmail($('email').value.trim(), { redirectTo: 'https://seungmin.xyz/test.html' });
    if (error) throw error;
    $('auth-message').textContent = '재설정 메일을 요청했습니다. 메일함을 확인해 주세요.';
  } catch (error) { $('auth-message').textContent = window.realmError(error); }
  finally { $('reset-password').disabled = false; }
});
$('logout').addEventListener('click', async () => {
  dungeon.reset();
  $('logout').disabled = true;
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
  } catch (error) { $('global-message').textContent = window.realmError(error); }
  finally { $('logout').disabled = false; }
});
async function saveMetadata(metadata) {
  if (!user) throw new Error('No account');
  const id = user.id, version = epoch;
  const { data, error } = await client.auth.updateUser({ data: metadata });
  if (error) throw error;
  if (id !== user?.id || version !== epoch) return false;
  user = data.user;
  return true;
}
$('profile-form').addEventListener('submit', async event => {
  event.preventDefault();
  const profile = { version:1, name:$('profile-name').value.trim(), age:Number($('profile-age').value),
    gender:$('profile-gender').value, mbti:$('profile-mbti').value, blood:$('profile-blood').value };
  if (!validProfile(profile)) { $('profile-message').textContent = '이름과 나이를 확인해 주세요.'; return; }
  disable($('profile-form'), true);
  $('logout').disabled = true;
  $('profile-message').textContent = '프로필 저장 중…';
  try {
    if (!await saveMetadata({ realm_profile: profile })) return;
    $('profile-message').textContent = '';
    prepareAvatar(); show('avatar');
  } catch (error) { $('profile-message').textContent = window.realmError(error); }
  finally { disable($('profile-form'), false); $('logout').disabled = false; }
});
function updateCount() { $('prompt-count').textContent = $('character-prompt').value.length + ' / 300'; }
function invalidateDraft() {
  updateCount();
  draft = null;
  $('avatar-result').hidden = true;
  $('preview-label').textContent = '미리보기';
  $('avatar-message').textContent = '';
}
$('character-prompt').addEventListener('input', invalidateDraft);
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
  $('character-prompt').value = button.dataset.preset;
  invalidateDraft();
  $('character-prompt').focus({ preventScroll: true });
}));
function describeAvatar() {
  const traits = avatarTraits(preview);
  $('character-class').textContent = avatarTitle(preview);
  $('character-name').textContent = user?.user_metadata?.realm_profile?.name || '캐릭터';
  $('traits').replaceChildren(...traits.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  $('avatar-canvas').setAttribute('aria-label', traits.join(', ') + ' 도트 캐릭터');
}
$('avatar-form').addEventListener('submit', event => {
  event.preventDefault();
  const spec = parseAvatar($('character-prompt').value);
  if (!spec.prompt || !spec.recognized) {
    $('avatar-message').textContent = '인식 가능한 요소가 없습니다. 직업·머리색·도포·장비를 입력해 주세요.';
    return;
  }
  draft = spec; preview = spec;
  $('avatar-message').textContent = '';
  $('avatar-result').hidden = false;
  $('preview-label').textContent = '저장 전';
  describeAvatar(); renderAvatar();
  const presentation = document.querySelector('.sprite-presentation');
  presentation.classList.remove('summoning');
  void presentation.offsetWidth;
  presentation.classList.add('summoning');
});
$('save-avatar').addEventListener('click', async () => {
  if (!draft || !validAvatar(draft)) return;
  const snapshot = { ...draft };
  disable($('avatar'), true);
  $('logout').disabled = true;
  $('avatar-message').textContent = '저장 중…';
  try {
    if (!await saveMetadata({ realm_avatar: snapshot })) return;
    $('avatar-message').textContent = '';
    showMap();
  } catch (error) { $('avatar-message').textContent = window.realmError(error); }
  finally { disable($('avatar'), false); $('logout').disabled = false; }
});
function complete(options = {}) {
  const stored = user?.user_metadata?.realm_avatar;
  if (!validAvatar(stored)) { show('avatar'); return; }
  preview = stored;
  $('saved-name').textContent = user.user_metadata.realm_profile.name;
  $('saved-class').textContent = avatarTitle(stored);
  $('saved-avatar').setAttribute('aria-label', avatarTraits(stored).join(', ') + ' 저장된 분신');
  show('complete',options);
}
function showMap(options = {}) {
  const stored = user?.user_metadata?.realm_avatar;
  if (!user) { show('auth'); return; }
  if (!validProfile(user.user_metadata?.realm_profile)) { show('profile'); return; }
  if (!validAvatar(stored)) { show('avatar'); return; }
  preview = stored;
  $('map-name').textContent = user.user_metadata.realm_profile.name;
  $('map-avatar').setAttribute('aria-label', user.user_metadata.realm_profile.name + ' 캐릭터');
  show('map',options);
}
function renderAvatar() {
  if (stage === 'avatar') paintAvatar($('avatar-canvas'), preview, frame, flipped);
  if (stage === 'complete') paintAvatar($('saved-avatar'), preview, frame);
  if (stage === 'map') paintAvatar($('map-avatar'), preview, $('map-actor').dataset.walking === 'true' ? frame * 2 : frame);
}
setInterval(() => {
  if (document.hidden || !motion || !['avatar','complete','map'].includes(stage)) return;
  frame++; renderAvatar();
}, 280);
$('turn-character').addEventListener('click', () => { flipped = !flipped; renderAvatar(); });
$('download-character').addEventListener('click', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 704;
  paintAvatar(canvas, preview, 0, flipped);
  const link = document.createElement('a');
  link.download = 'my-realm-avatar.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
const editProfile = () => { fillProfile(); $('profile-message').textContent = ''; show('profile'); };
$('back-profile').addEventListener('click', editProfile);
$('edit-profile').addEventListener('click', editProfile);
$('edit-avatar').addEventListener('click', () => { prepareAvatar(); show('avatar'); });
$('open-map').addEventListener('click', showMap);
$('map-character').addEventListener('click', complete);

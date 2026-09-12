import { validProfile } from './profile.js?v=20260912-3';
import { validAvatar } from './avatar.js?v=20260912-3';
let recovery = location.hash.includes('type=recovery') || new URLSearchParams(location.search).get('recovery') === '1' || document.getElementById('password-dialog').open;
window.realmClient.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') recovery = true;
  if (recovery && session) { document.body.classList.remove('session-checking'); return; }
  const metadata = session?.user?.user_metadata;
  if (!session || !validProfile(metadata?.realm_profile) || !validAvatar(metadata?.realm_avatar)) {
    location.replace('index.html#continue');
  } else document.body.classList.remove('session-checking');
});

import {validProfile} from './profile.js?v=20260913-4';
import {validAvatar} from './avatar.js?v=20260913-4';

export function resolveRealmStage(user,hash,entered=false) {
  const requested=hash.replace(/^#/,'');
  if(!user)return entered||Boolean(requested)?'auth':'entry';
  if(!validProfile(user.user_metadata?.realm_profile))return 'profile';
  if(requested==='profile')return 'profile';
  if(!validAvatar(user.user_metadata?.realm_avatar))return 'avatar';
  return ['avatar','complete','map'].includes(requested)?requested:'map';
}

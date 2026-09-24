import {validProfile} from './profile.js?v=20260924-2';
import {validAvatar} from './avatar.js?v=20260924-2';

export function resolveRealmStage(user,hash) {
  const requested=hash.replace(/^#/,'');
  if(!requested)return 'entry';
  if(['home','substack','about'].includes(requested))return requested;
  if(!user)return 'auth';
  if(!validProfile(user.user_metadata?.realm_profile))return 'profile';
  if(requested==='profile')return 'profile';
  if(!validAvatar(user.user_metadata?.realm_avatar))return 'avatar';
  return ['avatar','complete','map'].includes(requested)?requested:'map';
}

'use strict';
// Public browser key. Private records are protected by Supabase owner-only RLS.
window.realmClient = window.supabase.createClient(
  'https://rciahwtvrsysxqvjjtuu.supabase.co',
  'sb_publishable__pbxu1HGVdOKSR0QEBG4AQ_JXqHbXS5'
);
window.realmError = error => {
  if (error?.message === 'Invalid login credentials') return '이메일 또는 비밀번호를 확인해 주세요.';
  if (error?.message === 'Email not confirmed') return '메일함에서 인증을 마친 뒤 로그인해 주세요.';
  if (error?.code === 'user_already_exists') return '이미 가입한 이메일입니다. 로그인해 주세요.';
  if (error?.code === 'weak_password') return '더 긴 비밀번호를 입력해 주세요.';
  if (error?.status === 429) return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
  return '저장하거나 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';
};

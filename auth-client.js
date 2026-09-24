'use strict';
// Public browser key. Private records are protected by Supabase owner-only RLS.
window.realmClient = window.supabase.createClient(
  'https://rciahwtvrsysxqvjjtuu.supabase.co',
  'sb_publishable__pbxu1HGVdOKSR0QEBG4AQ_JXqHbXS5',
  {auth:{detectSessionInUrl:!/^\/google-callback(?:\.html)?\/?$/.test(location.pathname)}}
);
// The email is a public account identifier, never a password or an access control.
// Supabase disables signups/anonymous auth and verifies the owner's password.
window.realmAccess = Object.freeze({
  email: 'tmdals2008@gmail.com',
  signIn(password) {
    return window.realmClient.auth.signInWithPassword({ email: this.email, password });
  },
  requestReset() {
    return window.realmClient.auth.resetPasswordForEmail(this.email, { redirectTo: 'https://seungmin.xyz/test.html' });
  }
});
window.realmError = error => {
  if (error?.message === 'Invalid login credentials') return '접속 비밀번호를 확인해 주세요.';
  if (error?.message === 'Email not confirmed') return '소유자 이메일 인증이 필요합니다.';
  if (error?.code === 'weak_password') return '더 긴 비밀번호를 입력해 주세요.';
  if (error?.status === 429) return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
  return '저장하거나 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';
};

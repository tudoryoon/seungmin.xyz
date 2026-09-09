'use strict';
// Publishable browser key only. Authorization is enforced by database RLS.
const journalClient = window.supabase.createClient(
  'https://rciahwtvrsysxqvjjtuu.supabase.co',
  'sb_publishable__pbxu1HGVdOKSR0QEBG4AQ_JXqHbXS5'
);
window.journalCloud = {
  client: journalClient,
  user: null,
  ready: false,
  version: 0,
  async list() {
    const user = this.user;
    const rows = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await journalClient.from('journal_records').select('*')
        .eq('user_id', user.id).order('id').range(from, from + 499);
      if (error) throw error;
      rows.push(...data.map(row => ({...row.payload, id:row.id, kind:row.kind, date:row.date, title:row.title})));
      if (data.length < 500) return rows;
    }
  },
  async save(record) {
    const { error } = await journalClient.from('journal_records').upsert(this.row(record));
    if (error) throw error;
  },
  async remove(id) {
    const { error } = await journalClient.from('journal_records').delete().eq('id',id).eq('user_id',this.user.id);
    if (error) throw error;
  },
  row(record) {
    return {user_id:this.user.id,id:record.id,kind:record.kind,date:record.date,title:record.title,payload:record};
  },
  async import(records) {
    // Ignore existing IDs so a second import cannot overwrite newer online edits.
    const { error } = await journalClient.from('journal_records').upsert(records.map(r => this.row(r)), {
      onConflict:'user_id,id', ignoreDuplicates:true
    });
    if (error) throw error;
  }
};
const cloudElement = id => document.getElementById(id);
window.cloudError = error => {
  if (['PGRST205','42501','42P01'].includes(error?.code)) return '온라인 저장소 설정이 필요합니다. Supabase에서 테이블과 접근 규칙을 적용해 주세요.';
  if (error?.message === 'Invalid login credentials') return '이메일 또는 비밀번호를 확인해 주세요.';
  if (error?.message === 'Email not confirmed') return '이메일 인증 링크를 먼저 확인해 주세요.';
  if (error?.status === 429) return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
  return '요청을 완료하지 못했습니다. 인터넷 연결과 계정 설정을 확인하고 다시 시도해 주세요.';
};
journalClient.auth.onAuthStateChange((event, session) => {
  const cloud = window.journalCloud;
  const changed = !cloud.ready || cloud.user?.id !== session?.user?.id;
  cloud.user = session?.user || null;
  cloud.ready = true;
  if (changed) {cloud.version++; window.dispatchEvent(new Event('journal-account'));}
  if (event === 'PASSWORD_RECOVERY') setTimeout(() => cloudElement('password-dialog').showModal(),0);
});
cloudElement('open-auth').addEventListener('click', () => cloudElement('auth-dialog').showModal());
cloudElement('close-auth').addEventListener('click', () => cloudElement('auth-dialog').close());
cloudElement('auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const signup = event.submitter?.value === 'signup';
  const buttons = form.querySelectorAll('button'); buttons.forEach(b => b.disabled = true);
  cloudElement('auth-message').textContent = '처리 중…';
  try {
    const credentials = {email:cloudElement('auth-email').value.trim(),password:cloudElement('auth-password').value};
    const {data,error} = signup
      ? await journalClient.auth.signUp({...credentials,options:{emailRedirectTo:'https://seungmin.xyz/test.html'}})
      : await journalClient.auth.signInWithPassword(credentials);
    if (error) throw error;
    cloudElement('auth-password').value = '';
    cloudElement('auth-message').textContent = signup && !data.session ? '메일함의 인증 링크를 누른 뒤 로그인해 주세요.' : '로그인되었습니다.';
    if (data.session) cloudElement('auth-dialog').close();
  } catch(error) {cloudElement('auth-message').textContent = window.cloudError(error);}
  finally {buttons.forEach(b => b.disabled = false);}
});
cloudElement('sign-out').addEventListener('click', async () => {
  const {error} = await journalClient.auth.signOut({scope:'local'});
  if (error) cloudElement('message').textContent = window.cloudError(error);
});
cloudElement('forgot-password').addEventListener('click', async () => {
  const email = cloudElement('auth-email');
  if (!email.reportValidity()) return;
  cloudElement('forgot-password').disabled = true;
  try {
    const {error} = await journalClient.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:'https://seungmin.xyz/test.html'});
    if (error) throw error;
    cloudElement('auth-message').textContent = '재설정 메일을 요청했습니다. 메일함을 확인해 주세요.';
  } catch(error) {cloudElement('auth-message').textContent = window.cloudError(error);}
  finally {cloudElement('forgot-password').disabled = false;}
});
cloudElement('password-form').addEventListener('submit', async event => {
  event.preventDefault(); event.submitter.disabled = true;
  try {
    const {error} = await journalClient.auth.updateUser({password:cloudElement('new-password').value});
    if (error) throw error;
    cloudElement('new-password').value = ''; cloudElement('password-dialog').close();
    cloudElement('message').textContent = '비밀번호를 변경했습니다.';
  } catch(error) {cloudElement('password-message').textContent = window.cloudError(error);}
  finally {event.submitter.disabled = false;}
});

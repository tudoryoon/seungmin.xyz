import {errorMessage} from './google-calendar-core.js?v=20260913-6';
export async function calendarRequest(action, values = {}) {
  const client = window.realmClient;
  const {data:{session},error} = await client.auth.getSession();
  if (error || !session) throw new Error('UNAUTHORIZED');
  const {data,error:failure} = await client.functions.invoke('google-calendar',{body:{action,...values}});
  if (failure) {
    let code;
    try {code = (await failure.context.json()).error;} catch {}
    throw new Error(code || 'SERVICE_UNAVAILABLE');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export async function connectGoogle() {
  const {data:{session}} = await window.realmClient.auth.getSession();
  if (!session) throw new Error('UNAUTHORIZED');
  const result = await calendarRequest('connect');
  const url = new URL(result.url);
  if (url.origin !== 'https://accounts.google.com') throw new Error('INVALID_STATE');
  sessionStorage.setItem('google-calendar-oauth',JSON.stringify({state:result.state,user:session.user.id,at:Date.now()}));
  location.assign(url.href);
}
export {errorMessage};

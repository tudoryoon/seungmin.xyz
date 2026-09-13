import {calendarRequest,errorMessage} from './google-api.js?v=20260914-4';
const query = new URLSearchParams(location.search);
history.replaceState(null,'',location.pathname);
const status = document.getElementById('callback-status');
try {
  const pending = JSON.parse(sessionStorage.getItem('google-calendar-oauth') || 'null');
  sessionStorage.removeItem('google-calendar-oauth');
  if (query.has('error')) {
    status.textContent = 'Google 연결이 취소되었습니다.';
  } else {
    const {data:{session}} = await window.realmClient.auth.getSession();
    if (!pending || !session || pending.user !== session.user.id || pending.state !== query.get('state') || Date.now()-pending.at > 600000) throw new Error('INVALID_STATE');
    await calendarRequest('exchange',{state:pending.state,code:query.get('code')});
    status.textContent = '연결되었습니다.';
    location.replace('test.html#calendar');
  }
} catch(error) {status.textContent = errorMessage(error);}

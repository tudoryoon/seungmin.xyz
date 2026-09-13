// Standalone Edge Function: no Google credential or calendar data is returned to the browser.
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.calendarlist.readonly'];
const ORIGINS = ['https://seungmin.xyz', 'https://seungmin-xyz.pages.dev'];
const GOOGLE = 'https://www.googleapis.com/calendar/v3';
const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const unb64 = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
const hash = async value => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value))));
class CalendarError extends Error {
  constructor(code, status = 400) { super(code); this.status = status; }
}
const need = (condition, code = 'INVALID_REQUEST', status = 400) => { if (!condition) throw new CalendarError(code, status); };

export function createHandler(env, fetcher = fetch) {
  const base = env.SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  const dbHeaders = {apikey:service, Authorization:`Bearer ${service}`, 'Content-Type':'application/json'};
  const configured = () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.CALENDAR_ENCRYPTION_KEY);
  const key = async () => crypto.subtle.importKey('raw', unb64(env.CALENDAR_ENCRYPTION_KEY), 'AES-GCM', false, ['encrypt','decrypt']);
  async function encrypt(value, user) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(user)}, await key(), enc.encode(JSON.stringify(value)));
    return `${b64(iv)}.${b64(new Uint8Array(data))}`;
  }
  async function decrypt(value, user) {
    const [iv, data] = value.split('.');
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:enc.encode(user)}, await key(), unb64(data))));
  }
  async function request(url, options) {
    try { return await fetcher(url, {...options, signal:AbortSignal.timeout(15000)}); }
    catch { throw new CalendarError('SERVICE_UNAVAILABLE',503); }
  }
  async function db(path, method = 'GET', body, prefer = 'return=representation') {
    const response = await request(`${base}/rest/v1/${path}`, {method,headers:{...dbHeaders,Prefer:prefer},body:body === undefined ? undefined : JSON.stringify(body)});
    if (!response.ok) throw new CalendarError('STORAGE_UNAVAILABLE',503);
    return response.status === 204 ? null : response.json();
  }
  async function token(body) {
    const response = await request('https://oauth2.googleapis.com/token', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,...body})});
    const result = await response.json();
    if (!response.ok) throw new CalendarError(result.error === 'invalid_grant' ? 'RECONNECT_REQUIRED' : 'GOOGLE_UNAVAILABLE', response.status === 400 ? 401 : 502);
    return result;
  }
  async function saved(user) {
    const rows = await db(`google_calendar_connections?user_id=eq.${user}&select=credentials,email`);
    return rows[0];
  }
  async function store(user, credentials, email) {
    await db('google_calendar_connections?on_conflict=user_id','POST',{user_id:user,credentials:await encrypt(credentials,user),email,updated_at:new Date().toISOString()},'resolution=merge-duplicates,return=representation');
  }
  async function access(user) {
    const row = await saved(user);
    need(row,'NOT_CONNECTED',409);
    const credentials = await decrypt(row.credentials,user);
    if (credentials.expires_at < Date.now() + 60000) {
      const fresh = await token({grant_type:'refresh_token',refresh_token:credentials.refresh_token});
      credentials.access_token = fresh.access_token;
      credentials.expires_at = Date.now() + fresh.expires_in * 1000;
      if (fresh.refresh_token) credentials.refresh_token = fresh.refresh_token;
      // Compare-and-swap must not recreate a connection removed during refresh.
      await db(`google_calendar_connections?user_id=eq.${user}&credentials=eq.${encodeURIComponent(row.credentials)}`,'PATCH',{credentials:await encrypt(credentials,user),updated_at:new Date().toISOString()});
    }
    return credentials.access_token;
  }
  async function google(accessToken, path, method = 'GET', body, etag) {
    const response = await request(`${GOOGLE}/${path}`, {method,headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json',...(etag ? {'If-Match':etag} : {})},body:body === undefined ? undefined : JSON.stringify(body)});
    if (!response.ok) {
      const code = ({401:'RECONNECT_REQUIRED',403:'GOOGLE_PERMISSION',404:'EVENT_NOT_FOUND',409:'EVENT_EXISTS',410:'EVENT_NOT_FOUND',412:'EVENT_CHANGED',429:'RATE_LIMITED'})[response.status] || 'GOOGLE_UNAVAILABLE';
      throw new CalendarError(code,response.status);
    }
    return response.status === 204 ? {} : response.json();
  }
  async function pages(accessToken, path, params) {
    const items = []; let pageToken;
    for (let page = 0; page < 50; page++) {
      const query = new URLSearchParams({...params,...(pageToken ? {pageToken} : {})});
      const result = await google(accessToken,`${path}?${query}`);
      items.push(...(result.items || []));
      pageToken = result.nextPageToken;
      if (!pageToken) return items;
    }
    throw new CalendarError('TOO_MANY_EVENTS',422);
  }
  return async function handler(req) {
    const origin = req.headers.get('Origin');
    const headers = {'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(ORIGINS.includes(origin) ? {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'} : {})};
    const reply = (body, status = 200) => new Response(JSON.stringify(body),{status,headers});
    if (req.method === 'OPTIONS') return new Response(null,{status:ORIGINS.includes(origin) ? 204 : 403,headers});
    try {
      need(ORIGINS.includes(origin),'INVALID_ORIGIN',403);
      need(req.method === 'POST','METHOD_NOT_ALLOWED',405);
      const authorization = req.headers.get('Authorization') || '';
      need(/^Bearer \S+$/.test(authorization),'UNAUTHORIZED',401);
      const auth = await request(`${base}/auth/v1/user`,{headers:{apikey:service,Authorization:authorization}});
      need(auth.ok,'UNAUTHORIZED',401);
      const {id:user} = await auth.json();
      need(typeof user === 'string' && /^[0-9a-f-]{36}$/i.test(user),'UNAUTHORIZED',401);
      const raw = await req.text();
      need(raw.length <= 24000,'REQUEST_TOO_LARGE',413);
      let input;
      try {input = JSON.parse(raw);} catch {throw new CalendarError('INVALID_REQUEST');}
      need(input && typeof input === 'object');
      if (input.action === 'status') {
        if (!configured()) return reply({configured:false,connected:false});
        const row = await saved(user);
        return reply({configured:true,connected:Boolean(row),email:row?.email || ''});
      }
      need(configured(),'NOT_CONFIGURED',503);
      if (input.action === 'connect') {
        const state = b64(crypto.getRandomValues(new Uint8Array(32)));
        const verifier = b64(crypto.getRandomValues(new Uint8Array(32)));
        await db(`google_calendar_oauth_states?user_id=eq.${user}`,'DELETE');
        await db(`google_calendar_oauth_states?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`,'DELETE');
        await db('google_calendar_oauth_states','POST',{state_hash:await hash(state),user_id:user,verifier:await encrypt(verifier,user),origin,expires_at:new Date(Date.now()+600000).toISOString()});
        const query = new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:`${origin}/google-callback.html`,response_type:'code',scope:SCOPES.join(' '),access_type:'offline',prompt:'consent select_account',state,code_challenge:await hash(verifier),code_challenge_method:'S256'});
        return reply({url:`https://accounts.google.com/o/oauth2/v2/auth?${query}`,state});
      }
      if (input.action === 'exchange') {
        need(typeof input.state === 'string' && input.state.length === 43 && typeof input.code === 'string' && input.code.length < 4096);
        const states = await db('rpc/consume_google_calendar_state','POST',{p_hash:await hash(input.state),p_user:user});
        need(states.length === 1 && states[0].origin === origin,'INVALID_STATE');
        const result = await token({grant_type:'authorization_code',code:input.code,redirect_uri:`${origin}/google-callback.html`,code_verifier:await decrypt(states[0].verifier,user)});
        const granted = new Set((result.scope || '').split(' '));
        need(SCOPES.filter(s=>s.startsWith('https://')).every(s=>granted.has(s)),'MISSING_SCOPE',403);
        need(result.refresh_token,'RECONNECT_REQUIRED',401);
        const identity = await request('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${result.access_token}`}});
        need(identity.ok,'GOOGLE_UNAVAILABLE',502);
        const person = await identity.json();
        need(person.email && person.email_verified,'GOOGLE_PERMISSION',403);
        await store(user,{access_token:result.access_token,refresh_token:result.refresh_token,expires_at:Date.now()+result.expires_in*1000},person.email);
        return reply({connected:true,email:person.email});
      }
      if (input.action === 'disconnect') {
        const row = await saved(user);
        if (row) {
          const credentials = await decrypt(row.credentials,user);
          const revoked = await request('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:credentials.refresh_token})});
          need(revoked.ok || revoked.status === 400,'GOOGLE_UNAVAILABLE',502);
          await db(`google_calendar_connections?user_id=eq.${user}`,'DELETE');
        }
        await db(`google_calendar_oauth_states?user_id=eq.${user}`,'DELETE');
        return reply({connected:false});
      }
      const accessToken = await access(user);
      if (input.action === 'calendars') {
        const calendars = await pages(accessToken,'users/me/calendarList',{maxResults:'250',minAccessRole:'reader'});
        return reply({calendars:calendars.filter(c=>!c.deleted).map(c=>({id:c.id,name:c.summaryOverride || c.summary,primary:Boolean(c.primary),selected:Boolean(c.selected),color:c.backgroundColor,timeZone:c.timeZone,accessRole:c.accessRole}))});
      }
      need(typeof input.calendarId === 'string' && input.calendarId.length > 0 && input.calendarId.length <= 1024);
      const calendarPath = `calendars/${encodeURIComponent(input.calendarId)}`;
      if (input.action === 'events') {
        const start = Date.parse(input.timeMin), end = Date.parse(input.timeMax);
        need(Number.isFinite(start) && Number.isFinite(end) && end > start && end - start <= 100*86400000);
        const events = await pages(accessToken,`${calendarPath}/events`,{timeMin:new Date(start).toISOString(),timeMax:new Date(end).toISOString(),singleEvents:'true',orderBy:'startTime',showDeleted:'false',maxResults:'2500'});
        return reply({events:events.filter(e=>e.status !== 'cancelled').map(e=>({id:e.id,etag:e.etag,title:e.summary || '(제목 없음)',notes:e.description || '',location:e.location || '',start:e.start,end:e.end,recurring:Boolean(e.recurringEventId),htmlLink:e.htmlLink,editable:e.eventType === 'default' || !e.eventType,eventType:e.eventType || 'default'}))});
      }
      if (input.action === 'create' || input.action === 'update') {
        const calendar = await google(accessToken,`users/me/calendarList/${encodeURIComponent(input.calendarId)}`);
        need(['owner','writer'].includes(calendar.accessRole),'READ_ONLY_CALENDAR',403);
        const event = input.event;
        need(event && typeof event.title === 'string' && event.title.trim().length > 0 && event.title.length <= 1000);
        need(typeof event.notes === 'string' && event.notes.length <= 8192 && typeof event.location === 'string' && event.location.length <= 1024);
        const endpoint = value => {
          need(value && typeof value === 'object');
          if (typeof value.date === 'string') {
            need(/^\d{4}-\d{2}-\d{2}$/.test(value.date) && new Date(value.date).toISOString().slice(0,10) === value.date);
            return {date:value.date};
          }
          need(typeof value.dateTime === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value.dateTime) && Number.isFinite(Date.parse(value.dateTime)));
          return {dateTime:value.dateTime};
        };
        const start = endpoint(event.start), end = endpoint(event.end);
        need(Boolean(start.date) === Boolean(end.date) && Date.parse(end.date || end.dateTime) > Date.parse(start.date || start.dateTime));
        const payload = {summary:event.title.trim(),description:event.notes,location:event.location,start,end};
        if (input.action === 'create') {
          need(typeof input.eventId === 'string' && /^[0-9a-f]{32}$/.test(input.eventId));
          // Client-generated IDs make retries after a lost response idempotent.
          try {
            const result = await google(accessToken,`${calendarPath}/events?sendUpdates=all`,'POST',{...payload,id:input.eventId,extendedProperties:{private:{portalRequest:input.eventId}}});
            return reply({id:result.id});
          } catch(error) {
            if (error.message !== 'EVENT_EXISTS') throw error;
            const existing = await google(accessToken,`${calendarPath}/events/${input.eventId}`);
            need(existing.extendedProperties?.private?.portalRequest === input.eventId,'EVENT_EXISTS',409);
            const sameTime = (a,b) => a?.date ? a.date === b?.date : Date.parse(a?.dateTime) === Date.parse(b?.dateTime);
            need(existing.summary === payload.summary && (existing.description || '') === payload.description && (existing.location || '') === payload.location && sameTime(existing.start,start) && sameTime(existing.end,end),'EVENT_CHANGED',412);
            return reply({id:existing.id});
          }
        }
        need(typeof input.eventId === 'string' && /^[a-zA-Z0-9_-]{1,1024}$/.test(input.eventId) && typeof input.etag === 'string' && input.etag.length <= 256);
        const eventPath = `${calendarPath}/events/${encodeURIComponent(input.eventId)}`;
        const existing = await google(accessToken,eventPath);
        need(!existing.eventType || existing.eventType === 'default','UNSUPPORTED_EVENT',409);
        need(existing.etag === input.etag,'EVENT_CHANGED',412);
        // Patch only editable fields; attendees, recurrence and conferencing stay intact.
        const result = await google(accessToken,`${eventPath}?sendUpdates=all`,'PATCH',payload,input.etag);
        return reply({id:result.id});
      }
      throw new CalendarError('INVALID_REQUEST');
    } catch(error) {
      // Never log provider responses, authorization codes, tokens, or event contents.
      return reply({error:error instanceof CalendarError ? error.message : 'SERVICE_UNAVAILABLE'},error instanceof CalendarError ? error.status : 503);
    }
  };
}

if (typeof Deno !== 'undefined') Deno.serve(createHandler(Deno.env.toObject()));

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {occursOn,eventFields,eventPayload} from '../google-calendar-core.js';
process.env.TZ='Asia/Seoul';
const allDay={start:{date:'2026-09-13'},end:{date:'2026-09-15'}};
assert.ok(occursOn(allDay,'2026-09-13'));assert.ok(occursOn(allDay,'2026-09-14'));assert.equal(occursOn(allDay,'2026-09-15'),false);
const overnight={start:{dateTime:'2026-09-13T23:00:00+09:00'},end:{dateTime:'2026-09-14T01:00:00+09:00'}};
assert.ok(occursOn(overnight,'2026-09-13'));assert.ok(occursOn(overnight,'2026-09-14'));
assert.equal(occursOn({start:overnight.start,end:{dateTime:'2026-09-14T00:00:00+09:00'}},'2026-09-14'),false);
assert.equal(eventFields(overnight).startTime,'23:00');assert.equal(eventFields(allDay).endDate,'2026-09-14');
const fields={title:'New',notes:'',location:'',startDate:'2026-09-13',endDate:'2026-09-14',startTime:'23:00',endTime:'01:00',allDay:false};
assert.equal(eventPayload(fields).start.dateTime,'2026-09-13T14:00:00.000Z');
assert.equal(eventPayload({...fields,allDay:true}).end.date,'2026-09-15');
assert.throws(()=>eventPayload({...fields,endDate:'2026-09-12'}));
process.env.TZ='America/New_York';
assert.throws(()=>eventPayload({...fields,startDate:'2026-03-08',endDate:'2026-03-08',startTime:'02:30',endTime:'04:00'}));
process.env.TZ='Asia/Seoul';

const source=await readFile(new URL('../supabase/functions/google-calendar/index.ts',import.meta.url),'utf8');
const {createHandler}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const user='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-secret',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'google-secret',CALENDAR_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64url')};
const connections=[],states=[],writes=[];let etag='"v1"',refreshes=0,pages=0;
const scopes='openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
async function fake(url,options={}) {
  const u=new URL(url),method=options.method || 'GET';
  if(u.pathname==='/auth/v1/user')return options.headers.Authorization==='Bearer bad' ? json({},401) : json({id:options.headers.Authorization==='Bearer other' ? other : user});
  if(u.pathname.startsWith('/rest/v1/')) {
    assert.equal(options.headers.apikey,'server-secret');
    const table=u.pathname.split('/').at(-1),body=options.body ? JSON.parse(options.body) : null;
    if(table==='consume_google_calendar_state') {
      const index=states.findIndex(s=>s.state_hash===body.p_hash && s.user_id===body.p_user && Date.parse(s.expires_at)>Date.now());
      return json(index<0 ? [] : states.splice(index,1));
    }
    const rows=table==='google_calendar_connections' ? connections : states;
    const matched=row=>[...u.searchParams].filter(([key])=>!['select','on_conflict'].includes(key)).every(([key,value])=>value.startsWith('eq.') ? row[key]===value.slice(3) : value.startsWith('lt.') ? row[key]<value.slice(3) : true);
    if(method==='GET')return json(rows.filter(matched));
    if(method==='DELETE'){const deleted=rows.filter(matched);for(const row of deleted)rows.splice(rows.indexOf(row),1);return json(deleted);}
    if(method==='PATCH'){const updated=rows.filter(matched);updated.forEach(row=>Object.assign(row,body));return json(updated);}
    if(method==='POST'){const old=rows.findIndex(row=>row.user_id===body.user_id);if(table==='google_calendar_connections' && old>=0)rows[old]=body;else rows.push(body);return json([body]);}
  }
  if(url==='https://oauth2.googleapis.com/token') {
    const params=new URLSearchParams(options.body);assert.equal(params.get('client_secret'),'google-secret');
    if(params.get('grant_type')==='refresh_token')refreshes++;
    return json({access_token:'access-private',refresh_token:'refresh-private',expires_in:0,scope:scopes});
  }
  if(url==='https://openidconnect.googleapis.com/v1/userinfo')return json({email:'calendar@example.com',email_verified:true});
  if(url==='https://oauth2.googleapis.com/revoke')return json({});
  if(u.pathname.endsWith('/calendarList')) {
    assert.equal(u.searchParams.get('showHidden'),'true');assert.equal(u.searchParams.get('minAccessRole'),'reader');
    return json(u.searchParams.has('pageToken') ? {items:[{id:'kr',summary:'KR 실적발표',hidden:true,accessRole:'reader'},{id:'deleted',deleted:true}]} : {items:[{id:'a@example.com',summary:'Main',accessRole:'owner',primary:true},{id:'us',summary:'US 실적발표',selected:false,accessRole:'reader'}],nextPageToken:'calendars2'});
  }
  if(u.pathname.includes('/calendarList/'))return json({accessRole:u.pathname.endsWith('/read') ? 'reader' : 'owner'});
  if(u.pathname.includes('/events')) {
    if(method==='POST' || method==='PATCH'){writes.push({url,method,headers:options.headers,body:JSON.parse(options.body)});return json({id:'created'});}
    if(u.pathname.endsWith('/event1'))return json({etag,eventType:'default',attendees:[{email:'untouched@example.com'}]});
    pages++;return json({items:[{id:String(pages),start:allDay.start,end:allDay.end,eventType:'default'}],...(u.searchParams.has('pageToken') ? {} : {nextPageToken:'page2'})});
  }
  throw new Error('Unexpected URL '+url);
}
const handler=createHandler(env,fake);
async function call(body,{origin='https://seungmin.xyz',token='valid'}={}) {
  const response=await handler(new Request('https://test.supabase.co/functions/v1/google-calendar',{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${token}`},body:JSON.stringify(body)}));
  assert.equal(response.headers.get('Cache-Control'),'no-store');return {status:response.status,...await response.json()};
}
assert.equal((await call({action:'status'},{token:'bad'})).status,401);
assert.equal((await call({action:'status'},{origin:'https://evil.example'})).status,403);
assert.equal((await call({action:'status'})).connected,false);
const auth=await call({action:'connect'});
assert.equal(auth.status,200);assert.equal(states.length,1);assert.notEqual(states[0].state_hash,auth.state);assert.ok(!states[0].verifier.includes('access-private'));
const authUrl=new URL(auth.url);assert.equal(authUrl.searchParams.get('redirect_uri'),'https://seungmin.xyz/google-callback.html');assert.equal(authUrl.searchParams.get('code_challenge_method'),'S256');
assert.equal((await call({action:'exchange',state:auth.state,code:'code'},{token:'other'})).error,'INVALID_STATE');assert.equal(states.length,1);
assert.equal((await call({action:'exchange',state:auth.state,code:'code'})).status,200);assert.equal(states.length,0);
assert.ok(!JSON.stringify(connections).includes('refresh-private'));assert.ok(!JSON.stringify(connections).includes('access-private'));
assert.equal((await call({action:'exchange',state:auth.state,code:'code'})).error,'INVALID_STATE');
assert.equal((await call({action:'status'})).email,'calendar@example.com');assert.equal((await call({action:'status'},{token:'other'})).connected,false);
const calendarList=(await call({action:'calendars'})).calendars;
assert.deepEqual(calendarList.map(c=>c.id),['a@example.com','us','kr']);assert.equal(calendarList[2].accessRole,'reader');assert.ok(refreshes>0);
const listing=await call({action:'events',calendarId:'a@example.com',timeMin:'2026-09-01T00:00:00Z',timeMax:'2026-10-01T00:00:00Z'});
assert.equal(listing.events.length,2);assert.equal(pages,2);assert.ok(!JSON.stringify(listing).includes('access-private'));
assert.equal((await call({action:'events',calendarId:'a',timeMin:'invalid',timeMax:'invalid'})).error,'INVALID_REQUEST');
const payload=eventPayload(fields),eventId='a'.repeat(32);
assert.equal((await call({action:'create',calendarId:'read',eventId,event:payload})).error,'READ_ONLY_CALENDAR');
assert.equal((await call({action:'create',calendarId:'a@example.com',eventId,event:payload})).status,200);
assert.equal(writes.at(-1).body.id,eventId);assert.equal(writes.at(-1).body.extendedProperties.private.portalRequest,eventId);
assert.equal((await call({action:'update',calendarId:'a@example.com',eventId:'event1',etag:'"stale"',event:payload})).error,'EVENT_CHANGED');
assert.equal((await call({action:'update',calendarId:'a@example.com',eventId:'event1',etag,event:payload})).status,200);
assert.equal(writes.at(-1).method,'PATCH');assert.equal(writes.at(-1).headers['If-Match'],etag);assert.equal(writes.at(-1).body.attendees,undefined);assert.equal(writes.at(-1).body.recurrence,undefined);
assert.equal((await call({action:'disconnect'})).connected,false);assert.equal(connections.length,0);
console.log('PASS: exclusive all-day dates, overnight/timezone/DST, auth, origin, encrypted storage, OAuth user binding/replay, refresh, pagination, read-only permissions, idempotency IDs and conflict-safe patch.');

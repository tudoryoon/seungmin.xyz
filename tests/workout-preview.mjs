import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {parseAvatar} from '../avatar.js';
import {dailyFixture} from './daily-fixture.mjs';
const root = new URL('../', import.meta.url);
const day = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const user = {id:'workout-test',email:'test@example.com',user_metadata:{realm_profile:{version:1,name:'테스트',age:30,gender:'unspecified',mbti:'',blood:''},realm_avatar:parseAvatar('청록색 도포를 입은 도사. 지팡이.')}};
const rows = Array.from({length:12}, (_, index) => {
  const date = index < 3 ? day : `${day.slice(0,7)}-${String(index + 1).padStart(2,'0')}`;
  const type = ['런닝','케틀벨 스윙','푸시업'][index % 3];
  const record = {id:`fixture-${index}`,kind:'workout',type,date,title:type,duration:30,notes:'',completed:index % 4 !== 2};
  return {user_id:user.id,id:record.id,kind:record.kind,date,title:type,payload:record};
});
const auth = `
window.realmError=e=>e.message;
let user=${JSON.stringify(user)},rows=${JSON.stringify(rows)};
const callbacks=[];
const query=()=>{let operation='read',value,id;return {select(){return this},eq(key,v){if(key==='id')id=v;return this},order(){return this},range(){return this},upsert(v){operation='save';value=v;return this},delete(){operation='delete';return this},then(resolve){if(operation==='save'){rows=rows.filter(r=>r.id!==value.id).concat(value)}if(operation==='delete')rows=rows.filter(r=>r.id!==id);resolve({data:rows,error:null})}}};
window.realmClient={from:query,rpc:async()=>({data:${JSON.stringify(dailyFixture())}}),functions:{invoke:async()=>({data:{configured:true,connected:false}})},auth:{
getSession:async()=>({data:{session:{user,access_token:'fixture'}}}),getUser:async()=>({data:{user}}),
updateUser:async({data})=>{user={...user,user_metadata:{...user.user_metadata,...data}};callbacks.forEach(cb=>cb('USER_UPDATED',{user}));return {data:{user}}},
onAuthStateChange(callback){callbacks.push(callback);queueMicrotask(()=>callback('INITIAL_SESSION',{user}));return {data:{subscription:{unsubscribe(){}}}}}
}};`;
const types = {js:'text/javascript',css:'text/css',html:'text/html',png:'image/png',svg:'image/svg+xml',ico:'image/x-icon',webp:'image/webp',webmanifest:'application/manifest+json'};
createServer(async (req,res) => {
  try {
    const path = new URL(req.url,'http://local').pathname, file = new URL('.'+path,root);
    if (!file.href.startsWith(root.href) || path.includes('/.')) throw Error('path');
    const data = path === '/auth-client.js' ? auth : await readFile(file);
    res.writeHead(200, {'Content-Type':types[path.split('.').pop()] || 'application/octet-stream','Cache-Control':'no-store'}); res.end(data);
  } catch {res.writeHead(404);res.end();}
}).listen(4179,'127.0.0.1',()=>console.log('Mock workout preview: http://127.0.0.1:4179/test.html#workout'));

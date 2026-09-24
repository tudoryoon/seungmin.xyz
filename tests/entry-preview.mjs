import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {parseAvatar} from '../avatar.js';
import {dailyFixture} from './daily-fixture.mjs';
import {emptyFeed,sampleFeed} from './substack-fixture.mjs';
const root=new URL('../',import.meta.url);
const user={id:'entry-fixture',email:'preview@example.com',user_metadata:{realm_profile:{version:1,name:'테스트',age:30,gender:'unspecified',mbti:'',blood:''},realm_avatar:parseAvatar('청록색 도포를 입은 도사')}};
const auth=`const user=${JSON.stringify(user)};let signed=new URLSearchParams(location.search).has('signed');const callbacks=[];window.realmError=()=> '이메일 또는 비밀번호를 확인해 주세요.';window.realmClient={auth:{onAuthStateChange(cb){callbacks.push(cb);return {data:{subscription:{unsubscribe(){}}}}},getSession:async()=>({data:{session:signed?{user}:null}}),signInWithPassword:async({password})=>{if(password==='wrong-password')return {error:{message:'Invalid login credentials'}};signed=true;callbacks.forEach(cb=>cb('SIGNED_IN',{user}));return {data:{session:{user},user}}},signOut:async()=>{signed=false;callbacks.forEach(cb=>cb('SIGNED_OUT',null));return {}}},rpc:async()=>({data:${JSON.stringify(dailyFixture())}})};`;
const types={html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css',webp:'image/webp',png:'image/png',svg:'image/svg+xml',ico:'image/x-icon',webmanifest:'application/manifest+json'};
const faults=`if(new URLSearchParams(location.search).has('no-gpu')){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};}`;
let failedOnce=false;
createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://local'),path=url.pathname==='/'?'/index.html':url.pathname,file=new URL('.'+path,root);
  if(path==='/api/substack'){
    const mode=new URL(req.headers.referer||'http://local').searchParams.get('feed');
    const fail=mode==='error'||mode==='retry'&&!failedOnce;if(fail)failedOnce=true;
    res.writeHead(fail?502:200,{'Content-Type':'application/xml','Cache-Control':'no-store'});
    res.end(fail?'Unavailable':mode==='empty'?emptyFeed:mode==='invalid'?'<html>invalid</html>':sampleFeed);return;
  }
  if(!file.href.startsWith(root.href)||path.includes('/.'))throw new Error('path');
  const data=path==='/auth-client.js'?faults+auth:await readFile(file);
  res.writeHead(200,{'Content-Type':types[path.split('.').pop()]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
}catch{res.writeHead(404);res.end();}}).listen(4181,'127.0.0.1',()=>console.log('Local-only entrance fixture: http://127.0.0.1:4181/'));

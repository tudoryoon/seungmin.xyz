import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {parseAvatar} from '../avatar.js';
import {dailyFixture} from './daily-fixture.mjs';
import {emptyFeed,sampleFeed} from './substack-fixture.mjs';
const root=new URL('../',import.meta.url);
const user={id:'entry-fixture',email:'preview@example.com',user_metadata:{realm_profile:{version:1,name:'테스트',age:30,gender:'unspecified',mbti:'',blood:''},realm_avatar:parseAvatar('청록색 도포를 입은 도사')}};
const auth=`const user=${JSON.stringify(user)};let signed=new URLSearchParams(location.search).has('signed');const callbacks=[];window.realmError=()=> '이메일 또는 비밀번호를 확인해 주세요.';window.realmClient={auth:{onAuthStateChange(cb){callbacks.push(cb);return {data:{subscription:{unsubscribe(){}}}}},getSession:async()=>({data:{session:signed?{user}:null}}),signInWithPassword:async({password})=>{if(password==='wrong-password')return {error:{message:'Invalid login credentials'}};signed=true;callbacks.forEach(cb=>cb('SIGNED_IN',{user}));return {data:{session:{user},user}}},signOut:async()=>{signed=false;callbacks.forEach(cb=>cb('SIGNED_OUT',null));return {}}},rpc:async()=>({data:${JSON.stringify(dailyFixture())}})};`;
const types={html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css',webp:'image/webp',png:'image/png',svg:'image/svg+xml',ico:'image/x-icon',webmanifest:'application/manifest+json'};
const faults=`if(new URLSearchParams(location.search).has('no-gpu')){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};}else if(new URLSearchParams(location.search).has('capture-depth')){
const original=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(type,options){
  const capture=this.className==='subway-depth'&&type.startsWith('webgl');
  const gl=original.call(this,type,capture?{...options,preserveDrawingBuffer:true}:options);
  if(capture&&gl&&!this.dataset.pixelProbe){
    const canvas=this,draw=gl.drawElementsInstanced.bind(gl);let queued=false;
    canvas.dataset.pixelProbe='active';
    gl.drawElementsInstanced=function(...args){const result=draw(...args);if(!queued){queued=true;queueMicrotask(()=>{
      queued=false;const pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let painted=0,colored=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]){painted++;if(Math.max(pixels[i],pixels[i+1],pixels[i+2])-Math.min(pixels[i],pixels[i+1],pixels[i+2])>20)colored++;}}
      canvas.dataset.paintedPixels=String(painted);canvas.dataset.coloredPixels=String(colored);canvas.dataset.renderCount=String(Number(canvas.dataset.renderCount||0)+1);
    });}return result;};
  }return gl;
};}`;
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

import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {parseAvatar,DEFAULT_PROMPT} from '../avatar.js';
import {dailyFixture} from './daily-fixture.mjs';
import {STATIONS} from '../stations.js';
const root=new URL('../',import.meta.url);
const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const yesterday=new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10);
const user={id:'history-fixture',email:'test@example.com',user_metadata:{realm_profile:{version:1,name:'테스트',age:30,gender:'unspecified',mbti:'',blood:''},realm_avatar:parseAvatar(DEFAULT_PROMPT)}};
const history=[{id:'old-one',day:yesterday,title:'런닝 30분',completed_at:yesterday+'T10:00:00Z',position:0},{id:'old-two',day:yesterday,title:'책 읽기',completed_at:null,position:1}];
const seedChoices=STATIONS.slice(0,2).map((station,index)=>({station_id:station.id,station_name:station.name,lines:station.lines,day:yesterday,selected_at:yesterday+`T0${index}:00:00Z`}));
const seedCancellations=[{station_id:'fixture-old',station_name:'동대문역사문화공원',lines:['2호선','4호선','5호선'],day:yesterday,selected_at:yesterday+'T00:00:00Z',cancelled_at:day+'T01:30:00Z'}];
const auth=`window.realmError=e=>e.message;const user=${JSON.stringify(user)},past=${JSON.stringify(history)};let plan=${JSON.stringify(dailyFixture())};plan.day=${JSON.stringify(day)};plan.tasks=[{id:'today-one',title:'케틀벨 스윙',completed:false}];
const read=()=>JSON.parse(localStorage.getItem('history-preview-choices')||${JSON.stringify(JSON.stringify(seedChoices))});
const readCancelled=()=>JSON.parse(localStorage.getItem('history-preview-cancellations')||${JSON.stringify(JSON.stringify(seedCancellations))});
const query=table=>({select(){return this},eq(){return this},order(){return this},range(){return this},gte(){return this},lt(){return this},limit(){return this},then(resolve){resolve({data:table==='roulette_choices'?read():table==='roulette_cancellations'?readCancelled():table==='daily_tasks'?past:[],error:null})}});
window.realmClient={from:query,functions:{invoke:async()=>({data:{configured:true,connected:false}})},rpc:async(name,args)=>{
 if(name==='roulette_cancel'){const choices=read(),choice=choices.find(c=>c.station_id===args.p_station_id&&c.selected_at===args.p_selected_at);if(!choice)return {error:{message:'CHOICE_CHANGED'}};const row={...choice,cancelled_at:new Date().toISOString()};localStorage.setItem('history-preview-cancellations',JSON.stringify([...readCancelled(),row]));localStorage.setItem('history-preview-choices',JSON.stringify(choices.filter(c=>c!==choice)));return {data:row};}
 if(name==='roulette_choose'){const choices=read();let row=choices.find(c=>c.station_id===args.p_station_id);if(!row){row={station_id:args.p_station_id,station_name:args.p_station_name,lines:args.p_lines,day:${JSON.stringify(day)},selected_at:new Date().toISOString()};choices.push(row);localStorage.setItem('history-preview-choices',JSON.stringify(choices));}return {data:row};}
 if(name==='daily_plan_update'){if(args.p_action==='save')plan.tasks=args.p_tasks.map(t=>({...t,completed:false}));if(args.p_action==='check')plan.tasks.find(t=>t.id===args.p_task_id).completed=args.p_completed;plan.revision++;}return {data:plan};
},auth:{getSession:async()=>({data:{session:{user,access_token:'fixture'}}}),getUser:async()=>({data:{user}}),onAuthStateChange(cb){queueMicrotask(()=>cb('INITIAL_SESSION',{user}));return {data:{subscription:{unsubscribe(){}}}}}}};`;
const types={js:'text/javascript',css:'text/css',html:'text/html',png:'image/png',svg:'image/svg+xml',ico:'image/x-icon',webp:'image/webp',webmanifest:'application/manifest+json'};
const port=Number(process.env.PORT||4180);
createServer(async(req,res)=>{try{const url=new URL(req.url,'http://local'),path=url.pathname,file=new URL('.'+path,root);if(!file.href.startsWith(root.href)||path.includes('/.'))throw Error('path');const data=path==='/auth-client.js'?auth:await readFile(file);res.writeHead(200,{'Content-Type':types[path.split('.').pop()]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end();}}).listen(port,'127.0.0.1',()=>console.log(`Mock history preview: http://127.0.0.1:${port}/roulette.html`));

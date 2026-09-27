// Synthetic test records only. No private Notion text is shipped in test fixtures.
const entities = [
  {id:'pltr',name:'PLTR',type:'company',aliases:['팔란티어']},
  {id:'nvda',name:'NVDA',type:'company',aliases:['NVIDIA','엔비디아']},
  {id:'adoption',name:'AI 도입',type:'topic',aliases:['AX']}
];
const rows = [
  ['fde-20260922','FDE 전성시대','2026-09-22',['pltr','adoption']],
  ['jev-20260923','JEV 모델 스터디','2026-09-23',['adoption']],
  ['diary-20260913','일기 테스트','2026-09-13',[]],
  ['nvda-202608','NVDA 테스트','2026-08-26',['nvda']],
  ['saas-202608','산업 테스트','2026-08-11',['adoption']],
  ['pltr','PLTR · 도입의 병목',null,['pltr','adoption']]
];
const records=rows.map(([id,title,date,ids])=>({
  id,title,kind:'study',source:{title,url:'https://example.com/'+id},date:{start:date,precision:date?'day':'unknown',basis:'테스트 날짜'},path:['테스트'],entities:ids,
  summary:'실제 연구가 아닌 UI 테스트입니다.',question:'테스트 질문?',state:'검토 중',
  sections:[{id:'implementation',label:'테스트 문단',text:'실제 사용자 기록이 아닙니다.'}],questions:['테스트 질문']
}));
records[4].date={start:'2026-08-11',end:'2026-08-20',precision:'approximate',label:'2026.08 중순',basis:'테스트'};
const relation=(id,from,to,status)=>({id,from,to,status,type:'question',label:'테스트 연결',reason:'테스트용 근거입니다.',evidence:[{record:from,section:'implementation'},{record:to,section:'implementation'}]});
export default {version:1,capturedAt:'2026-09-27',mode:'fixture',entities,records,relations:[relation('pltr-fde','pltr','fde-20260922','editorial'),relation('fde-jev','fde-20260922','jev-20260923','suggested')]};

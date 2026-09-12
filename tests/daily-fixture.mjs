export function dailyFixture() {
  const now = new Date();
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  return {day,server_now:now.toISOString(),ends_at:new Date(Date.parse(day+'T00:00:00+09:00')+86400000).toISOString(),
    revision:1,level:1,awarded:false,tasks:[{id:'10000000-0000-4000-8000-000000000001',title:'Fixture task',completed:false}]};
}

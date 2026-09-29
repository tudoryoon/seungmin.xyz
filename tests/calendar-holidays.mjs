import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {Window}=await import(process.env.DOM_MODULE || 'happy-dom');
const w=new Window({url:'https://seungmin.xyz/test.html#calendar',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
const $=id=>w.document.getElementById(id);
try {
  w.document.write(await readFile(new URL('../test.html',import.meta.url),'utf8'));
  w.lucide={createIcons(){}};
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  const records=[{id:'fixture',kind:'event',title:'휴일 약속',date:'2026-10-03',start:'12:00'}];
  w.localStorage.setItem('seungmin-journal-v1',JSON.stringify(records));
  for(const file of ['workout.js','calendar-holidays.js','journal.js','notebook.js'])
    w.eval(await readFile(new URL('../'+file,import.meta.url),'utf8'));
  const holidays=w.calendarHolidays;
  assert.equal(holidays.forDate('2025-05-05'),'어린이날 · 부처님오신날');
  assert.equal(holidays.forDate('2025-01-27'),'임시공휴일');
  assert.equal(holidays.forDate('2025-06-03'),'대통령선거');
  assert.equal(holidays.forDate('2026-06-03'),'전국동시지방선거');
  for(const date of ['2026-09-28','2026-06-08','2027-06-07','2025-05-01','2025-07-17'])
    assert.equal(holidays.forDate(date),'',`${date} must not acquire an invented holiday`);
  for(const year of [2026,2027]) {
    assert.equal(holidays.forDate(`${year}-05-01`),'노동절');
    assert.equal(holidays.forDate(`${year}-07-17`),'제헌절');
  }
  for(const date of ['2026-03-02','2026-05-25','2026-08-17','2026-10-05','2027-02-09','2027-05-03','2027-07-19','2027-08-16','2027-10-04','2027-10-11','2027-12-27'])
    assert.match(holidays.forDate(date),/^대체공휴일/);
  // KASA's yearly total including Sundays catches both omitted and excess days.
  for(const [year,expected] of [[2025,70],[2026,72],[2027,72]]) {
    let daysOff=0;
    for(let m=1;m<=12;m++) for(let d=1;d<=new Date(Date.UTC(year,m,0)).getUTCDate();d++) {
      const key=`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if(holidays.forDate(key)||new Date(Date.UTC(year,m-1,d)).getUTCDay()===0) daysOff++;
    }
    assert.equal(daysOff,expected,`${year} nationwide holidays and Sundays`);
  }
  w.journalCalendar.selectDate('2026-10-03');
  const day=key=>$('month-grid').querySelector(`[data-date="${key}"]`);
  assert.ok(day('2026-10-03').matches('.is-saturday.is-holiday.selected'));
  assert.equal(day('2026-10-03').getAttribute('aria-label'),'2026-10-03, 일정 1개, 개천절');
  assert.equal(day('2026-10-03').querySelector('.day-count').textContent,'1건','holidays do not inflate event counts');
  assert.equal($('event-list').querySelectorAll('.record').length,1);
  assert.ok(day('2026-10-10').matches('.is-saturday:not(.is-holiday)'));
  assert.ok(day('2026-10-04').matches('.is-sunday'));
  assert.ok(day('2026-10-05').matches('.is-holiday:not(.is-saturday):not(.is-sunday)'));
  assert.equal(day('2026-10-05').querySelector('.day-holiday').textContent,'대체공휴일');
  day('2026-10-05').click();
  assert.equal($('selected-holiday').textContent,'대체공휴일 (개천절)');
  assert.equal($('selected-holiday').hidden,false);
  $('notebook-mode').click();
  assert.ok($('selected-holiday').closest('#notebook-agenda-slot'),'full holiday label follows the agenda into the notebook');
  assert.ok($('selected-date').classList.contains('is-holiday'));
  $('calendar-mode').click();
  w.journalCalendar.selectDate('2026-09-26');
  assert.ok(day('2026-09-26').matches('.is-saturday.is-holiday'));
  day('2026-09-28').click();
  assert.equal($('selected-holiday').hidden,true);
  assert.equal($('selected-holiday').textContent,'');
  assert.equal($('selected-date').className,'');
  w.journalCalendar.selectDate('2028-02-29');
  assert.equal($('calendar-holiday-coverage').hidden,false);
  assert.match($('calendar-holiday-coverage').textContent,/2028년/);
  assert.ok(day('2028-02-26').matches('.is-saturday:not(.is-holiday)'));
  w.journalCalendar.selectDate('2027-02-09');
  assert.equal($('calendar-holiday-coverage').hidden,true);
  assert.equal($('selected-holiday').textContent,'대체공휴일 (설날)');
  assert.equal(w.localStorage.getItem('seungmin-journal-v1'),JSON.stringify(records),'date navigation leaves stored events intact');
  console.log('PASS: official holiday totals, overlap/substitute exceptions, weekend classes, event counts, accessible labels, notebook details and unsupported-year notice.');
} finally {await w.happyDOM.close();}

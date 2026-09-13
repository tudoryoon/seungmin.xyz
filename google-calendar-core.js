export const ERRORS = {
  NOT_CONFIGURED:'Google 연동 설정이 아직 완료되지 않았습니다.',
  UNAUTHORIZED:'다시 로그인해 주세요.', NOT_CONNECTED:'Google 계정을 연결해 주세요.',
  RECONNECT_REQUIRED:'Google 연결이 만료되었습니다. 다시 연결해 주세요.',
  MISSING_SCOPE:'캘린더 목록과 일정 접근 권한을 모두 허용해 주세요.',
  GOOGLE_PERMISSION:'Google 캘린더 접근 권한을 확인해 주세요.',
  READ_ONLY_CALENDAR:'이 캘린더는 읽기 전용입니다.',
  EVENT_CHANGED:'Google에서 변경된 일정입니다. 창을 닫고 새로고침한 뒤 다시 수정해 주세요.',
  EVENT_NOT_FOUND:'Google에서 삭제되었거나 접근할 수 없는 일정입니다.',
  INVALID_STATE:'연결 요청이 만료되었습니다. 다시 연결해 주세요.',
  TOO_MANY_EVENTS:'일정이 너무 많아 불러오지 못했습니다.',
  RATE_LIMITED:'요청이 많습니다. 잠시 후 다시 시도해 주세요.',
  UNSUPPORTED_EVENT:'이 일정은 Google Calendar에서 수정해 주세요.',
};
export const errorMessage = error => ERRORS[error?.message] || 'Google 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';
export function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function nextDate(value, days = 1) {
  const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate()+days); return localDate(date);
}
export function localTime(date) { return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`; }
export function occursOn(event, date) {
  if (!event.start || !event.end) return false;
  if (event.start.date) return event.start.date <= date && date < event.end.date;
  const start = new Date(`${date}T00:00:00`).getTime();
  const end = new Date(`${nextDate(date)}T00:00:00`).getTime();
  return Date.parse(event.start.dateTime) < end && Date.parse(event.end.dateTime) > start;
}
export function eventFields(event) {
  if (event.start.date) return {startDate:event.start.date,endDate:nextDate(event.end.date,-1),startTime:'09:00',endTime:'10:00',allDay:true};
  const start = new Date(event.start.dateTime), end = new Date(event.end.dateTime);
  return {startDate:localDate(start),endDate:localDate(end),startTime:localTime(start),endTime:localTime(end),allDay:false};
}
export function eventPayload(fields) {
  const title = fields.title.trim();
  if (!title) throw new Error('제목을 입력해 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(fields.endDate)) throw new Error('날짜를 입력해 주세요.');
  let start, end;
  if (fields.allDay) {
    if (fields.endDate < fields.startDate) throw new Error('종료일을 확인해 주세요.');
    start = {date:fields.startDate}; end = {date:nextDate(fields.endDate)};
  } else {
    const startDate = new Date(`${fields.startDate}T${fields.startTime}:00`);
    const endDate = new Date(`${fields.endDate}T${fields.endTime}:00`);
    if (!Number.isFinite(+startDate) || !Number.isFinite(+endDate) || endDate <= startDate) throw new Error('종료 시간은 시작 이후로 입력해 주세요.');
    if (localTime(startDate) !== fields.startTime || localTime(endDate) !== fields.endTime) throw new Error('해당 시간대에 존재하지 않는 시간입니다. 시간을 확인해 주세요.');
    start = {dateTime:startDate.toISOString()}; end = {dateTime:endDate.toISOString()};
  }
  return {title,notes:fields.notes,location:fields.location,start,end};
}

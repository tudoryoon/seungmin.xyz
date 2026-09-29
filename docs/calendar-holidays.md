# 일정관리의 대한민국 공휴일

`calendar-holidays.js`는 2026-09-29에 확인한 **2025~2027년 전국 공휴일**을 수록한다. 토요일은 파랑, 일요일·공휴일은 빨강이며 공휴일 색이 우선한다. 날짜 칸과 선택한 날짜의 일정 목록에 명칭을 표시한다. Google 캘린더나 사용자 일정에는 별도 이벤트를 생성하지 않는다.

## 자료 출처

- [한국천문연구원 / 우주항공청 2025년도 월력요항](https://www.kasi.re.kr/kor/publication/post/newsMaterial/30071)
- [한국천문연구원 2026년 달력자료](https://astro.kasi.re.kr/kor/life/post/calendarData?search_year=2026)
- [한국천문연구원 2027년 달력자료](https://astro.kasi.re.kr/kor/life/post/calendarData?search_year=2027)
- [우주항공청 2027년 월력요항 발표](https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431): 2026년부터 노동절·제헌절 공휴일 지정 반영. 2026년 기존 달력자료보다 이후 발표를 우선한다.
- [정부 정책브리핑: 노동절 공휴일 지정](https://www.korea.kr/news/policyNewsView.do?newsId=148963568)
- [2025년 1월 27일 임시공휴일 지정 국무회의 의결 보도](https://imnews.imbc.com/replay/2025/nw1200/article/6676732_36769.html)
- [정부 정책브리핑: 2025년 6월 3일 대통령선거 및 임시공휴일 지정](https://www.korea.kr/news/policyNewsView.do?newsId=148941443)

## 갱신

공식 월력요항과 이후 정부 발표를 확인해 연도별 날짜 표를 추가·수정하고 `test.html`의 공휴일 스크립트 버전을 올린다. 정적 자료이므로 새로운 임시공휴일 지정은 자동 반영되지 않는다. 지원하지 않는 연도에서는 주말만 색칠하고 공휴일 정보가 없다는 안내를 표시한다. 근무처별 휴무, 지역 한정 공휴일은 포함하지 않는다.

대체공휴일은 단순히 주말 다음 월요일로 계산하지 않는다. 특히 2026년 9월 28일과 현충일 다음 월요일은 대체공휴일이 아니다. 2025년 5월 5일의 겹친 두 공휴일은 하나의 날짜에 함께 표시한다.

검증: `.local/test.ps1 -Tests calendar-holidays,google-calendar-ui,notebook,daily-ui`

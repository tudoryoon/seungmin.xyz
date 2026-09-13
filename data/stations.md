# Roulette Station Snapshot

Retrieved 2026-09-13. Passenger lines 1-9 and Gyeongui-Jungang, including branches outside Seoul. 448 distinct station complexes; each draw samples all 448 with replacement. A transfer does not add weight. The two Sinchon stations and the two Yangpyeong stations remain separate places.

## Sources

- Seoul Metropolitan Government, T-DATA / TAIMS, [지하철역_GEOM (역사마스터)](https://t-data.seoul.go.kr/dataprovide/trafficdataviewfile.do?data_id=36), [CSV attachment 10229](https://t-data.seoul.go.kr/dataprovide/download.do?id=10229). Attribution (BY), modification permitted. Original bytes are in `stations-source.csv`. The provider's update date is not a guarantee that every row is current.
- [KORAIL timetables](https://www.korail.com/com/userBoard.do?mode=list&schBcid=ticketTable): September 1, 2026 schedules cover Gyeongui-Jungang and the Gyeongbu/Janghang/Gyeongin/Gyeongwon/Gwangmyeong services.
- [KORAIL Dorasan station](https://www.korail.com/ticket/train/stationGuide/station/view?stationSeq=10281375): includes the 2026 DMZ service. Dorasan is included in the full-line scope but is a restricted-access, reservation-only destination, not an ordinary daily metro stop. Its result explicitly warns about reservations and operating days. Imjingang and Uncheon also carry a limited-service note.
- [Korea Aerospace University announcement](https://kau.ac.kr/intro/speeches.php?code=s3301&mode=read&page=5&searchkey=&searchvalue=&seq=7487): Hwajeon renamed to Korea Aerospace University in 2023.
- [Seoul Metropolitan Government](https://mediahub.seoul.go.kr/archives/2014269): Jayang (formerly Ttukseom Resort), Buramsan (formerly Danggogae).
- [SR PyeongtaekJije station guide](https://etk.srail.kr/cms/archive.do?pageId=TK0403010300): current station name.

## Normalization

Infrastructure sections are mapped to passenger lines in `scripts/build-stations.rb`. Gyeongwon IDs 1008-1014 belong to Gyeongui-Jungang; the other Gyeongwon stations belong to Line 1. Hoegi and Changdong also carry Line 1. Yongsan and Daegok also carry Gyeongui-Jungang. Duplicate operator records (Jichuk and Line 7 Incheon section) are merged. Chongshin University / Isu is one transfer complex. Subnames in parentheses are omitted except that transfer name. Three stale base names are corrected using the sources above.

Kkachisan also carries Line 2's Sinjeong branch, although the source lists it only under Line 5.

Counts before cross-line transfer deduplication: 1:102, 2:51, 3:44, 4:51, 5:56, 6:39, 7:53, 8:24, 9:38, Gyeongui-Jungang:58. Planned unopened stations are not included. This is a reviewed static snapshot, not a live service-status feed; travel still requires checking current service.

Regenerate after reviewing changes:

```sh
ruby scripts/build-stations.rb data/stations-source.csv stations.js
node tests/roulette.mjs
```

The generator retains source IDs and coordinates and rejects unexpected distant namesakes. New same-name stations or changed operator codes require explicit review. Random selection uses Web Crypto rejection sampling, not line-first selection or modulo-biased sampling. Animation lands on the preselected station; it cannot change the outcome.

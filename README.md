# 김덕만 데바데 통계 사이트 v1.6.2 — 베스트·워스트 픽 동기화

## 문제 원인
- 기존 Google Apps Script의 `picks.favorite`는 `카니발`로 고정되어 있었습니다.
- 사이트의 `BEST PICK`/`WORST PICK`은 API의 `picks` 값으로 이름을 표시합니다.

## 수정 내용
- Apps Script가 `TR!B17`의 베스트 픽, `TR!B23`의 워스트 픽 이름을 읽어 API에 보냅니다.
- 시트 값이 `힐빌리\n16전 ...` 처럼 여러 줄인 경우 첫 줄을 살인마 이름으로 사용합니다.
- 표의 경기 기록은 계속 연도별 시트만 집계하며 TR은 기록으로 합산하지 않습니다.
- 사이트의 오프라인 저장본(`data/records.json`) 베스트 픽도 현재 표시값인 `힐빌리`로 수정했습니다.
- 나머지 대시보드·룰렛·모바일 레이아웃 및 API 주소는 유지합니다.

## 필수: Apps Script 수정·재배포
1. 구글 스프레드시트 → 확장 프로그램 → Apps Script → `KdmStatsAPI.gs` 열기
2. 파일 전체를 `KdmStatsAPI-v4-picks-sync.gs` 내용으로 교체 후 저장
3. `testKdmStats` 실행. 로그에 `picks`가 `favorite: 힐빌리`, `leastFavorite: 트릭스터`인지 확인
4. 배포 → 배포 관리 → 배포 편집(연필) → 새 버전 → 배포
5. 이전과 같은 `/exec` 주소를 사용했다면 `config.js`는 수정하지 않아도 됩니다.

## 선택: GitHub 저장본 갱신
- `dbd-kdm-stats-v1.6.2-github-update.zip`을 압축 해제해 `index.html`, `data/records.json`, `README.md`를 저장소에 업로드/덮어쓰기
- 이것은 API 접속이 안 될 때 표시되는 오프라인 저장본의 베스트 픽을 맞추기 위한 작업입니다.
- **실시간으로 TR의 베스트/워스트 픽을 따라가려면 Apps Script 재배포가 필수**입니다.

## 주의
- `TR!B17`과 `TR!B23`은 병합셀의 왼쪽 위 기준 주소입니다.
- 코드에서는 유효한 살인마 이름이 아닌 경우 기본값을 사용하고 로그에 경고를 남깁니다.
- 전체 연도 TR에서 선정한 베스트·워스트 픽 이름을 사용합니다. 연도 필터로 선택한 해의 승패 수치는 해당 연도 기준입니다.

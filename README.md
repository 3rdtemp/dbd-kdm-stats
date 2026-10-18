# 김덕만 데바데 토토데이 통계 사이트 v1.5.0

GitHub Pages 기반 **조회 전용** 데드 바이 데이라이트 통계 사이트입니다. Google Apps Script를 통해 구글 스프레드시트의 승패 통계를 자동으로 조회합니다. Firebase/Cloudflare/관리자 로그인은 사용하지 않습니다.

## v1.5.0 변경 사항

- 사용자가 제공한 `killer.zip`의 **44종 PNG 초상화(512×512)**를 `assets/killers/`에 포함했습니다.
- 캐릭터 이름 ↔ 초상화 매핑을 원본 파일명 그대로 구성했습니다. **K05는 쉐이프, K06은 해그**입니다.
- 메인 기존 대시보드는 유지하고 하단의 살인마 선택창에 작은 초상화 카드를 표시합니다.
- 초상화 클릭 시 살인마 상세 페이지로 이동하며 동일한 로컬 이미지를 크게 표시합니다.
- wiki.gg 및 Fandom 이미지 핫링크와 링크 실패 시 재시도 코드를 제거했습니다.
- 기존 승률 계산, 2025/2026 연도 필터, 도넛 차트, 최근 10경기, 날짜별 전적표와 Google Apps Script 연동 URL은 유지했습니다.

## GitHub 업로드 — 기존 사이트 업데이트

1. `dbd-kdm-stats-v1.5.0-github-update.zip`을 **압축 해제**합니다.
2. [저장소](https://github.com/3rdtemp/dbd-kdm-stats)에서 `Add file → Upload files`로 ZIP 안의 **파일과 `assets`, `data` 폴더 전체**를 업로드합니다.
3. 같은 이름으로 파일을 덮어쓴 뒤 **Commit changes**로 저장합니다. `index.html`, `app.js`, `styles.css`, `config.js`는 저장소 최상위에 있어야 합니다.
4. 특히 `assets/killers/` 경로에 PNG 44개가 업로드되었는지 확인합니다. 이 폴더는 자동으로 생성되어야 합니다.
5. 기존 Pages 설정(main / root)은 유지합니다. 새 파일이 게시되면 [통계 사이트](https://3rdtemp.github.io/dbd-kdm-stats/)에서 `Ctrl + F5`로 강력 새로고침하세요.
6. 이미지를 확인할 때 메인 맨 아래 살인마 선택창에서 트래퍼·쉐이프·해그를 비교하고, 하나를 클릭해 상세 초상화가 나오는지 확인하세요.

참고: GitHub 웹 화면에서 기존 파일이 있는 상태로 대량 업로드 시 중복/충돌 안내가 표시될 수 있습니다. 이런 경우 해당 경로로 변경 사항이 정상 커밋됐는지 확인하세요. 폴더가 중복으로 들어가면 이미지 경로가 맞지 않습니다.

## 폴더 구성

```
index.html
app.js
styles.css
config.js
data/records.json
assets/killers/K01_TheTrapper_Portrait.png
assets/killers/K02_TheWraith_Portrait.png
...
assets/killers/K44_TheJudgment_Portrait.png
README.md
```

전체 프로젝트 ZIP에는 `google-apps-script/Code.gs` 참고용 파일이 추가로 들어갑니다. **기존 Apps Script는 다시 배포할 필요가 없습니다.**

## 통계 및 운영

- 초기 저장본: **582전, 373승 209패**, 살인마 상대 548전, 생존자 34전(20탈출·14사망).
- 시트 연동 주소: `config.js`에 기존에 연결된 읽기 전용 Apps Script URL을 그대로 유지합니다.
- 웹사이트는 스프레드시트에 쓰기 권한이 없습니다. 약 5분마다 업데이트를 확인하고 연결 실패 시 저장된 데이터를 표시합니다.
- 살인마별 횟수는 **스트리머가 상대해 만난 살인마 출현 기록**입니다(스트리머 본인의 살인마 픽 횟수가 아닙니다).
- 제공된 캐릭터 이미지의 웹 공개 이용 권한은 배포 운영자가 별도로 확인해야 합니다. 파일을 제공받았다는 사실만으로 저작권 이용 허가가 확인된 것은 아닙니다.


## v1.5.0 추가 사항
- 좌측 사이드바에 `살인마 선택` 바로가기 추가
- 좌측 사이드바에 `랜덤 선택 룰렛` 페이지 추가
- KDM 로고 적용 및 살인마 카드 워터마크 추가
- 살인마 선택 룰렛(슬롯머신 스타일) 추가
- 기술 퍽 룰렛 예정 섹션 추가

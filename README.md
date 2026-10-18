# 김덕만 데바데 토토데이 통계 사이트 v1.5.11

조회 전용 GitHub Pages 사이트입니다. Google Apps Script를 통해 구글 스프레드시트의 승패 통계를 자동으로 읽습니다. 로그인 서버나 Firebase/Cloudflare는 사용하지 않습니다.

## 이번 업데이트 (v1.5.11)

- 사용자가 제공한 **4.584초** 길이의 `electric-slot-machine_[cut_5sec].mp3`를 `assets/audio/electric-slot-machine.mp3`로 교체했습니다.
- MP3를 **원래 속도(1.0배)**로 1회 재생하고, 화면은 약 4.58초 이내에 순서대로 멈춥니다. 마지막 칸은 약 4.52초에 정지합니다(브라우저 로딩 상태에 따른 미세 차이 가능).
- 룰렛은 **3칸**을 유지합니다. 투명 초상화가 위아래로 조금씩 교차 이동하고 부드럽게 페이드되며, 이전 버전의 **눈에 띄는 셀/카드 묶음 이동**을 없앴습니다. 세 칸의 최종 결과는 항상 같은 살인마입니다.
- KDM 로고는 슬롯 창의 고정 배경에만 남아 있으며 캐릭터 이미지에는 추가하지 않습니다.
- 기존 살인마 TOP 10(최소 10경기 이상, 승률 순), 최근 기록 10개, 상세 통계, 기술 퍽 룰렛 예정, 음소거/재추첨 기능은 유지합니다.

## GitHub 적용 (v1.5.7 → v1.5.11)

1. `dbd-kdm-stats-v1.5.11-github-update.zip`을 압축 해제합니다.
2. [GitHub 저장소](https://github.com/3rdtemp/dbd-kdm-stats)에서 다음 파일을 해당 경로에 그대로 업로드하고 기존 파일을 교체합니다.
   - `app.js`
   - `index.html`
   - `styles.css`
   - `README.md`
   - `assets/audio/electric-slot-machine.mp3` (**이번 새 음원으로 반드시 교체**)
3. `Commit changes`를 누르고 GitHub Pages 배포가 완료되면 `Ctrl + F5`로 새로고침합니다. 사이트: https://3rdtemp.github.io/dbd-kdm-stats/
4. 룰렛 버튼을 눌러 **효과음·회전·순차 정지·3칸 결과 일치**를 확인합니다. 문제가 있다면 브라우저 탭 음소거 및 사운드 버튼을 먼저 확인합니다.

**중요:** 기존 `config.js`, 구글 Apps Script, `data/records.json`, `assets/kdm-logo.png`, `assets/killers/`의 PNG 44종은 변경하지 않았습니다. 별도 재업로드 및 Apps Script 재배포는 필요하지 않습니다.

## 전체 프로젝트 구조

```text
index.html
app.js
styles.css
config.js
data/records.json
assets/kdm-logo.png
assets/audio/electric-slot-machine.mp3
assets/killers/  (44 PNG)
google-apps-script/Code.gs  (참고용)
README.md
```

## 통계 관련

- 기존 저장본: 총 582경기 373승 209패 (살인마 상대 548경기, 생존자 34경기).
- 살인마별 기록은 김덕만이 **상대해서 만난 살인마**의 경기 수와 승패입니다. 스트리머가 해당 살인마를 직접 플레이한 횟수가 아닙니다.
- 생존자 기록은 탈출/사망만 공개하며 맵 이름을 포함하지 않습니다.
- Google Sheets 조회는 약 5분마다 갱신되며, 연동 장애 시 기존 저장 데이터를 표시합니다.
- 초상화 및 로고·효과음 등의 공개 사용 권한은 별도 확인이 필요합니다.


## v1.5.11 룰렛 전체 재구축
- 이전 릴 및 페이드 애니메이션과 중복된 CSS 규칙 제거. 3칸에 하나의 연속 스크롤 트랙을 사용합니다.
- 4.584초 MP3 원본 속도를 유지하고 릴을 왼쪽부터 순차 정지합니다.
- 결과는 44종 중 균등한 확률로 한 종이며 세 칸 모두 같은 결과를 표시합니다.
- 룰렛 이외 기존 통계, 살인마 이미지, 구글 시트 연동 설정은 유지합니다.
- GitHub 업데이트용 ZIP에 MP3까지 함께 포함했습니다.


## v1.5.11 변경 내용

- 슬롯 이미지가 세로로 이동하던 연속 릴 애니메이션 제거
- 3칸 각각 한 개의 이미지 요소를 유지하고, 이미지만 무작위로 빠르게 교체
- 단계적 감속 후 왼쪽부터 차례로 정지하여 동일한 살인마 확정
- 효과음 4.584초 및 구글 스프레드시트 자동 연동 유지
- 이미지 중첩 방지, 방문자가 룰렛 페이지에 들어오면 초상화 미리 로딩

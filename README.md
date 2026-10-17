# 김덕만 데바데 토토데이 데이터룸 v1.2

**GitHub Pages + Google Sheets + Cloudflare Worker + Firebase Authentication** 기반 통계 사이트입니다. PC/모바일 대응, 시청자 조회 전용, 관리자 이메일·비밀번호 로그인, 기존 스프레드시트 자동 조회, 신규 경기 서버 저장을 지원하도록 구성했습니다.

## 중요한 현재 상태

- **사이트 파일과 연동용 서버 코드 제작 완료. 아직 실제 구글 시트·Firebase·Cloudflare 서비스에 연결되지 않았습니다.** 배포 설정 전에는 `data/records.json`에 저장된 기존 582경기의 통계를 읽기 전용으로 표시합니다.
- 새 기록을 브라우저에서 임시로 저장하거나 비밀번호만 화면에서 비교하는 방식이 **아닙니다**. 관리자가 로그인한 경우에만 서버에서 Firebase 서명을 검증하고 Google 스프레드시트에 기록을 씁니다.
- 원본 `KDM Record Table` 시트는 **읽기 전용**으로 보존합니다. 관리자가 웹에서 추가한 라운드는 같은 스프레드시트 안의 `WEB_RECORDS` 탭에 기록되고, 사이트 통계에는 **원본 + WEB_RECORDS**가 합산됩니다. **원본 통계표의 자체 합계 수식에는 웹 추가 기록이 자동 합산되지 않습니다.**
- 구글 시트의 살인마 상대 경기 체크박스 `TRUE/FALSE`, 생존자 경기의 `탈출/사망` 문자를 직접 읽습니다. **생존자 맵 이름은 공개 API·records.json·사이트에 보관하지 않습니다.**
- 실시간 연동이 켜진 후 웹페이지가 열려 있으면 약 **60초마다 새로 조회**합니다. 네트워크·Google API 상태에 따라 지연될 수 있습니다. 연결 실패 시 **'연동 오류 · 저장본 표시'**라는 경고를 표시합니다.

## 기록 검증 (업로드한 수정본 .xlsx)

| 구분 | 경기 | 승/탈출 | 패/사망 | 비율 |
|---|---:|---:|---:|---:|
| 전체 | 582 | 373 | 209 | 64.09% |
| 살인마 상대 | 548 | 353 | 195 | 64.42% |
| 생존자 | 34 | 20 | 14 | 58.82% |

2025-11-08~2025-12-26 80전, 2026-01-02~2026-10-17 502전. 실제 xlsx에서 추출한 B4:L220 데이터를 v1.2 파서로 재변환한 결과 **582전 / 83기록 묶음 / 유형 분류 오류 0건**입니다.

## 준비물

- 기존 구글 스프레드시트의 **편집 권한** 및 URL/스프레드시트 ID
- Google Cloud 프로젝트(스프레드시트 API 사용 설정, 서비스 계정 생성)
- Firebase 프로젝트(Authentication → **이메일/비밀번호** 로그인 사용 설정 및 **관리자 사용자 1명 직접 생성**)
- Cloudflare 계정(Workers 사용)
- GitHub 계정(Pages 게시)

**보안:** Firebase 관리자 비밀번호, 서비스 계정 `private_key`, OAuth 토큰은 채팅·GitHub·`config.js`에 절대 올리지 마세요. Cloudflare에는 Secret으로 보관합니다. Firebase 웹 API 키는 공개 클라이언트 설정 항목이며, **관리자 권한 검증에는 키가 아니라 서버가 확인하는 Firebase UID와 서명된 토큰을 사용**합니다.

## 실제 연동 설치 순서

### 1. 구글 스프레드시트 준비

1. 기존 구글 스프레드시트를 엽니다. 원본 기록 탭 이름이 **`KDM Record Table`**인지 확인합니다. 다르면 Worker Secret `SOURCE_SHEET_NAME`에 정확한 이름을 설정합니다.
2. 상단 **확장 프로그램 → Apps Script**를 열어 `setup/prepare-sheet.gs` 내용을 붙여 넣고 `prepareKdmWebRecords()`를 **한 번만** 실행합니다. 권한 승인 후 새 탭 `WEB_RECORDS`가 만들어집니다. 직접 탭을 생성하고 1행 A:E에 `dateISO`, `mode`, `name`, `result`, `id`를 입력해도 됩니다.
3. 구글 스프레드시트 URL의 `/d/`와 `/edit` 사이 문자열을 `SPREADSHEET_ID`로 사용합니다. (예: `docs.google.com/spreadsheets/d/여기/edit`)
4. Google Cloud Console에서 **Google Sheets API**를 활성화하고 서비스 계정을 만듭니다. JSON 키를 생성해 `client_email`과 `private_key`를 **로컬에 안전하게** 보관합니다.
5. 해당 스프레드시트의 **공유**에서 서비스 계정 `client_email` 주소를 **편집자**로 추가합니다. 스프레드시트 전체를 '링크가 있는 모든 사용자'로 공개할 필요는 없습니다.

### 2. Firebase 관리자 계정 준비

1. Firebase Console → 프로젝트 생성 → **Authentication → Sign-in method**에서 이메일/비밀번호를 켭니다.
2. **Authentication → Users → Add user**에서 관리자 이메일·비밀번호 사용자 **1명**을 생성합니다. 이 이메일이 관리자 **아이디** 역할을 합니다.
3. 사용자 항목의 **UID**를 기록합니다. 이 값을 Worker의 `ADMIN_UID`로 사용하여 **해당 계정 1명만 기록을 수정**할 수 있게 합니다.
4. Firebase 프로젝트의 **프로젝트 ID**(`FIREBASE_PROJECT_ID`)와 프로젝트 설정의 **웹 API 키**(`firebaseWebApiKey`)를 확인합니다.
5. 비밀번호는 사이트/서버 파일에 직접 쓰지 않고 Firebase에만 설정합니다. 테스트 후 충분히 강한 비밀번호를 사용하세요.

### 3. Cloudflare Worker 배포 및 Secret 등록

터미널에서 `backend/` 폴더로 이동하고 다음을 실행합니다.

```bash
cd backend
npx wrangler login
npx wrangler deploy
```

최초 배포 시 Secret을 등록하지 않았다면 API는 503으로 응답합니다(의도한 안전 동작). 이어서 다음 **필수 항목 6개**를 Worker Secret으로 등록합니다. 각 명령 실행 시 값을 묻는 프롬프트에서 직접 입력하세요.

```bash
npx wrangler secret put SPREADSHEET_ID
npx wrangler secret put SERVICE_ACCOUNT_EMAIL
npx wrangler secret put SERVICE_ACCOUNT_PRIVATE_KEY
npx wrangler secret put FIREBASE_PROJECT_ID
npx wrangler secret put ADMIN_UID
npx wrangler secret put ALLOWED_ORIGINS
```

- `ALLOWED_ORIGINS`: 실제 GitHub Pages 사이트의 **출처(origin)**, 예: `https://사용자명.github.io` (저장소 경로 `/repo`는 제외). 여러 개일 때는 쉼표로 구분합니다. 로컬 테스트를 포함하려면 `http://localhost:8000`도 추가할 수 있습니다.
- 원본 시트가 `KDM Record Table`이 아니라면 **선택 사항**: `npx wrangler secret put SOURCE_SHEET_NAME`.
- `SERVICE_ACCOUNT_PRIVATE_KEY`: 서비스 계정 JSON의 `private_key` **전체 값**, BEGIN/END 포함. `\\n` 문자열과 실제 줄바꿈 모두 지원하도록 구현했습니다.
- **설치 직후 검증:** `https://사용자워커.workers.dev/api/records`를 열었을 때 `sessions` 배열이 있는 JSON과 `582`경기가 조회되는지 확인합니다. 연결 전에는 에러가 발생할 수 있습니다.

### 4. GitHub Pages 게시

1. GitHub Pages 저장소 최상위에 `index.html`, `app.js`, `styles.css`, `config.js`, `data/records.json`을 올립니다. **GitHub 업데이트용 ZIP**에는 해당 파일만 포함됩니다. 나머지 `backend/`와 `setup/` 파일은 서버·설치용이며 웹사이트의 공개 정적 파일로 배포할 필요가 없습니다.
2. `config.js`에서 다음 두 값을 **본인 프로젝트에 맞게** 수정합니다.

```js
window.KDM_CONFIG = {
  apiBase: 'https://실제-워커-주소.workers.dev',
  firebaseWebApiKey: '실제-Firebase-웹-API-키'
};
```

3. GitHub 저장소 **Settings → Pages**에서 `Deploy from a branch`, `main`, `/(root)`를 선택합니다.
4. 사이트에 접속하면 `Google Sheets 연결 · 자동 갱신` 상태가 표시되는지 확인합니다. 표시되지 않으면 서버 Secret, Sheets API, 서비스 계정 공유 권한, 출처 설정을 확인하세요.
5. **데이터 관리** 메뉴에서 Firebase 관리자 이메일·비밀번호로 로그인합니다. 관리자 UID가 Worker의 `ADMIN_UID`와 같아야 기록 추가가 허용됩니다.

## 데이터 입력/운영 방법

| 입력하는 위치 | 웹사이트 통계 반영 | 원본 표 자체 합계에 반영 |
|---|---|---|
| 기존 `KDM Record Table` 탭 | 다음 갱신 시 반영 | 기존 엑셀 수식 기준에 따라 반영 |
| 관리자 페이지 (웹사이트) | 서버 저장 후 즉시 다시 읽어 반영 | **아니요**. `WEB_RECORDS` 탭에 별도 저장 |
| `WEB_RECORDS` 탭 직접 편집 | 다음 갱신 시 반영 | **아니요** |

원본 시트가 도중에 확장되면 파서는 `B4:L1000` 범위의 날짜 이름·체크박스 구조를 인식합니다. 새 살인마가 출시되어 원본에 이름을 추가한다면 `backend/reference.json`의 `killerCategories` 목록도 업데이트해야 합니다. 목록에 없는 명칭은 **원본에서 생존자 맵으로 분류되므로**, 신규 살인마 등장 시 사전 확인이 필요합니다. 생존자 행에서는 결과 셀에 `탈출` 또는 `사망`으로 입력해야 합니다.

### 보안 및 운영 시 주의점

- GitHub Pages는 정적 사이트라 **클라이언트만으로 관리자 권한을 보호할 수 없습니다**. 실제 권한은 Cloudflare Worker가 Firebase ID 토큰의 서명·대상 프로젝트·허가 UID를 확인하여 결정합니다. 다른 사람이 HTML을 수정하거나 API를 직접 호출해도 **유효한 관리자 토큰 없이는 저장할 수 없습니다**.
- 로그인 정보 중 **Firebase ID 토큰은 현재 열린 브라우저 탭의 sessionStorage에만 저장**되고, 해당 토큰의 약 1시간 수명이 지나면 다시 로그인해야 합니다. Firebase 계정 비밀번호는 저장하지 않습니다.
- 계정이 탈취되거나 로그인 시도 공격이 의심되면 Firebase의 사용자 관리 및 Cloudflare의 WAF/Rate limiting을 별도로 점검하세요. 이 버전은 **자체 로그인 시도 제한·토큰 강제 폐기 목록은 구현하지 않았습니다**.
- 공개 API는 원본 시트 전체 내용을 내보내지 않고 통계용 결과만 내보냅니다. 서비스 계정 권한은 편집자로 공유한 **해당 시트에 한정**할 것을 권장합니다.
- 백엔드가 연결되지 않았다면 표시된 기록은 실시간 데이터가 아닌 **번들에 포함된 정적 저장본**입니다. 사용자에게 온라인 연동이 완료된 것처럼 표시하지 않습니다.

## 프로젝트 파일

```text
index.html                   공개 페이지
app.js                       통계 및 관리자 UI
styles.css                   반응형 스타일
config.js                    공개 URL·Firebase 웹 키만 저장
/data/records.json           582경기 백업 스냅샷 (생존자 맵 정보 없음)
/backend/index.mjs           Cloudflare Worker · 인증·Google Sheets API
/backend/source-parser.mjs   원본 체크박스/생존자 결과 변환 로직
/backend/reference.json      기본 명칭·살인마 분류표
/backend/wrangler.toml       Workers 배포 설정
/setup/prepare-sheet.gs      WEB_RECORDS 1회 생성 스크립트
/tests/source-parser.test.mjs 데이터 변환 테스트
```

## 로컬 실행 / 테스트

```bash
# 프로젝트 루트
python -m http.server 8000
# 브라우저: http://localhost:8000

# 원본 파서 단위 테스트 (Node.js 18 이상)
node --test tests/source-parser.test.mjs
```

이 README의 링크·설정은 실제 외부 서비스의 계정과 권한을 필요로 하므로 **사용자 계정 연결 및 실시간 쓰기 동작은 아직 외부 환경에서 검증되지 않았습니다**. 단위 테스트와 기존 xlsx 데이터 합계 검증은 로컬에서 수행했습니다.

참고 공식 문서: [Firebase ID token 검증](https://firebase.google.com/docs/auth/admin/verify-id-tokens) · [Google Sheets API](https://developers.google.com/workspace/sheets/api/reference/rest) · [Cloudflare Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) · [GitHub Pages](https://docs.github.com/en/pages)

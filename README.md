# Entropy (MV3)

> **웹에는 마찰을, 주의에는 선택의 여지를.**

Entropy는 자동적으로 이어지는 웹 사용에 멈춤과 선택의 여지를 만드는 Chrome 확장 프로그램이다.
보호할 사이트와 이용 시간을 정하면 진입 확인, 시각 필터, 클릭·스크롤 저항과 넛지로
다음 행동을 돌아볼 간격을 만든다. 선택한 범위의 사용 기록은 자신의 패턴을 이해하고 보호를 조율하는 데 쓰인다.

다음 콘텐츠는 달라도 계속하는 동작은 늘 같을 수 있다. Entropy는 이 익숙한 반복에 사용자가 정한
간격과 경계를 두어, 지금 얻을 것과 들일 수고를 다시 판단할 수 있게 한다.

현재 기준 브라우저는 Chrome 129 이상이며 Manifest V3를 사용한다.

- [선언문 — 바깥의 마찰, 안쪽의 선택](docs/product/entropy-manifesto.md): 철학과 전체 흐름을 한 호흡으로 읽기
- [프로젝트 소개](docs/product/project-introduction.md): 제품 원칙, 기능, 테마와 기술 구조
- [설명 모델 지도](docs/product/README.md): 예측·가치 학습, 정보 압축, 보상·안도 동기의 상세 설명

## 무엇을 하나

사이트별 이용 목표, 시간대별 보호와 즉시 시작하는 집중 세션을 설정할 수 있다.
팝업은 현재 사이트의 빠른 조작을, 대시보드는 사이트·일정·기록·아티팩트·테마 설정을 맡는다.
일부 아티팩트와 안내는 사용일에 따라 차례로 공개된다.

보호 기능은 일곱 아티팩트로 묶인다.

| 아티팩트 | 기능 |
| --- | --- |
| 신호 차폐 (`veil`) | 사회적 비교 숫자와 시간 신호를 숨기고 클릭 전 의도를 확인 |
| 시야 필터 (`lens`) | 흑백화·흐림·밝기·대비·채도로 시각 자극 조절 |
| 패턴 차단 (`barrier`) | 숏폼·미디어 스킵·텍스트 리듬·보호 탭 확산 제어 |
| 문턱 확인 (`gate`) | 보호 사이트 진입과 재진입 확인 |
| 리듬 제동 (`brake`) | 클릭 일시 정지·스크롤 저항·입력 시각 효과 |
| 개입 알림 (`flare`) | 이용 목표와 보호 상태에 따른 인터랙티브 넛지 |
| 흔적 정리 (`echo`) | 방문 기록·북마크·보호 탭 정리 |

테마는 `matrix`, `entropy`, `cyberpunk`, `clinical`, `scp`, `zen`이다.
Zen은 연못, 잉어, 분재와 일본 정원 모티프로 사용 흐름과 보호 상태를 표현한다.

## 데이터와 권한

설정과 사용 기록, 분석 결과는 이 기기에서 처리·보관되며 외부로 자동 전송되지 않는다.
기록은 보호 사이트만, 모든 사이트의 기본 기록, 기록하지 않음 중에서 선택하고 설정에서 변경하거나 삭제할 수 있다.
기록을 꺼도 보호 기능에 필요한 페이지 관측은 계속될 수 있다. 내보낸 파일의 공유 여부는 사용자가 결정한다.
사이트 아이콘은 브라우저의 로컬 캐시나 이미 기기에 있는 이미지를 사용한다.

처음 대시보드를 열면 Main에서 첫 보호 사이트를 등록한다. 사용시간 기록은 기본 해제된 선택 사항이며 기록 없이 둘러볼 수도 있다.
데이터 잠금 암호는 나중에 설정할 수 있다. 상세 로그와 이를 여는 키를 보호하며, 사이트 설정과 집계 통계, 보호용 키까지 암호화하는 것은 아니다.
데이터 잠금을 켜도 사이트 보호와 집계 통계는 계속 동작한다. 재시작 후 상세 로그만 잠기며 새 상세 로그는 잠금 해제 이후부터 저장한다.
암호는 복구할 수 없으므로 안전하게 보관해야 한다. 전체 백업은 별도 암호로 암호화해 저장·복원할 수 있다.
설정 보호 PIN은 데이터 잠금 암호와 별개다.

필수 권한은 `storage`, `tabs`, `alarms`, `favicon`이다.
사이트 접근, 기록·북마크 정리, 활동 이력, 탭 그룹, 알림에는 필요한 기능을 사용할 때
`scripting`, 구체적인 사이트 권한, `history`, `bookmarks`, `idle`, `webNavigation`,
`tabGroups`, `notifications`를 선택적으로 요청한다.
자세한 데이터 처리 안내는 [개인정보처리방침](src/apps/landing/privacy/index.html)을 참고한다.

## 빠른 시작

개발은 네이티브 Windows 도구를 사용한다. Node.js 버전은 [.nvmrc](.nvmrc)의 `24.14.0`에 맞추고
npm은 `10` 이상을 사용한다. 준비된 Windows 환경에서는 다음 순서로 실행한다.

```powershell
. .\scripts\dev\enter-windows.ps1
npm.cmd ci
npm.cmd run doctor:runtime
npm.cmd run build
```

1. Chrome에서 `chrome://extensions` 열기
2. 개발자 모드 활성화
3. `dist/` 폴더를 "압축해제된 확장 프로그램"으로 로드
4. 확장의 옵션 페이지에서 암호와 기록 범위를 설정하고 보호할 사이트 추가

변경을 감시하려면 `npm.cmd run dev`를 사용한다. 개발 빌드는 별도 staging 디렉터리에서
완성·검증한 결과만 `dist/`에 승격한다. 승격 후 Chrome에서 확장을 다시 로드한다.
실사용 빌드를 명시적으로 고정한 동안에는 새 결과가 `.artifacts/dev-extension-builds/latest`에 게시된다.
고정·해제 절차는 [QA 제어 계약](docs/operations/qa/entropy-qa-control-plane.md)을 따른다.

일반 Vite 웹 주소는 확장 런타임과 저장소를 제공하지 않으므로 대시보드의 실행 경로가 아니다.
도구 설치와 브라우저 프로필은 [Windows 개발 안내](docs/operations/runbooks/windows-native-development.md)를 따른다.

## 빌드와 검증

| 명령 | 용도 |
| --- | --- |
| `npm.cmd run build` | 디버그 도구를 포함한 개발 확장 게시 |
| `npm.cmd run build:prod` | `dist-prod/` 프로덕션 번들 및 산출물 검사 |
| `npm.cmd run build:release` | build phase 구조 계약 검사와 프로덕션 빌드 |
| `npm.cmd run gate:structural` | lint와 주요 아키텍처 경계 검사 |
| `npm.cmd run gate:product` | 구조 검사·프로덕션 산출물·릴리스 테스트; `gate:ci`의 정본 |
| `npm.cmd run gate:release` | 전체 구조 검사·프로덕션 산출물·커버리지 검증 |
| `npm.cmd run test:file -- tests/<name>.test.js` | 선택한 테스트만 실행 |

최종 Chrome Web Store 제출 후보는 `npm.cmd run release:rc`가 만든다.
깨끗한 커밋, 출시 버전 태그, 고정된 Store ID, 실제 Store·지원 URL과 자산 권리 확인이 필요하다.
실행 조건과 ZIP·브라우저 증적 절차는 [스토어 제출 안내](docs/operations/runbooks/chrome-web-store-submission-guide.md),
검사 범위는 [품질 게이트](docs/operations/ci/quality-gate.md)를 따른다.

공개 랜딩은 확장과 별도로 `npm.cmd run build:landing`으로 `dist-landing/`에 빌드한다.
실제 Store·지원 URL 설정이 필요하며, 빌드가 웹 배포까지 수행하지는 않는다.

## 한눈에 보는 구조

앱 조합, 도메인 규칙, 브라우저·저장소 어댑터, 테마 표현의 책임을 나눈다.
각 소비자는 해당 소유자의 공개 경계를 통해 접근한다.

```txt
src/
  apps/       # MV3 entrypoint (background · content · dashboard · gate · nudge · popup …)
  domains/    # 제품 도메인 규칙과 도메인 소유 공개 API
  platform/   # browser·storage·messaging·worker·security 저수준 어댑터
  themes/     # core(정본 계약) + plugins(테마별 표현)
  ui-kit/ · lib/ · i18n/ · pages/ · assets/   # 중립 UI·순수 유틸·로케일·HTML·정적 자원
```

구조·저장소·신뢰 경계의 정본은 [시스템 구조](docs/system-architecture/README.md)와
[문서 규칙](docs/governance/document-system.md)에 두고, README는 그 개요를 설명한다.

더 깊은 지도는 아래를 편다.

<details>
<summary><strong>더 깊이 — 문서 · 도메인 · 테마 지도</strong></summary>

### 읽는 순서

1. `docs/README.md` — 전체 문서 지도
2. `docs/system-architecture/README.md` — 현재 구조와 owner 정본
3. `src/apps/README.md` · `src/domains/README.md` · `src/platform/README.md` · `src/themes/README.md`

### 문서 체계 (`docs/`)

- `system-architecture/` — 현재 구조와 owner, 보존할 불변 조건을 설명하는 정본
- `architecture/` — storage·runtime·i18n·worker·theme 세부 설계
- `governance/` — 문서 운영 규칙, naming, registry, guard
- `product/` — PRD, IA, UX 방향
- `domains/` · `apps/` — 도메인 baseline과 app shell/entrypoint
- `operations/` · `migrations/` · `decisions/` · `templates/` · `archive/` — CI/QA, 전환, 결정 기록, 서식, 아카이브

### 테마 시스템

- id 정규화: `src/themes/core/ids.js`
- profile: `src/themes/core/profile.js`
- registry/loading: `src/themes/core/registry/index.js`
- plugin catalog: `src/themes/core/runtime/pluginCatalog.js`
- zen plugin guide: `src/themes/plugins/zen/README.md`

### 스토리지 상세

- owner/path topology: `docs/system-architecture/02-runtime-storage-boundaries.md`
- backend/data-shape/migration: `docs/architecture/storage/storage-architecture-target.md`
- `window.localStorage`는 UI-local/debug 편의만 허용하고 business data의 정본으로 쓰지 않는다.

### 멀티플랫폼 빌드

```powershell
npm.cmd run build:chrome
npm.cmd run build:whale
npm.cmd run build:firefox
npm.cmd run build:safari:web-extension
```

Chrome 공개 산출물은 `dist-prod/`, 나머지는 각각 `dist-whale/`, `dist-firefox/`, `dist-safari/`다.
Whale은 Chromium 호환 프로필이며 Firefox·Safari는 별도 검증이 필요한 패키지 출발점이다.
빌드 명령이 있다는 것만으로 브라우저별 출시 지원을 의미하지 않는다.

런타임 구조는 `docs/architecture/runtime/multiplatform-extension-runtime.md`를 본다.

</details>

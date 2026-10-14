# CI Quality Gate

- Status: Active
- Owner: CI operations
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: CI quality gate contract

로컬/CI 검증은 비용과 소유 목적에 따라 구조, 제품, 출시, 연구 lane으로 나눈다.
`gate:ci`는 병합용 제품 게이트의 호환 별칭이며 커버리지를 중복 실행하지 않는다.

## 실행 명령

### 구조 게이트

```bash
npm run gate:structural
```

소스와 소유 경계만 빠르게 검증한다.

1. deterministic Zen pond static asset generation
2. `npm run lint`
3. `npm run profile:checks:structural`
4. `npm run check:zen:no-unused-js`

`profile:checks:structural`은 기존 prebuild/build 검사 중 owner topology와 제품
불변식에 해당하는 핵심 계약만 중복 없이 실행한다. storage, security, runtime
sender, theme seam, G15 product/research, worker admission, i18n ownership이 이
lane의 차단 경계다. soft-size, QA workflow shape, 상세 UI/i18n 표면, 퇴역 facade,
golden replay 같은 전체 감사 항목은 출시 프로필이 소유한다.

### 제품 게이트

```bash
npm run gate:product
# 호환 별칭
npm run gate:ci
```

구조 게이트를 통과한 뒤 public artifact를 소스 구조 검사를 재실행하지 않는
`build:artifact` 경로로 한 번 만들고 global/context/Zen worker 예산을 검증한 다음
release test lane을 한 번
실행한다. 구조 검사를 `npm run build`를 통해 다시 실행하지 않는다.

### 출시 게이트

```bash
npm run gate:release
```

전체 prebuild/build 구조 계약을 `profile:checks:release`에서 중복 없이 한 번씩
감사하고 같은 artifact 검증을 수행하되 plain `npm test` 대신
`test:coverage:ci`를 한 번 실행한다. 따라서 전체 릴리스 테스트를 일반 실행과
커버리지 실행으로 두 번 돌리지 않는다. CWS RC는 이 프로필을 소유한다.
`test:coverage:ci`는 기본적으로 동시에 최대 2개 worker로 실행한다. 전체 소스 계측과 DOM·연구
경계 검사가 Windows 개발 환경의 메모리·CPU를 경합해 무관한 프로세스/테스트
deadline을 초과하지 않도록 실행 병렬도만 제한하며, 선택 테스트와 커버리지 기준은
그대로 유지한다. 명시적인 `--maxWorkers` 옵션은 이 기본값을 재지정한다.
실패한 실행에서도 coverage 보고서를 보존해 원인 분석에 사용한다. 테스트 실패는
그대로 non-zero 종료하며, 실패 시 후속 coverage budget 단계로 진행하지 않는다.

### 독립 lane

```bash
npm run gate:coverage        # build 없이 coverage + budget만 재검증
npm run gate:research        # detached Zen research
npm run gate:maintainability # advisory line budget
```

line budget은 알려진 대형 파일을 반복해서 출력하는 출시 차단기가 아니다. 구조
분할을 검토할 때 명시적으로 실행한다. 실제 Chromium MV3 lifecycle은 nightly/RC
소유로 유지한다.

제품·출시 artifact와 bundle budget은 public Chrome 산출물 `dist-prod/`를 공유한다.
Chrome에 unpacked로 로드한 개발 경로 `dist/`는 어떤 quality gate도 수정하지 않는다.

`.github/workflows/quality-gate.yml`은 모든 pull request와 `main` push에서 exact
`npm ci` 후 `gate:product`를 실행하는 병합 게이트다. 저장소 branch protection은
이 workflow의 `Product gate` job을 required check로 지정해야 한다. Release
후보의 더 강한 `gate:release`와 브라우저 matrix는 RC owner가 별도로 실행한다.

어느 단계에서든 실패하면 즉시 중단되며 non-zero exit code를 반환합니다.

## 검사 등록과 실행 계획

`scripts/ci/buildCheckManifest.mjs`는 build check의 phase별 선택과 실행 순서를
소유하는 단일 등록부다. 각 항목은 `id`, `script`, `category`, `ownerDoc`,
`phases`를 가진다. `script`는 기존 package script를 실행하며, `ownerDoc`는
검사가 보호하는 계약의 정본 문서를 가리킨다. `category`는 검사의 목적을
설명하는 분류이며 실행 lane이나 phase를 대신하지 않는다.

### 불변 조건과 구현 정책의 검사

규칙의 성격은 [Document System](../../governance/document-system.md#계약의-성격과-변경-절차)의
기준에 따라 `ownerDoc` 안에서 해석한다. 하나의 checker가 단일 소유권 같은 불변
조건과 정확한 파일명·함수명 같은 현재 구현 정책을 함께 검사할 수 있으므로,
manifest 항목 전체에 불변성 등급을 부여하지 않는다. `category`는 목적 분류이며
변경 가능성이나 차단 강도 분류가 아니다.

현재 구현 정책도 `Active`인 동안 기존 phase에서 동일하게 실패를 차단한다.
실패 메시지가 경로나 문자열을 지목하면, 먼저 그 marker가 보호하는 성질과 실제
owner를 확인한다. 의도적인 정책 변경이라면 보존할 불변 조건을 명시하고 코드·해당
owner 문서·직접 영향을 받는 guard/test를 같은 변경에서 맞춘다. `policy`로
재분류하거나 검사 항목을 제거해 storage·security·runtime 소유권 검사를 우회하지 않는다.
이 구분 자체는 검사 선택·순서·실패 처리나 새 문서 메타데이터 검사를 추가하지 않는다.

### Runner와 계획 조회

개별 checker와 두 기존 runner를 유지한다. `run-build-checks.mjs`는 등록부에서
선택한 검사를 실행하고, `run-quality-gate.mjs`는 생성·lint·구조 검사·artifact·test
같은 상위 단계를 조합한다. 새 검사나 phase 편입은 등록부에서 정의하며 runner에
별도 선택 목록을 추가하지 않는다. Artifact build의 post-build 검사와 quality
gate의 독립 budget 재검증은 각각의 계약으로 유지한다.

상위 문서의 역사 경로 표시 검사는 `check:docs:paths`가 기존 본문·fenced code
검사 범위와 함께 소유한다. 별도 build phase 프로세스를 실행하지 않으며 문서
경로·메타데이터 검증과 함께 prebuild/release 및 structural phase에서 적용한다.

`scripts/ci/sourceScanUtils.mjs`는 theme shared-seam/public-entry checker가 공유하는
파일 순회와 import specifier 추출만 소유한다. 검사할 root·확장자·제외 경로,
domain 규칙과 실패 메시지는 각 checker가 정한다. Import 추출은 기존 정규식 기반
방식을 유지하며 AST 분석이나 문자열의 신뢰성·데이터 흐름을 증명하지 않는다.

`check:dashboard:owner-architecture`의 `checkForbiddenImports`는 기존 전체 파일 목록과 모든 assertion을 유지하며, 파일 읽기 동시성만 64개 배치로 제한한다. 읽기 오류는 그대로 검사를 실패시킨다.

기존 CLI 선택자는 그대로 유지한다.

- build check `--phase`: `dev`, `prebuild`, `build`, `structural`, `release`
  (생략 시 `prebuild`).
- quality gate `--profile`: `structural`, `product`, `release`, `coverage`,
  `research`, `maintainability` (생략 시 `product`).

아래 명령은 실행할 항목을 JSON으로 조회한다.

```bash
node scripts/ci/run-build-checks.mjs --phase=structural --plan --json
node scripts/ci/run-quality-gate.mjs --profile=product --plan --json
```

Build check plan은 선택된 검사를 실행 순서대로 보여준다. Quality gate plan은
상위 단계 순서와 해당 단계에 포함된 phase 검사 목록을 함께 보여준다. Plan은
자식 프로세스나 asset generation을 실행하지 않는 읽기 전용 경로다.

## Test lane ownership

`run-release-tests.mjs`는 자식 프로세스에만 `ENTROPY_TEST_LANE=release|research`를
설정하고, `vitest.config.js`가 기존 lane collector의 선택을 js/jsx include 목록으로
적용한다. 파일 목록을 명령줄 인자로 펼치지 않아 Windows 명령 길이 제한에 걸리지
않는다. 기존 tmp 제외, coverage·serial 옵션과 사용자의 일반 파일/name 필터는
유지한다. Named lane에서는 선택 계약을 우회하는 `--config`/`-c`, `--root`/`-r`
재지정과 `--no-config` 같은 비활성화 형식을 거부한다. 기존 프로젝트를 고르는
`--project` 필터는 그대로 허용한다.
이 내부 selector가 없는 직접 Vitest 실행은 기존 전체 include 설정을 사용하며,
빈 값이나 알 수 없는 selector는 실패한다.

`npm test`와 `npm run test:coverage:ci`는 public 제품과 출시 도구의 테스트를
실행하며, detached Zen morphology/pond workbench 자체의 모델·표현 실험은 실행하지
않는다. 테스트 소스가 `scripts/dev/zen-bonsai-morphology-research` 또는
`scripts/dev/zen-pond-render-research`를 참조하면
`scripts/ci/releaseTestLane.mjs`가 research lane으로 분류한다. 제품 소스와 detached
research를 한 테스트가 함께 import하면 명시적으로 승인된 research-only 비교
소유자 두 개 외에는 분류 자체가 fail-loud한다.

`tests/zenBonsaiMorphologyResearchBoundary.test.js`는 예외적인 이중 소유자다. 이
테스트는 release lane에서 제품이 research를 import하지 않는지, research가 저장소
및 런타임 상태를 읽지 않는지 검증하고, research lane에서도 workbench 격리 계약을
검증한다. 진행 중인 모델 fingerprint, pathology, counterfactual 연구는
`npm run test:research`에서 별도로 검증하며 CWS 제출을 차단하지 않는다. 두 lane과
임시 테스트를 모두 실행하려면 `npm run test:all`을 사용한다.

이 경계 테스트의 전체 source audit은 generated research run도 빠짐없이 읽는다.
Windows cold IO와 전체 suite 경합을 허용하도록 해당 setup hook만 60초를 사용하며,
전체 검사 범위와 runtime/browser deadline은 기존 계약을 따른다.

## Nightly MV3 lifecycle

`.github/workflows/mv3-lifecycle-nightly.yml`은 매일 `18:17 UTC`와 수동
dispatch에서 Node `.nvmrc`, Playwright Chromium, public Chrome artifact를
준비한 뒤 `verify:release-lifecycle` 전체 matrix를 실행한다. 결과는
`.artifacts/ci/mv3-lifecycle`에서 14일 artifact로 보존한다. 이 lane은 실제
service-worker stop/revival, 기존 탭 `service_init` catch-up readiness, Dashboard
cold reload, storage/data lifecycle drift를 조기에 발견하는 scheduled signal이다.

Workflow가 schedule/manual trigger, Chromium install, Chrome build, lifecycle
matrix, always-upload 증거를 잃으면 `npm run check:qa:mv3-nightly`가 실패하며 이
가드는 prebuild check에 포함된다. Nightly 성공은 clean-tree CWS RC와 headed
physical-GPU visual threshold를 대체하지 않는다.

## Clean Chrome Web Store Release Candidate

`gate:release`는 source/build 품질 게이트이고 제출 ZIP 소유자는 아니다. 실제 제출용
Chrome RC는 깨끗한 커밋에서 다음 명령으로만 만든다.

```bash
ENTROPY_CWS_EXTENSION_ID="<frozen-32-character-store-id>" \
ENTROPY_CWS_RELEASE_MODE="first" \
VITE_CHROME_STORE_URL="https://chromewebstore.google.com/detail/<slug>/<extension-id>" \
VITE_SUPPORT_URL="https://<public-monitored-support-route>" \
npm run release:rc
```

Update candidates use `ENTROPY_CWS_RELEASE_MODE=update` plus
`ENTROPY_CWS_PREVIOUS_VERSION=<currently-published-version>`. The URL's final
extension ID must exactly equal `ENTROPY_CWS_EXTENSION_ID`, and the update
manifest version must increase under Chrome's numeric version ordering.
The release commit must already carry exactly one `cws-v<manifest-version>`
tag; RC creation never invents or moves release tags.

이 명령은 시작과 각 주요 단계 뒤에 Git commit/tree와 clean worktree를 다시
검증한다. `npm ci`, production dependency audit, asset provenance, `gate:release`,
landing build, 같은 `dist-prod`를 재빌드하지 않는 `cws:preflight --no-build`,
CWS runtime budget, release lifecycle source
profile을 통과한 뒤 Vite/module/worker inventory와 등록된 public asset
provenance로 한 번 캡처한 byte snapshot에서 deterministic STORE ZIP을 만든다.
시스템 `unzip`에 기대지 않는 strict parser로 그 ZIP을 임시 경로에 다시 풀고,
unmodified artifact Chromium smoke, no-build static preflight, exact extracted
global bundle budget, instrumented runtime budget, browser lifecycle을 같은 snapshot에 실행한다. 원본·추출본 hash를
다시 비교한 뒤에만 `.artifacts/cws/`의 최종 ZIP과 SHA-256 attestation을
exclusive no-clobber 방식으로 확정한다. Attestation은 실제 browser/report
hash도 포함한다. `dist-prod/.vite/**`는 artifact 검증용 inventory이며 제출
ZIP에는 넣지 않는다.
`dist-landing/entropy-landing-build-info.json`과 landing 전체 tree도 identity를
검증한 뒤 재해시한다. 그 digest는 attestation schema 2에
`deploymentStatus: not-performed-by-release-rc`와 함께 기록한다. 실제 hosting과
동일 digest에 대한 deployment receipt는 외부 release operation이 소유한다.

Dirty tree/build, source-vs-build commit/tree/lockfile mismatch, 잘못된 Chrome
target/profile, manifest version/API floor drift, 미확인 asset 권리, production
Store ID/URL 불일치, update version 비단조 증가, landing URL/support URL 부재,
canonical CWS tag 부재/불일치, landing tree provenance drift, raw artifact smoke 또는 instrumented browser
lifecycle failure는 모두 명시적 release failure다.

참고:

- `npm run test:coverage`: 개발용 상세 리포트(text/html/lcov/json-summary)
- `npm run test:coverage:ci`: 출시/coverage lane용 안정 리포트(text/json-summary)
- `npm run build`, `build:quick`, `build:dev`, `build:dev:quick`은
  `--artifact-only` 개발 빌드이며 전체 prebuild/build 구조 검사를 실행하지 않는다.
  뒤의 세 이름은 인수를 전달하는 `build` 호환 별칭이며 중복 빌드 본문이나 lifecycle
  hook을 갖지 않는다. `build:prod:quick`은 `build:prod`에, `dev:checked`는 `dev`에
  같은 방식으로 위임한다.
  `prebuild:release` hook이 runtime 확인과 prebuild 검사를 소유하고,
  `build:release`가 build phase 검사 후 production build를 실행한다.
  Quality gate는 구조 프로필 후 `build:artifact`를 호출한다.
- public artifact build의 post-build contract에는 public research/debug inventory,
  context별 static closure budget, background service-worker static-import
  계약, Zen Home renderer worker sub-build closure 계약이 포함된다. 제품/출시 게이트는 같은
  `dist-prod/`에 context/worker budget을 다시 적용해 최종 산출물과 독립
  budget step을 함께 고정한다.
- `prebuild` phase에는 `npm run check:release-v1:baseline`,
  `npm run check:personal-baseline:architecture`,
  `npm run check:nudge-domain:owner-architecture`가 포함된다. 각각
  명시된 current-only release baseline, 공용 개인 기준점 vocabulary/owner,
  nudge bounded-context/root/public-seam inventory를 고정한다.
- Cooling P1-C에서 protection envelope와 cross-entry boot prewarm은 각각
  `PROTECTION_ENVELOPE_VERSION = 2`, `BOOT_PREWARM_SCHEMA_VERSION = 2`를
  exact baseline으로 채택했다. 전자는 필수 quantized `coolingCurve` metadata를,
  후자는 퇴역 degree key 대신 정확한 `coolingCurve` settings를 요구한다.
  기존 V1은 읽기 시 변환하거나 기본값으로 대체하지 않고 거부하며, 개발 profile은
  명시적으로 reset한다. Guard의 두 경로·선언 예외와 prewarm shape 검사는 V2에
  고정하고 다른 V1 검사 및 기존 별도 선언 예외는 유지한다.
- Manifest V3, `AES-GCM`, dependency/브라우저 API version은 외부 표준이므로 release V1 guard가 재번호하지 않는다.
- 실제 Chromium이 필요한 `npm run verify:release-lifecycle`은 별도 수동 RC
  gate이면서 nightly drift lane이다. 기본 `build`/quality gate 실행 자체에는 포함하지 않으며, source-only owner-chain
  profile은 `npm run verify:release-lifecycle:source`로 독립 실행한다. 이
  source profile은 storage/data owner chain과 함께 nudge atomic issued-run,
  monotonic phase, exact lifecycle authorization, idempotent terminal ACK,
  run-keyed effect outbox, actual-hostname teardown, tab-scoped drain resume,
  dedicated debug authorization/admission, site-absorption owner CAS, bootstrap
  drain 계약을 검증한다.

## 예산 설정

- 단일 설정 파일: `scripts/ci/quality-gate.config.json`
- 커버리지 임계치:
  - `statementsPctMin`
  - `branchesPctMin`
  - `functionsPctMin`
  - `linesPctMin`
- 번들 임계치:
  - `maxJsAssetBytes`
  - `maxTotalJsBytes`
  - `maxTotalCssBytes`
  - `maxTotalDistBytes`
  - `namedJsAssets`: 해시가 붙는 특정 JavaScript 산출물의 파일명 prefix와
    개별 바이트 상한. 대상이 없거나 둘 이상이면 실패한다.

2026-08-19 분리 후 release lane 실측은 statements `72.63%`, branches `65.63%`,
functions `77.75%`, lines `74.72%`다. 차단선은 각각 `68%`, `60%`, `72%`,
`70%`로 두어 작은 코드 변화가 아니라 대규모 검증 상실만 차단한다. 이전
`10/8/9/11%` 기준은 실제 보호 신호가 아니므로 폐기했다.

Public Chrome의 현재 global 상한은 단일 JS `2,100,000B`, 전체 JS
`13,800,000B`, 전체 CSS `650,000B`, 전체 dist `19,000,000B`다.
2026-09-29 사용자 승인에 따라 현재 제품 기능을 포함한 public build
`20260929042628-01c9b40ab434-dirty`의 실측을 기준으로 약 10%의 여유를
재승인했다. 실측은 단일 JS `1,869,523B`, 전체 JS `12,528,236B`, CSS
`581,008B`, dist `17,242,927B`다. 실측에 10%를 더해 단일 JS/dist는
`100,000B`, 전체 JS/CSS는 `50,000B` 단위로 올림했다.
이는 현재 dirty artifact에 대한 용량 정책이며 clean release나 브라우저 성능
검증을 뜻하지 않는다. Context별 상한, forbidden graph, 보안 및 커버리지 기준은
변경하지 않았다.

2026-10-01에는 global byte inventory를 CWS archive의 배송 경계와 맞췄다.
`scripts/release/artifactEvidenceBoundary.mjs`가 top-level `.vite` build evidence
directory를 선언하며, global bundle walker와 CWS inventory walker가 이 계약을
공유한다. `.vitefoo`나 다른 directory는 제외하지 않는다. Runtime JS/CSS/assets와
build info는 계속 예산에 포함되고 evidence-only output은 실패한다. Context/worker
검사는 `.vite` manifest/module sidecar를 계속 읽어 실제 import/owner graph를 검증한다.
이 변경은 byte 상한을 올리거나 unknown runtime asset을 제외하는 정책이 아니다.

Public worktree build `20261001095804-4aeb0e0daaa2-dirty`의 전체 output은
`19,064,480B`이며, 그중 배송되지 않는 `.vite` evidence는 `699,273B`, 배송
파일은 `18,365,207B`다. 최대 JS `1,879,236B`, 전체 JS `12,629,407B`, CSS
`593,060B`도 기존 상한 안에 있다. 위 2026-09-29의 전체-dist 실측은 evidence를
포함한 당시 metric으로 보존하며 새 배송 합계와 직접적인 성능 비교로 쓰지 않는다.

아래 2026-08 측정과 상한은 당시 변경 근거를 보존한 기록이다.
2026-08-09 rebaseline은 최종 실측값에 3%를 더한 뒤 JS는 `50,000B`,
CSS는 `10,000B`, dist는 `100,000B` 단위로 올림하고 기존 상한보다
낮추지 않는 방식으로 산정했다. Context closure는 같은 artifact의 실제 owner
graph를 기준으로 재승인하되 forbidden asset/module 목록과 worker closure
예산은 변경하지 않았다.

이번 측정은 build `20260809042102-c9f421c85e60-dirty`의 `c9f421c8`
기반 dirty development artifact이므로 clean release
baseline으로 오인하면 안 된다. 다만 변경 전 artifact도 global 세 항목을 이미
초과했고, 이번 pass는 background i18n closure를 크게 줄인 상태에서 실제 MV3
cold/warm lifecycle까지 검증했으므로 현실과 어긋난 byte ceiling을 그대로 두는
것보다 현재 구조를 명시적으로 재승인하는 편이 더 강한 신호를 준다.

| Global metric | 이전 관측 | 2026-08-09 실측 | Delta | 새 상한 |
| --- | ---: | ---: | ---: | ---: |
| 최대 JS asset | `1,556,215B` | `1,562,773B` | `+6,558B` | `1,650,000B` |
| 전체 JS | `9,992,233B` | `10,025,264B` | `+33,031B` | `10,350,000B` |
| 전체 CSS | `556,375B` | `567,584B` | `+11,209B` | `580,000B` |
| 전체 dist | `12,810,800B` | `12,860,387B` | `+49,587B` | `15,850,000B` |

2026-08-19에는 G15.4 제품 엔진과 현재 Pressure UI를 포함한 public development
artifact를 다시 측정했다. 실측은 최대 JS `1,691,745B`, 전체 JS
`10,966,244B`, 전체 CSS `595,215B`, 전체 dist `15,406,540B`였다. 위와 같은
3%/단위 올림 규칙을 적용해 각각 `1,750,000B`, `11,300,000B`, `620,000B`,
`15,900,000B`로 재승인했다. 최대 파일은 MV3 static-import 계약을 지키는
Background service worker이며, G15 비용은 Home lazy boundary와 renderer-worker
closure에서 별도로 측정한다. 이 global 재승인은 context forbidden graph나
worker forbidden-module 규칙을 완화하지 않는다.

`bundle.contextStaticClosures`는 `.vite/manifest.json`의 `imports`만 재귀
순회한다. `dynamicImports`는 static closure에 더하지 않으며, 같은 emitted
JS file은 한 context에서 한 번만 raw/gzip 계산한다. Canonical source root가
Vite manifest의 literal key로 남지 않는 동적 entry이면 checker는 아래 module
inventory에서 source를 정확히 하나 소유한 emitted artifact를 찾고, 그 artifact의
유일한 `isEntry`/`isDynamicEntry` identity에서 순회를 시작한다. Source owner나
entry identity가 없거나 둘 이상이면 hash/chunk-name 추측 없이 fail-loud한다. Build는 Rollup
`chunk.modules`에서 project-relative module id만 추출한
`.vite/entropy-module-inventory.json`도 함께 낸다. Checker는 closure의 각
chunk가 이 inventory에 존재하는지 fail-loud 검증하고, 금지 항목을 manifest
key/file 이름뿐 아니라 실제 module id에도 적용한다. Dashboard boot artifact checker는 같은 inventory로
기존 `dashboard-boot-low-level` chunk의 descriptor factory/catalog/plugin coverage를
검증하고, bootManager static closure가 full `pluginCatalog.js` 또는 plugin
`manifest.js`를 다시 흡수하면 실패한다. Context checker의 background `pluginCatalog`
금지는 plugin friction presentation owner가 broad manifest output에 흡수되는 회귀도 잡는다.

The build has three bounded pure-data/contract chunk policies. The existing
`extension-message-contracts` chunk contains exactly `messageTypes.js`,
`frameMediaProtocol.js`, `scheduleRuntimeState.js`, and
`storageSupportTaskContract.js`; these dependency-free transport vocabularies
and DTO validators retain their source owners. `background-i18n-locales`
contains only the metadata-derived generated `locales/*/backgroundRuntime.js`
copy leaves, preserving their shared projection when Dashboard UI dictionaries
are admitted independently. The service-worker and background i18n artifact
contracts verify exact module membership and zero static/dynamic/CSS imports.
The background closure rejects every non-allowlisted `src/i18n/locales/`
module, including direct JSON sources and transformed module IDs.
`runtime-i18n-primitives` contains exactly the four metadata/language/translator
definition modules declared in `scripts/i18n/runtimeI18nChunkContract.mjs`.
Vite and the background i18n artifact guard consume that same list. This owner
has no imported dependency, dictionary, Chrome/DOM access or eager translator
instance; emitted static/dynamic/re-export imports are checked as well as the
manifest. These policies do not group business runtime, storage implementations
or full UI dictionaries.

Worker control has a separate admission boundary. The exact fourteen modules
in `scripts/release/workerRuntimeChunkContract.mjs` emit as
`worker-runtime-control`, including their typed telemetry repository/store.
Its only allowed static dependency is the existing descriptor/base
`dashboard-boot-low-level` owner; the reverse edge is forbidden. The Dashboard
artifact checker excludes worker control from the Popup HTML and actual
`main.jsx` wrapper static closures. Dashboard HTML retains the declared
`ZenSoftBootShell.js` consumer under the existing boot file/byte limits. This
preserves the existing
eight-descriptor coverage and bootManager/full-manifest constraints. Background
retains static linking; other modules keep their natural source owners.

Every context explicitly declares `fileCountPolicy`. Background uses `advisory`:
`maxFiles=66` is a topology reference, and every count above it emits a warning
without a hard file limit. Popup, Dashboard main and Zen Home use `enforced`
with their existing nominal limits and integer 5% emergency band. Byte ceilings,
forbidden module inventories and entry/source ownership stay hard constraints.
The former Background count ceiling followed named-owner changes rather than a
measured wake threshold, so count alone must not force unrelated owners together.

2026-10-01 public build comparison for the bounded chunk-policy change:

| Context | Before files / raw / gzip | After files / raw / gzip |
| --- | --- | --- |
| Background | `68 / 2,594,455B / 710,058B` | `67 / 2,594,162B / 710,078B` |
| Popup | `8 / 311,472B / 97,102B` | `7 / 260,192B / 83,495B` |
| Dashboard main entry wrapper | `3 / 74,171B / 21,397B` | `3 / 22,968B / 7,960B` |
| Zen Home entry wrapper | `3 / 195,218B / 61,493B` | `3 / 195,218B / 61,493B` |

The before/after build IDs are `20261001095007-4aeb0e0daaa2-dirty` and
`20261001095804-4aeb0e0daaa2-dirty`. These development-worktree measurements
describe initial static imports, not all dynamically admitted Dashboard/Home
code, elapsed wake performance or clean release certification. The worker/base
split removes about 51KB of unused initial JS from Popup and the Dashboard
wrapper. Background retains the worker owner and almost the same total bytes;
its 67 files intentionally produce the advisory warning against reference 66.
The Dashboard HTML boot shell still needs the worker owner, so the smaller
`main.jsx` wrapper is not evidence that the full Dashboard cold boot became
51KB smaller or faster.

2026-08-17 public 측정값과 nominal budget은 다음과 같다. Background와 Zen Home의
file 수는 named owner chunk 분리가 늘어난 현재 Rollup graph를 재승인한 값이다.
두 context 모두 raw/gzip은 기존 byte ceiling 안에 있고 forbidden module inventory는
변경하지 않았다.

| Context | Manifest root | Measured files / raw / gzip | Budget files / raw / gzip |
| --- | --- | --- | --- |
| Background | `src/apps/background/index.js` | `62 / 2,347,734B / 633,702B` | `62 / 3,200,000B / 900,000B` |
| Popup | `src/pages/popup.html` | `8 / 299,525B / 93,243B` | `13 / 785,000B / 247,000B` |
| Dashboard main | `src/apps/dashboard/main.jsx` | `3 / 72,527B / 20,977B` | `68 / 1,650,000B / 500,000B` |
| Zen Home | `src/themes/plugins/zen/widgets/core/ZenCoreStatusClassicHome.jsx` | `43 / 1,469,557B / 428,993B` | `43 / 1,550,000B / 445,000B` |

2026-08-09 관측 대비 Background는 named runtime contract 분리로 `+3` files,
`+123,732B raw / +30,392B gzip`이고, Zen Home은 named materialization/projection
contract 분리로 `+3` files이지만 `-17,962B raw / -2,343B gzip`이다. Popup과
Dashboard main의 static closure는 lazy runtime boundary가 manifest에 반영되며 크게
줄었다. 이 rebaseline은 file-count topology만 현재 graph에 맞추며 byte ceiling과
forbidden graph 계약은 완화하지 않는다.

직전 development artifact를 Chrome for Testing 151의 명시적 하드웨어 렌더러에서
측정한 Dashboard visual threshold run은 10/10 samples 유효였다. Navigation 기준
`p50/p95/max`는 `3,940/4,854/4,854ms`, page-ready 기준은
`3,835/4,640/4,640ms`였으며 degraded/forced release는 모두 0이었다. 최신
`20260809042102` artifact의 foreground 10-sample 재검증은 사용 중인 workstation에서
세 번째 reload 전에 Chrome 창이 완전히 가려져 `document.visibilityState=hidden`이
되자 fail-closed 중단됐다. 따라서 직전 10/10 결과를 최신 artifact의 release 증명으로
승격하지 않으며, Chrome을 계속 보이게 둘 수 있는 환경에서 재실행해야 한다. 같은 최신
artifact의 non-pausing MV3 wake threshold run은 20/20 samples 유효였고 cold
`p50/p95/max`는 `497/719/921ms`, warm은 `1/3/3ms`였다. 각 cold probe는
현재 worker와 probe 전 successor를 닫은 뒤 최소 100ms 연속 no-worker를
증명했고, runtime resource budget도 모두 PASS였다. 이 실측은 global byte guard가 coarse inventory
tripwire이고, context forbidden graph·worker closure·실제 cold-wake threshold가
성능 및 topology 회귀의 우선 신호라는 현재 운영 원칙을 뒷받침한다.

Background byte budget은 settings/runtime owner가 늘어날 때마다 emergency
overhead 경계에 닿지 않도록 약 20%의 nominal headroom을 둔다. 전역
`maxOverheadPct=0.05`를 포함한 hard ceiling은 raw `3,360,000B`, gzip
`945,000B`다. Context checker는 모든 context의 raw/gzip nominal limit에 이 5%
emergency band를 적용한다. `fileCountPolicy=enforced`인 context의 정수 file 수는
내림한 여유만 인정하며, Background의 advisory file 수에는 적용하지 않는다. Forbidden
asset/module inventory에는 완화를 적용하지 않아 background import topology
회귀를 계속 차단한다.

각 context는 byte/file 상한과 함께 forbidden asset fragment inventory를
검사한다. Background는 pond/renderer, Sakura species, VNext/Classic research,
plugin catalog를 허용하지 않는다. Popup/dashboard main은 background kernel
artifact와 `src/apps/background/index.js` root를 허용하지 않으며, 세 context는
서로의 entry root를 static closure로 가져올 수 없다. Chunk 이름만 바꾸는 변경은 manifest key와
Rollup module inventory 중 하나에서 계속 실패해야 한다. Inventory에는
repository 상대 경로만 기록하고 absolute/user path와 외부 dependency path는
기록하지 않는다.

Vite worker sub-build는 main manifest와 위 inventory에 나타나지 않으므로
`.vite/entropy-worker-module-inventory/*.json`을 별도로 낸다. 현재 sidecar
`schemaVersion`은 `2`이며, 각 sidecar는
worker entry module id, emitted entry file, static/dynamic imports, project module
ids와 같은 순서의 Rollup rendered byte 기여도를 기록한다.
`check:zen-home-renderer-worker:artifact-contract`는 Home renderer worker의 import
종류를 재귀 순회하고 storage/model/main-thread snapshot/research module을 module id
기준으로 거부한다.

2026-08-19 G15.4 accepted baseline은 entry
`26,078B raw / 8,703B gzip`, 전체 worker sub-build closure
`15 files / 1,670,911B raw / 516,504B gzip / 492 project modules`다. Worker entry는
logical pond/bonsai runtime을 필요할 때 불러오는 작은 소유자로 유지된다. G15.4의
`ZenBonsaiG15RenderSpecies`와 `render-runtime.js`는 이미 생성된 graph만 소비하며,
full engine `index.js`와 generation-capable `ZenBonsaiG15Species.js`는 worker closure
금지 목록에 들어간다. Storage, workspace state, VNext/research module 금지도 그대로다.
2026-09-29 승인 baseline은 entry `27,531B raw / 9,109B gzip`, 전체
closure `1,933,443B raw / 622,018B gzip / 593 modules`다. 2026-09-27
Plume inventory보다 추가된 10개 owner는 crown/flower depth/Home framing,
wood shadow, Home frame seam geometry/renderer, water light transport/shader/
optical domain, petal depth다. 모델 생성·storage·research 소유권은 추가하지 않았다.

2026-10-13 의존성 검토 후 **모듈 수 baseline만 `593 → 645`로 재승인**했다.
기존 byte baseline, `+3%` 경고 / `+8%` 실패 비율, 모든 절대 상한과 forbidden
module 규칙은 유지한다. 640개 보존 inventory와의 정확한 차이는 수중 굴절
공통 상수, 수중 재질 계산, 실제 지느러미 pose를 재사용하는 그림자 mesh,
cold 그림자 atlas의 네 Pond owner와 `zenKoiShadowMaterial.js` leaf contract다.
마지막 계약은 cold bake가 GPU mesh 구현에서 상수를 가져오던 역방향 의존성을
제거하며, 모듈 수를 줄이기 위한 파일 병합이나 기능 제거는 없다.
절대 상한과 baseline 증가율은 독립적인 제한이며, 둘 중 더 엄격한 제한이
먼저 차단한다. Baseline 재승인이 절대 상한 인상을 강제하지 않는다.
모듈 수 baseline `645`의 `+8%` 선보다 기존 절대 상한 `680`이 낮으므로
현재는 `681`개부터 절대 상한으로 차단된다. 상한 자체를 넘는 baseline은
계속 잘못된 정책으로 거부한다.

검토는 전체 static/dynamic closure와 선택된 Home 구성, 모듈별 rendered bytes,
직접 source import/re-export 관계를 사용한다. 593개 당시 정확한 inventory는
보존돼 있지 않으므로 source tree 존재 비교를 과거 순증 52개의 정확한 내역으로
취급하지 않는다. 새 renderer owner의 책임, 기존 640개 inventory와의 정확한
차이, 생성·storage·앱 UI 경계 부재가 승인 근거다. 측정값과 한계는
`reports/zen-home-worker-budget-review-2026-10-13.md`에 기록한다.

Baseline 대비 `3%` 초과 증가는 `WARN`, `8%` 초과 증가는 baseline을 명시적으로
재승인하기 전까지 `FAIL`이다. Baseline 갱신은 실제 artifact 변화와 이유를 이 문서에 함께
기록해야 하며, 단순 chunk 이름 변경이나 동적 chunk 이동은 승인 근거가 아니다.

절대 비상선은 entry `900,000B raw / 280,000B gzip`, 전체 closure
`2,250,000B raw / 725,000B gzip`, closure project modules `680`이다. Closure
비상선은 현재 실측에 15%를 더한 뒤 raw는 `50,000B`, gzip은 `25,000B`
단위로 올림했다. Entry/module 비상선과 forbidden-module 계약은 유지한다. Entry와
전체 closure를 모두 실측하므로 동적 chunk로 비용을 옮겨도 전체 예산을 우회할 수
없다. 모듈 수는 거친 비상 지표이고, storage/VNext/research 등 forbidden module
규칙은 별도의 zero-tolerance architecture 계약으로 유지한다. PASS 로그의
`ownerRendered`는 Rollup rendered byte를 `pond`, `bonsai`, `artifacts`, `shared`, `vendor`로
분류해 회귀 주체를 진단한다. 이 값은 raw/gzip 하드 판정을 대체하지 않는다.
Emitted closure에 `globalThis/self/window.devicePixelRatio` read가 재진입해도
artifact contract가 실패한다.

Public `ZenCoreStatusClassicHome` static closure도 별도 `zenHome` context로
측정한다. G15 Home runtime을 React lazy boundary 뒤로 분리한 2026-08-19 surface는
`3 files / 195,218B raw / 61,494B gzip`이며, nominal ceiling은 기존의
`43 files / 1,550,000B raw / 445,000B gzip`을 더 올리지 않는다. Main/Home은
작은 workspace shell에서 시작하고 G15 generation/runtime은 그 명시적 동적 경계
뒤에서 준비된다.
Broad/structural/render species, main-thread Sakura renderer, Lab/A-B renderer,
classic analysis, candidate evaluator/score model이 이 closure에 들어오면 크기와
무관하게 실패한다. `ZenBonsaiPreview`는 nested dynamic runtime boundary로
분리되어 설정 preview를 열기 전에는 이 Home static closure에 합쳐지지 않는다.

Public `entropy-build-info.json`은 `schemaVersion`, timestamp+commit+tree-state를
담은 `buildId`, `gitCommitSha`, `gitTreeSha`, `dirty`, `lockfileSha256`,
`releaseProfile`, `extensionTarget`, `command`, `createdAt`을 기록한다.
`extensionOutDir` 같은 output/user path나 환경변수 값은 artifact에 기록하지
않는다. Public checker는 provenance shape, dirty/clean buildId 표기, research
manifest/module inventory를 함께 검증한다.

## 로그 규약

- 게이트 실행기: `[quality-gate:<profile>] START|PASS|FAIL ...`
- 테마 widget fallback 가드: `[theme-widget-no-fallbacks] PASS|FAIL ...`
- 테마 boot loader / visible boot shell 계약 가드: `[theme-boot-loader-contract] PASS|FAIL ...`
- 보안 표면/권한 가드: `[security-surface] PASS|FAIL ...`
- 출시 V1 baseline 가드: `[release-v1-baseline] PASS|FAIL ...`
- 개인 기준점 architecture 가드: `[personal-baseline-architecture] PASS|FAIL ...`
- nudge domain owner 가드: `[nudge-domain-owner-architecture] PASS|FAIL ...`
- 커버리지 예산: `[coverage-budget] PASS|FAIL ...`
- 번들 예산: `[bundle-budget] PASS|FAIL ...`
- context 번들 예산: `[context-bundle-budget] PASS|FAIL ...`
- Zen Home renderer worker closure: `[zen-home-renderer-worker-artifact] PASS|WARN|FAIL ...`
- public artifact/provenance: `[public-build-debug-surface] PASS|FAIL ...`

실패 로그는 실제 값과 제한 값을 함께 출력하여 원인 파악이 가능해야 합니다.

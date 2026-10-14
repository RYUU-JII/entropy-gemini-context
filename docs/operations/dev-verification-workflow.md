# Dev Verification Workflow

- Status: Active
- Owner: engineering workflow
- Last validated against code: 2026-08-19
- Path policy: current-only
- Canonical for: local verification flow for patches, builds, tests, commits, and pushes

짧은 수정은 빠르게 확인하고, 무거운 검증은 마지막에 몰아서 한다.

Windows 릴리즈 검사 owner인 `scripts/ci/run-build-checks.mjs`는 단일 Node
검사를 직접 실행하고, 나머지 npm 스크립트는 lifecycle의 `npm_execpath`를
현재 Node로 실행한다. `.cmd`를 직접 spawn하거나 셸 문자열로 인수를 합치지 않는다.

Pre-push의 변경 파일 목록은 JSON stdin으로 `scripts/lint.mjs`에 전달한다.
ESLint API가 전체 목록을 검사하므로 Windows 명령행 길이 제한 때문에 파일을
생략하거나 여러 셸 인수로 재전달하지 않는다. 일반 lint CLI도 로컬 ESLint의
JavaScript 진입점을 현재 Node로 실행하며, 설치·실행 실패를 성공으로 처리하지 않는다.

로컬 Linux/WSL 셸에서는 먼저 `source "$HOME/.nvm/nvm.sh" && nvm use` 로 `.nvmrc` 런타임을 맞춘다.

## 기본 원칙

- 수정 중에는 관련 테스트만 먼저 돌린다.
- 번들 영향이 걱정될 때만 빠른 빌드를 돌린다.
- 공용 계약, 설정, 리포터, 스토리지 경계, 공용 위젯을 건드렸으면
  `gate:structural`을 먼저 본다.
- 병합 전에는 `gate:product`, 실제 CWS 후보에서만 `gate:release`를 실행한다.

## 빠른 기준표

- 완성본 단위의 개발 확장 watch가 필요하면: `npm run dev`
- dev source preflight 없이 같은 artifact watch를 시작하려면: `npm run dev:quick`
- 두 명령 모두 HTTP dashboard나 브라우저를 자동으로 열지 않는다. publish 로그가
  나온 뒤 `dist/`를 압축해제된 확장으로 로드/Reload하고 extension options page를
  연다.
- release V1 이전 개발 프로필 shape가 남아 있으면
  `docs/operations/runbooks/pre-release-development-profile-reset.md`의 전체 초기화를
  한 번 수행한다.
- 작은 로직 패치: `npm run test:file -- tests/someFile.test.js`
- 파일 단위 fast 분기가 필요하면: `npm run test:file:fast -- tests/someFile.test.js`
- 로컬 logic 스모크만 빠르게 보고 싶으면: `npm run test:fast`
- 공용/비테마 로직만 보고 싶으면: `npm run test:fast:core`
- 테마 로직만 보고 싶으면: `npm run test:fast:theme`
- DOM/UI 스모크만 보고 싶으면: `npm run test:fast:dom`
- 빠른 전체 스모크를 보고 싶으면: `npm run test:fast:all`
- UI 수정 후 브라우저 반영 빌드가 필요하면: `npm run build` (`dist/`; 10초 초고속 dev 빌드)
- 스토어 배포용 번들 확인이 필요하면: `npm run build:prod` (`dist-prod/`; public 릴리즈 번들 및 용량 검증)
- 실패 원인 추적부터 시작하면:
  - `reports/test-failures/latest-run.json`
  - 실패 상태면 `reports/test-failures/latest-failure-summary.txt`
  - 구조화된 정보가 필요하면 `reports/test-failures/latest-failure-summary.json`
- 공용 계층 수정 후 최종 확인: `npm test`
- 구조 경계 수정 후 확인: `npm run gate:structural`
- 병합 전 제품 확인: `npm run gate:product` (`gate:ci`는 같은 호환 별칭)
- 실제 출시 후보 확인: `npm run gate:release`
- 기본 pre-push 훅은 `fast` 모드다. 변경 파일을 보고 `lint`, `logic fast`, `DOM fast`, `build:quick`을 필요한 것만 고른다. 전체 검증이 필요하면 `ENTROPY_PRE_PUSH_MODE=strict git push` 또는 `ENTROPY_PRE_PUSH_MODE=full git push`

### 공개 명령과 호환 별칭

중복 명령 본문은 아래 canonical 명령에만 둔다. 호환 별칭은 `npm run <명령> --`로
인수를 그대로 전달하며 별도의 pre/post hook이나 준비 작업을 추가하지 않는다.

| Canonical 명령 | 같은 작업을 호출하는 별칭 |
| --- | --- |
| `npm run build` | `build:quick`, `build:dev`, `build:dev:quick` |
| `npm run build:prod` | `build:prod:quick` |
| `npm run dev` | `dev:checked` |

`build`는 staged publisher의 `--artifact-only` 경로다. 전체 소스 구조 검사와
테스트는 포함하지 않으며 artifact 검증과 `dist/` 활성화는 유지한다. `build:prod`는
public bundle과 artifact 검증을 소유한다. `dev:quick`은 source preflight를 생략하는
별도 watch 경로이며, release·coverage·research·fast logic/DOM test lane도 각자
검증 범위가 달라 같은 별칭으로 합치지 않는다.

## 추천 흐름

### 1. 개별 수정 중

```bash
npm run test:file -- tests/related.test.js
```

DOM 없는 로직만 먼저 보고 싶으면:

```bash
npm run test:fast
```

공용 로직만 확인하고 싶으면:

```bash
npm run test:fast:core
```

테마 로직만 확인하고 싶으면:

```bash
npm run test:fast:theme
```

UI나 DOM 영향도 같이 빠르게 보고 싶으면:

```bash
npm run test:fast:dom
```

파일 하나만 빠른 경로로 태우고 싶으면:

```bash
npm run test:file:fast -- tests/related.test.js
```

### 2. UI나 번들 영향이 걱정될 때

```bash
npm run build:quick
```

### 3. 공유 코드나 여러 영역에 걸친 수정일 때

```bash
npm run gate:structural
```

행동 회귀까지 전부 확인해야 할 때만 `npm test`를 이어서 실행한다. `npm test`는
제품/출시 lane과 detached research의 격리 경계를 검증한다. Zen morphology 또는
pond workbench 자체를 수정했다면 별도로 다음을 실행한다.

```bash
npm run test:research
```

제품, detached research, 임시 테스트를 모두 확인하려면 `npm run test:all`을 쓴다.

### 4. 커밋 정리 끝나고 푸시 직전

```bash
npm run gate:product
```

## 실전 팁

- `npm run build`는 `--artifact-only` 개발 빌드다. 전체 소스 구조 검사는
  `gate:structural`이나 release 프로필로 실행한다. 병합용 `gate:product`는 구조
  검사 후 `build:artifact`로 public artifact를 검증하므로 같은 소스 검사를 반복하지 않는다.
- `npm run dev` 는 로컬 dev source preflight를 한 번 통과한 뒤 변경마다 격리된
  정적 dev artifact를 만들고 검증된 완성본만 `dist/`에 승격한다. 체크 없이 같은
  watch를 시작하려면 `npm run dev:quick` 를 쓴다. 빌드 전에 선언된 입력을
  별도 디렉터리에 복사하고 원본과 digest가 일치하는지 검증한다. 빌드 중 입력이 바뀌면
  진행 중 빌드는 이미 캡처한 입력으로 완료하고, watch가 다음 빌드에 새 입력을 반영한다.
- `dist/`는 Chrome에 로드한 개발 확장의 단일 활성 경로다. `npm run build`와 `npm run dev`는
  `.artifacts/dev-extension-builds/staging/`에서 빌드와 artifact 검증을 끝낸
  뒤 디렉터리 교체 트랜잭션으로만 이 경로를 갱신한다. 직전 완성본은
  `.artifacts/dev-extension-builds/previous/`에 남아 승격 실패 rollback의 근거가 된다.
  새 dev 버전을 활성화하는 공개 명령은 `npm run build`와 `npm run dev`다.
  실사용 `artifact pin`이 활성 상태면 같은 publisher가 새 완성본을
  `.artifacts/dev-extension-builds/latest/`에 게시하고 Chrome이 읽는 `dist/`의
  경로와 바이트는 보존한다. 정확한 pin ID로 `artifact release`를 실행하면
  latest를 기존 승격 트랜잭션으로 dist에 반영하고 수동 Reload 영수증을 반환한다.
  공개 artifact 명령과 지속 수명 계약은
  `qa/entropy-qa-control-plane.md`를 따른다. 설정 초기화나 프로필 이동은 하지 않는다.
- `npm run build:prod`, `npm run build:release`, `npm run build:chrome`은 public 프로필을
  `dist-prod/`에 만들고 live `dist/`를 건드리지 않는다. public Chrome 빌드가
  `dist/`를 대상으로 삼으면 빌드 계약 오류로 즉시 실패한다.
- Vite source HTML을 `http://localhost`에서 직접 열지 않는다. dashboard는 extension-origin runtime/storage owner가 필요한 제품 surface다.
- `npm test`도 제품 레인 전체를 실행하므로, 평소엔 국소 테스트와
  `gate:structural`이 기본이다. detached Zen workbench까지 확인하는 날에는
  `npm run gate:research`를 별도로 실행한다.
- `npm run test:fast` 는 core/theme 로직 스모크를 한 번에 도는 기본 빠른 루프다. 느린 `cx`/대형 theme integration과 DOM/UI 스위트는 제외한다.
- `npm run test:fast:core` 는 공용/비테마 로직 회귀를 빠르게 본다.
- `npm run test:fast:theme` 는 theme/zen 쪽 로직 회귀만 빠르게 본다.
- `npm run test:fast:dom` 은 DOM/UI 회귀만 빠르게 보는 보조 스위트다.
- `npm run test:fast:all` 은 두 빠른 스위트를 연속 실행하는 타협안이다.
- 기본 pre-push 훅은 smart fast 루프를 쓴다. 관련 없는 core/theme logic, DOM 테스트, build를 자동으로 건너뛰고, 둘 다 필요한 로직 검증은 한 번짜리 logic pass로 합친다. 더 엄격하게 밀고 싶으면 `verify:pre-push:strict` 또는 `verify:pre-push:full` 을 직접 실행하면 된다.
- 마지막 병합 지점에서만 `gate:product`를 돌리면 속도와 안정성 균형이 좋다.

## 기능 개발 시퀀스

- 작은 동작 단위로 먼저 패치한다.
- 바로 관련 테스트만 돌린다.
- 빠른 회귀 확인이면 `npm run test:fast` 를 먼저 본다.
- 렌더링이나 문서 조작을 건드렸으면 `npm run test:fast:dom` 을 이어서 본다.
- UI나 번들 영향이 있으면 `npm run build:quick` 를 본다.
- Chrome Web Store에 올릴 산출물을 만들 때만 `npm run cws:preflight` 를 본다.
- 이 흐름을 2~4번 반복한 뒤 마지막에 `npm run gate:product`로 마감한다.

## 커밋 주기

- 20~60분마다가 아니라, 논리 단위가 닫힐 때 커밋한다.
- 추천 단위:
  - 리팩터 1개
  - 버그 수정 1개
  - UI 조정 1개
- 관련 테스트가 통과한 단위로 자르면 나중에 되돌리기 쉽다.

## 푸시 주기

- 푸시 전에는 최소한 현재 커밋 묶음에 맞는 로컬 검증은 끝낸다.
- 일반 기능 작업:
  - 중간에는 필요할 때만 WIP 푸시
  - 최종 푸시 전에는 `npm run gate:product`
- 큰 리팩터:
  - 중간 저장용 푸시는 더 자주 해도 좋다.
  - 다만 리뷰 가능한 단위로 커밋을 분리하는 편이 낫다.

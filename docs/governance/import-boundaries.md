# Import Boundaries

- Scope: `src/**`
- Last Updated: `2026-10-11`

- Status: Active
- Owner: repository governance
- Last validated against code: 2026-10-11
- Path policy: current-only
- Canonical for: allowed import boundaries and retired facade policy

## Purpose
이 문서는 Entropy 코드베이스에서 cross-module import를 어디까지 허용하는지 정의한다.

목표는 세 가지다.

1. 파일 이동 시 수정 범위 축소
2. app/domain/theme/platform 간 결합도 제어
3. 리팩터링 시 public entry 기반 변경으로 수렴

## Core Rule
같은 모듈 내부는 상대 경로를 사용한다.
모듈 경계를 넘는 import는 alias + public entry만 사용한다.

여기서 모듈 경계는 현재 기준으로 아래를 뜻한다.

1. `src/apps/**`
2. `src/domains/**`
3. `src/platform/**`
4. `src/themes/core/**`
5. `src/themes/plugins/<themeId>/**`
6. `src/ui-kit/**`
7. `src/lib/**`

## Public Entry Points
아래 경로는 외부에서 참조 가능한 안정 경로다.

1. Theme widget lookup / preload
   - `@/themes/core/registry/index.js`
2. Theme definition / catalog reads
   - `@/themes/core/catalog.js`
3. Theme document apply / init
   - `@/themes/core/documentTheme.js`
4. Theme behavior / layout profile
   - `@/themes/core/profile.js`
5. Schedule visual policy lookup
   - `@/themes/core/scheduleVisualPolicy.js`
6. Theme motion contract
   - `@/themes/core/motion/index.js`
7. Theme ambient presentation delivery
   - `@/themes/core/presentation/ThemeAmbientPresentationContext.jsx`
8. Theme-core shared widget seams
   - `@/themes/core/widgets/shared/sites/index.js`
   - `@/themes/core/widgets/shared/filter/index.js`
   - `@/themes/core/widgets/shared/preview/Common.jsx`
   - `@/themes/core/widgets/shared/homeBrief/index.js`
   - `@/themes/core/react/useResolvedThemeState.js`
9. Zen internals exposed to non-theme callers
   - `@/themes/plugins/zen/api`
   - `@/themes/plugins/zen/api/index.js`
   - `@/themes/plugins/zen/api/koi.js`
   - `@/themes/plugins/zen/api/koiEntity.js`
   - `@/themes/plugins/zen/api/lab.js`
   - `@/themes/plugins/zen/api/learning.js`
   - `@/themes/plugins/zen/api/environment.js`
   - `@/themes/plugins/zen/api/waterLily.js`
   - `@/themes/plugins/zen/api/homeCanopyReading.js`
10. Shared UI surface
   - `@/ui-kit`
   - `@/ui-kit/index.js`
11. Platform favicon fetch/conversion adapter
   - `@/platform/browser/faviconFetch.js`
12. Local AI narration runtime
   - `@/domains/ai/index.js`
   - `@/platform/ai/index.js`

## Restricted Paths
아래 경로는 외부 모듈에서 직접 import하지 않는다.

1. `src/apps/dashboard/tabs/**`
   - theme 쪽에서는 직접 접근 금지
   - 대신 `@/themes/core/widgets/shared/**` 또는 app-provided props 사용
2. `src/apps/dashboard/utils/formatters.js`
   - theme 쪽에서는 직접 접근 금지
   - 대신 theme-core shared formatter 또는 domain-owned seam 사용
3. `src/apps/dashboard/stores/useProtocolStore.js`
   - theme/ui-kit에서 직접 import 금지
   - app layer가 필요한 값을 prop으로 주입한다
4. `src/themes/core/loaders/widgets.js`
   - app/domain/platform/ui-kit/lib에서 직접 접근 금지
   - 대신 `@/themes/core/registry/index.js` 사용
5. `src/themes/plugins/*/widgets/**`
   - app/domain/platform/ui-kit/lib에서 직접 접근 금지
   - 대신 `@/themes/core/registry/index.js` 또는 각 theme plugin의 public API 사용
6. retired broad theme facade entrypoints
   - retired broad facade
   - theme read는 `@/themes/core/catalog.js`, document side effect는 `@/themes/core/documentTheme.js` 사용
7. retired theme shared root
   - `src/themes/shared/**` 는 금지
   - shared theme UI는 `src/themes/core/widgets/shared/**` public exit 또는 `src/ui-kit/**` 로 이동한다
8. Schedule visual-policy declaration internals
   - app/domain/platform/ui-kit/lib는 `src/themes/plugins/*/scheduleVisualPolicy.js` 또는 `src/themes/core/schedule/policyContract.js`를 직접 import하지 않는다
   - app caller는 `@/themes/core/scheduleVisualPolicy.js`를 사용하고, plugin declaration만 leaf contract를 사용한다
9. Zen ambient presentation internals
   - app/domain/platform/ui-kit/lib는 `src/themes/plugins/zen/presentation/environment/**`를 직접 import하지 않는다
   - non-theme caller는 `@/themes/plugins/zen/api/environment.js`를 사용한다
   - dashboard UI timer는 `src/apps/dashboard/presentation/useDashboardZenAmbientPresentation.js` 하나가 소유하고 canvas/widget이 private clock을 만들지 않는다
10. Zen Home canopy reading internals
   - app/domain/platform/ui-kit/lib는 `src/themes/plugins/zen/model/bonsai/plume/**` 또는 private `model/bonsai/rendering/zenHomeCanopyReadingEnvelope.js`를 직접 import하지 않는다
   - non-theme caller는 `@/themes/plugins/zen/api/homeCanopyReading.js`의 `resolveZenHomeCanopyReadingEnvelope`와 `requireZenHomeCanopyReadingEnvelope`만 사용한다
   - 이 API는 pure model owner의 두 named export만 재노출한다. Model은 canonical full-history camera envelope, Home framing, analytical sway, frame-seam geometry와 garden-bed projection contract만 소비하며 React/runtime/storage를 읽지 않는다
   - Home composition owner가 정규화된 painted-left envelope를 CSS-pixel text inset으로 투영한다. App GardenFrame은 숫자를 전달받고 paper plane, canvas allocation, camera 또는 renderer ACK를 변경하지 않는다. 텍스트 gutter는 소비 surface가 별도로 소유한다

## Dashboard Tab Boundaries
`src/apps/dashboard/tabs/**` 내부는 같은 dashboard app 안에 있어도 sibling tab을 직접 import하지 않는다.

규칙:

1. tab 구현은 자기 tab subtree와 dashboard-owned seam만 본다.
2. `src/apps/dashboard/tabs/<tabA>/** -> src/apps/dashboard/tabs/<tabB>/**` (`tabA !== tabB`) 직접 import는 금지다.
3. shared controller/hook/UI가 필요하면 `src/apps/dashboard/hooks/**`, `src/apps/dashboard/settings/**`, 또는 다른 dashboard-owned non-tab seam으로 먼저 올린다.
4. filter preview 구현은 `src/apps/dashboard/tabs/filter/preview/**` 가 canonical owner다.

## Shared Seam Scope
`src/themes/core/widgets/shared/**`, `src/themes/core/react/**`, `src/themes/core/motion/**` 는 broad theme facade의 대체 범용 폴더가 아니다.

허용된 external exit는 아래만 사용한다.

1. `@/themes/core/widgets/shared/sites/index.js`
2. `@/themes/core/widgets/shared/filter/index.js`
3. `@/themes/core/widgets/shared/preview/Common.jsx`
4. `@/themes/core/widgets/shared/homeBrief/index.js`
5. `@/themes/core/react/useResolvedThemeState.js`
6. `@/themes/core/motion/index.js`

추가 규칙:

1. shared seam 내부는 `apps/**`, `themes/plugins/**`, `platform/**` 를 직접 import하지 않는다.
2. motion seam은 dashboard tab transition, workspace reveal, dashboard state transition, interaction recipe 같은 cross-theme motion contract만 가진다.
3. shared seam은 theme-neutral presentational UI, derived theme read hook, 또는 documented motion recipe contract만 가진다.
4. 새 cross-feature need가 생겨도 internal file deep import로 열지 않고 public exit를 먼저 갱신한다.

## Theme Preference Owner
`src/themes/core/state/themePreferenceRepository.js` 는 active `app-theme` read owner다.

추가 규칙:

1. app-theme read, mirror read/write helper, settings snapshot normalization, storage event 해석은 repository helper를 통해서만 수행한다.
2. feature/app/domain/background 코드는 `app-theme` 를 직접 읽거나 자체 fallback을 계산하지 않는다.
3. 허용된 예외는 settings command patch surface, storage metadata, theme state registry coverage뿐이다.
4. raw page-local `app-theme` mirror 접근은 `src/themes/core/state/themePreferenceMirror.js` 만 소유하고, repository는 해당 mirror helper를 재노출한다.
5. raw `chrome.storage.onChanged` 구독은 repository가 직접 소유하지 않고 `src/platform/storage/internal/chrome-storage/storageChangeBus.js` 를 통해서만 연결한다.
6. persisted `app-theme` read failure는 default theme fallback으로 숨기지 않는다. invalid stored value와 storage read failure는 서로 다른 상태다.

## Theme Public Surface
theme public surface는 책임별 seam으로 고정한다.

규칙:

1. theme definition lookup, theme object read, display catalog read는 `@/themes/core/catalog.js` 로 수렴한다.
2. document `data-theme` 적용, CSS variable injection, theme mirror/event dispatch는 `@/themes/core/documentTheme.js` 로 수렴한다.
3. dashboard/workspace/interaction motion contract는 `@/themes/core/motion/index.js` 로 수렴한다.
4. Schedule의 theme-specific recipes, typography, tokens, timeline paint lookup은 `@/themes/core/scheduleVisualPolicy.js` 로 수렴한다. app은 plugin declaration이나 leaf schema를 직접 읽지 않는다.
5. theme ambient object delivery는 `@/themes/core/presentation/ThemeAmbientPresentationContext.jsx`로 수렴한다. theme core는 이 context에서 solar 계산이나 persistence를 소유하지 않는다.
6. Zen ambient build/resolve/refresh는 `@/themes/plugins/zen/api/environment.js`로 수렴한다. non-theme caller는 implementation projection을 deep import하지 않는다.
7. dashboard boot/loading의 widget capability, Main widget owner, tab icon variant lookup은 `@/themes/core/surfaceDescriptor.js`로 수렴한다. 이 seam은 full plugin manifest/profile/theme object를 노출하지 않는다.
8. legacy broad theme facade entrypoints 는 retired 상태이며 다시 도입하지 않는다.
9. 같은 책임이면 기존 seam public surface를 의도적으로 확장한다.
10. 새 책임이면 새 named seam을 추가하고 문서와 CI를 같이 갱신한다.
11. broad facade를 다시 만들지 않는다.
12. runtime theme seam은 unknown theme id를 default theme로 대체하지 않는다. 입력 경계에서만 canonicalize하고, registry/loader/profile/catalog/document apply 경계는 assert한다.
13. 실제 Schedule DOM 분화가 필요해지면 visual policy deep import나 theme-id switch를 추가하지 않고 별도 named Schedule surface capability를 설계한다.
14. Zen Home의 canopy text exclusion은 `@/themes/plugins/zen/api/homeCanopyReading.js`로 수렴한다. 전체 canvas bounds나 현재 growth/bloom pose를 두 번째 읽기영역 진실로 사용하지 않는다.

## Allowed Direction
현재 기준 권장 방향은 아래와 같다.

1. `themes -> ui-kit`
2. `themes -> themes/core/widgets/shared/**`
3. `themes -> themes/core/react/**`
4. `apps/domains/platform/ui-kit/lib -> themes/core/registry`
5. `apps/domains/platform/ui-kit/lib -> themes/core/profile`
6. `apps/domains/platform/ui-kit/lib -> themes/core/catalog`
7. `apps -> themes/core/scheduleVisualPolicy`
8. `apps/domains/platform/ui-kit/lib -> themes/core/motion`
9. `apps -> themes/core/presentation/ThemeAmbientPresentationContext.jsx`
10. `apps -> themes/core/documentTheme`
11. `apps/domains/platform/ui-kit/lib -> themes/plugins/zen/api`
12. `apps/themes/plugins/tests -> shared theme public exits only`
13. `apps/dashboard loading owners -> themes/core/surfaceDescriptor`
14. `apps -> platform/browser/faviconFetch` for composition; domain owners consume the injected function port and do not import `apps/**`

직접 deep import로 내부 구현 파일을 참조하는 방향은 지양한다.

## Examples
좋은 예:

```js
import { getThemeWidget } from '@/themes/core/registry/index.js';
import { getThemeCatalogEntry } from '@/themes/core/catalog.js';
import { initializeDocumentTheme } from '@/themes/core/documentTheme.js';
import { getScheduleVisualPolicy } from '@/themes/core/scheduleVisualPolicy.js';
import { getDashboardTabTransitionProfile } from '@/themes/core/motion/index.js';
import { ThemeAmbientPresentationProvider } from '@/themes/core/presentation/ThemeAmbientPresentationContext.jsx';
import { SitesRegistryScopeTabs } from '@/themes/core/widgets/shared/sites/index.js';
import ThemeFilterTestScaffold from '@/themes/core/widgets/shared/filter/index.js';
import SharedHomeBriefCard from '@/themes/core/widgets/shared/homeBrief/index.js';
import { useResolvedThemeState } from '@/themes/core/react/useResolvedThemeState.js';
import { DEFAULT_KOI_TUNING } from '@/themes/plugins/zen/api/koi.js';
import { resolveZenAmbientPresentation } from '@/themes/plugins/zen/api/environment.js';
import { drawWaterLilyRefined } from '@/themes/plugins/zen/api/waterLily.js';
import { resolveZenHomeCanopyReadingEnvelope } from '@/themes/plugins/zen/api/homeCanopyReading.js';
```

나쁜 예:

```js
import { getWidget } from '@/themes/core/loaders/widgets.js';
import { formatMinutes } from '@/apps/dashboard/utils/formatters.js';
import { useCycle } from '@/apps/dashboard/stores/index.js';
import TargetProtocolPanel from '@/themes/core/widgets/shared/sites/TargetProtocolPanel.jsx';
import SharedHomeBriefCard from '@/themes/shared/homeBrief/SharedHomeBriefCard.jsx';
import { zenScheduleVisualPolicy } from '@/themes/plugins/zen/scheduleVisualPolicy.js';
import { resolveZenAmbientPresentation } from '@/themes/plugins/zen/presentation/environment/zenAmbientPresentation.js';
```

## When A New Cross-Module Need Appears
새로운 cross-module import가 필요하면 아래 순서를 따른다.

1. 먼저 기존 public entry에 이미 노출된 심볼인지 확인한다.
2. 있으면 그 seam의 public surface만 확장한다.
3. 기존 seam과 책임이 자연스럽게 맞지 않으면 새 named seam을 추가한다.
4. 호출부를 새 public entry로 바꾼다.
5. 같은 패턴이 반복되면 lint 또는 dedicated architecture check를 추가한다.

원칙은 "구현 파일을 외부에 열지 말고, 출구를 하나 만든다"이다.

## Lint Contract
이 규칙의 자동 강제는 `eslint.config.js`에서 관리한다.

기본 정책:

1. `themes`는 `apps/dashboard/**` 전체를 직접 import하지 않는다.
2. `ui-kit`는 dashboard stores나 dashboard-owned hooks를 직접 import하지 않는다.
3. `apps/domains/platform/lib`는 theme widget internals를 직접 import하지 않는다.
4. `apps/domains/platform/lib`는 `themes/core/loaders/widgets.js`를 직접 import하지 않는다.
5. shared theme seam callers는 public exit만 사용하고 internal file deep import를 하지 않는다.
6. `apps/domains/platform/ui-kit/lib`는 retired `themes/core/index.js` / `themes/index.js` broad facade를 import하지 않는다.

## Script Contract
lint 외에도 일부 high-value boundary는 dedicated CI script로 중복 강제한다.

현재 script-level로 잠긴 규칙:

1. `apps/domains/platform/ui-kit/lib` 는 `@/themes/core/registry/index.js` 대신 `themes/core/loaders/widgets.js` 나 retired widget loader surface를 직접 import하지 않는다.
2. `apps/domains/platform/ui-kit/lib` 는 `themes/plugins/*/widgets/**` 를 직접 import하지 않고 registry 또는 theme plugin public API를 사용한다.
3. `themes/core/widgets/shared/**`, `themes/core/react/**`, `themes/core/motion/**` 의 public exit/deep import 규칙은 별도 architecture check로도 강제된다.
4. `src/ui-kit/**` 는 dashboard owner를 직접 import하지 않고, theme-core shared seam도 허용된 public exit만 사용한다.
5. `apps/domains/platform/ui-kit/lib` 는 `@/themes/core/catalog.js` / `@/themes/core/documentTheme.js` 대신 retired `@/themes/core/index.js` / `@/themes/index.js` 를 사용할 수 없다.
6. dashboard Schedule caller는 plugin-owned policy나 leaf contract를 deep import하지 않고 `@/themes/core/scheduleVisualPolicy.js`만 사용한다. canonical manifests는 모두 자기 top-level `scheduleVisualPolicy` capability를 선언해야 한다.
7. app/domain/platform/ui-kit/lib caller는 Zen ambient projection internals를 deep import하지 않고 `@/themes/plugins/zen/api/environment.js`만 사용한다.
8. `src/domains/**` 는 `src/apps/**` 를 import하지 않는다. Favicon capture는 app composition이 `@/platform/browser/faviconFetch.js`를 domain service port로 주입한다.
9. app/domain/platform/ui-kit/lib caller는 Plume camera/framing/motion 및 private canopy reading model을 deep import하지 않는다. `check-theme-public-entry-boundaries.mjs`가 `homeCanopyReading.js`의 exact 두 named export와 model의 pure geometry dependency 범위도 함께 보호한다.

## Non-Goals
이 문서는 아래를 목표로 하지 않는다.

1. 모든 폴더에 `index.js` 추가
2. 전체 레포를 package 단위로 재분할
3. theme 내부 세부 렌더러/실험용 로직까지 전부 public API화

지금 원칙은 전면 구조화가 아니라, 변경 충격이 큰 seam만 안정화하는 것이다.

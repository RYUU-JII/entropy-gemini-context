# Social Metrics Architecture

이 경로는 social metrics hide/cleanup 엔진의 canonical internal home이다.

## Ownership

- `socialMetricsManager.js`
  - public facade
  - observer lifecycle 연결
  - active runtime state 적용
- `core/scanController.js`
  - mutation payload -> dirty root -> queued scan orchestration
- `core/candidateMatcher.js`
  - metric candidate match / mark / restore
- `core/runtimeState.js`
  - canonical settings -> compiled runtime state
- `core/cleanupCoordinator.js`
  - clear/restore orchestration
- `core/compiledScanPlan.js`
  - host + active filters -> selector/pattern/root plan
- `core/observerInterestPlan.js`
  - selector dependencies + adapter semantic attributes + owner attributes -> live observer interest
  - high-churn `class`/`style` dependencies stay initial-scan-only unless explicitly approved
- `core/targetingHealthProjector.js`
  - latest exact scan operation facts -> content-free targeting health snapshot
  - no DOM discovery, persistence, drift promotion, or recovery authority
- `core/dirtyRootReducer.js`
  - mutation roots collapse + root prefilter
- `core/semanticActionMetricMatcher.js`
  - profile-driven action cluster matching
  - scores nearby numeric text by action label, DOM proximity, leaf-ness, and expected order
- `adapters/platformSemanticAdapters.js`
  - host -> semantic candidate/mutation-root adapter registry
- `adapters/socialMetricTargetProfiles.js`, `adapters/*Profile.js`
  - canonical site id -> immutable `metricSelectors` / `scanRoots` owner profile
  - host-specific target vocabulary stays beside its adapter
- `adapters/redditShadowMetricsOwner.js`
  - Reddit `shreddit-post` open shadow-root observer/style/marker lifecycle
  - bounded host-local hydration rescans and exact teardown
- `adapters/*.js`
  - host-specific classification and metadata cleanup
  - TikTok keeps post-detail action counts, author dates, comment time/like
    leaves, comment-tab/reply labels, Explore card counts, profile totals, and
    non-interactive thumbnail view indicators inside its bounded adapter
- `contracts/socialMetricContracts.js`
  - group/filter contract constants

## Guardrails

- 새 host-specific logic는 `socialMetricsManager.js`에 직접 넣지 말고 `adapters/`로 보낸다.
- mutation filtering/scan orchestration 변경은 `core/scanController.js`와 `core/dirtyRootReducer.js`에서 처리한다.
- selector root narrowing은 `adapters/socialMetricTargetProfiles.js`와 각 host
  `*Profile.js`의 `scanRoots`에서 선언한다.
- observer attribute filter를 수동 상수 목록으로 복제하지 않는다. compiled selector dependency와
  `platformSemanticAdapters.js`의 semantic mutation attribute 계약을 함께 사용한다.
- cleanup side effect는 candidate matcher 안에서 직접 DOM shape를 만지지 말고 adapter/cleanup seam으로 보낸다.
- top-document mutation은 계속 `ObserverHub`가 소유한다. Host 전용 shadow observer가 필요하면
  실제 open shadow 경계와 lifecycle cleanup을 함께 소유하고 root 수와 재스캔을 제한한다.
- public runtime caller는 `SocialMetricsManager.update(canonicalSocialMetricsSetting)`만 사용한다.
- compiled filter map caller는 `projectCompiledRuntimeSocialMetricsSetting()`에서 single-setting으로 투영한 뒤 호출한다. Full map을 persisted settings normalizer로 되돌리지 않는다.

## Selector Strategy

- Known selectors are the default path. Keep them narrow, stable, and cheap.
- Semantic fallback must be host-owned, root-bounded, and capped. Do not scan broad page selectors like `body span`.
- Add a new platform semantic path by wiring its adapter through `adapters/platformSemanticAdapters.js`; keep host-specific profiles inside the host adapter.
- Prefer strong surface signals before text matching: video links, action buttons, semantic attributes, or platform roots.
- Mixed TikTok control labels such as `댓글 (254)` and `3개 더 보기` keep the
  control and icon intact; the adapter owns count-only text replacement and
  exact restore rather than hiding the interactive owner.
- TikTok targets that are actually hidden—numeric leaves, dates/separators,
  profile totals, and non-interactive overlays—also carry the adapter-owned
  collapse marker so their layout box is removed. Mixed control labels do not.
- Use strict text gates for fallback candidates so titles and body copy are not hidden just because they contain metric-like words.
- Mutation fallback should react to meaningful added roots only, not every character update inside a large page region.
- X Today’s News metadata stays inside the exact `news_sidebar_article_*`
  owner and its text leaf spans. Do not admit ancestor spans: marking one hides
  the projected child through inherited visibility. Project combined segments
  per option, treat `Trending now` as a `timeSignals` freshness signal,
  preserve category context, and restore the exact original text during cleanup.

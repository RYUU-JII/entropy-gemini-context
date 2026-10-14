# CI Docs

이 경로는 품질 게이트와 정적 검사를 설명한다.

## 문서 구조 관련 체크

- `npm run check:docs:paths`

이 체크는 active docs 의 경로 드리프트, 깨진 링크, 버전/`final` 네이밍 재유입을 막기 위한 최소 가드다.

## Fast feedback loop

`check:docs:paths` now runs in both `predev` and `prebuild`, so stale doc paths fail early before the full gate.

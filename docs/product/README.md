# Product Docs

이 경로는 Entropy의 철학, 제품 설명, 세부 모델과 화면별 요구사항을 모은다.

## 읽는 순서

**처음에는 [선언문 — 바깥의 마찰, 안쪽의 선택](./entropy-manifesto.md)을 읽는다.**
수식 없이 전체 흐름을 이해할 수 있고, 마지막의 주장 지도에서 필요한 분석으로 들어갈 수 있다.
현재 기능과 테마가 궁금하면 [프로젝트 소개](./project-introduction.md),
설치·개발 진입점이 필요하면 [루트 README](../../README.md)를 본다.

설명의 중심은 **예측 가능한 조작, 갱신되는 보상 기대, 낮은 재시도 비용의 결합**이다.
콘텐츠가 다양하다는 사실만으로 기대 가치가 높아지지는 않는다. 같은 동작으로 다음 후보를
쉽게 확인할 수 있고, 그 확인에 아직 가치가 있으리라고 기대할 때 반복할 이유가 남는다.
Entropy는 이 관계에서 표시·비용·결정 지점을 바꾸며, 엔트로피의 일괄 감소를 목표로 삼지 않는다.

```text
README: 프로젝트의 짧은 진입점
  ├─ 선언문: 왜 Entropy인가 / 이름과 전체 흐름 / 핵심 주장 지도
  │    ├─ 예측·가치 학습: 경험이 기대와 선택을 어떻게 바꾸는가
  │    ├─ 정보이론: 어느 층위의 불확실성·압축·비용을 다루는가
  │    └─ 보상·안도 동기: 왜 그 결과를 원하고 반복하게 되는가
  └─ 프로젝트 소개: 제품 원칙 / 현재 기능 / 테마 / 구현 정본 연결

세부 모델의 검증 질문 → 연구 backlog: 후속 연구 방식과 재검토 조건
```

## 문서별 책임

| 문서 | 상태 | 담당 질문 | 상세 설명을 넘길 곳 |
| --- | --- | --- | --- |
| [선언문](./entropy-manifesto.md) | `Active` | 왜 만들며 어떤 변화를 지향하는가? | 주장별 수식·근거는 아래 세부 모델 |
| [프로젝트 소개](./project-introduction.md) | `Active` | 그 철학을 어떤 제품 원칙·기능·세계로 구현하는가? | 정확한 기능·정책·owner는 해당 Active PRD와 architecture |
| [다섯 사용일 여정과 최소 안내](../architecture/progression/five-day-journey-guidance-design.md) | `Active` | 첫 다섯 사용일에 무엇을 공개하고 언제 설명하는가? | 공개 일정, 후린 설치 연출과 Guidance Runtime의 상태·명령 |
| [예측과 가치 학습](./prediction-value-learning-model.md) | `Active` | 예측 부호화와 보상 학습은 어떻게 연결되고, 기대는 어떻게 바뀌는가? | 정보량·표현 압축은 정보이론, 안도 동기는 동기 가설 |
| [정보이론 모델](./entropy-information-theory-model.md) | `Active` | 조작·콘텐츠·결과 중 무엇의 불확실성이며, 기대 가치·압축·비용은 어떻게 다른가? | 시간에 따른 가치 갱신은 예측 모델 |
| [보상·안도 루프 가설](./attention-relief-loop-hypothesis.md) | `Draft` | 재미와 안도, 내적 불편함과 선택 부담은 어떤 역할을 하는가? | 예측 오차는 예측 모델, 실제 개입 계약은 architecture |
| [분재 습관 피드백과 회복](./garden/bonsai-habit-feedback-foundation.md) | `Proposed` | 어떤 관측과 기준으로 활성화를 판단하고 회복시킬 것인가? | 연구 근거, 최소 판정 모형, 증거·일일 마감 계약; 현재 구현 정본은 stats와 Zen Active 문서 |
| [효과 연구 backlog](./backlog/friction-effect-research-backlog.md) | `Hold` | 나중에 어떤 방식과 조건에서 확인할 수 있는가? | 개별 가설과 반증 질문은 각 세부 모델 |
| [추가 기능 후보](./backlog/feature-candidates.md) | `Hold` | 어떤 기능을 보류했으며 언제 다시 검토할 것인가? | 채택 후 구현 계약은 관련 Active PRD와 architecture |

## 상태와 주장 해석

`Active`는 현재 쓰는 제품 설명과 모델 정의의 기준이며 과학적 입증 등급이 아니다.
각 문서 안에서는 다음을 구분한다.

- **제품 원칙:** 사용자의 목적과 사전 약속, 예측 가능한 보호, 로컬 데이터, 테마별 완성도.
- **일반 이론·연구:** 원 출처가 다룬 대상과 범위 안에서 참고하는 개념과 결과.
- **제품 가설:** 그 원리를 Entropy의 경험에 연결한 예상; 실제 효과는 별도 검증 대상.
- **구현 사실:** 코드와 Active 기능 계약으로 확인하는 현재 동작.

선언문은 직관이 이어지는 글로 유지한다. 세부 모델은 정의·근거·가정·반례를 맡는다.
모든 문서에 같은 면책 문구나 동일한 이론 설명을 복제하지 않는다. 다만 단독으로 읽어도 제품
가설이 현재 기능 약속으로 바뀌지 않도록 해당 경계를 짧게 밝힌다.
`Draft`와 `Hold`는 현재 구현 지시가 아니며, 모델의 식을 새 감정 점수·정책·계측으로 옮기지 않는다.

## 화면과 후속 과제

- `landing/`: 선언문을 공개 경험으로 옮기는 화면과 표현 계약
- `dashboard/`: Settings, Protection, unified workspace, home IA
- `popup/`: popup and overview journey
- `garden/`: ambient and garden-specific product docs
- `ui/`: cross-surface UI unification docs
- `backlog/`: 후속 과제 문서; 현재 상태는 각 문서의 metadata를 따른다
  - `feature-candidates.md`: `Hold`; 추가 기능과 확장팩 후보, 보류 이유와 재검토 조건
  - `friction-effect-research-backlog.md`: `Hold`; 로컬 효과 해석과 명시적 Lab 연구
  - `main-thread-cooperative-scheduling-backlog.md`: `Active`; 현재 cooperative scheduling 적용과 rollout 경계

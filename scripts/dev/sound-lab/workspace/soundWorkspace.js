import { scanSoundCatalog } from '../scanner/soundCatalogScanner.js';
import { getDefaultSynthRegistry } from '../engine/synths/SynthRegistry.js';
import { SOUND_BRIEFS } from './soundBriefs.js';
import { SOUND_CANDIDATES } from './soundCandidates.js';

export const REVIEW_DECISIONS = Object.freeze({
  discuss: '방향 논의', revise: '수정 요청', prefer: '이 시안 선호', hold: '보류', silence: '무음 제안',
});
export const REVIEW_TAGS = Object.freeze(['너무 날카로움', '더 부드럽게', '더 짧게', '존재감 부족', '반복 시 피로함', '장면과 잘 맞음']);

export function createSoundWorkspace() {
  const registry = getDefaultSynthRegistry();
  const scan = scanSoundCatalog();
  const ids = new Set();
  for (const candidate of SOUND_CANDIDATES) {
    if (ids.has(candidate.id) || !scan.items.some(item => item.id === candidate.targetId)
      || !registry.has(candidate.synthId) || !candidate.version || !candidate.sourcePath
      || !candidate.rationale || !candidate.changeNote) {
      throw new Error(`SOUND_LAB_CANDIDATE_INVALID:${candidate.id}`);
    }
    ids.add(candidate.id);
  }
  return scan.items.map(item => {
    const brief = SOUND_BRIEFS[item.id];
    if (!brief || brief.length !== 4) throw new Error(`SOUND_LAB_BRIEF_MISSING:${item.id}`);
    const candidates = SOUND_CANDIDATES.filter(candidate => candidate.targetId === item.id)
      .map(candidate => ({ ...candidate, role: 'research' }));
    if (item.liveStatus === 'SYNTH' && item.liveDetails.hasPlayFunction) {
      candidates.unshift({
        id: `${item.id}:product`, targetId: item.id, role: 'product', version: 'checkout',
        name: '제품 연결본', rationale: '현재 체크아웃의 테마 사운드 팩에 연결된 합성 함수를 직접 청음합니다.',
        changeNote: '기본 컨텍스트의 단독 청음입니다. 실제 앱의 타이밍·믹스·배포 여부는 별도 확인이 필요합니다.',
        sourcePath: `src/themes/plugins/${item.theme}/sound/${item.theme}SoundPack.js`, parameters: {},
      });
    }
    return {
      id: item.id, theme: item.theme, scope: item.scope, group: item.artifactName,
      name: brief[0], moment: brief[1], purpose: brief[2], question: brief[3],
      concept: item.acousticConcept, layers: item.physicalLayers, recipe: item.agentRecipePrompt,
      duration: item.targetDuration, kind: item.kind, bus: item.bus,
      productStatus: item.liveStatus, productReason: item.liveDetails.reason === undefined ? '' : item.liveDetails.reason,
      candidates,
    };
  });
}

export function assertReviewRequest(request, targets, buildRevision) {
  if (!request || request.schemaVersion !== 1 || request.buildRevision !== buildRevision) {
    throw new Error('SOUND_LAB_REVIEW_REVISION_MISMATCH');
  }
  const target = targets.find(item => item.id === request.targetId);
  if (!target) throw new Error('SOUND_LAB_REVIEW_TARGET_INVALID');
  const candidate = request.candidateId === null ? null : target.candidates.find(item => item.id === request.candidateId);
  if (candidate === undefined || (candidate === null && target.candidates.length !== 0)) {
    throw new Error('SOUND_LAB_REVIEW_CANDIDATE_INVALID');
  }
  if (!Object.hasOwn(REVIEW_DECISIONS, request.decision) || typeof request.note !== 'string'
    || request.note.length > 6000 || typeof request.context !== 'string' || request.context.length > 2000
    || !Array.isArray(request.tags) || request.tags.length > REVIEW_TAGS.length
    || new Set(request.tags).size !== request.tags.length || request.tags.some(tag => !REVIEW_TAGS.includes(tag))
    || typeof request.auditioned !== 'boolean') throw new Error('SOUND_LAB_REVIEW_FIELDS_INVALID');
  if (request.decision === 'prefer' && (!candidate || !request.auditioned)) throw new Error('SOUND_LAB_REVIEW_LISTEN_FIRST');
  if (!request.parameters || typeof request.parameters !== 'object' || Array.isArray(request.parameters)) {
    throw new Error('SOUND_LAB_REVIEW_PARAMETERS_INVALID');
  }
  const allowed = candidate === null ? {} : candidate.parameters;
  if (Object.keys(request.parameters).length !== Object.keys(allowed).length) throw new Error('SOUND_LAB_REVIEW_PARAMETERS_INVALID');
  for (const [key, value] of Object.entries(request.parameters)) {
    if (!Object.hasOwn(allowed, key) || !Number.isFinite(value)
      || (key === 'intensity' && (value < 0.2 || value > 1.3))
      || (key === 'basePitch' && (value < allowed.basePitch * 0.5 || value > allowed.basePitch * 1.5))
      || !['intensity', 'basePitch'].includes(key)) throw new Error('SOUND_LAB_REVIEW_PARAMETERS_INVALID');
  }
  return { target, candidate };
}

export function formatAgentRequest(target, candidate, draft, buildRevision) {
  return `Entropy 사운드 디자인 협업 요청

기능: ${target.name}
사용 순간: ${draft.context || target.moment}
목적: ${target.purpose}
논의할 질문: ${target.question}
Sound ID: ${target.id} (${target.theme} / ${target.kind} / ${target.bus})
제품 코드 연결 상태: ${target.productStatus}
대상 시안: ${candidate ? `${candidate.name} / ${candidate.id} / ${candidate.version}` : '아직 없음 — 방향부터 논의'}
청음 조건: ${JSON.stringify(draft.parameters)}
현재 조건 청음: ${draft.auditioned ? '예' : '아니오'}
피드백: ${REVIEW_DECISIONS[draft.decision]}
인상: ${draft.tags.join(', ') || '미선택'}
의견: ${draft.note || '함께 방향을 논의하고 싶습니다.'}
연구소 빌드: ${buildRevision}

작업 계약:
1. docs/architecture/sound/sound-lab-architecture.md와 scripts/dev/sound-lab/README.md를 읽고 기능 맥락부터 논의한다.
2. workspace/reviews/의 해당 Sound ID 피드백을 읽고, 기존 시안을 보존하며 새 ID의 후보를 workspace/soundCandidates.js에 등록한다. 합성 원본·버전·의도·변경점을 함께 남긴다.
3. npm run build:sound-lab 후 연구소에서 비교할 수 있게 정리한다. 제품 연결본과 연구 시안의 동일성을 추정하지 않는다.
4. 선호는 제품 적용 완료가 아니다. 채택한 작업물은 정식 sound domain / theme sound pack 경로로 통합하고, 기능 타이밍과 관련 검증을 확인한다.`;
}

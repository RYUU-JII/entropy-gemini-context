// The accepted worker ACK proves the runtime path; a catalog/default declaration
// or a painted canvas alone cannot prove which product model actually rendered.
// src/lib/debug/zenTrace.dev.js bounds signature values at 180 characters.
// A summary establishes a nonempty identity was present, never exact equality.
const TRACE_SIGNATURE_PREVIEW_LENGTH = 180;
const isTraceSignaturePresent = value => {
  if (typeof value === 'string') return value.length > 0;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 2 && keys.includes('length') && keys.includes('preview')
    && Number.isSafeInteger(value.length) && value.length > TRACE_SIGNATURE_PREVIEW_LENGTH
    && typeof value.preview === 'string'
    && value.preview.length === TRACE_SIGNATURE_PREVIEW_LENGTH + 3
    && value.preview.endsWith('...');
};

export function requireDashboardBonsaiRenderIdentity(snapshot, request) {
  if (request.themeId !== 'zen' || request.surfaceId !== 'main') return null;
  // Trace-off boot is an explicit low-overhead measurement mode. It makes no
  // renderer-identity claim; full-trace capture owns that product acceptance.
  if (request.traceMode === 'off') return null;
  const history = snapshot?.boot?.zenTraceHistory;
  const ack = Array.isArray(history)
    ? history.findLast(entry => entry?.event === 'bonsai_worker:first_frame_ready')?.details?.metadata
    : null;
  // Marks mode may deliberately omit event payloads; only full trace requires
  // their presence. Available marks-mode ACKs receive the same strict check.
  if (request.traceMode === 'marks' && !ack) return null;
  if (ack?.renderBackend !== 'pixi_plume'
    || ack?.renderer !== 'zen_bonsai_worker_pixi_plume'
    || ack?.renderPlanModel !== 'plume'
    || ack?.renderPlanContract !== 'zen-bonsai-plume-render-plan-v1'
    || !isTraceSignaturePresent(ack?.sceneSignature)
    || typeof ack?.bonsaiMaterializationKey !== 'string' || ack.bonsaiMaterializationKey.length === 0
    || !isTraceSignaturePresent(ack?.inputSignature)) {
    const error = new Error('QA_DASHBOARD_PLUME_RENDER_IDENTITY_INVALID');
    error.diagnostic = ack;
    throw error;
  }
  return Object.freeze({
    renderBackend: ack.renderBackend, renderer: ack.renderer,
    model: ack.renderPlanModel, contract: ack.renderPlanContract,
    identityEvidence: 'accepted_ack_trace_presence_only',
    sceneSignature: ack.sceneSignature,
    bonsaiMaterializationKey: ack.bonsaiMaterializationKey,
    inputSignature: ack.inputSignature,
  });
}

// Long native-input journeys can evict the ACK from the 260-event page ring.
// Keep the two actual observations in one proven page/trace session; a newer
// ACK still takes precedence and receives the same strict validation.
export function requireDashboardBonsaiJourneyRenderIdentity(readySnapshot, finalSnapshot, request) {
  if (request.themeId !== 'zen' || request.surfaceId !== 'main') return null;
  const before = readySnapshot?.boot?.zenTraceHistory;
  const after = finalSnapshot?.boot?.zenTraceHistory;
  const session = Array.isArray(before) ? before.at(-1)?.sessionId : null;
  if (typeof readySnapshot?.href !== 'string' || readySnapshot.href !== finalSnapshot?.href
    || typeof session !== 'string' || session.length === 0
    || !Array.isArray(after) || after.length === 0
    || [...before, ...after].some(entry => entry?.sessionId !== session)) {
    throw new Error('QA_DASHBOARD_PLUME_RENDER_OBSERVATION_SESSION_CHANGED');
  }
  const identity = requireDashboardBonsaiRenderIdentity({
    boot: { zenTraceHistory: [...before, ...after] },
  }, request);
  return Object.freeze({ ...identity, observationWindow: 'capture_ready_to_final', traceSessionId: session });
}

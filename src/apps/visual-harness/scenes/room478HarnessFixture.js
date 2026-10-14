import { tRuntimeWithLanguage } from '../../../domains/settings/i18n/runtime.js';

export const ROOM478_HARNESS_HANDOFF = Object.freeze({
  origin: Object.freeze({ x: 0.54, y: 0.55 }),
  runId: 'visual-room-478',
  seed: 0,
  source: 'global_sentinel_success',
});

function translateRoom478(key) {
  return tRuntimeWithLanguage('ko', `tools:sentinel_flare_protocol.${key}`);
}

export function resolveRoom478HarnessCopy() {
  return Object.freeze({
    breathingLabel: translateRoom478('room_478_breathing_label'),
    exit: translateRoom478('room_478_exit'),
    groundingHint: translateRoom478('room_478_grounding_hint'),
    return: translateRoom478('room_478_return'),
    repeat: translateRoom478('room_478_repeat'),
    phases: Object.freeze({
      arrival: translateRoom478('room_478_phase_arrival'),
      grounding: translateRoom478('room_478_phase_grounding'),
      inhale: translateRoom478('room_478_phase_inhale'),
      hold: translateRoom478('room_478_phase_hold'),
      exhale: translateRoom478('room_478_phase_exhale'),
      still: translateRoom478('room_478_phase_still'),
    }),
    statuses: Object.freeze({
      arrival: translateRoom478('room_478_status_arrival'),
      grounding: translateRoom478('room_478_status_grounding'),
      inhale: translateRoom478('room_478_status_inhale'),
      hold: translateRoom478('room_478_status_hold'),
      exhale: translateRoom478('room_478_status_exhale'),
      still: translateRoom478('room_478_status_still'),
    }),
  });
}
export async function decodeRoom478HarnessGarden(roots) {
  await Promise.all(roots.flatMap(root => [
    root.querySelector('[data-room478-garden-image]'),
    root.querySelector('[data-room478-garden-furin-image]'),
  ]).map(image => {
    if (!(image instanceof HTMLImageElement) || !image.src) {
      throw new Error('room_478_harness_image_missing');
    }
    return image.decode();
  }));
}

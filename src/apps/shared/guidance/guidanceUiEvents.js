// This event only invalidates a UI read. Background remains the record owner.
export const GUIDANCE_STATE_CHANGED_EVENT = 'entropy:guidance-state-changed';

export function notifyGuidanceStateChanged() {
  window.dispatchEvent(new Event(GUIDANCE_STATE_CHANGED_EVENT));
}

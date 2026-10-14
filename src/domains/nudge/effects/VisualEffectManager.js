import { runtimeGetURL } from '../../../platform/chrome/ChromeService.js';
import { FRICTION_ASSET_PATHS } from '../../../lib/assets/index.js';
import {
  behaviorHub,
  BEHAVIOR_HUB_EVENTS,
  BEHAVIOR_SIGNAL_TYPES,
} from '../behavior/index.js';
import {
  resolveDisruptionTheme,
  resolveRuntimeThemeId,
} from '../../../themes/core/friction/runtime.js';
import { resolveDisruptionRenderer } from '../../../themes/core/friction/renderers/disruption/index.js';

class VisualEffectManager {
  constructor() {
    this._unsub = null;
    this._abort = null;
  }

  init() {
    if (this._unsub) return;
    const abort = new AbortController();
    this._abort = abort;
    this._unsub = behaviorHub.subscribe(BEHAVIOR_HUB_EVENTS.BEHAVIOR_SIGNAL, (signal) => {
      if (signal?.type !== BEHAVIOR_SIGNAL_TYPES.PLAY_EFFECT) return;
      void this.play(signal?.context?.effectType, { signal: abort.signal })
        .catch(error => console.error('[VisualEffectManager] Effect failed.', error));
    });
  }

  remove() {
    this._abort?.abort();
    this._abort = null;
    this._unsub?.();
    this._unsub = null;
  }

  play(effectType, { signal } = {}) {
    if (effectType === 'DISRUPTION') {
      return this._triggerDisruption(signal);
    }
    return Promise.resolve();
  }

  async _triggerDisruption(signal) {
    if (signal?.aborted) return;
    const runtimeThemeId = await resolveRuntimeThemeId();
    if (signal?.aborted) return;
    const effectProfile = resolveDisruptionTheme(runtimeThemeId);
    const renderer = resolveDisruptionRenderer(effectProfile?.rendererId);

    const burstImpactPath = FRICTION_ASSET_PATHS?.effects?.burstImpact;
    if (burstImpactPath) {
      const audio = new Audio(runtimeGetURL(burstImpactPath));
      audio.volume = effectProfile.audioVolume;
      const stop = () => { audio.pause(); signal?.removeEventListener('abort', stop); };
      audio.addEventListener('ended', () => signal?.removeEventListener('abort', stop), { once: true });
      signal?.addEventListener('abort', stop, { once: true });
      void audio.play().catch(error => {
        signal?.removeEventListener('abort', stop);
        if (!signal?.aborted) console.warn('[VisualEffectManager] Disruption audio rejected.', error);
      });
    }

    try {
      await renderer.play({ effectProfile, signal });
    } catch (error) {
      console.warn('Disruption renderer failed:', error);
    }
  }
}

const visualEffectManager = new VisualEffectManager();

export { VisualEffectManager };
export default visualEffectManager;

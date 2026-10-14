import { runtimeSendMessage } from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { projectSentinelStartFailureDiagnostics } from '../../protection/debug/SentinelProtocolTimeline.js';

const REFRESH_INTERVAL_MS = 1500;
const DEFAULT_TIMELINE_LIMIT = 40;

function nowMs() {
  return Date.now();
}

function getProbeErrorMessage(error, fallback = 'SENTINEL_DEBUG_PROBE_FAILED') {
  return String(error?.message || error || fallback);
}

function resolveLaunchMetadata(protocolScope) {
  return protocolScope === 'global'
    ? {
        protocolLabel: 'Global Sentinel',
        entryMode: 'debug_immediate',
      }
    : {
        protocolLabel: 'Site Furin',
        entryMode: 'integrated_prelude',
      };
}

export class RuntimeDebuggerSentinelProbe {
  constructor({
    request = runtimeSendMessage,
    refreshIntervalMs = REFRESH_INTERVAL_MS,
    timelineLimit = DEFAULT_TIMELINE_LIMIT,
  } = {}) {
    this._request = request;
    this._refreshIntervalMs = refreshIntervalMs;
    this._timelineLimit = timelineLimit;
    this._active = false;
    this._pending = false;
    this._lastRequestedAt = 0;
    this._snapshot = {
      loaded: false,
      pending: false,
      error: null,
      lastUpdatedAt: null,
      timeline: null,
      lastLaunch: null,
    };
  }

  start() {
    this._active = true;
    this.refresh({ force: true });
  }

  stop() {
    this._active = false;
  }

  reset() {
    this._snapshot = {
      loaded: false,
      pending: false,
      error: null,
      lastUpdatedAt: null,
      timeline: null,
      lastLaunch: null,
    };
    this._lastRequestedAt = 0;
  }

  getSnapshot() {
    return {
      ...this._snapshot,
      pending: this._pending,
    };
  }

  sample(wallTime = nowMs()) {
    if (this._active && wallTime - this._lastRequestedAt >= this._refreshIntervalMs) {
      this.refresh();
    }
    return this.getSnapshot();
  }

  refresh({ force = false } = {}) {
    if (!this._active && !force) return;
    if (this._pending) return;
    this._pending = true;
    this._lastRequestedAt = nowMs();
    Promise.resolve()
      .then(() => this._request({
        action: MESSAGE_ACTIONS.DEBUG_GET_SENTINEL_PROTOCOL_SELF_TAB_TIMELINE,
        limit: this._timelineLimit,
      }))
      .then((response) => {
        if (response?.success !== true) {
          throw new Error(response?.error || 'SENTINEL_TIMELINE_UNAVAILABLE');
        }
        this._snapshot = {
          ...this._snapshot,
          loaded: true,
          pending: false,
          error: null,
          lastUpdatedAt: nowMs(),
          timeline: response.snapshot || null,
        };
      })
      .catch((error) => {
        this._snapshot = {
          ...this._snapshot,
          loaded: false,
          pending: false,
          error: getProbeErrorMessage(error),
          lastUpdatedAt: nowMs(),
        };
      })
      .finally(() => {
        this._pending = false;
      });
  }

  async launch({ protocolScope = 'site', hudVisible = true } = {}) {
    const normalizedScope = String(protocolScope || '').trim().toLowerCase() === 'global'
      ? 'global'
      : 'site';
    const launchMetadata = resolveLaunchMetadata(normalizedScope);
    const launchedAt = nowMs();
    try {
      const response = await this._request({
        action: MESSAGE_ACTIONS.DEBUG_TRIGGER_SENTINEL_FLARE,
        protocolScope: normalizedScope,
        hudVisible: hudVisible === true,
      });
      const success = response?.success === true;
      this._snapshot = {
        ...this._snapshot,
        lastLaunch: {
          ts: launchedAt,
          protocolScope: normalizedScope,
          ...launchMetadata,
          success,
          error: success ? null : String(response?.error || 'SENTINEL_LAUNCH_FAILED'),
          startFailureDiagnostics: success ? null
            : projectSentinelStartFailureDiagnostics(response?.result?.startFailureDiagnostics),
        },
      };
      this.refresh({ force: true });
      return this._snapshot.lastLaunch;
    } catch (error) {
      this._snapshot = {
        ...this._snapshot,
        lastLaunch: {
          ts: launchedAt,
          protocolScope: normalizedScope,
          ...launchMetadata,
          success: false,
          error: getProbeErrorMessage(error, 'SENTINEL_LAUNCH_FAILED'),
          startFailureDiagnostics: null,
        },
      };
      this.refresh({ force: true });
      return this._snapshot.lastLaunch;
    }
  }
}

export default RuntimeDebuggerSentinelProbe;

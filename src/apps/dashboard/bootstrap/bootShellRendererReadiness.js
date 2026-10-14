import {
  THEME_BOOT_SHELL_RENDERER_STATUS,
  getThemeBootShellRendererReadyPromise,
} from '../../../themes/core/boot/bootShellRendererContract.js';
import { BOOT_SHELL_RENDERER_READY_TIMEOUT_MS } from './bootConfig.js';

const formatErrorMessage = (error) => {
  if (!error) return 'Unknown renderer readiness error';
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string' && error.message.trim()) return error.message;
  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
};

export function createBootShellRendererReadinessError(code, details = {}) {
  const error = new Error(code);
  error.name = 'BootShellRendererReadinessError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

export function normalizeBootShellRendererReadiness(result = {}) {
  const status = String(result?.status || THEME_BOOT_SHELL_RENDERER_STATUS.NOT_DECLARED);
  const timeoutLike = status === THEME_BOOT_SHELL_RENDERER_STATUS.TIMEOUT
    || String(result?.reason || '').toLowerCase().includes('timeout')
    || String(result?.error || '').toLowerCase().includes('timeout')
    || String(result?.message || '').toLowerCase().includes('timeout');
  const normalizedStatus = status === THEME_BOOT_SHELL_RENDERER_STATUS.FAILED && timeoutLike
    ? THEME_BOOT_SHELL_RENDERER_STATUS.TIMEOUT
    : status;
  const degraded = result?.degraded === true
    || normalizedStatus === THEME_BOOT_SHELL_RENDERER_STATUS.FAILED
    || normalizedStatus === THEME_BOOT_SHELL_RENDERER_STATUS.TIMEOUT;
  return Object.freeze({
    ...result,
    status: normalizedStatus,
    degraded,
  });
}

function assertBootShellRendererReadiness(result = {}) {
  const normalized = normalizeBootShellRendererReadiness(result);
  if (normalized.status === THEME_BOOT_SHELL_RENDERER_STATUS.NOT_DECLARED) {
    throw createBootShellRendererReadinessError('BOOT_SHELL_RENDERER_READY_NOT_DECLARED', {
      result: normalized,
    });
  }
  if (normalized.status === THEME_BOOT_SHELL_RENDERER_STATUS.FAILED) {
    throw createBootShellRendererReadinessError('BOOT_SHELL_RENDERER_READY_FAILED', {
      result: normalized,
      reason: normalized.reason || null,
    });
  }
  return normalized;
}

export function waitForBootShellRendererReady(
  shell,
  { timeoutMs = BOOT_SHELL_RENDERER_READY_TIMEOUT_MS } = {},
) {
  const rendererReadyPromise = getThemeBootShellRendererReadyPromise(shell);
  if (!rendererReadyPromise) {
    return Promise.reject(createBootShellRendererReadinessError('BOOT_SHELL_RENDERER_READY_NOT_DECLARED', {
      status: THEME_BOOT_SHELL_RENDERER_STATUS.NOT_DECLARED,
      source: 'renderer_readiness_not_declared',
    }));
  }

  const safeTimeoutMs = Math.max(1, Math.round(Number(timeoutMs) || BOOT_SHELL_RENDERER_READY_TIMEOUT_MS));

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = 0;

    const settle = (result) => {
      if (settled) return;
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = 0;
      }
      try {
        resolve(assertBootShellRendererReadiness(result));
      } catch (error) {
        reject(error);
      }
    };

    timeoutId = setTimeout(() => {
      settle({
        status: THEME_BOOT_SHELL_RENDERER_STATUS.TIMEOUT,
        degraded: true,
        reason: 'renderer_ready_timeout',
        timeoutMs: safeTimeoutMs,
      });
    }, safeTimeoutMs);

    rendererReadyPromise.then(
      (result) => settle(result),
      (error) => settle({
        status: THEME_BOOT_SHELL_RENDERER_STATUS.FAILED,
        degraded: true,
        reason: 'renderer_ready_rejected',
        error: formatErrorMessage(error),
        causeCode: error?.code || null,
      }),
    );
  });
}

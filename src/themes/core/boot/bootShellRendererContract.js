export const THEME_BOOT_SHELL_RENDERER_READY_PROPERTY = '__entropyBootShellRendererReady';
export const THEME_BOOT_SHELL_COMPLETION_PROPERTY = '__entropyBootShellCompletion';

export function getThemeBootShellCompletionPromise(shell) {
  const promise = shell?.[THEME_BOOT_SHELL_COMPLETION_PROPERTY];
  if (promise === undefined) return null;
  if (typeof promise?.then !== 'function') throw new Error('THEME_BOOT_SHELL_COMPLETION_PROMISE_INVALID');
  return promise;
}

export function attachThemeBootShellCompletionPromise(shell, promise) {
  if (!shell || typeof promise?.then !== 'function') throw new Error('THEME_BOOT_SHELL_COMPLETION_PROMISE_REQUIRED');
  shell[THEME_BOOT_SHELL_COMPLETION_PROPERTY] = promise;
}

export const THEME_BOOT_SHELL_RENDERER_STATUS = Object.freeze({
  NOT_DECLARED: 'not_declared',
  ACTIVE: 'active',
  FIRST_FRAME: 'first_frame',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
});

export function getThemeBootShellRendererReadyPromise(shell) {
  const promise = shell?.[THEME_BOOT_SHELL_RENDERER_READY_PROPERTY];
  return promise && typeof promise.then === 'function' ? promise : null;
}

export function attachThemeBootShellRendererReadyPromise(shell, promise) {
  if (!shell || !promise || typeof promise.then !== 'function') {
    throw new Error('THEME_BOOT_SHELL_RENDERER_READY_PROMISE_REQUIRED');
  }
  shell[THEME_BOOT_SHELL_RENDERER_READY_PROPERTY] = promise;
  return shell;
}

// Optional lifecycle capability: release rendering resources while retaining the
// final DOM/pixels for the existing exit fade. Full disposal remains idempotent.
export const THEME_BOOT_SHELL_EXIT_PROPERTY = '__entropyBootShellPrepareForExit';

export function attachThemeBootShellExitHandler(shell, handler) {
  if (!shell || typeof handler !== 'function') throw new Error('THEME_BOOT_SHELL_EXIT_HANDLER_REQUIRED');
  shell[THEME_BOOT_SHELL_EXIT_PROPERTY] = handler;
}

export function prepareThemeBootShellForExit(shell) {
  const handler = shell?.[THEME_BOOT_SHELL_EXIT_PROPERTY];
  if (handler === undefined) return;
  if (typeof handler !== 'function') throw new Error('THEME_BOOT_SHELL_EXIT_HANDLER_INVALID');
  handler();
}

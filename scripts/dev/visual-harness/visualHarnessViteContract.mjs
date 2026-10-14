export const VISUAL_HARNESS_VITE_MODE = 'entropy-visual-harness';

export function isVisualHarnessViteServe({ command, mode } = {}) {
  if (mode !== VISUAL_HARNESS_VITE_MODE) return false;
  if (command !== 'serve') {
    throw new Error(`VISUAL_HARNESS_VITE_COMMAND_INVALID:${String(command || 'missing')}`);
  }
  return true;
}

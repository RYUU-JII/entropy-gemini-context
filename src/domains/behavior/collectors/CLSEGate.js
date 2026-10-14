let gate = null;

export function setCLSEGate(nextGate) {
  gate = typeof nextGate === 'function' ? nextGate : null;
}

export async function shouldCollectCLSEEvent(context = {}) {
  if (!gate) return false;
  try {
    const result = gate(context);
    return await Promise.resolve(result);
  } catch (err) {
    return false;
  }
}

export function callRequiredBackgroundKernelBridge(bridge, errorCode, args = []) {
  if (typeof bridge !== 'function') {
    throw new Error(errorCode);
  }
  return bridge(...args);
}

/**
 * Extension contexts execute packaged worker modules only. Chrome MV3 rejects
 * blob: in extension_pages worker-src even though local image/media blob URLs
 * are valid. HTTP(S) content-document bootstrap is a separate page policy.
 */
export function assertPackagedExtensionWorkerCsp(csp, { source = 'manifest' } = {}) {
  const workerDirectives = typeof csp === 'string'
    ? csp.split(';').map(value => value.trim().split(/\s+/u))
      .filter(parts => parts[0].toLowerCase() === 'worker-src')
    : [];
  if (workerDirectives.length !== 1
    || workerDirectives[0].length !== 2
    || workerDirectives[0][1] !== "'self'") {
    throw new Error(`EXTENSION_WORKER_CSP_PACKAGED_ONLY:${source}`);
  }
  return csp;
}

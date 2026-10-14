import path from 'node:path';

const ACTIVATION_TIMEOUT_MS = 3_000;

export function normalizeBrowserExtensionPath(extensionPath) {
  if (typeof extensionPath !== 'string' || !extensionPath.trim()) return null;
  const normalized = extensionPath.trim().replace(/[\\/]+$/u, '');
  if (/^(?:[a-z]:[\\/]|\\\\)/iu.test(normalized)) {
    return normalized.replace(/\//gu, '\\').toLowerCase();
  }
  return path.normalize(normalized);
}

function findByPath(extensions, extensionPath) {
  const expectedPath = normalizeBrowserExtensionPath(extensionPath);
  return Array.isArray(extensions)
    ? extensions.find((extension) => (
      normalizeBrowserExtensionPath(extension?.path) === expectedPath
    )) || null
    : null;
}

function blocked(reason) {
  const error = new Error(`CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_BLOCKED:${reason}`);
  error.code = 'CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_BLOCKED';
  error.stage = 'managed_extension_slot_admission';
  return error;
}

async function waitForActive(cdp, extensionPath, extensionId, {
  timeoutMs,
  sleep,
}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await cdp.send('Extensions.getExtensions');
    const extension = findByPath(result?.extensions, extensionPath);
    if (extension?.enabled === true && extension.id === extensionId) return extension;
    await sleep(100);
  }
  return null;
}

// This function is a mutation mechanism, not authority. Its only production
// caller is ExtensionChromiumHarness after capacity, marker, canonical-slot,
// execution-contract, and exact browser-identity admission have all succeeded.
export async function ensureManagedAttachedExtensionSlot(cdp, extensionPath, {
  activationTimeoutMs = ACTIVATION_TIMEOUT_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  loadUnpacked = (params) => cdp.send('Extensions.loadUnpacked', params),
} = {}) {
  if (!cdp || typeof cdp.send !== 'function') {
    throw new Error('CHROMIUM_HARNESS_CDP_REQUIRED');
  }
  if (typeof extensionPath !== 'string' || !extensionPath.trim()) {
    throw new Error('CHROMIUM_HARNESS_EXTENSION_PATH_REQUIRED');
  }
  if (typeof loadUnpacked !== 'function') {
    throw new Error('CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_OWNER_REQUIRED');
  }
  let baselineExtensions;
  try {
    const result = await cdp.send('Extensions.getExtensions');
    if (!Array.isArray(result?.extensions)) throw new Error('extensions_list_missing');
    baselineExtensions = result.extensions;
  } catch {
    throw blocked('discovery_unavailable');
  }
  const existing = findByPath(baselineExtensions, extensionPath);
  if (existing && (typeof existing.id !== 'string' || !/^[a-p]{32}$/u.test(existing.id))) {
    throw blocked('exact_slot_identity_invalid');
  }
  if (existing?.enabled === true) {
    return Object.freeze({
      extensionId: existing.id,
      installMode: 'managed_persistent_existing',
      managedSlotAction: 'already_active',
      uninstallOnClose: false,
    });
  }
  const expectedPath = normalizeBrowserExtensionPath(extensionPath);
  if (baselineExtensions.some((extension) => {
    const baselinePath = normalizeBrowserExtensionPath(extension?.path);
    return baselinePath && baselinePath !== expectedPath;
  })) {
    throw blocked('noncanonical_unpacked_extension_present');
  }

  let result;
  try {
    result = await loadUnpacked({ path: extensionPath });
  } catch (error) {
    if (error?.code === 'CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_BLOCKED') {
      throw error;
    }
    throw blocked('load_command_rejected');
  }
  if (typeof result?.id !== 'string' || !/^[a-p]{32}$/u.test(result.id)) {
    throw blocked('load_id_missing');
  }
  if (existing && result.id !== existing.id) throw blocked('load_id_changed');
  let activeExtension;
  try {
    activeExtension = await waitForActive(cdp, extensionPath, result.id, {
      timeoutMs: activationTimeoutMs,
      sleep,
    });
  } catch {
    throw blocked('post_load_discovery_failed');
  }
  if (!activeExtension) throw blocked('exact_slot_not_active');
  return Object.freeze({
    extensionId: result.id,
    installMode: 'managed_persistent_cdp',
    managedSlotAction: 'loaded_exact_slot',
    uninstallOnClose: false,
  });
}

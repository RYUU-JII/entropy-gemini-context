import { spawn } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MANAGED_XVFB_START_TIMEOUT_MS = 5_000;
const MANAGED_XVFB_STOP_TIMEOUT_MS = 3_000;
const MANAGED_XVFB_CHILD_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../runtime/managedXvfbChild.mjs',
);

function isWslWindowsExecutable(browserPath, platform = process.platform) {
  return platform === 'linux'
    && typeof browserPath === 'string'
    && /^\/mnt\/[a-z]\//iu.test(browserPath)
    && browserPath.toLowerCase().endsWith('.exe');
}

export async function findQaExecutable(name, {
  pathValue = process.env.PATH || '',
  access = fs.access,
} = {}) {
  for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(directory, name);
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Continue through the explicit PATH entries.
    }
  }
  return null;
}

export function resolveQaDisplayBackend({
  executionPlan,
  browser,
  processEnvironment = process.env,
  platform = process.platform,
  xvfbPath = null,
} = {}) {
  if (!executionPlan || !browser) {
    throw new Error('QA_DISPLAY_EXECUTION_AND_BROWSER_REQUIRED');
  }
  const renderingRequirement = executionPlan.renderingRequirement
    || (executionPlan.gpuRequirement === 'hardware_active_required'
      ? 'physical_gpu_required'
      : 'headless_ok');
  const displayPolicy = executionPlan.displayPolicy;
  if (![
    'none',
    'host_display_required',
    'host_or_managed_display',
    'external_display',
  ].includes(displayPolicy)) {
    throw new Error(`QA_DISPLAY_POLICY_INVALID:${displayPolicy || 'missing'}`);
  }
  if (executionPlan.headless === true) {
    if (displayPolicy !== 'none') {
      throw new Error(`QA_DISPLAY_HEADLESS_POLICY_CONFLICT:${displayPolicy}`);
    }
    if (renderingRequirement !== 'headless_ok') {
      const error = new Error(
        `QA_DISPLAY_HEADLESS_RENDERING_FORBIDDEN:${renderingRequirement}`,
      );
      error.code = 'QA_DISPLAY_HEADLESS_RENDERING_FORBIDDEN';
      throw error;
    }
    return Object.freeze({
      kind: 'none',
      managed: false,
      display: null,
      launchEnvironment: Object.freeze({}),
      gpuAdmission: 'classify_on_start',
    });
  }
  if (displayPolicy === 'none') {
    throw new Error('QA_DISPLAY_HEADED_POLICY_CONFLICT:none');
  }
  if (browser.processOwnership === 'attach_only') {
    if (displayPolicy !== 'external_display') {
      throw new Error(`QA_DISPLAY_ATTACH_POLICY_INVALID:${displayPolicy}`);
    }
    return Object.freeze({
      kind: 'external_browser_display',
      managed: false,
      display: null,
      launchEnvironment: Object.freeze({}),
      gpuAdmission: renderingRequirement === 'physical_gpu_required'
        ? 'probe_required'
        : 'classify_on_attach',
    });
  }
  if (displayPolicy === 'external_display') {
    throw new Error('QA_DISPLAY_OWNED_EXTERNAL_POLICY_FORBIDDEN');
  }
  if (platform === 'win32' || isWslWindowsExecutable(browser.chrome, platform)) {
    return Object.freeze({
      kind: 'windows_desktop',
      managed: false,
      display: 'windows',
      launchEnvironment: Object.freeze({}),
      gpuAdmission: renderingRequirement === 'physical_gpu_required'
        ? 'probe_required'
        : 'classify_on_start',
    });
  }
  const waylandDisplay = processEnvironment.WAYLAND_DISPLAY?.trim();
  if (waylandDisplay) {
    return Object.freeze({
      kind: 'host_wayland',
      managed: false,
      display: waylandDisplay,
      launchEnvironment: Object.freeze({ WAYLAND_DISPLAY: waylandDisplay }),
      gpuAdmission: renderingRequirement === 'physical_gpu_required'
        ? 'probe_required'
        : 'classify_on_start',
    });
  }
  const x11Display = processEnvironment.DISPLAY?.trim();
  if (x11Display) {
    return Object.freeze({
      kind: 'host_x11',
      managed: false,
      display: x11Display,
      launchEnvironment: Object.freeze({ DISPLAY: x11Display }),
      gpuAdmission: renderingRequirement === 'physical_gpu_required'
        ? 'probe_required'
        : 'classify_on_start',
    });
  }
  if (displayPolicy === 'host_display_required') {
    const error = new Error('QA_DISPLAY_FOREGROUND_HOST_REQUIRED');
    error.code = 'QA_DISPLAY_FOREGROUND_HOST_REQUIRED';
    throw error;
  }
  if (renderingRequirement === 'physical_gpu_required') {
    const error = new Error('QA_DISPLAY_PHYSICAL_GPU_VIRTUAL_DISPLAY_FORBIDDEN');
    error.code = 'QA_DISPLAY_PHYSICAL_GPU_VIRTUAL_DISPLAY_FORBIDDEN';
    throw error;
  }
  if (!xvfbPath) {
    const error = new Error('QA_DISPLAY_XVFB_UNAVAILABLE');
    error.code = 'QA_DISPLAY_XVFB_UNAVAILABLE';
    throw error;
  }
  return Object.freeze({
    kind: 'managed_xvfb',
    managed: true,
    display: null,
    xvfbPath,
    launchEnvironment: Object.freeze({}),
    gpuAdmission: 'software_or_unclassified_expected',
  });
}

function waitForManagedXvfb(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (worker) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.stdout.off('data', onStdout);
      child.stderr.off('data', onStderr);
      child.off('error', onError);
      child.off('exit', onExit);
      worker();
    };
    const onStdout = (chunk) => {
      stdout += chunk;
      const line = stdout.split(/\r?\n/u)[0]?.trim();
      if (!line) return;
      try {
        const result = JSON.parse(line);
        if (!/^:\d+$/u.test(result?.display || '')) throw new Error('display_invalid');
        finish(() => resolve(Object.freeze(result)));
      } catch (error) {
        finish(() => reject(new Error(
          `QA_MANAGED_XVFB_OUTPUT_INVALID:${line}`,
          { cause: error },
        )));
      }
    };
    const onStderr = (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4_000);
    };
    const onError = (error) => finish(() => reject(new Error(
      `QA_MANAGED_XVFB_START_FAILED:${error?.message || error}`,
      { cause: error },
    )));
    const onExit = (code, signal) => finish(() => reject(new Error(
      `QA_MANAGED_XVFB_EARLY_EXIT:${code ?? 'null'}:${signal || 'none'}:${stderr}`,
    )));
    const timeout = setTimeout(() => finish(() => reject(new Error(
      `QA_MANAGED_XVFB_START_TIMEOUT:${timeoutMs}`,
    ))), timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);
    child.once('error', onError);
    child.once('exit', onExit);
  });
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.off('exit', onExit);
      resolve(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    child.once('exit', onExit);
  });
}

export async function startQaManagedXvfb({
  xvfbPath,
  width = 1280,
  height = 720,
  depth = 24,
  spawnImpl = spawn,
} = {}) {
  const child = spawnImpl(process.execPath, [
    MANAGED_XVFB_CHILD_PATH,
    xvfbPath,
    String(width),
    String(height),
    String(depth),
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let ready;
  try {
    ready = await waitForManagedXvfb(child, MANAGED_XVFB_START_TIMEOUT_MS);
  } catch (error) {
    child.stdin.end();
    child.kill('SIGTERM');
    if (!await waitForExit(child, 1_000)) {
      child.kill('SIGKILL');
      if (!await waitForExit(child, 1_000)) {
        throw new AggregateError(
          [error, new Error('QA_MANAGED_XVFB_START_ROLLBACK_UNCONFIRMED')],
          'QA_MANAGED_XVFB_START_AND_ROLLBACK_FAILED',
          { cause: error },
        );
      }
    }
    throw error;
  }
  let released = false;
  let releasePromise = null;
  return Object.freeze({
    display: ready.display,
    helperPid: child.pid,
    xvfbPid: ready.xvfbPid,
    release() {
      if (released) return Promise.resolve({ status: 'already_released' });
      if (!releasePromise) {
        releasePromise = (async () => {
          child.stdin.end();
          if (!await waitForExit(child, MANAGED_XVFB_STOP_TIMEOUT_MS)) {
            child.kill('SIGTERM');
            if (!await waitForExit(child, 1_000)) {
              child.kill('SIGKILL');
              if (!await waitForExit(child, 1_000)) {
                throw new Error('QA_MANAGED_XVFB_STOP_UNCONFIRMED');
              }
            }
          }
          released = true;
          return { status: 'released' };
        })().catch((error) => {
          releasePromise = null;
          throw error;
        });
      }
      return releasePromise;
    },
  });
}

export class QaDisplayLease {
  constructor({
    executionPlan,
    browser,
    evidence = null,
    rootDir = process.cwd(),
    processEnvironment = process.env,
    platform = process.platform,
    executableResolver = findQaExecutable,
    managedDisplayStarter = startQaManagedXvfb,
  } = {}) {
    this.executionPlan = executionPlan;
    this.browser = browser;
    this.evidence = evidence;
    this.rootDir = path.resolve(rootDir);
    this.processEnvironment = processEnvironment;
    this.platform = platform;
    this.executableResolver = executableResolver;
    this.managedDisplayStarter = managedDisplayStarter;
    this.managedDisplay = null;
    this.receipt = null;
  }

  async acquire() {
    const needsXvfbLookup = this.executionPlan?.headless !== true
      && this.executionPlan?.displayPolicy === 'host_or_managed_display'
      && this.browser?.processOwnership !== 'attach_only'
      && !isWslWindowsExecutable(this.browser?.chrome, this.platform)
      && !this.processEnvironment.DISPLAY?.trim()
      && !this.processEnvironment.WAYLAND_DISPLAY?.trim();
    const xvfbPath = needsXvfbLookup
      ? await this.executableResolver('Xvfb')
      : null;
    const backend = resolveQaDisplayBackend({
      executionPlan: this.executionPlan,
      browser: this.browser,
      processEnvironment: this.processEnvironment,
      platform: this.platform,
      xvfbPath,
    });
    let display = backend.display;
    let launchEnvironment = backend.launchEnvironment;
    if (backend.managed) {
      this.managedDisplay = await this.managedDisplayStarter({
        xvfbPath,
        rootDir: this.rootDir,
      });
      display = this.managedDisplay.display;
      launchEnvironment = Object.freeze({ DISPLAY: display });
    }
    this.receipt = Object.freeze({
      contractVersion: 1,
      kind: backend.kind,
      managed: backend.managed,
      display,
      launchEnvironment,
      gpuAdmission: backend.gpuAdmission,
    });
    try {
      await this.evidence?.event('QA_DISPLAY_ACQUIRED', this.receipt);
    } catch (error) {
      const cleanupError = await this.managedDisplay?.release()
        .then(() => null, (releaseError) => releaseError);
      this.managedDisplay = null;
      if (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'QA_DISPLAY_ACQUIRE_EVIDENCE_ROLLBACK_FAILED',
          { cause: error },
        );
      }
      throw error;
    }
    return this.receipt;
  }

  async release() {
    const managedResult = await this.managedDisplay?.release();
    const receipt = Object.freeze({
      resource: 'display',
      status: 'released',
      kind: this.receipt?.kind || 'not_acquired',
      managedResult: managedResult || null,
    });
    await this.evidence?.event('QA_DISPLAY_RELEASED', receipt);
    return receipt;
  }
}

export {
  findQaExecutable as findExecutable,
  QaDisplayLease as DisplayLease,
  resolveQaDisplayBackend as resolveDisplayBackend,
  startQaManagedXvfb as startManagedXvfb,
};

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { runWindowsQaChildJob, windowsChildCleanupState } from './qaWindowsChildJob.mjs';
import { readBrowserExecutionEnvironment } from '../../browser-qa/contracts/browserExecutionContract.mjs';

const DEFAULT_ABORT_GRACE_MS = 5_000;
const DEFAULT_ABORT_TERMINATE_MS = 5_000;
const PROCESS_TREE_POLL_MS = 25;
const PROCESS_TREE_KILL_WAIT_MS = 1_000;
const CHILD_STDERR_TAIL_BYTES = 8 * 1024;
const DEFAULT_STDIO_CLOSE_TIMEOUT_MS = 2_000;

export function isQaChildCleanupFailure(error) {
  return [
    'QA_CHILD_PROCESS_TREE_CLEANUP_INCOMPLETE',
    'QA_CHILD_PROCESS_TREE_CLEANUP_UNVERIFIED',
    'QA_CHILD_STDIO_CLOSE_TIMEOUT',
    'QA_CHILD_COOPERATIVE_CLEANUP_FAILED',
  ].includes(error?.code);
}

function createAbortError(signal) {
  const reason = signal?.reason;
  const detail = reason instanceof Error
    ? reason.message
    : String(reason || 'signal');
  const error = new Error(
    detail.startsWith('QA_RUN_ABORTED')
      ? detail
      : `QA_RUN_ABORTED:${detail}`,
    reason instanceof Error ? { cause: reason } : undefined,
  );
  error.code = 'QA_RUN_ABORTED';
  return error;
}

function validateAbortTimeout(value, code) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 60_000) {
    throw new Error(`${code}:${String(value)}`);
  }
  return value;
}

function appendStderrTail(current, chunk) {
  const next = `${current}${String(chunk)}`;
  return Buffer.byteLength(next, 'utf8') <= CHILD_STDERR_TAIL_BYTES
    ? next
    : Buffer.from(next, 'utf8').subarray(-CHILD_STDERR_TAIL_BYTES).toString('utf8');
}

function createChildProcessFailure(command, code, childSignal, stderrTail) {
  const browserCapacityFailure = stderrTail.match(
    /QA_BROWSER_CAPACITY_BUSY:[^\r\n]*/u,
  )?.[0];
  if (browserCapacityFailure) {
    const error = new Error(browserCapacityFailure);
    error.code = 'QA_BROWSER_CAPACITY_BUSY';
    error.exitCode = code;
    error.signal = childSignal;
    return error;
  }
  const error = new Error(
    `QA_CHILD_PROCESS_FAILED:${command}:${code ?? childSignal ?? 'unknown'}`,
  );
  error.exitCode = code;
  error.signal = childSignal;
  return error;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });
}

function parseLinuxParentPid(stat, pid) {
  const commandEnd = stat.lastIndexOf(')');
  if (commandEnd < 0) {
    throw new Error(`QA_CHILD_PROCESS_STAT_INVALID:${pid}`);
  }
  const fields = stat.slice(commandEnd + 1).trim().split(/\s+/u);
  const parentPid = Number(fields[1]);
  if (!Number.isSafeInteger(parentPid) || parentPid < 0) {
    throw new Error(`QA_CHILD_PROCESS_STAT_INVALID:${pid}`);
  }
  return parentPid;
}

async function listLinuxDescendantPids(rootPid) {
  if (process.platform !== 'linux') return [];
  let entries;
  try {
    entries = await fs.readdir('/proc', { withFileTypes: true });
  } catch (error) {
    throw new Error(
      `QA_CHILD_PROCESS_TREE_SCAN_FAILED:${error?.code || 'unknown'}`,
      { cause: error },
    );
  }
  const parentByPid = new Map();
  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && /^\d+$/u.test(entry.name))
    .map(async (entry) => {
      const pid = Number(entry.name);
      let stat;
      try {
        stat = await fs.readFile(`/proc/${entry.name}/stat`, 'utf8');
      } catch (error) {
        if (error?.code === 'ENOENT' || error?.code === 'ESRCH') return;
        throw new Error(
          `QA_CHILD_PROCESS_STAT_READ_FAILED:${pid}:${error?.code || 'unknown'}`,
          { cause: error },
        );
      }
      const parentPid = parseLinuxParentPid(stat, pid);
      if (parentPid) parentByPid.set(pid, parentPid);
    }));

  const descendants = [];
  const pendingParents = [rootPid];
  for (let index = 0; index < pendingParents.length; index += 1) {
    const parentPid = pendingParents[index];
    for (const [pid, candidateParentPid] of parentByPid) {
      if (candidateParentPid !== parentPid || descendants.includes(pid)) continue;
      descendants.push(pid);
      pendingParents.push(pid);
    }
  }
  return descendants;
}

function isProcessAlive(pid, child) {
  if (pid === child.pid && (child.exitCode !== null || child.signalCode !== null)) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
}

function signalPid(pid, signal) {
  try {
    process.kill(pid, signal);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

async function signalQaChildTree(child, trackedPids, signal, {
  includeDescendants,
}) {
  const currentDescendants = new Set();
  if (Number.isSafeInteger(child.pid) && child.pid > 1) {
    trackedPids.add(child.pid);
    const descendants = await listLinuxDescendantPids(child.pid);
    descendants.forEach((pid) => {
      trackedPids.add(pid);
      currentDescendants.add(pid);
    });
    if (includeDescendants) {
      for (const pid of descendants.reverse()) {
        signalPid(pid, signal);
      }
    }
  }
  if (child.exitCode === null && child.signalCode === null) {
    child.kill(signal);
  }
  for (const pid of trackedPids) {
    if (
      pid !== child.pid
      && includeDescendants
      && !currentDescendants.has(pid)
      && isProcessAlive(pid, child)
    ) {
      signalPid(pid, signal);
    }
  }
}

async function waitForQaChildTreeExit(child, trackedPids, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  do {
    if ([...trackedPids].every((pid) => !isProcessAlive(pid, child))) {
      return true;
    }
    if (Date.now() >= deadline) return false;
    await sleep(Math.min(PROCESS_TREE_POLL_MS, deadline - Date.now()));
  } while (true);
}

async function terminateQaChildTree(child, {
  abortGraceMs,
  abortTerminateMs,
}) {
  const trackedPids = new Set();
  await signalQaChildTree(child, trackedPids, 'SIGINT', {
    includeDescendants: false,
  });
  if (await waitForQaChildTreeExit(child, trackedPids, abortGraceMs)) {
    return 'sigint';
  }
  await signalQaChildTree(child, trackedPids, 'SIGTERM', {
    includeDescendants: true,
  });
  if (await waitForQaChildTreeExit(child, trackedPids, abortTerminateMs)) {
    return 'sigterm';
  }
  await signalQaChildTree(child, trackedPids, 'SIGKILL', {
    includeDescendants: true,
  });
  return await waitForQaChildTreeExit(
    child,
    trackedPids,
    PROCESS_TREE_KILL_WAIT_MS,
  ) ? 'sigkill' : 'incomplete';
}

export async function runQaChildProcess({
  command,
  args = [],
  cwd,
  env = process.env,
  signal = null,
  onStdout = null,
  onStderr = null,
  abortGraceMs = DEFAULT_ABORT_GRACE_MS,
  abortTerminateMs = DEFAULT_ABORT_TERMINATE_MS,
  stdioCloseTimeoutMs = DEFAULT_STDIO_CLOSE_TIMEOUT_MS,
  spawnChild = spawn,
  recoveryJournal = null,
} = {}) {
  if (typeof command !== 'string' || !command) {
    throw new Error('QA_CHILD_COMMAND_REQUIRED');
  }
  validateAbortTimeout(abortGraceMs, 'QA_CHILD_ABORT_GRACE_MS_INVALID');
  validateAbortTimeout(abortTerminateMs, 'QA_CHILD_ABORT_TERMINATE_MS_INVALID');
  validateAbortTimeout(stdioCloseTimeoutMs, 'QA_CHILD_STDIO_CLOSE_TIMEOUT_MS_INVALID');
  if (signal?.aborted) throw createAbortError(signal);
  if (process.platform === 'win32' && spawnChild === spawn) {
    let stderrTail = '';
    const result = await runWindowsQaChildJob({ command, args, cwd, env, signal, onStdout,
      onStderr: (chunk) => { stderrTail = appendStderrTail(stderrTail, chunk); onStderr?.(chunk); },
      abortGraceMs, abortTerminateMs, stdioCloseTimeoutMs, recoveryJournal });
    if (result.aborted) {
      const browserExecution = Object.hasOwn(env, 'QA_BROWSER_EXECUTION_CONTRACT')
        ? readBrowserExecutionEnvironment(env) : null;
      if (windowsChildCleanupState(result.receipt, false) === 'cleanup_failed') {
        const error = new Error('QA_CHILD_COOPERATIVE_CLEANUP_FAILED');
        error.code = 'QA_CHILD_COOPERATIVE_CLEANUP_FAILED';
        throw error;
      }
      if (browserExecution?.processOwnership === 'attach_only'
        && result.receipt.started && !result.receipt.cooperativeCleanup) {
        const error = new Error('QA_CHILD_PROCESS_TREE_CLEANUP_UNVERIFIED:attached_targets');
        error.code = 'QA_CHILD_PROCESS_TREE_CLEANUP_UNVERIFIED';
        throw error;
      }
      throw createAbortError(signal);
    }
    if (result.receipt.forced) {
      const error = new Error('QA_CHILD_PROCESS_DESCENDANTS_OUTLIVED_ROOT');
      error.code = 'QA_CHILD_PROCESS_DESCENDANTS_OUTLIVED_ROOT';
      throw error;
    }
    if (result.exitCode !== 0) throw createChildProcessFailure(command, result.exitCode, null, stderrTail);
    return Object.freeze({ exitCode: 0, signal: null });
  }
  return new Promise((resolve, reject) => {
    const child = spawnChild(command, args, {
      cwd,
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false,
    });
    let abortHandled = false;
    let abortCleanup = null;
    let settled = false;
    let stderrTail = '';
    let stdioCloseTimer = null;
    const finish = async (worker) => {
      if (settled) return;
      settled = true;
      if (stdioCloseTimer) clearTimeout(stdioCloseTimer);
      signal?.removeEventListener('abort', handleAbort);
      try {
        const cleanupStatus = await abortCleanup;
        if (cleanupStatus === 'incomplete') {
          const cleanupError = new Error('QA_CHILD_PROCESS_TREE_CLEANUP_INCOMPLETE');
          cleanupError.code = 'QA_CHILD_PROCESS_TREE_CLEANUP_INCOMPLETE';
          reject(cleanupError);
          return;
        }
        if (abortHandled && process.platform !== 'linux') {
          // Only Linux currently proves descendant absence. A terminated root
          // PID alone cannot certify a Windows wrapper's browser descendants.
          const error = new Error(`QA_CHILD_PROCESS_TREE_CLEANUP_UNVERIFIED:${process.platform}`);
          error.code = 'QA_CHILD_PROCESS_TREE_CLEANUP_UNVERIFIED';
          reject(error);
          return;
        }
        worker();
      } catch (error) {
        reject(error);
      }
    };
    const handleAbort = () => {
      if (abortHandled || child.exitCode !== null || child.signalCode !== null) return;
      abortHandled = true;
      abortCleanup = terminateQaChildTree(child, {
        abortGraceMs,
        abortTerminateMs,
      });
    };
    signal?.addEventListener('abort', handleAbort, { once: true });
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      onStdout?.(String(chunk));
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      stderrTail = appendStderrTail(stderrTail, chunk);
      onStderr?.(String(chunk));
    });
    child.once('error', (error) => {
      void finish(() => {
        reject(abortHandled ? createAbortError(signal) : error);
      });
    });
    child.once('exit', () => {
      // exit does not prove pipe EOF. Drain the final evidence and stderr code
      // before classifying, while bounding descendants that retain these pipes.
      if (settled) return;
      stdioCloseTimer = setTimeout(() => {
        child.stdout.destroy();
        child.stderr.destroy();
        void finish(() => {
          const error = new Error('QA_CHILD_STDIO_CLOSE_TIMEOUT');
          error.code = 'QA_CHILD_STDIO_CLOSE_TIMEOUT';
          reject(error);
        });
      }, stdioCloseTimeoutMs);
    });
    child.once('close', (code, childSignal) => {
      void finish(() => {
        if (abortHandled) {
          reject(createAbortError(signal));
          return;
        }
        if (code === 0) {
          resolve(Object.freeze({ exitCode: 0, signal: null }));
          return;
        }
        reject(createChildProcessFailure(command, code, childSignal, stderrTail));
      });
    });
    if (signal?.aborted) handleAbort();
  });
}

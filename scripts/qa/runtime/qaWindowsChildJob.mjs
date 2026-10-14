import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readBrowserExecutionEnvironment } from '../../browser-qa/contracts/browserExecutionContract.mjs';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const driverPath = path.resolve(moduleDirectory, '../drivers/windowsQaChildJob.ps1');
const preloadPath = pathToFileURL(path.join(moduleDirectory, 'qaChildCooperativeAbort.mjs')).href;
const TOKEN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;

function failure(detail, cause) {
  const error = new Error(`QA_CHILD_PROCESS_TREE_CLEANUP_UNVERIFIED:${detail}`, cause ? { cause } : undefined);
  error.code = 'QA_CHILD_PROCESS_TREE_CLEANUP_UNVERIFIED';
  return error;
}

function powerShellPath() {
  if (!process.env.SystemRoot) throw new Error('QA_WINDOWS_SYSTEM_ROOT_REQUIRED');
  return path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
}

export function validateWindowsChildJobIdentity(identity, { jobToken, command }) {
  if (identity?.event !== 'prepared' || identity.jobToken !== jobToken
    || !Number.isSafeInteger(identity.pid) || identity.pid < 1
    || !/^windows-filetime:\d+$/u.test(identity.processStartToken || '')
    || typeof identity.executable !== 'string'
    || path.win32.normalize(identity.executable).toLowerCase() !== path.win32.normalize(command).toLowerCase()) {
    throw failure('prepared_identity_invalid');
  }
  return Object.freeze({ ...identity });
}

export function validateWindowsChildJobReceipt(receipt, jobToken) {
  if (receipt?.event !== 'completed' || receipt.jobToken !== jobToken
    || receipt.activeProcessCount !== 0 || receipt.proof !== 'windows_job_active_process_zero'
    || !Number.isSafeInteger(receipt.rootExitCode) || receipt.rootExitCode < 0
    || ['started', 'aborted', 'forced', 'cooperativeCleanup'].some((key) => typeof receipt[key] !== 'boolean')) {
    throw failure('completion_receipt_invalid');
  }
  return Object.freeze({ ...receipt });
}

export function windowsChildCleanupState(receipt, requiresCooperativeCleanup) {
  if (receipt.aborted && receipt.rootExitCode === 1 && !receipt.forced && !receipt.cooperativeCleanup) return 'cleanup_failed';
  if (requiresCooperativeCleanup && receipt.started && receipt.aborted && !receipt.cooperativeCleanup) return 'unverified_targets';
  return 'released';
}

export async function runWindowsQaChildJob({
  command, args, cwd = process.cwd(), env, signal, onStdout, onStderr,
  abortGraceMs, abortTerminateMs, stdioCloseTimeoutMs, recoveryJournal = null,
}) {
  if (!path.isAbsolute(command)) throw new Error('QA_WINDOWS_CHILD_EXECUTABLE_ABSOLUTE_REQUIRED');
  const jobToken = randomUUID();
  const requiresCooperativeCleanup = Object.hasOwn(env, 'QA_BROWSER_EXECUTION_CONTRACT')
    && readBrowserExecutionEnvironment(env).processOwnership === 'attach_only';
  const controlRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'entropy-qa-child-'));
  const cancelPath = path.join(controlRoot, 'cancel');
  const server = net.createServer();
  let supervisor = null;
  let socket = null;
  let receipt = null;
  let prepared = false;
  let abortRequested = false;
  let abortSent = false;
  let controlDrain = null;
  let channelError = null;
  let events = Promise.resolve();
  let startupTimer;
  let abortTimer;
  let closeTimer;
  const sendAbort = () => {
    if (!abortSent && prepared && socket?.writable) {
      abortSent = true;
      socket.write('abort\n');
    }
  };
  const requestAbort = () => {
    if (abortRequested) return;
    abortRequested = true;
    if (receipt) return;
    sendAbort();
    abortTimer = setTimeout(() => {
      channelError = failure('supervisor_abort_timeout');
      socket?.destroy();
      if (supervisor && supervisor.exitCode === null && supervisor.signalCode === null) supervisor.kill();
    }, 20_000 + abortGraceMs + abortTerminateMs);
  };
  try {
    await recoveryJournal?.reserveChildJob({ jobToken, command, requiresCooperativeCleanup });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(`\\\\.\\pipe\\entropy-qa-child-${jobToken}`, resolve);
    });
    server.on('connection', (connection) => {
      if (socket) { connection.destroy(); channelError = failure('duplicate_control_connection'); requestAbort(); return; }
      socket = connection;
      controlDrain = new Promise((resolve) => {
        socket.once('end', resolve);
        socket.once('close', resolve);
      });
      socket.setEncoding('utf8');
      socket.on('error', (error) => { channelError = failure('control_transport', error); requestAbort(); });
      socket.write(`${JSON.stringify({ contractVersion: 1, jobToken, command,
        args: path.normalize(command).toLowerCase() === path.normalize(process.execPath).toLowerCase()
          ? ['--import', preloadPath, ...args] : args,
        cwd, cancelPath, abortGraceMs, abortTerminateMs, stdioCloseTimeoutMs })}\n`);
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk;
        if (buffer.length > 64 * 1024) { channelError = failure('control_frame_too_large'); requestAbort(); return; }
        const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) {
          events = events.then(async () => {
            const event = JSON.parse(line);
            if (event.event === 'prepared' && !prepared) {
              validateWindowsChildJobIdentity(event, { jobToken, command });
              prepared = true;
              await recoveryJournal?.admitChildJob({ ...event, supervisorPid: supervisor.pid });
              clearTimeout(startupTimer);
              if (abortRequested) sendAbort();
              else socket.write('start\n');
            } else if (event.event === 'completed' && prepared && !receipt) {
              receipt = validateWindowsChildJobReceipt(event, jobToken);
            } else throw failure('control_event_order');
          }).catch((error) => { channelError = failure('control_evidence', error); requestAbort(); });
        }
      });
    });
    supervisor = spawn(powerShellPath(), ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', driverPath, '-Operation', 'run', '-Token', jobToken], {
      cwd, env: { ...env, QA_CHILD_CANCEL_PATH: cancelPath, QA_CHILD_JOB_TOKEN: jobToken },
      // The native supervisor handles console interrupts before launching work;
      // only the private request may interrupt its Job cleanup.
      stdio: ['inherit', 'pipe', 'pipe'], shell: false, windowsHide: true,
    });
    const forward = (stream, callback) => (chunk) => {
      stream.write(chunk);
      try { callback?.(String(chunk)); }
      catch (error) { channelError = failure('output_consumer', error); requestAbort(); }
    };
    supervisor.stdout.on('data', forward(process.stdout, onStdout));
    supervisor.stderr.on('data', forward(process.stderr, onStderr));
    signal?.addEventListener('abort', requestAbort, { once: true });
    if (signal?.aborted) requestAbort();
    startupTimer = setTimeout(() => {
      channelError = failure('supervisor_start_timeout'); requestAbort();
    }, 20_000);
    const result = await new Promise((resolve, reject) => {
      supervisor.once('error', reject);
      supervisor.once('exit', () => {
        closeTimer = setTimeout(() => {
          supervisor.stdout.destroy(); supervisor.stderr.destroy();
          reject(failure('supervisor_pipe_close_timeout'));
        }, stdioCloseTimeoutMs);
      });
      supervisor.once('close', (exitCode) => resolve(exitCode));
    });
    // Process stdout EOF and the private pipe EOF are independent events.
    if (controlDrain) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(failure('control_drain_timeout')), stdioCloseTimeoutMs);
        controlDrain.then(() => { clearTimeout(timer); resolve(); });
      });
    }
    await events;
    if (channelError) throw channelError;
    if (result !== 0 || !receipt) throw failure(`supervisor_exit_without_proof:${result}`);
    await recoveryJournal?.releaseChildJob({ jobToken, receipt });
    return Object.freeze({ exitCode: receipt.rootExitCode, receipt, aborted: abortRequested });
  } catch (error) {
    throw error?.code === 'QA_CHILD_PROCESS_TREE_CLEANUP_UNVERIFIED' ? error : failure('owner_failed', error);
  } finally {
    signal?.removeEventListener('abort', requestAbort);
    clearTimeout(startupTimer); clearTimeout(abortTimer); clearTimeout(closeTimer);
    socket?.destroy();
    await new Promise((resolve) => server.close(resolve));
    if (supervisor && supervisor.exitCode === null && supervisor.signalCode === null) {
      await new Promise((resolve) => {
        const timer = setTimeout(() => supervisor.kill(), 10_000);
        supervisor.once('close', () => { clearTimeout(timer); resolve(); });
      });
    }
    // Closing the transport makes the native owner terminate its Job on parent loss.
    // No temp path or job name grants process-kill authority to recovery.
    await fs.rm(controlRoot, { recursive: true, force: true });
  }
}

export async function inspectWindowsQaChildJob(jobToken) {
  if (!TOKEN.test(jobToken || '')) throw new Error('QA_CHILD_JOB_TOKEN_INVALID');
  const value = await inspectDriver(['-Operation', 'inspect', '-Token', jobToken]);
  if (value.contractVersion !== 1 || value.jobToken !== jobToken || typeof value.absent !== 'boolean') throw failure('inspect_invalid');
  return value;
}

export async function readWindowsQaProcessStartToken(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('QA_WINDOWS_PROCESS_PID_INVALID');
  const value = await inspectDriver(['-Operation', 'identity', '-Token', randomUUID(), '-ProcessId', String(pid)]);
  if (value.contractVersion !== 1 || value.pid !== pid
    || (value.processStartToken !== null && !/^windows-filetime:\d+$/u.test(value.processStartToken))) throw failure('process_identity_invalid');
  return value.processStartToken;
}

async function inspectDriver(args) {
  if (process.platform !== 'win32') throw new Error('QA_CHILD_JOB_WINDOWS_REQUIRED');
  return new Promise((resolve, reject) => {
    const child = spawn(powerShellPath(), ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', driverPath, ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(failure('inspect_timeout')); }, 15_000);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-8192); });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code) => {
      clearTimeout(timer);
      try {
        if (code !== 0) throw failure(`inspect_failed:${stderr}`);
        const value = JSON.parse(output);
        resolve(value);
      } catch (error) { reject(error); }
    });
  });
}

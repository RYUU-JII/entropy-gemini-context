import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// Private, local evidence owns stderr; public CLI/run receipts carry only this
// path and a scalar summary. No full command line, log text or profile path.
export async function persistQaBrowserStartupFailure(error, { rootDir, writeFile = fs.writeFile }) {
  const diagnostics = error?.startupDiagnostics;
  if (!diagnostics) return error;
  const relativePath = `.artifacts/qa/browser-startup/${randomUUID()}.json`;
  const summary = Object.freeze({
    stage: diagnostics.stage,
    elapsedMs: diagnostics.elapsedMs,
    timeoutMs: diagnostics.timeoutMs,
    pollCount: diagnostics.pollCount,
    cdpStatus: diagnostics.lastInspection?.cdp.status ?? null,
    cdpErrorCode: diagnostics.lastInspection?.cdp.errorCode ?? null,
    pid: diagnostics.process?.pid ?? null,
    exitCode: diagnostics.process?.exitCode ?? null,
    signalCode: diagnostics.process?.signalCode ?? null,
    rollback: diagnostics.rollback,
    leaseRelease: diagnostics.leaseRelease,
  });
  try {
    const filePath = path.join(rootDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    await writeFile(filePath, JSON.stringify({
      ...diagnostics,
      recordedAt: new Date().toISOString(),
      terminalFailureCode: String(error.code || error.message).split(':', 1)[0],
    }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    error.startupEvidence = Object.freeze({ status: 'saved', relativePath, summary });
    return error;
  } catch (writeError) {
    const combined = new AggregateError(
      [error, writeError], 'QA_BROWSER_STARTUP_DIAGNOSTICS_WRITE_FAILED', { cause: error },
    );
    combined.code = 'QA_BROWSER_STARTUP_DIAGNOSTICS_WRITE_FAILED';
    combined.startupEvidence = Object.freeze({ status: 'write_failed', relativePath: null, summary });
    return combined;
  }
}

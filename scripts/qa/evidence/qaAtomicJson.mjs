import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';

const WINDOWS_RENAME_WAITS = Object.freeze([100, 500, 2_000]);

// Windows readers can briefly deny an atomic replacement. Retry only the same
// source/destination operation; never remove the old record or write elsewhere.
export async function renameQaAtomicJson(temporaryPath, filePath, {
  platform = process.platform, rename = fs.rename,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  onRetry = (receipt) => console.error(JSON.stringify(receipt)),
} = {}) {
  const waits = platform === 'win32' ? WINDOWS_RENAME_WAITS : [];
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(temporaryPath, filePath);
      return;
    } catch (error) {
      if (error?.code !== 'EPERM' || attempt >= waits.length) throw error;
      await onRetry({ event: 'QA_ATOMIC_JSON_RENAME_RETRY', from: temporaryPath, to: filePath,
        attempt: attempt + 1, code: error.code, waitMs: waits[attempt] });
      await wait(waits[attempt]);
    }
  }
}

export async function writeQaJsonAtomic(filePath, value, { mode = 0o600, ...renameOptions } = {}) {
  const temporaryPath = `${filePath}.${process.pid}-${randomUUID()}.tmp`;
  let failure = null;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx', mode });
    await renameQaAtomicJson(temporaryPath, filePath, renameOptions);
  } catch (error) {
    failure = error;
  }
  try {
    await fs.unlink(temporaryPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      failure = failure ? new AggregateError([failure, error], 'QA_ATOMIC_JSON_CLEANUP_FAILED') : error;
    }
  }
  if (failure) throw failure;
}

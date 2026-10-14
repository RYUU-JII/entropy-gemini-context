import fs from 'node:fs/promises';

const TEMP_ROOT_CLEANUP_MAX_RETRIES = 10;
const TEMP_ROOT_CLEANUP_RETRY_DELAY_MS = 100;
const RETRYABLE_TEMP_ROOT_CLEANUP_CODES = new Set([
  'EACCES',
  'EBUSY',
  'ENOTEMPTY',
  'EPERM',
]);

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });
}

export async function removeHarnessTempRoot(tempRoot, {
  remove = fs.rm,
  wait = sleep,
} = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= TEMP_ROOT_CLEANUP_MAX_RETRIES; attempt += 1) {
    try {
      await remove(tempRoot, {
        recursive: true,
        force: true,
        maxRetries: TEMP_ROOT_CLEANUP_MAX_RETRIES,
        retryDelay: TEMP_ROOT_CLEANUP_RETRY_DELAY_MS,
      });
      return;
    } catch (error) {
      lastError = error;
      const retryable = RETRYABLE_TEMP_ROOT_CLEANUP_CODES.has(error?.code);
      if (!retryable || attempt === TEMP_ROOT_CLEANUP_MAX_RETRIES) throw error;
      await wait(TEMP_ROOT_CLEANUP_RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastError;
}

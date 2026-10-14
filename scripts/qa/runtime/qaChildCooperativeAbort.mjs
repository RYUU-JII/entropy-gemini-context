import fs from 'node:fs/promises';
import { disposeQaChildResources, enableQaChildAbortCleanup } from './qaChildAbortRegistry.mjs';

// Root Node child only. Descendants inherit the Job, not this control channel.
const cancelPath = process.env.QA_CHILD_CANCEL_PATH;
const token = process.env.QA_CHILD_JOB_TOKEN;
delete process.env.QA_CHILD_CANCEL_PATH;
delete process.env.QA_CHILD_JOB_TOKEN;
if (!cancelPath || !/^[a-f0-9-]{36}$/u.test(token || '')) {
  throw new Error('QA_CHILD_ABORT_CHANNEL_INVALID');
}
let polling = false;
enableQaChildAbortCleanup();
const timer = setInterval(async () => {
  if (polling) return;
  polling = true;
  try {
    let request;
    try { request = await fs.readFile(cancelPath, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    if (request !== token) throw new Error('QA_CHILD_ABORT_TOKEN_MISMATCH');
    clearInterval(timer);
    await disposeQaChildResources();
    await fs.writeFile(`${cancelPath}.ack`, token, 'utf8');
    process.exit(130);
  } finally { polling = false; }
}, 50);
timer.unref();

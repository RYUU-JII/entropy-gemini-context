import { readFile, readdir, writeFile, link, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertReviewRequest } from '../workspace/soundWorkspace.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function readReviews(directory) {
  const files = (await readdir(directory)).filter(name => name.endsWith('.json'));
  const records = await Promise.all(files.map(async name => {
    const record = JSON.parse(await readFile(join(directory, name), 'utf8'));
    if (!UUID.test(record.id) || name !== `${record.id}.json` || record.schemaVersion !== 1
      || !record.request || !record.target || !record.savedAt) throw new Error(`SOUND_LAB_REVIEW_CORRUPT:${name}`);
    return record;
  }));
  return records.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

// A single writer queue per host keeps retries idempotent and records atomic.
export function createReviewRepository(directory) {
  let queue = Promise.resolve();
  return {
    read: () => readReviews(directory),
    save(request, build) {
      const job = queue.then(async () => {
        if (!UUID.test(request.requestId)) throw new Error('SOUND_LAB_REVIEW_REQUEST_ID_INVALID');
        const { target, candidate } = assertReviewRequest(request, build.targets, build.revision);
        const records = await readReviews(directory);
        const existing = records.find(record => record.id === request.requestId);
        if (existing) {
          if (JSON.stringify(existing.request) !== JSON.stringify(request)) throw new Error('SOUND_LAB_REVIEW_REQUEST_CONFLICT');
          return existing;
        }
        const record = {
          schemaVersion: 1, id: request.requestId, savedAt: new Date().toISOString(),
          request, target, candidate,
        };
        const temporary = join(directory, `${request.requestId}.${randomUUID()}.tmp`);
        await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
        try {
          // link is atomic and never replaces an existing record, even if a
          // second explicit host races this writer with the same request id.
          await link(temporary, join(directory, `${record.id}.json`));
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
          const concurrent = JSON.parse(await readFile(join(directory, `${record.id}.json`), 'utf8'));
          if (JSON.stringify(concurrent.request) !== JSON.stringify(request)) throw new Error('SOUND_LAB_REVIEW_REQUEST_CONFLICT');
          return concurrent;
        } finally { await unlink(temporary); }
        return record;
      });
      // Keep a failed request visible to its caller without poisoning later writes.
      queue = job.then(() => undefined, () => undefined);
      return job;
    },
  };
}

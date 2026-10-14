import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { renameQaAtomicJson } from '../evidence/qaAtomicJson.mjs';

const SESSION_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/u;
const MAX_JSON_BYTES = 256 * 1024;

export function requireQaExplorationSessionId(sessionId) {
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) {
    throw new Error('QA_EXPLORATION_SESSION_ID_INVALID');
  }
  return sessionId;
}

// Evidence is confined to plain directories and files under this checkout.
export async function requireQaExplorationDirectory(rootDir, segments, { create = false } = {}) {
  if (!path.isAbsolute(rootDir || '')) throw new Error('QA_EXPLORATION_ROOT_ABSOLUTE_REQUIRED');
  let directory = path.normalize(rootDir);
  for (const segment of [null, ...segments]) {
    if (segment !== null) {
      if (segment !== '.artifacts' && !SESSION_ID.test(segment)) {
        throw new Error('QA_EXPLORATION_UNSAFE_PATH');
      }
      directory = path.join(directory, segment);
      if (create) await fs.mkdir(directory).catch((error) => { if (error.code !== 'EEXIST') throw error; });
    }
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()
      || path.relative(await fs.realpath(directory), directory) !== '') {
      throw new Error('QA_EXPLORATION_UNSAFE_PATH');
    }
  }
  return directory;
}

export async function readQaExplorationJson(filePath) {
  const stat = await fs.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_JSON_BYTES) {
    throw new Error('QA_EXPLORATION_EVIDENCE_FILE_INVALID');
  }
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

export async function writeQaExplorationJson(filePath, value, { exclusive = false } = {}) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(text, 'utf8') > MAX_JSON_BYTES) throw new Error('QA_EXPLORATION_EVIDENCE_TOO_LARGE');
  if (exclusive) {
    await fs.writeFile(filePath, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return;
  }
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await renameQaAtomicJson(temporaryPath, filePath);
  } finally {
    await fs.unlink(temporaryPath).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
}

// Complete the receipt before publishing its final name. link is atomic and
// refuses an existing destination, so competing publishers never observe a
// partial receipt and cannot replace one another's evidence.
export async function publishQaExplorationJson(filePath, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(text, 'utf8') > MAX_JSON_BYTES) throw new Error('QA_EXPLORATION_EVIDENCE_TOO_LARGE');
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await fs.link(temporaryPath, filePath);
  } finally {
    await fs.unlink(temporaryPath).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
}

export async function readQaExplorationSession({ rootDir, sessionId }) {
  requireQaExplorationSessionId(sessionId);
  const sessionRoot = await requireQaExplorationDirectory(rootDir, ['.artifacts', 'qa', 'explorations', sessionId]);
  const session = await readQaExplorationJson(path.join(sessionRoot, 'session.json'));
  if (session?.contractVersion !== 1 || session.kind !== 'exploration_session'
    || session.sessionId !== sessionId || !['READY', 'CLOSED', 'FAILED'].includes(session.status)
    || session.namedQaVerdict !== null || session.environmentId !== 'authenticated'
    || session.ownerId !== `exploration:${sessionId}` || !Number.isSafeInteger(session.pid) || session.pid < 1
    || session.liveBuildProved !== false || !Number.isFinite(Date.parse(session.startedAt))) {
    throw new Error('QA_EXPLORATION_SESSION_EVIDENCE_INVALID');
  }
  if (Object.hasOwn(session, 'runner') && (session.runner?.pid !== session.pid
    || typeof session.runner.processStartToken !== 'string'
    || !/^(?:windows-filetime|linux-proc):\d+$/u.test(session.runner.processStartToken))) {
    throw new Error('QA_EXPLORATION_RUNNER_EVIDENCE_INVALID');
  }
  const notesRoot = await requireQaExplorationDirectory(rootDir, ['.artifacts', 'qa', 'explorations', sessionId, 'notes']);
  const entries = await fs.readdir(notesRoot, { withFileTypes: true });
  if (entries.length > 256) throw new Error('QA_EXPLORATION_NOTE_LIMIT_EXCEEDED');
  const notes = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!/^[a-f0-9-]{36}\.json$/u.test(entry.name) || !entry.isFile() || entry.isSymbolicLink()) {
      throw new Error('QA_EXPLORATION_NOTE_FILE_INVALID');
    }
    const note = await readQaExplorationJson(path.join(notesRoot, entry.name));
    if (note?.contractVersion !== 1 || note.kind !== 'exploration_observation'
      || note.sessionId !== sessionId || note.namedQaVerdict !== null || note.liveBuildProved !== false
      || `${note.noteId}.json` !== entry.name || note.leaseId !== session.leaseId
      || !Number.isFinite(Date.parse(note.at))
      || ['actions', 'observation', 'uncertainty'].some((key) => typeof note[key] !== 'string'
        || !note[key].trim() || note[key].length > 4_000)) {
      throw new Error('QA_EXPLORATION_NOTE_EVIDENCE_INVALID');
    }
    notes.push(note);
  }
  return Object.freeze({ ...session, sessionRoot, notes: Object.freeze(notes) });
}

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function readJson(file, fallback = {}) {
  if (!file || !fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function readJsonRequired(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJsonAtomic(file, payload) {
  const dir = path.dirname(file);
  const base = path.basename(file);
  const tmp = path.join(
    dir,
    `.${base}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}`
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function workerBaseLabel(worker, fallbackSlot = '') {
  if (!worker || typeof worker !== 'object') return `worker${fallbackSlot}`;
  return worker.base_title || worker.pane_title || `worker${worker.slot || fallbackSlot}`;
}

function readWorkers(file) {
  const parsed = readJson(file, {});
  return {
    parsed,
    workers: Array.isArray(parsed.workers) ? parsed.workers : [],
  };
}

function readQueue(file) {
  const parsed = readJson(file, {});
  return {
    parsed,
    jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
  };
}

function readWorkersRequired(file) {
  const parsed = readJsonRequired(file);
  return {
    parsed,
    workers: Array.isArray(parsed.workers) ? parsed.workers : [],
  };
}

function readQueueRequired(file) {
  const parsed = readJsonRequired(file);
  return {
    parsed,
    jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
  };
}

function writeWorkersQueue(workersFile, queueFile, workersParsed, queueParsed, workers, jobs, now) {
  workersParsed.updated_at = now;
  workersParsed.workers = workers;
  queueParsed.updated_at = now;
  queueParsed.jobs = jobs;
  writeJsonAtomic(workersFile, workersParsed);
  writeJsonAtomic(queueFile, queueParsed);
}

function opEnsure(args) {
  const [workersFile, queueFile, paneCsv = ''] = args;
  const panes = String(paneCsv)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const now = new Date().toISOString();
  const prevParsed = readJson(workersFile, {});
  const prevWorkers = Array.isArray(prevParsed.workers) ? prevParsed.workers : [];
  const workers = panes.map((paneTitle, idx) => {
    const slot = String(idx + 1);
    const base = prevWorkers.find((item) => item && String(item.slot) === slot) || {};
    const state = base.state === 'busy' ? 'busy' : 'idle';
    return {
      slot,
      pane_title: paneTitle,
      base_title: paneTitle,
      label:
        typeof base.label === 'string' && base.label.trim() ? base.label.trim() : paneTitle,
      state,
      persona_session: typeof base.persona_session === 'string' ? base.persona_session : '',
      effort: base.effort === 'xhigh' ? 'xhigh' : 'high',
      job_id: typeof base.job_id === 'string' ? base.job_id : '',
      assigned_at: typeof base.assigned_at === 'string' ? base.assigned_at : '',
      updated_at: now,
    };
  });

  for (const worker of workers) {
    if (worker.state !== 'busy') {
      worker.persona_session = '';
      worker.effort = 'high';
      worker.job_id = '';
      worker.assigned_at = '';
      if (!worker.label) worker.label = worker.base_title;
    }
  }

  const workersPayload = {
    version: '1.0.0',
    updated_at: now,
    workers,
  };

  const queueParsed = readJson(queueFile, {});
  const jobs = Array.isArray(queueParsed.jobs)
    ? queueParsed.jobs.filter((job) => job && typeof job.id === 'string')
    : [];
  const queuePayload = {
    version: '1.0.0',
    updated_at: now,
    jobs,
  };

  writeJsonAtomic(workersFile, workersPayload);
  writeJsonAtomic(queueFile, queuePayload);
}

function opHarvest(args) {
  const [workersFile, queueFile] = args;
  const now = new Date().toISOString();
  const events = [];
  let changed = false;

  const { parsed: workersParsed, workers } = readWorkersRequired(workersFile);
  const { parsed: queueParsed, jobs } = readQueueRequired(queueFile);

  for (const worker of workers) {
    if (!worker || worker.state !== 'busy' || !worker.job_id) continue;
    const job = jobs.find((item) => item && item.id === worker.job_id);
    if (!job) continue;
    const resultFile = typeof job.result_file === 'string' ? job.result_file : '';
    if (!resultFile || !fs.existsSync(resultFile)) continue;
    const raw = fs.readFileSync(resultFile, 'utf8');
    const lines = String(raw).split(/\r?\n/);
    let firstNonEmpty = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      firstNonEmpty = trimmed;
      break;
    }
    const firstMatch = firstNonEmpty.match(/^status\s*:\s*(DONE|BLOCKED)$/i);
    if (!firstMatch) continue;
    const markerCount = lines.reduce(
      (count, line) => (/^status\s*:\s*(DONE|BLOCKED)$/i.test(line.trim()) ? count + 1 : count),
      0
    );
    if (markerCount !== 1) continue;

    const status = firstMatch[1].toLowerCase();
    job.state = status;
    job.finished_at = now;
    job.last_update = now;

    worker.state = 'idle';
    worker.persona_session = '';
    worker.effort = 'high';
    worker.job_id = '';
    worker.assigned_at = '';
    worker.label = workerBaseLabel(worker);
    worker.updated_at = now;

    events.push(`${worker.slot}\t${job.id}\t${status}\t${worker.label}`);
    changed = true;
  }

  if (changed) {
    writeWorkersQueue(workersFile, queueFile, workersParsed, queueParsed, workers, jobs, now);
  }
  for (const event of events) process.stdout.write(`${event}\n`);
}

function opAssign(args) {
  const [workersFile, queueFile] = args;
  const now = new Date().toISOString();
  const assignments = [];
  let changed = false;

  const { parsed: workersParsed, workers } = readWorkersRequired(workersFile);
  const { parsed: queueParsed, jobs } = readQueueRequired(queueFile);

  const queuedJobs = jobs
    .filter((job) => job && job.state === 'queued')
    .sort((a, b) => {
      const pa = Number.isFinite(Number(a.priority)) ? Number(a.priority) : 50;
      const pb = Number.isFinite(Number(b.priority)) ? Number(b.priority) : 50;
      if (pb !== pa) return pb - pa;
      const ta = typeof a.created_at === 'string' ? a.created_at : '';
      const tb = typeof b.created_at === 'string' ? b.created_at : '';
      return ta.localeCompare(tb);
    });

  const idleWorkers = workers
    .filter((worker) => worker && worker.state !== 'busy')
    .sort((a, b) => Number(a.slot) - Number(b.slot));

  const count = Math.min(queuedJobs.length, idleWorkers.length);
  for (let i = 0; i < count; i += 1) {
    const worker = idleWorkers[i];
    const job = queuedJobs[i];
    const personaSession =
      typeof job.persona_session === 'string' && job.persona_session.trim()
        ? job.persona_session.trim()
        : workerBaseLabel(worker);
    const effort = job.effort === 'xhigh' ? 'xhigh' : 'high';
    const contextMode = job.context_mode === 'resume' ? 'resume' : 'fresh';

    worker.state = 'busy';
    worker.persona_session = personaSession;
    worker.effort = effort;
    worker.job_id = job.id;
    worker.assigned_at = now;
    worker.label = personaSession;
    worker.updated_at = now;

    job.state = 'assigned';
    job.assigned_worker = worker.slot;
    job.assigned_at = now;
    job.last_update = now;

    assignments.push(
      [worker.slot, job.id, personaSession, effort, contextMode, job.job_file || '', job.result_file || ''].join(
        '\t'
      )
    );
    changed = true;
  }

  if (changed) {
    writeWorkersQueue(workersFile, queueFile, workersParsed, queueParsed, workers, jobs, now);
  }
  for (const row of assignments) process.stdout.write(`${row}\n`);
}

function opRollback(args) {
  const [workersFile, queueFile, slotRaw = '', jobIdRaw = ''] = args;
  const slot = String(slotRaw);
  const jobId = String(jobIdRaw);
  const now = new Date().toISOString();

  const { parsed: workersParsed, workers } = readWorkersRequired(workersFile);
  const { parsed: queueParsed, jobs } = readQueueRequired(queueFile);
  const worker = workers.find((item) => item && String(item.slot) === slot);
  const job = jobs.find((item) => item && item.id === jobId);
  let changed = false;
  let label = '';

  if (worker && (!jobId || worker.job_id === jobId)) {
    worker.state = 'idle';
    worker.persona_session = '';
    worker.effort = 'high';
    worker.job_id = '';
    worker.assigned_at = '';
    worker.label = workerBaseLabel(worker, slot);
    worker.updated_at = now;
    label = worker.label;
    changed = true;
  } else if (worker) {
    label = workerBaseLabel(worker, slot);
  }

  if (job) {
    const assignedWorker = String(job.assigned_worker || '');
    if ((job.state === 'assigned' || job.state === 'running') && (!assignedWorker || assignedWorker === slot)) {
      job.state = 'queued';
      job.assigned_worker = '';
      job.assigned_at = '';
      job.last_update = now;
      changed = true;
    }
  }

  if (changed) {
    writeWorkersQueue(workersFile, queueFile, workersParsed, queueParsed, workers, jobs, now);
  }

  if (worker || job) {
    process.stdout.write(`${slot}\t${jobId}\t${label}\t${changed ? '1' : '0'}`);
  }
}

function opAdd(args) {
  let queueFile = '';
  let id = '';
  let personaSession = '';
  let taskText = '';
  let priorityRaw = '';
  let effortRaw = '';
  let contextModeRaw = 'fresh';
  let jobFile = '';
  let resultFile = '';
  let createdAt = '';

  if (args.length >= 10) {
    [queueFile, id, personaSession, taskText, priorityRaw, effortRaw, contextModeRaw, jobFile, resultFile, createdAt] = args;
  } else {
    [queueFile, id, personaSession, taskText, priorityRaw, effortRaw, jobFile, resultFile, createdAt] = args;
  }

  const parsed = readJsonRequired(queueFile);
  const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
  const priority = Number.isFinite(Number(priorityRaw)) ? Number(priorityRaw) : 50;
  const contextMode = contextModeRaw === 'resume' ? 'resume' : 'fresh';
  jobs.push({
    id,
    persona_session: personaSession,
    task: taskText,
    priority,
    effort: effortRaw === 'xhigh' ? 'xhigh' : 'high',
    context_mode: contextMode,
    state: 'queued',
    created_at: createdAt,
    assigned_worker: '',
    assigned_at: '',
    finished_at: '',
    last_update: createdAt,
    job_file: jobFile,
    result_file: resultFile,
  });
  parsed.updated_at = createdAt;
  parsed.jobs = jobs;
  writeJsonAtomic(queueFile, parsed);
  process.stdout.write(`Queued job: ${id}\n`);
}

function opDone(args) {
  const [workersFile, queueFile, slotRaw = '', markRaw = 'done'] = args;
  const slot = String(slotRaw);
  const mark = String(markRaw).toLowerCase() === 'blocked' ? 'blocked' : 'done';
  const now = new Date().toISOString();

  const { parsed: workersParsed, workers } = readWorkersRequired(workersFile);
  const { parsed: queueParsed, jobs } = readQueueRequired(queueFile);
  const worker = workers.find((item) => item && String(item.slot) === slot);
  if (!worker) return;

  let jobId = '';
  if (worker.job_id) {
    const job = jobs.find((item) => item && item.id === worker.job_id);
    if (job) {
      job.state = mark;
      job.finished_at = now;
      job.last_update = now;
      jobId = job.id;
    }
  }

  worker.state = 'idle';
  worker.persona_session = '';
  worker.effort = 'high';
  worker.job_id = '';
  worker.assigned_at = '';
  worker.label = workerBaseLabel(worker, slot);
  worker.updated_at = now;

  writeWorkersQueue(workersFile, queueFile, workersParsed, queueParsed, workers, jobs, now);
  process.stdout.write(`${slot}\t${jobId}\t${mark}\t${worker.label}`);
}

function opReset(args) {
  const [workersFile, queueFile, slotRaw = ''] = args;
  const slot = String(slotRaw);
  const now = new Date().toISOString();

  const { parsed: workersParsed, workers } = readWorkersRequired(workersFile);
  const { parsed: queueParsed, jobs } = readQueueRequired(queueFile);
  const worker = workers.find((item) => item && String(item.slot) === slot);
  if (!worker) return;

  let requeuedJobId = '';
  if (worker.job_id) {
    const job = jobs.find((item) => item && item.id === worker.job_id);
    if (job && (job.state === 'assigned' || job.state === 'running')) {
      job.state = 'queued';
      job.assigned_worker = '';
      job.assigned_at = '';
      job.last_update = now;
      requeuedJobId = job.id;
    }
  }

  worker.state = 'idle';
  worker.persona_session = '';
  worker.effort = 'high';
  worker.job_id = '';
  worker.assigned_at = '';
  worker.label = workerBaseLabel(worker, slot);
  worker.updated_at = now;

  writeWorkersQueue(workersFile, queueFile, workersParsed, queueParsed, workers, jobs, now);
  process.stdout.write(`${slot}\t${requeuedJobId}\t${worker.label}`);
}

function opRecover(args) {
  const [workersFile, queueFile, staleSecRaw = '0'] = args;
  const staleSec = Number(staleSecRaw);
  if (!Number.isFinite(staleSec) || staleSec <= 0) return;

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const events = [];
  let changed = false;

  const { parsed: workersParsed, workers } = readWorkersRequired(workersFile);
  const { parsed: queueParsed, jobs } = readQueueRequired(queueFile);

  for (const worker of workers) {
    if (!worker || worker.state !== 'busy' || !worker.job_id) continue;
    const job = jobs.find((item) => item && item.id === worker.job_id);
    if (!job || (job.state !== 'assigned' && job.state !== 'running')) continue;
    const assignedAt =
      typeof job.assigned_at === 'string' && job.assigned_at.trim()
        ? job.assigned_at.trim()
        : (typeof worker.assigned_at === 'string' ? worker.assigned_at.trim() : '');
    if (!assignedAt) continue;
    const assignedMs = Date.parse(assignedAt);
    if (!Number.isFinite(assignedMs)) continue;
    const ageSec = Math.floor((nowMs - assignedMs) / 1000);
    if (ageSec < staleSec) continue;

    job.state = 'queued';
    job.assigned_worker = '';
    job.assigned_at = '';
    job.last_update = now;

    worker.state = 'idle';
    worker.persona_session = '';
    worker.effort = 'high';
    worker.job_id = '';
    worker.assigned_at = '';
    worker.label = workerBaseLabel(worker);
    worker.updated_at = now;

    events.push(`${worker.slot}\t${job.id}\t${ageSec}\t${worker.label}`);
    changed = true;
  }

  if (changed) {
    writeWorkersQueue(workersFile, queueFile, workersParsed, queueParsed, workers, jobs, now);
  }
  for (const event of events) process.stdout.write(`${event}\n`);
}

function usageAndExit() {
  console.error('Usage: node scripts/cx_queue_state.cjs <ensure|harvest|assign|rollback|add|done|reset|recover> ...');
  process.exit(2);
}

function main() {
  const op = process.argv[2];
  const args = process.argv.slice(3);
  switch (op) {
    case 'ensure':
      opEnsure(args);
      return;
    case 'harvest':
      opHarvest(args);
      return;
    case 'assign':
      opAssign(args);
      return;
    case 'rollback':
      opRollback(args);
      return;
    case 'add':
      opAdd(args);
      return;
    case 'done':
      opDone(args);
      return;
    case 'reset':
      opReset(args);
      return;
    case 'recover':
      opRecover(args);
      return;
    default:
      usageAndExit();
  }
}

main();

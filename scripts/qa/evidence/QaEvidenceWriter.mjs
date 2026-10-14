import fs from 'node:fs/promises';
import path from 'node:path';
import { writeQaJsonAtomic } from './qaAtomicJson.mjs';

import {
  serializeQaError,
} from '../contracts/qaEvidenceContract.mjs';

function writeJsonAtomic(filePath, value) {
  return writeQaJsonAtomic(filePath, value, { mode: 0o666 });
}

export class QaEvidenceWriter {
  constructor(plan, { now = () => Date.now() } = {}) {
    this.plan = plan;
    this.now = now;
    this.startedAt = now();
    this.eventPath = path.join(plan.runRoot, 'events.jsonl');
    this.writeQueue = Promise.resolve();
  }

  async start() {
    await fs.mkdir(path.dirname(this.plan.runRoot), { recursive: true });
    try {
      await fs.mkdir(this.plan.runRoot);
    } catch (error) {
      if (error?.code === 'EEXIST') {
        throw new Error(`QA_RUN_ROOT_EXISTS:${this.plan.runRoot}`, { cause: error });
      }
      throw error;
    }
    await fs.mkdir(path.join(this.plan.runRoot, 'attachments'));
    await this.event('QA_RUN_STARTED', {
      targetId: this.plan.targetId,
      mode: this.plan.mode,
      lane: this.plan.lane,
      resourceClaims: this.plan.resourceClaims,
    });
  }

  async event(type, payload = {}) {
    const event = Object.freeze({
      contractVersion: 1,
      runId: this.plan.runId,
      type,
      at: new Date(this.now()).toISOString(),
      payload,
    });
    this.writeQueue = this.writeQueue.then(() => (
      fs.appendFile(this.eventPath, `${JSON.stringify(event)}\n`, 'utf8')
    ));
    await this.writeQueue;
    return event;
  }

  async finalize({
    status,
    result = null,
    error = null,
    cleanup,
  }) {
    const finishedAt = this.now();
    const durationMs = Math.max(0, finishedAt - this.startedAt);
    await this.event('QA_RUN_FINISHED', {
      status,
      durationMs,
    });
    await this.writeQueue;
    const report = {
      contractVersion: 2,
      runId: this.plan.runId,
      targetId: this.plan.targetId,
      mode: this.plan.mode,
      lane: this.plan.lane,
      protocolId: this.plan.protocolId,
      evidenceContract: {
        reportRequired: Object.hasOwn(this.plan.protocolOptions, 'reportContract'),
      },
      status,
      startedAt: new Date(this.startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      durationMs,
      artifactId: this.plan.artifactId,
      environment: this.plan.environment
        ? {
          id: this.plan.environment.id,
          browserClass: this.plan.environment.browserClass,
          processOwnership: this.plan.environment.processOwnership,
          focusPolicy: this.plan.environment.focusPolicy,
          audioPolicy: this.plan.environment.audioPolicy,
        }
        : null,
      browserRequirements: this.plan.browserRequirements,
      browserExecution: this.plan.browserExecution,
      parameters: this.plan.parameters,
      resourceClaims: this.plan.resourceClaims,
      result,
      error: error ? serializeQaError(error) : null,
      cleanup,
    };
    await writeJsonAtomic(path.join(this.plan.runRoot, 'cleanup.json'), cleanup);
    await writeJsonAtomic(path.join(this.plan.runRoot, 'run.json'), report);
    return Object.freeze(report);
  }
}

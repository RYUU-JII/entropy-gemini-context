import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  cloneProjectHarnessJsonData,
} from './projectHarnessEnvelope.mjs';

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function createOutputReservationPath(outputPath) {
  const name = createHash('sha256')
    .update(outputPath)
    .digest('hex')
    .slice(0, 32);
  return path.join(
    path.dirname(outputPath),
    `.project-harness-output-${name}.reservation`,
  );
}

async function assertOutputAbsent(outputPath) {
  try {
    await fs.lstat(outputPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  fail('PROJECT_HARNESS_OUTPUT_EXISTS', outputPath);
}

export async function reserveProjectHarnessJsonOutput(outputPath) {
  if (typeof outputPath !== 'string' || !path.isAbsolute(outputPath)) {
    fail('PROJECT_HARNESS_OUTPUT_PATH_ABSOLUTE_REQUIRED');
  }
  const normalizedOutputPath = path.normalize(outputPath);
  await fs.mkdir(path.dirname(normalizedOutputPath), { recursive: true });
  await assertOutputAbsent(normalizedOutputPath);

  const reservationPath = createOutputReservationPath(normalizedOutputPath);
  const reservationToken = randomUUID();
  let reservationHandle;
  try {
    reservationHandle = await fs.open(reservationPath, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(
        `PROJECT_HARNESS_OUTPUT_RESERVED:${normalizedOutputPath}`,
        { cause: error },
      );
    }
    throw error;
  }

  let reservationReady = false;
  try {
    await reservationHandle.writeFile(
      `${JSON.stringify({
        contractVersion: 1,
        outputPath: normalizedOutputPath,
        token: reservationToken,
        pid: process.pid,
      })}\n`,
      'utf8',
    );
    await reservationHandle.sync();
    await reservationHandle.close();
    reservationHandle = null;

    await assertOutputAbsent(normalizedOutputPath);
    const probePath = path.join(
      path.dirname(normalizedOutputPath),
      `.project-harness-link-probe-${randomUUID()}`,
    );
    try {
      await fs.link(reservationPath, probePath);
    } finally {
      await fs.rm(probePath, { force: true }).catch(() => {});
    }
    reservationReady = true;
  } finally {
    await reservationHandle?.close().catch(() => {});
    if (!reservationReady) {
      await fs.rm(reservationPath, { force: true }).catch(() => {});
    }
  }

  let state = 'reserved';
  async function release() {
    if (state === 'released') return;
    await fs.rm(reservationPath, { force: true });
    state = 'released';
  }

  return Object.freeze({
    outputPath: normalizedOutputPath,
    reservationPath,
    async publish(value) {
      if (state !== 'reserved') {
        fail('PROJECT_HARNESS_OUTPUT_RESERVATION_INACTIVE', state);
      }
      const normalizedValue = cloneProjectHarnessJsonData(value, 'output');
      const temporaryPath = path.join(
        path.dirname(normalizedOutputPath),
        `.project-harness-output-${randomUUID()}.tmp`,
      );
      let temporaryHandle;
      try {
        temporaryHandle = await fs.open(temporaryPath, 'wx', 0o600);
        await temporaryHandle.writeFile(
          `${JSON.stringify(normalizedValue, null, 2)}\n`,
          'utf8',
        );
        await temporaryHandle.sync();
        await temporaryHandle.close();
        temporaryHandle = null;
        await fs.link(temporaryPath, normalizedOutputPath);
        state = 'published';
      } catch (error) {
        if (error?.code === 'EEXIST') {
          throw new Error(
            `PROJECT_HARNESS_OUTPUT_EXISTS:${normalizedOutputPath}`,
            { cause: error },
          );
        }
        throw error;
      } finally {
        await temporaryHandle?.close().catch(() => {});
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
      }
      await release();
    },
    release,
  });
}

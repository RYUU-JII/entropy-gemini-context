import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  getQaTarget,
} from '../catalog/qaTargetRegistry.mjs';
import {
  compileQaExecutionPlan,
} from '../contracts/qaExecutionPlanContract.mjs';
import {
  readQaLocalConfig,
  createEmptyQaLocalConfig,
  resolveQaTargetEnvironment,
} from '../environment/qaLocalConfig.mjs';

export const DEFAULT_QA_LOCAL_CONFIG_RELATIVE_PATH = '.artifacts/entropy-qa.local.json';

function createRunId(targetId, now = new Date()) {
  const timestamp = now.toISOString().replace(/[-:.TZ]/gu, '');
  const targetSlug = targetId.replace(/[^a-z0-9]+/giu, '-');
  return `${timestamp}-${targetSlug}-${randomUUID().slice(0, 8)}`;
}

async function pathExists(filePath) {
  return fs.access(filePath).then(() => true, () => false);
}

async function loadConfigForTarget({
  configPath,
  rootDir,
  target,
}) {
  if (await pathExists(configPath)) {
    return readQaLocalConfig(configPath, { rootDir });
  }
  if (target.environmentId === 'authenticated') {
    throw new Error(`QA_LOCAL_CONFIG_UNAVAILABLE:${configPath}`);
  }
  return createEmptyQaLocalConfig({ rootDir });
}

export async function loadQaConfigForRoot({
  configPath,
  rootDir,
  requireExisting = false,
} = {}) {
  if (!path.isAbsolute(rootDir || '')) {
    throw new Error('QA_RUN_ROOT_ABSOLUTE_REQUIRED');
  }
  if (!path.isAbsolute(configPath || '')) {
    throw new Error('QA_LOCAL_CONFIG_ABSOLUTE_PATH_REQUIRED');
  }
  if (await pathExists(configPath)) {
    return readQaLocalConfig(configPath, { rootDir });
  }
  if (requireExisting) {
    throw new Error(`QA_LOCAL_CONFIG_UNAVAILABLE:${configPath}`);
  }
  return createEmptyQaLocalConfig({ rootDir });
}

export async function compileQaRun({
  rootDir,
  targetId,
  mode,
  rawParameters = {},
  configPath = null,
  runId = null,
} = {}) {
  if (!path.isAbsolute(rootDir || '')) {
    throw new Error('QA_RUN_ROOT_ABSOLUTE_REQUIRED');
  }
  const target = getQaTarget(targetId);
  const resolvedConfigPath = configPath === null
    ? path.join(rootDir, DEFAULT_QA_LOCAL_CONFIG_RELATIVE_PATH)
    : configPath;
  if (!path.isAbsolute(resolvedConfigPath || '')) {
    throw new Error('QA_LOCAL_CONFIG_ABSOLUTE_PATH_REQUIRED');
  }
  const config = await loadConfigForTarget({
    configPath: path.normalize(resolvedConfigPath),
    rootDir,
    target,
  });
  const environment = resolveQaTargetEnvironment(target, config);
  return compileQaExecutionPlan({
    rootDir,
    runId: runId || createRunId(target.id),
    target,
    mode,
    rawParameters,
    environment,
    artifactPaths: config.artifacts,
    configPath: path.normalize(resolvedConfigPath),
  });
}

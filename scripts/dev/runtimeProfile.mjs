#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function parseVersion(value) {
  const normalized = String(value || '').trim().replace(/^v/i, '');
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return {
    raw: normalized,
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

function compareVersions(a, b) {
  if (!a || !b) return 0;
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function parseMinimumVersion(range) {
  const normalized = String(range || '').trim();
  if (!normalized.startsWith('>=')) {
    return parseVersion(normalized);
  }
  return parseVersion(normalized.slice(2).trim());
}

function readPackageRuntime() {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return {
    packageJsonPath,
    packageJson,
    nodeRange: String(packageJson?.engines?.node || '').trim(),
  };
}

function readPreferredNodeVersion() {
  const nvmrcPath = path.join(repoRoot, '.nvmrc');
  const preferredNode = readTextIfExists(nvmrcPath).trim();
  return {
    nvmrcPath,
    preferredNode,
  };
}

export function getRuntimeProfile() {
  const packageRuntime = readPackageRuntime();
  const nvmRuntime = readPreferredNodeVersion();
  return {
    repoRoot,
    nodeRange: packageRuntime.nodeRange,
    preferredNode: nvmRuntime.preferredNode,
    packageJsonPath: packageRuntime.packageJsonPath,
    nvmrcPath: nvmRuntime.nvmrcPath,
  };
}

export function assessCurrentRuntime() {
  const profile = getRuntimeProfile();
  const current = parseVersion(process.versions.node);
  const minimum = parseMinimumVersion(profile.nodeRange);
  const preferred = parseVersion(profile.preferredNode);
  const meetsMinimum = minimum ? compareVersions(current, minimum) >= 0 : true;
  const matchesPreferred = preferred ? compareVersions(current, preferred) === 0 : true;

  return {
    ...profile,
    currentNode: current?.raw || process.versions.node,
    minimumNode: minimum?.raw || '',
    preferredNode: preferred?.raw || profile.preferredNode,
    meetsMinimum,
    matchesPreferred,
    isSupported: meetsMinimum,
  };
}

export function describeRuntimeRequirement(runtime) {
  const lines = [];
  if (runtime.nodeRange) {
    lines.push(`Expected Node ${runtime.nodeRange} from package.json.`);
  } else if (runtime.preferredNode) {
    lines.push(`Expected Node ${runtime.preferredNode} from .nvmrc.`);
  }
  if (runtime.preferredNode && runtime.nodeRange) {
    lines.push(`Project .nvmrc prefers Node ${runtime.preferredNode} for reproducible local shells.`);
  }
  return lines;
}

function isMountedWindowsPath(value) {
  return /^\/mnt\/[a-z]\//i.test(String(value || '').trim());
}

export function shouldUseLinuxTmp(env = process.env) {
  if (process.platform === 'win32') return false;
  const tmpCandidates = [env.TMPDIR, env.TMP, env.TEMP];
  return tmpCandidates.some(isMountedWindowsPath);
}

export function buildSpawnEnv(env = process.env) {
  const nextEnv = { ...env };
  const localBinDir = path.join(repoRoot, 'node_modules', '.bin');
  const runtimeBinDir = path.dirname(process.execPath);
  const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
  const currentPath = String(nextEnv[pathKey] || nextEnv.PATH || '');
  nextEnv[pathKey] = currentPath
    ? `${runtimeBinDir}${path.delimiter}${localBinDir}${path.delimiter}${currentPath}`
    : `${runtimeBinDir}${path.delimiter}${localBinDir}`;
  nextEnv.PATH = nextEnv[pathKey];
  if (shouldUseLinuxTmp(nextEnv)) {
    nextEnv.TMPDIR = '/tmp';
    nextEnv.TMP = '/tmp';
    nextEnv.TEMP = '/tmp';
  }
  return nextEnv;
}

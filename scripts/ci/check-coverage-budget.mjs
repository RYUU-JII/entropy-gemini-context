#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const configPath = path.resolve(rootDir, 'scripts/ci/quality-gate.config.json');
const summaryPath = path.resolve(rootDir, 'coverage/coverage-summary.json');

const readJson = async (targetPath) => {
  const payload = await fs.readFile(targetPath, 'utf8');
  return JSON.parse(payload);
};

const pctOf = (metric) => {
  const value = Number(metric?.pct);
  return Number.isFinite(value) ? value : NaN;
};

const formatPct = (value) => `${value.toFixed(2)}%`;

const main = async () => {
  let config;
  try {
    config = await readJson(configPath);
  } catch (error) {
    console.error(`[coverage-budget] Failed to read config: ${configPath}`);
    console.error(`[coverage-budget] ${error?.message || error}`);
    process.exit(1);
    return;
  }

  let summary;
  try {
    summary = await readJson(summaryPath);
  } catch (error) {
    console.error(`[coverage-budget] Failed to read coverage summary: ${summaryPath}`);
    console.error('[coverage-budget] Run `npm run test:coverage` before this check.');
    console.error(`[coverage-budget] ${error?.message || error}`);
    process.exit(1);
    return;
  }

  const thresholds = config?.coverage ?? {};
  const total = summary?.total ?? {};

  const checks = [
    { name: 'statements', actual: pctOf(total.statements), min: Number(thresholds.statementsPctMin) },
    { name: 'branches', actual: pctOf(total.branches), min: Number(thresholds.branchesPctMin) },
    { name: 'functions', actual: pctOf(total.functions), min: Number(thresholds.functionsPctMin) },
    { name: 'lines', actual: pctOf(total.lines), min: Number(thresholds.linesPctMin) },
  ];

  let hasError = false;
  checks.forEach(({ name, actual, min }) => {
    if (!Number.isFinite(actual) || !Number.isFinite(min)) {
      console.error(`[coverage-budget] Invalid metric for ${name}. actual=${actual} min=${min}`);
      hasError = true;
      return;
    }

    const status = actual >= min ? 'PASS' : 'FAIL';
    const printer = status === 'PASS' ? console.log : console.error;
    printer(
      `[coverage-budget] ${status} ${name}: actual=${formatPct(actual)} min=${formatPct(min)}`,
    );
    if (status === 'FAIL') hasError = true;
  });

  if (hasError) {
    process.exit(1);
    return;
  }

  console.log('[coverage-budget] PASS: coverage budgets satisfied.');
};

main().catch((error) => {
  console.error('[coverage-budget] Unexpected error:', error);
  process.exit(1);
});

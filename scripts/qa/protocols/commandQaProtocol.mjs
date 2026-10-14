import fs from 'node:fs/promises';
import path from 'node:path';

import {
  createBrowserExecutionEnvironment,
} from '../../browser-qa/contracts/browserExecutionContract.mjs';
import {
  QA_RUN_STATUSES,
} from '../contracts/qaTargetContract.mjs';

function buildArgs({ plan, artifact, attachmentsDir }) {
  const options = plan.protocolOptions;
  const args = [path.join(plan.rootDir, options.script)];
  if (typeof options.reportArgument === 'string') {
    args.push(`${options.reportArgument}=${path.join(attachmentsDir, 'report')}`);
  }
  if (
    typeof options.artifactArgument === 'string'
    && plan.parameters.sourceOnly !== true
  ) {
    if (!artifact?.path) throw new Error('QA_COMMAND_ARTIFACT_PATH_REQUIRED');
    args.push(`${options.artifactArgument}=${artifact.path}`);
  }
  if (plan.browserExecution) {
    args.push(plan.browserExecution.headless === false ? '--headed' : '--headless');
  }
  if (plan.parameters.sourceOnly === true) args.push('--source-only');
  return args;
}

function fail(code, detail = '', cause = null) {
  const error = new Error(
    detail ? `${code}:${detail}` : code,
    cause ? { cause } : undefined,
  );
  error.code = code;
  throw error;
}

function isReportBearingChildFailure(error) {
  return error?.code === undefined
    && Number.isSafeInteger(error?.exitCode)
    && error.exitCode > 0
    && error.signal === null
    && String(error?.message || '').startsWith('QA_CHILD_PROCESS_FAILED:');
}

export async function readCommandQaProtocolReport({ reportRoot, reportContract } = {}) {
  if (typeof reportRoot !== 'string' || !path.isAbsolute(reportRoot)) {
    fail('QA_COMMAND_REPORT_ROOT_INVALID');
  }
  if (
    !reportContract
    || typeof reportContract !== 'object'
    || !Number.isSafeInteger(reportContract.schemaVersion)
    || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(reportContract.filePrefix || '')
    || typeof reportContract.outcomeField !== 'string'
    || !reportContract.outcomeField
    || !Object.hasOwn(reportContract, 'passValue')
    || !Object.hasOwn(reportContract, 'failValue')
    || Object.is(reportContract.passValue, reportContract.failValue)
  ) {
    fail('QA_COMMAND_REPORT_CONTRACT_INVALID');
  }
  const rootStat = await fs.lstat(reportRoot).catch((error) => {
    fail('QA_COMMAND_REPORT_ROOT_MISSING', error?.code || 'unknown', error);
  });
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    fail(
      'QA_COMMAND_REPORT_ROOT_INVALID',
      rootStat.isSymbolicLink() ? 'symlink' : 'not_directory',
    );
  }
  const entries = await fs.readdir(reportRoot, { withFileTypes: true });
  const reportEntries = entries.filter((entry) => (
    entry.name.startsWith(reportContract.filePrefix)
    && entry.name.endsWith('.json')
  ));
  if (reportEntries.length !== 1) {
    fail('QA_COMMAND_REPORT_FILE_COUNT_INVALID', String(reportEntries.length));
  }
  const [reportEntry] = reportEntries;
  const reportJsonPath = path.join(reportRoot, reportEntry.name);
  const reportStat = await fs.lstat(reportJsonPath);
  if (reportStat.isSymbolicLink() || !reportStat.isFile()) {
    fail(
      'QA_COMMAND_REPORT_FILE_INVALID',
      reportStat.isSymbolicLink() ? 'symlink' : 'not_file',
    );
  }
  let report;
  try {
    report = JSON.parse(await fs.readFile(reportJsonPath, 'utf8'));
  } catch (error) {
    fail('QA_COMMAND_REPORT_JSON_INVALID', error?.name || 'parse', error);
  }
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    fail('QA_COMMAND_REPORT_OBJECT_REQUIRED');
  }
  if (report.schemaVersion !== reportContract.schemaVersion) {
    fail(
      'QA_COMMAND_REPORT_SCHEMA_MISMATCH',
      `${reportContract.schemaVersion}:${String(report.schemaVersion)}`,
    );
  }
  const generatedAt = new Date(report.generatedAt);
  if (
    typeof report.generatedAt !== 'string'
    || Number.isNaN(generatedAt.getTime())
    || generatedAt.toISOString() !== report.generatedAt
  ) {
    fail('QA_COMMAND_REPORT_GENERATED_AT_INVALID');
  }
  const outcome = report[reportContract.outcomeField];
  const passed = Object.is(outcome, reportContract.passValue);
  const failed = Object.is(outcome, reportContract.failValue);
  if (!passed && !failed) {
    fail('QA_COMMAND_REPORT_OUTCOME_INVALID', String(outcome));
  }
  return Object.freeze({
    status: passed ? QA_RUN_STATUSES.PASS : QA_RUN_STATUSES.FAIL,
    outcome,
    reportJsonPath,
    schemaVersion: report.schemaVersion,
  });
}

export async function executeQaProtocol({
  plan,
  artifact,
  browser,
  attachmentsDir,
  runChild,
  readProtocolReport = readCommandQaProtocolReport,
}) {
  if (browser?.processOwnership !== 'owned' || !browser.chrome) {
    throw new Error('QA_COMMAND_OWNED_BROWSER_REQUIRED');
  }
  const args = buildArgs({ plan, artifact, attachmentsDir });
  let childFailure = null;
  try {
    await runChild({
      command: process.execPath,
      args,
      env: {
        ...process.env,
        ...browser.launchEnvironment,
        ...createBrowserExecutionEnvironment(plan.browserExecution),
        CHROME_BIN: browser.chrome,
        QA_BROWSER_RENDERING_REQUIREMENT: plan.browserExecution.renderingRequirement,
      },
    });
  } catch (error) {
    if (!isReportBearingChildFailure(error)) throw error;
    childFailure = error;
  }
  const reportRoot = path.join(attachmentsDir, 'report');
  let reportResult;
  try {
    reportResult = await readProtocolReport({
      reportRoot,
      reportContract: plan.protocolOptions.reportContract,
    });
  } catch (error) {
    if (!childFailure) throw error;
    fail(
      'QA_COMMAND_CHILD_REPORT_REQUIRED_AFTER_NONZERO',
      `${childFailure.exitCode}:${error?.code || error?.name || 'unknown'}`,
      error,
    );
  }
  const childExitCode = childFailure?.exitCode || 0;
  if (
    (childExitCode === 0 && reportResult.status !== QA_RUN_STATUSES.PASS)
    || (childExitCode !== 0 && (
      childExitCode !== 1
      || reportResult.status !== QA_RUN_STATUSES.FAIL
    ))
  ) {
    fail(
      'QA_COMMAND_CHILD_EXIT_OUTCOME_MISMATCH',
      `${childExitCode}:${reportResult.status}`,
      childFailure,
    );
  }
  return Object.freeze({
    status: reportResult.status,
    protocol: 'command',
    script: plan.protocolOptions.script,
    childExitCode,
    reportRoot,
    reportJsonPath: reportResult.reportJsonPath,
    reportSchemaVersion: reportResult.schemaVersion,
    reportOutcome: reportResult.outcome,
  });
}

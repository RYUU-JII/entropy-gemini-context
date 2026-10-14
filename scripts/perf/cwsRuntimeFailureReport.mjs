import fs from 'node:fs/promises';
import { sanitizeServiceWorkerDiagnosticText } from './cwsServiceWorkerDiagnostics.mjs';

// Early failure is valid failed evidence, never a set of fabricated metrics.
export async function finalizeCwsRuntimeFailureReport({ reportPath, writeReport, stage, error, cleanup }) {
  const cleanupFailed = cleanup.some(receipt => receipt.status === 'failed');
  if (!error && !cleanupFailed) return reportPath;
  const report = reportPath
    ? JSON.parse(await fs.readFile(reportPath, 'utf8'))
    : { schemaVersion: 3, generatedAt: new Date().toISOString(), measurementComplete: false };
  report.status = 'failed';
  report.failure = error ? { stage, error: sanitizeServiceWorkerDiagnosticText(error.message || String(error)) } : null;
  report.cleanup = cleanup;
  if (!reportPath) return writeReport(report);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return reportPath;
}

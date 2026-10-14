import React, { useEffect, useState } from 'react';
import { tDashboardRuntime as tRuntime } from '../../../domains/settings/i18n/dashboardRuntime.js';
import { BOOT_CORE_TIMEOUT_MS } from './bootConfig.js';
import { reportDashboardBootRecoverySurfaceReady } from './bootEvents.js';

export default function DashboardBootRecoverySurface({ error = null, failed = false, timedOut = false }) {
  const [waitExceeded, setWaitExceeded] = useState(timedOut);
  useEffect(() => {
    if (error !== null || failed || timedOut || waitExceeded) return undefined;
    const timeoutId = window.setTimeout(() => setWaitExceeded(true), BOOT_CORE_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [error, failed, timedOut, waitExceeded]);

  const terminal = error !== null || failed || timedOut || waitExceeded;
  useEffect(() => {
    if (!terminal) return;
    reportDashboardBootRecoverySurfaceReady(error !== null || failed ? 'boot_failed' : 'boot_timeout');
  }, [error, failed, terminal]);

  return (
    <main
      className="flex h-full min-h-screen w-full items-center justify-center bg-surface px-6 text-on-surface"
      data-dashboard-boot-recovery={terminal ? 'error' : 'pending'}
    >
      <section className="w-full max-w-xl border border-border/70 bg-surface-elevated p-8 shadow-xl">
        <h1 className="text-2xl font-semibold">
          {terminal ? tRuntime('common:dashboard_boot_recovery.failed_title') : tRuntime('common:dashboard_boot_recovery.pending_title')}
        </h1>
        <p role={terminal ? 'alert' : 'status'} className="mt-4 text-sm leading-6 text-muted-foreground">
          {terminal ? tRuntime('common:dashboard_boot_recovery.failed_body') : tRuntime('common:dashboard_boot_recovery.pending_body')}
        </p>
        {terminal && (
          <button type="button" className="mt-6 border border-border px-4 py-2 text-sm" onClick={() => window.location.reload()}>
            {tRuntime('common:dashboard_boot_recovery.retry')}
          </button>
        )}
      </section>
    </main>
  );
}

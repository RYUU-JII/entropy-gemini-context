import React, { useEffect } from 'react';
import { reportDashboardSetupSurfaceReady } from '../bootstrap/bootEvents.js';

// Presentation only: showing setup never acknowledges profile/core/Main readiness.
export default function DashboardSetupCanvas({ title, description, busy = false, presented = true, children }) {
  useEffect(() => { if (presented) reportDashboardSetupSurfaceReady(); }, [presented]);
  return (
    <main className="min-h-dvh w-full overflow-y-auto bg-surface px-5 py-12 text-on-surface sm:px-8 sm:py-20"
      data-dashboard-setup-canvas="true" aria-busy={busy}>
      <section className="mx-auto w-full max-w-[600px]">
        <header className="border-b border-border/30 pb-6">
          <p className="mb-3 text-xs font-medium tracking-[0.18em] text-on-surface-muted">Entropy</p>
          <h1 className="break-keep text-balance text-2xl font-medium leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {description ? <p className="mt-4 text-sm leading-7 text-on-surface-muted">{description}</p> : null}
        </header>
        <div className="pt-5">{children}</div>
      </section>
    </main>
  );
}

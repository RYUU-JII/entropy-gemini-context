import {
  getBootSnapshot,
  reportMainTabFirstFrameFailed,
  reportMainTabFirstFrameReady,
} from './bootManager.js';
import { emitZenTrace } from '@zen-trace';

function reportDuringMainBootGate(outcome, metadata, report) {
  const snapshot = getBootSnapshot();
  // Main's visual coordinator may restart for a new theme or canvas. Its
  // lifetime exceeds the document's one-shot boot gate, including stale callbacks.
  if (snapshot.mainTabFirstFrameReady === true || snapshot.status === 'failed') {
    emitZenTrace('dashboard_page:main_boot_gate_closed', {
      outcome,
      status: snapshot.status,
      phase: snapshot.phase,
      mainTabFirstFrameReady: snapshot.mainTabFirstFrameReady,
    });
    return snapshot;
  }
  return report(metadata);
}

export const reportDashboardMainBootFirstFrameReady = (metadata = null) => (
  reportDuringMainBootGate('ready', metadata, reportMainTabFirstFrameReady)
);

export const reportDashboardMainBootFirstFrameFailed = (metadata = null) => (
  reportDuringMainBootGate('failed', metadata, reportMainTabFirstFrameFailed)
);

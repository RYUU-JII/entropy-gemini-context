import {
  getFeedBingeDiagnosticSnapshot,
  getFeedFlowDiagnosticSnapshot,
  getFeedFlowDiagnosticLedgerSnapshot,
  getFeedSupplyDiagnosticSnapshot,
  getFeedTempoDiagnosticSnapshot,
  resetFeedFlowDiagnosticLedger,
} from '../feed-flow/diagnostics/feedFlowDiagnosticState.js';

export class RuntimeDebuggerFeedProbe {
  start() {
    return true;
  }

  stop() {
    return true;
  }

  reset() {
    return this.getSnapshot();
  }

  resetLedger() {
    resetFeedFlowDiagnosticLedger();
    return this.getSnapshot();
  }

  sample(now = Date.now()) {
    return this._compose(getFeedSupplyDiagnosticSnapshot(), now);
  }

  getSnapshot() {
    return this._compose(getFeedSupplyDiagnosticSnapshot(), Date.now());
  }

  _compose(supplySnapshot, now) {
    return {
      ...(supplySnapshot || {}),
      semantic: getFeedFlowDiagnosticSnapshot(now),
      ledger: getFeedFlowDiagnosticLedgerSnapshot(),
      tempo: getFeedTempoDiagnosticSnapshot(),
      binge: getFeedBingeDiagnosticSnapshot(),
      // Research acquisition is explicit/offline; reading the debugger cannot
      // start a live geometry sensor or personal-tempo collector.
      sensorObservation: null,
      researchMode: 'offline_only',
    };
  }
}

export default RuntimeDebuggerFeedProbe;

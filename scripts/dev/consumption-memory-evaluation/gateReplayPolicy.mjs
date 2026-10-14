import { DEFAULT_COOLING_CURVE } from '../../../src/domains/settings/config/coolingCurvePolicy.js';
import { createProtectionRuntimeInputAssembler } from '../../../src/domains/protection/background/ProtectionRuntimeInputAssembler.js';
import { ARTIFACT_DISCLOSURE_FAMILY_ORDER } from '../../../src/domains/progression/policy/artifactDisclosurePolicy.js';
import { createGateEntryApproval, approveGateEntry, observeGateEntryApproval } from '../../../src/domains/protection/background/runtime/gateEntryApprovalPolicy.js';
import { DEFAULT_ARTIFACT_CONTROL_STATE } from '../../../src/domains/settings/config/artifactControlState.js';
import { DEFAULT_GATE_CONFIG } from '../../../src/domains/settings/config/gateConfig.js';
import { createEmptyConsumptionFlowState, projectConsumptionFlow } from '../../../src/domains/tracking/background/trackingConsumptionFlowState.js';
import { projectProtectedConsumptionContext } from '../../../src/domains/behavior/consumption/consumptionContext.js';

export const REPLAY_HOSTS = Object.freeze(Array.from({ length: 4 }, (_, i) => `protected-${i}.example`));

export function createGateReplayPolicy() {
  const assembler = createProtectionRuntimeInputAssembler({ mergeNudgeConfig: (config) => config });
  // In-memory evaluation I/O only. The production pure policy owns every
  // transition; no host passes or independent expiry rule remain in replay.
  let approval = createGateEntryApproval();
  const artifactDisclosureSnapshot = {
    policyVersion: 1, orderedFamilyIds: ARTIFACT_DISCLOSURE_FAMILY_ORDER,
    disclosedFamilyIds: ARTIFACT_DISCLOSURE_FAMILY_ORDER,
    entriesByFamilyId: Object.fromEntries(ARTIFACT_DISCLOSURE_FAMILY_ORDER.map((familyId) => [familyId, { familyId, runtimeEligible: true }])),
  };
  return {
    evaluate({ hostname, tabId, now, enteredAt = now, enabled = true, isForeground = true, snapshot = {} }) {
      const input = assembler.assembleRuntimeInput({ hostname, now, artifactDisclosureSnapshot,
        // Replay has no committed tracking ledger for Gate input. State that
        // absence through the canonical projection, without inventing recent use.
        consumptionContext: {
          ...projectProtectedConsumptionContext({
            ...projectConsumptionFlow(createEmptyConsumptionFlowState(), now), environment: null,
          }, now),
          memory: { status: 'not_ready', projection: null, error: null },
        },
        settingsSnapshot: { artifactControlState: DEFAULT_ARTIFACT_CONTROL_STATE, blockedUrls: REPLAY_HOSTS, allowedUrls: [], rulesMode: 'managed',
          dataCollectionMode: 'protected_sites', insightsConsent: 'protected_only',
          coolingCurve: DEFAULT_COOLING_CURVE, globalGoal: 0, nudgeConfig: { goalEnds: { site: false, global: false } }, filterSettings: {},
          gateConfig: { ...DEFAULT_GATE_CONFIG, entryCheckpoint: { enabled } },
          siteGoals: {}, siteGoalMeta: {}, protectionPresetCatalog: {}, protectionPresetAssignments: {} },
        ruleHashSnapshot: { blockedByHash: null, allowedByHash: null, siteGoalFromHash: null },
        statsSnapshot: { dateStr: '2026-09-09', dates: {} },
        gateRuntimeSnapshot: { hostname, isForeground, foregroundTabId: tabId,
          foregroundActiveAt: now, lastEnteredAt: enteredAt,
          ...snapshot, entryApproved: approval.approved },
      });
      return { eligible: input.directTriggers.includes('ENTRY_CHECKPOINT_REQUIRED'),
        telemetry: input.gateRuntime.telemetry.entryCheckpoint };
    },
    decide({ sessionId, now, decision }) {
      if (decision === 'continue') approval = approveGateEntry(approval, { sessionId, now });
    },
    observe(point) { approval = observeGateEntryApproval(approval, point); },
    getApproval() { return structuredClone(approval); },
  };
}

import { requireSitesSiteDetailRevision } from '../../../domains/stats/contracts/sitesSiteDetailContracts.js';
import { requireSitesGlobalExposureAverage } from '../../../domains/stats/contracts/sitesGlobalExposureAverageContract.js';
import { requireSitesRecordingPolicy } from '../../../domains/stats/contracts/sitesRecordingContracts.js';
import {
  requireCanonicalStatsStatusSnapshot,
} from '../../../domains/stats/contracts/statsStatusSnapshotContract.js';

export function createAnalysisResponseError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function requireAnalysisResponseObject(value, errorCode) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createAnalysisResponseError(errorCode);
  }
  return value;
}

function requireAnalysisResponseField(source, field, errorCode) {
  return requireAnalysisResponseObject(source?.[field], errorCode);
}

function requireStatusSnapshotField(source, field, errorCode) {
  return requireCanonicalStatsStatusSnapshot(
    requireAnalysisResponseField(source, field, errorCode),
    errorCode,
  );
}

function requireSitesSnapshotSemanticRevision(sitesSnapshot) {
  try {
    requireSitesSiteDetailRevision(sitesSnapshot.siteDetailRevision);
  } catch {
    throw createAnalysisResponseError('SITES_SNAPSHOT_SITE_DETAIL_REVISION_INVALID');
  }
  try {
    requireSitesGlobalExposureAverage(sitesSnapshot.globalExposureAverage);
  } catch {
    throw createAnalysisResponseError('SITES_SNAPSHOT_GLOBAL_EXPOSURE_AVERAGE_INVALID');
  }
  requireSitesRecordingPolicy(sitesSnapshot.recording);
  return sitesSnapshot;
}

export function requireBootstrapAnalysisPayload(response, {
  includeSitesSnapshot = false,
} = {}) {
  const analysis = requireAnalysisResponseField(
    response,
    'analysis',
    'ANALYSIS_BOOTSTRAP_RESPONSE_INVALID',
  );
  requireAnalysisResponseField(
    analysis,
    'cycleSnapshot',
    'ANALYSIS_BOOTSTRAP_CYCLE_SNAPSHOT_INVALID',
  );
  requireStatusSnapshotField(
    analysis,
    'statusSnapshot',
    'ANALYSIS_BOOTSTRAP_STATUS_SNAPSHOT_INVALID',
  );
  if (includeSitesSnapshot) {
    requireSitesSnapshotSemanticRevision(requireAnalysisResponseField(
      analysis,
      'sitesSnapshot',
      'ANALYSIS_BOOTSTRAP_SITES_SNAPSHOT_INVALID',
    ));
  }
  return analysis;
}

export function requireCycleProjectionPayload(response) {
  requireAnalysisResponseField(
    response,
    'cycleSnapshot',
    'CYCLE_PROJECTION_RESPONSE_INVALID',
  );
  return response;
}

export function requireStatusSnapshotPayload(response) {
  requireStatusSnapshotField(
    response,
    'statusSnapshot',
    'STATUS_SNAPSHOT_RESPONSE_INVALID',
  );
  return response;
}

export function requireSitesSnapshotPayload(response) {
  const sitesSnapshot = requireAnalysisResponseField(
    response,
    'sitesSnapshot',
    'SITES_SNAPSHOT_RESPONSE_INVALID',
  );
  requireSitesSnapshotSemanticRevision(sitesSnapshot);
  return response;
}

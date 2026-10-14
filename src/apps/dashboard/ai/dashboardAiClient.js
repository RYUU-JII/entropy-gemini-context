import {
  AI_TASK_IDS,
  createAiNarrationService,
  createAiTaskRegistry,
  createSessionSummaryNarrationRequest,
  createUsageInsightNarrationRequest,
  sessionSummaryNarrationTask,
  usageInsightNarrationTask,
} from '@/domains/ai/index.js';
import { createChromeBuiltInAiProvider } from '@/platform/ai/index.js';

let dashboardAiRuntime = null;

function createDashboardAiRuntime() {
  const provider = createChromeBuiltInAiProvider();
  const taskRegistry = createAiTaskRegistry([
    usageInsightNarrationTask,
    sessionSummaryNarrationTask,
  ]);
  const service = createAiNarrationService({
    taskRegistry,
    provider,
  });
  return Object.freeze({
    provider,
    service,
  });
}

export function getDashboardAiRuntime() {
  if (!dashboardAiRuntime) {
    dashboardAiRuntime = createDashboardAiRuntime();
  }
  return dashboardAiRuntime;
}

export function resetDashboardAiRuntimeForTests() {
  dashboardAiRuntime = null;
}

export async function getDashboardAiCapability({
  taskId = AI_TASK_IDS.USAGE_INSIGHT_GENERATE_NARRATION,
  locale = 'en',
} = {}) {
  const { service } = getDashboardAiRuntime();
  return service.getCapabilityForTask(taskId, { locale });
}

export async function generateUsageInsightNarration({
  siteInsightModel = null,
  homeScanSnapshot = null,
  locale = 'en',
  tone = 'calm',
  policy = {},
  signal = null,
  monitor = null,
} = {}) {
  const { service } = getDashboardAiRuntime();
  const request = createUsageInsightNarrationRequest({
    siteInsightModel,
    homeScanSnapshot,
    locale,
    tone,
    policy,
  });
  return service.generate(request, { signal, monitor });
}

export async function prepareUsageInsightNarrationModel({
  locale = 'en',
  signal = null,
  monitor = null,
} = {}) {
  const { service } = getDashboardAiRuntime();
  return service.prepare(AI_TASK_IDS.USAGE_INSIGHT_GENERATE_NARRATION, {
    locale,
    signal,
    monitor,
  });
}

export async function generateSessionSummaryNarration({
  summaryDraft = null,
  locale = 'en',
  tone = 'calm',
  policy = {},
  signal = null,
  monitor = null,
} = {}) {
  const { service } = getDashboardAiRuntime();
  const request = createSessionSummaryNarrationRequest({
    summaryDraft,
    locale,
    tone,
    policy,
  });
  return service.generate(request, { signal, monitor });
}

export async function prepareSessionSummaryNarrationModel({
  locale = 'en',
  signal = null,
  monitor = null,
} = {}) {
  const { service } = getDashboardAiRuntime();
  return service.prepare(AI_TASK_IDS.SESSION_SUMMARY_GENERATE_NARRATION, {
    locale,
    signal,
    monitor,
  });
}

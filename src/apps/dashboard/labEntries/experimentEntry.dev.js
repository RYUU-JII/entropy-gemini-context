export function createExperimentDashboardTabEntry({
  loadingPolicy,
} = {}) {
  if (!loadingPolicy || typeof loadingPolicy !== 'object') {
    throw new Error('EXPERIMENT_DASHBOARD_TAB_LOADING_POLICY_REQUIRED');
  }
  return Object.freeze({
    id: 'experiment',
    load: () => import('../tabs/experiment/ExperimentHubTab.jsx'),
    portraitVisible: false,
    ...loadingPolicy,
    titleKey: 'experiment.title',
    navKey: 'experiment.nav',
    descriptionKey: 'experiment.desc',
  });
}

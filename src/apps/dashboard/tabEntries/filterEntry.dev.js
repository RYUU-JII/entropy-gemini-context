export function createFilterDashboardTabEntry({
  loadingPolicy,
} = {}) {
  if (!loadingPolicy || typeof loadingPolicy !== 'object') {
    throw new Error('FILTER_DASHBOARD_TAB_LOADING_POLICY_REQUIRED');
  }
  return Object.freeze({
    id: 'filter',
    load: () => import('../tabs/filter/FilterTab.jsx'),
    portraitVisible: false,
    ...loadingPolicy,
    titleKey: 'filter.title',
    navKey: 'filter.nav',
    descriptionKey: 'filter.desc',
    isEnabled: () => false,
  });
}

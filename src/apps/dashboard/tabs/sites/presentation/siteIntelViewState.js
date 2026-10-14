import { buildTargetPanelViewModel } from './targetPanelViewModel.js';

// Policy withdrawal and initial detail loading are explicit non-analysis states.
// Projection errors are delivered to the Intel boundary, never substituted data.
export function projectSiteIntelViewState({ intel, recordingEnabled, weeklyFallbackLabels }) {
  if (recordingEnabled !== true || intel?.isReady !== true) {
    return { viewModel: null, error: null };
  }
  try {
    return { viewModel: buildTargetPanelViewModel({ intel, weeklyFallbackLabels }), error: null };
  } catch (error) {
    return { viewModel: null, error };
  }
}

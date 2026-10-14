import { DashboardBootPresentationStore } from '../../../platform/storage/presentation/DashboardBootPresentationStore.js';

const store = new DashboardBootPresentationStore();

export async function resolveBootEnsoPresentation() {
  const completed = await store.readEnsoCompleted();
  return {
    renderMode: 'animated',
    durationMs: completed ? 2200 : 3300,
    complete: completed ? null : () => store.markEnsoCompleted(),
  };
}

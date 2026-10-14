import { SoundLabStore } from './state/SoundLabStore.js';
import { SoundLedgerComponent } from './components/SoundLedgerComponent.js';
import { StudioDetailComponent } from './components/StudioDetailComponent.js';
import { AgentPromptCardComponent } from './components/AgentPromptCardComponent.js';
import { SoundLabPlayer } from './playback/SoundLabPlayer.js';

export function bootstrapSoundLab() {
  const store = new SoundLabStore();
  const player = new SoundLabPlayer();
  const ledger = new SoundLedgerComponent(document.getElementById('soundList'), store);
  const studio = new StudioDetailComponent(store, player);
  const feedback = new AgentPromptCardComponent(store);
  ledger.bindEvents(); studio.bindEvents(); feedback.bindEvents();
  let selection = '';
  store.subscribe(() => {
    const next = `${store.selectedSoundId}/${store.getSelectedCandidate()?.id}`;
    if (selection !== next) {
      selection = next;
      player.stop().catch(error => { store.message = error.message; store.notify(); });
    }
    const stats = store.getStatistics();
    for (const [key, value] of Object.entries(stats)) document.getElementById(`stat-${key}`).textContent = value;
    document.getElementById('connectionStatus').textContent = store.connected ? '로컬 작업 공간 연결됨' : '청음 · 요청 복사 모드';
    document.getElementById('workspaceMessage').textContent = store.message;
    ledger.render(); studio.render(); feedback.render();
  });
  player.onState = playing => { store.playing = playing; store.notify(); };
  window.addEventListener('pagehide', () => { void player.stop().catch(error => console.error('[sound-lab]', error)); });
  window.addEventListener('beforeunload', event => {
    if ([...store.drafts.values()].some(draft => draft.dirty)) { event.preventDefault(); event.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void player.stop().catch(error => { store.message = error.message; store.notify(); });
  });
  store.notify();
  void feedback.connect();
  return { store, player };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrapSoundLab);
else bootstrapSoundLab();

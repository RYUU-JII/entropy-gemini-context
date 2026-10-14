import React, { useLayoutEffect, useRef } from 'react';
import { measureZenFurinConnections } from '../../../themes/plugins/zen/presentation/artifacts/engine/zenFurinConnectionDiagnostics.dev.js';
import { createZenFurinPresentation, ZEN_FURIN_INSCRIPTIONS } from '../../../themes/plugins/zen/api/furin.js';
import NudgeOverlayHost from '../../../domains/nudge/runtime/NudgeOverlayHost.js';
import { createSiteFurinReflectionView } from '../../../domains/nudge/nudge/SiteFurinReflectionView.js';
import { createSiteFurinReflectionFixture } from '../../../domains/nudge/runtime/automation/siteFurinReflectionFixture.dev.js';
import { createSiteFurinState, advanceSiteFurinFrame, beginSiteFurinExit, resolveSiteFurinProgress } from '../../../domains/nudge/nudge/nudgeGameSiteFurinProtocol.js';
import { setRuntimeLanguage } from '../../../domains/settings/i18n/runtime.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';

const PREVIEWS = [
  { id: 'arrival', elapsedMs: 300, reducedMotion: false, inscriptionIndex: 0 },
  { id: 'choice', elapsedMs: 6000, reducedMotion: false, inscriptionIndex: 0 },
  { id: 'breeze', elapsedMs: 6000, reducedMotion: false, inscriptionIndex: 0, rewardMs: 1500 },
  { id: 'narrow', elapsedMs: 1000, reducedMotion: true, inscriptionIndex: 3, rewardMs: 1000 },
  ...[1, 2, 4, 5].map(inscriptionIndex => ({
    id: ZEN_FURIN_INSCRIPTIONS[inscriptionIndex].id,
    elapsedMs: 6000, reducedMotion: false, inscriptionIndex, rewardMs: 1500,
  })),
];

// Actual product DOM/vector/state projection. Facts and frame progression are
// synthetic; production admission, media and storage proof remain runtime QA.
function SiteFurinSequenceScene({ signalReady }) {
  const refs = useRef([]);
  useLayoutEffect(() => {
    const owners = refs.current.map((container, index) => {
      const { elapsedMs, reducedMotion, inscriptionIndex, rewardMs } = PREVIEWS[index];
      const overlay = new NudgeOverlayHost();
      overlay.ensure();
      const { root } = overlay.getRefs();
      root.id = 'furin-preview-' + index;
      container.append(root);
      root.style.cssText = 'position:relative;height:800px;display:block;width:100%';
      const stage = overlay.prepareSiteFurinChime({ label: 'Furin preview' });
      const visual = createZenFurinPresentation({ container: stage, reducedMotion,
        random: () => (inscriptionIndex + 0.5) / ZEN_FURIN_INSCRIPTIONS.length });
      let state = createSiteFurinState();
      const view = createSiteFurinReflectionView({ root, stage,
        data: createSiteFurinReflectionFixture(new Date(2026, 8, 14, 16, 30).getTime()),
        onAction: () => {}, onWind: wind => visual.setWind(wind),
        onLeave: direction => {
          // Synthetic ACK only: the actual semantic control starts the same
          // host-owned exit projection without closing the harness document.
          state = beginSiteFurinExit(state, 'leave', { reducedMotion });
          visual.blow({ direction });
          const closing = view.close({ choice: 'leave', reducedMotion });
          closing.catch(error => { if (error.name !== 'AbortError') throw error; });
        } });
      const advance = durationMs => {
        for (let elapsed = 0; elapsed < durationMs; elapsed += 16) {
          const frameMs = Math.min(16, durationMs - elapsed);
          state = advanceSiteFurinFrame(state, { frameMs, visible: true, presented: true });
          const progress = resolveSiteFurinProgress(state);
          const projected = visual.frame({ frameMs, progress });
          view.update(progress, { presented: true, pending: state.exitChoice !== null, reducedMotion, visual: projected });
        }
      };
      advance(elapsedMs);
      if (rewardMs !== undefined) {
        const wind = root.shadowRoot.getElementById('nudgeFurinWind');
        if (!wind || wind.disabled) throw new Error('SITE_FURIN_PREVIEW_WIND_UNAVAILABLE');
        // Native button semantic activation covers keyboard/AT equivalence;
        // the runtime target separately proves the real captured pointer sweep.
        wind.click();
        advance(rewardMs);
        const progress = resolveSiteFurinProgress(state);
        if (progress.exitChoice !== 'leave' || progress.exitElapsedMs !== rewardMs) throw new Error('SITE_FURIN_PREVIEW_EXIT_CLOCK_INVALID');
      }
      const connections = measureZenFurinConnections(stage.querySelector('svg'));
      console.info('ZEN_SITE_FURIN_CONNECTIONS ' + JSON.stringify({ index, connections,
        progress: resolveSiteFurinProgress(state), snapshot: visual.snapshot() }));
      return () => { view.dispose(); visual.dispose(); overlay.destroy(); };
    });
    signalReady();
    return () => owners.forEach(dispose => dispose());
  }, [signalReady]);
  return <main data-visual-capture="site-furin-sequence" style={{ background: '#191918', color: '#aaa8a1', minHeight: 900, padding: 20 }}>
    <p style={{ margin: '0 0 16px', fontSize: 13 }}>SITE FURIN · 빈 탄자쿠 / 여섯 문구와 해석 / 좁은 화면 · 실제 컴포넌트 + 합성 사용 기록</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
      {PREVIEWS.map(({ id }, index) => <section key={id} style={{ position: 'relative', transform: 'translateZ(0)', overflow: 'hidden', minHeight: 800,
        width: id === 'narrow' ? 360 : '100%', maxWidth: '100%', justifySelf: 'center' }}
        data-visual-capture={'site-furin-' + id} ref={node => { refs.current[index] = node; }} />)}
    </div>
  </main>;
}
export default defineVisualSceneImplementation({
  Component: SiteFurinSequenceScene,
  prepare: ({ manifest }) => { setRuntimeLanguage(manifest.locale); },
});

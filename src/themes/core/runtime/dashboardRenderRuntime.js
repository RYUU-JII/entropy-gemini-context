import { assertCanonicalThemeId, THEME_IDS } from '../ids.js';
const RETAINERS = Object.freeze({
  [THEME_IDS.MATRIX]: null, [THEME_IDS.ENTROPY]: null, [THEME_IDS.CYBERPUNK]: null,
  [THEME_IDS.CLINICAL]: null, [THEME_IDS.SCP]: null,
  [THEME_IDS.ZEN]: async () => {
    const [{ retainZenDashboardRendererSession }, { retainZenArtifactGallerySession }] = await Promise.all([
      import('../../plugins/zen/runtime/worker/ZenHomeRendererWorkerSession.js'),
      import('../../plugins/zen/runtime/worker/ZenArtifactGallerySession.js'),
    ]);
    const session = retainZenDashboardRendererSession();
    const gallery = retainZenArtifactGallerySession();
    return { status: 'retained', prepare: gallery.prepare, release() { gallery.release(); session.release(); } };
  },
});
export async function retainDashboardThemeRenderRuntime(themeId) {
  const retain = RETAINERS[assertCanonicalThemeId(themeId, 'dashboard render lifetime')];
  if (retain === null) return { status: 'not_declared', release() {} };
  if (!retain) throw new Error('DASHBOARD_RENDER_LIFETIME_OWNER_MISSING');
  return retain();
}

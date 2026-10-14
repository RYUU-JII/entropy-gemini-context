import { assertCanonicalThemeId } from '../ids.js';
import ZenInstallationScene, { ZEN_INSTALLATION_PALETTE } from '../../plugins/zen/presentation/installation/ZenInstallationScene.jsx';
import MatrixInstallationScene, { MATRIX_INSTALLATION_PALETTE } from '../../plugins/matrix/presentation/installation/MatrixInstallationScene.jsx';
import EntropyInstallationScene, { ENTROPY_INSTALLATION_PALETTE } from '../../plugins/entropy/presentation/installation/EntropyInstallationScene.jsx';
import CyberpunkInstallationScene, { CYBERPUNK_INSTALLATION_PALETTE } from '../../plugins/cyberpunk/presentation/installation/CyberpunkInstallationScene.jsx';
import ClinicalInstallationScene, { CLINICAL_INSTALLATION_PALETTE } from '../../plugins/clinical/presentation/installation/ClinicalInstallationScene.jsx';
import ScpInstallationScene, { SCP_INSTALLATION_PALETTE } from '../../plugins/scp/presentation/installation/ScpInstallationScene.jsx';

const INSTALLATION_PRESENTATIONS = Object.freeze({
  zen: Object.freeze({ Scene: ZenInstallationScene, palette: ZEN_INSTALLATION_PALETTE }),
  matrix: Object.freeze({ Scene: MatrixInstallationScene, palette: MATRIX_INSTALLATION_PALETTE }),
  entropy: Object.freeze({ Scene: EntropyInstallationScene, palette: ENTROPY_INSTALLATION_PALETTE }),
  cyberpunk: Object.freeze({ Scene: CyberpunkInstallationScene, palette: CYBERPUNK_INSTALLATION_PALETTE }),
  clinical: Object.freeze({ Scene: ClinicalInstallationScene, palette: CLINICAL_INSTALLATION_PALETTE }),
  scp: Object.freeze({ Scene: ScpInstallationScene, palette: SCP_INSTALLATION_PALETTE }),
});

// Deliberately separate from the Main current/first_vision scene catalog.
export function getInstallationPresentation(themeId) {
  const id = assertCanonicalThemeId(themeId, 'installation presentation');
  const descriptor = INSTALLATION_PRESENTATIONS[id];
  if (typeof descriptor?.Scene !== 'function' || !descriptor.palette) throw new Error(`installation_renderer_missing:${id}`);
  return descriptor;
}

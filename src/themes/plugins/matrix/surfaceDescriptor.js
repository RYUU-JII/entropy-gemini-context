import { THEME_IDS } from '../../core/ids.js';
import { createThemeSurfaceDescriptor } from '../../core/runtime/createThemeSurfaceDescriptor.js';

export const matrixThemeSurfaceDescriptor = createThemeSurfaceDescriptor({
    id: THEME_IDS.MATRIX,
    mainWidgetThemeId: THEME_IDS.MATRIX,
    tabIconVariant: 'standard',
    widgetLoaders: {
        CoreStatus: './widgets/main/MatrixCoreStatus.jsx',
        HomeBriefCard: './widgets/main/MatrixHomeBriefCard.jsx',
        SignalScanner: './widgets/signals/MatrixSignalScanner.jsx',
        TargetInfo: './widgets/main/MatrixActivityGraph.jsx',
        ActivityGraph: './widgets/main/MatrixActivityGraph.jsx',
        FilterTest: './widgets/filter/MatrixFilterTest.jsx',
        ArtifactIcons: './widgets/tools/ArtifactIcons.jsx',
        FluxToggle: './widgets/tools/MatrixFluxToggle.jsx',
        Artifact_Lens: './widgets/tools/Artifacts/GlyphPrism.jsx',
        Artifact_Veil: './widgets/tools/Artifacts/CipherScrim.jsx',
        Artifact_Resonance: './widgets/tools/Artifacts/Monolith.jsx',
        Artifact_Brake: './widgets/tools/Artifacts/MatrixPulseDamper.jsx',
        Artifact_Monolith: './widgets/tools/Artifacts/Monolith.jsx',
        Artifact_Gate: './widgets/tools/Artifacts/EventHorizon.jsx',
        Artifact_Lethe: './widgets/tools/Artifacts/Lethe.jsx',
        Artifact_SentinelFlare: './widgets/tools/Artifacts/SentinelFlare.jsx',
        SitesRegistry: './widgets/sites/MatrixRegistryPanel.jsx',
        SitesTargetPanel: './widgets/sites/MatrixTargetPanel.jsx',
    },
});

export default matrixThemeSurfaceDescriptor;

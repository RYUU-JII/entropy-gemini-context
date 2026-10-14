import { THEME_IDS } from '../../core/ids.js';
import { createThemeSurfaceDescriptor } from '../../core/runtime/createThemeSurfaceDescriptor.js';

export const cyberpunkThemeSurfaceDescriptor = createThemeSurfaceDescriptor({
    id: THEME_IDS.CYBERPUNK,
    mainWidgetThemeId: THEME_IDS.CYBERPUNK,
    tabIconVariant: 'standard',
    widgetLoaders: {
        CoreStatus: './widgets/main/CyberpunkCoreStatus.jsx',
        HomeBriefCard: './widgets/main/CyberpunkHomeBriefCard.jsx',
        FilterTest: './widgets/filter/CyberpunkFilterTest.jsx',
        SignalScanner: './widgets/signals/CyberpunkSignalScanner.jsx',
        TargetInfo: './widgets/main/CyberpunkActivityGraph.jsx',
        ActivityGraph: './widgets/main/CyberpunkActivityGraph.jsx',
        SitesRegistry: './widgets/sites/CyberpunkRegistryPanel.jsx',
        SitesTargetPanel: './widgets/sites/CyberpunkTargetPanel.jsx',
        ArtifactIcons: './widgets/tools/CyberpunkArtifactIcons.jsx',
        FluxToggle: './widgets/tools/CyberpunkFluxToggle.jsx',
        ArtifactPanel: './widgets/tools/CyberpunkArtifactPanel.jsx',
        ArtifactCanvas: './widgets/tools/CyberpunkArtifactCanvas.jsx',
        Artifact_Lens: './widgets/tools/Artifacts/VisorPrism.jsx',
        Artifact_Veil: './widgets/tools/Artifacts/GhostMesh.jsx',
        Artifact_Resonance: './widgets/tools/Artifacts/CyberpunkMonolith.jsx',
        Artifact_Brake: './widgets/tools/Artifacts/CyberpunkInertiaUnit.jsx',
        Artifact_Monolith: './widgets/tools/Artifacts/CyberpunkMonolith.jsx',
        Artifact_Gate: './widgets/tools/Artifacts/CyberpunkEventHorizon.jsx',
        Artifact_Lethe: './widgets/tools/Artifacts/CyberpunkLethe.jsx',
        Artifact_SentinelFlare: './widgets/tools/Artifacts/CyberpunkSentinelFlare.jsx',
    },
});

export default cyberpunkThemeSurfaceDescriptor;

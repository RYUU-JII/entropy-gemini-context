import { THEME_IDS } from '../../core/ids.js';
import { createThemeSurfaceDescriptor } from '../../core/runtime/createThemeSurfaceDescriptor.js';

export const entropyThemeSurfaceDescriptor = createThemeSurfaceDescriptor({
    id: THEME_IDS.ENTROPY,
    mainWidgetThemeId: THEME_IDS.ENTROPY,
    tabIconVariant: 'standard',
    widgetLoaders: {
        CoreStatus: './widgets/main/EntropyCoreStatus.jsx',
        HomeBriefCard: './widgets/main/EntropyHomeBriefCard.jsx',
        FilterTest: './widgets/filter/EntropyFilterTest.jsx',
        SignalScanner: './widgets/signals/EntropySignalScanner.jsx',
        SitesRegistry: './widgets/sites/EntropyRegistryPanel.jsx',
        SitesTargetPanel: './widgets/sites/EntropyTargetPanel.jsx',
        ArtifactIcons: './widgets/tools/ArtifactIcons.jsx',
        ArtifactPanel: './widgets/tools/EntropyArtifactPanel.jsx',
        ArtifactCanvas: './widgets/tools/EntropyArtifactCanvas.jsx',
        FluxToggle: './widgets/tools/FluxToggle.jsx',
        Artifact_Lens: './widgets/tools/Artifacts/ApertureRack.jsx',
        Artifact_Veil: './widgets/tools/Artifacts/ScrimEngine.jsx',
        Artifact_Resonance: './widgets/tools/Artifacts/Monolith.jsx',
        Artifact_Brake: './widgets/tools/Artifacts/InertialDamper.jsx',
        Artifact_Monolith: './widgets/tools/Artifacts/Monolith.jsx',
        Artifact_Gate: './widgets/tools/Artifacts/EventHorizon.jsx',
        Artifact_Lethe: './widgets/tools/Artifacts/Lethe.jsx',
        Artifact_SentinelFlare: './widgets/tools/Artifacts/SentinelFlare.jsx',
    },
});

export default entropyThemeSurfaceDescriptor;

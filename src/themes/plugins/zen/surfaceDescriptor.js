import { THEME_IDS } from '../../core/ids.js';
import { createThemeSurfaceDescriptor } from '../../core/runtime/createThemeSurfaceDescriptor.js';
import { BUILD_INCLUDE_EXPERIMENT_TAB } from '../../../platform/build/releaseCapabilities.js';

export const zenThemeSurfaceDescriptor = createThemeSurfaceDescriptor({
    id: THEME_IDS.ZEN,
    mainWidgetThemeId: THEME_IDS.ZEN,
    tabIconVariant: 'zen',
    widgetLoaders: {
        CorePreview: './widgets/core/ZenBonsaiPreview.jsx',
        CoreStatus: './widgets/core/ZenCoreStatus.jsx',
        HomeBriefCard: './widgets/core/ZenHomeBriefCard.jsx',
        PressureRail: './widgets/core/ZenPressureRail.jsx',
        RhythmMarker: './widgets/core/ZenRhythmMarker.jsx',
        ContextBrief: './widgets/core/ZenContextBrief.jsx',
        FilterTest: './widgets/filter/ZenFilterTest.jsx',
        SignalScanner: './widgets/signals/signalScanner/index.js',
        TargetInfo: './widgets/core/ZenActivityGraph.jsx',
        ActivityGraph: './widgets/core/ZenActivityGraph.jsx',
        ArtifactIcons: './widgets/tools/ArtifactIcons.jsx',
        FluxToggle: './widgets/tools/ZenFluxToggle.jsx',
        ArtifactPanel: './widgets/tools/ZenArtifactPanel.jsx',
        ArtifactCanvas: './widgets/tools/ZenArtifactCanvas.jsx',
        ArtifactGalleryVisual: './widgets/tools/ZenArtifactGalleryVisual.jsx',
        ArtifactWorkspaceLintel: './widgets/tools/ZenArtifactWorkspaceLintel.jsx',
        ArtifactMemoryPurgeReview: './widgets/tools/ZenMemoryPurgeReview.jsx',
        Artifact_Lens: './widgets/tools/Shoji.jsx',
        Artifact_Veil: './widgets/tools/Enso.jsx',
        Artifact_Resonance: './widgets/tools/Suikinkutsu.jsx',
        Artifact_Brake: './widgets/tools/TomeIshi.jsx',
        Artifact_Monolith: './widgets/tools/Ishidouro.jsx',
        Artifact_Gate: './widgets/tools/ShishiOdoshi.jsx',
        Artifact_Lethe: './widgets/tools/GreatWave.jsx',
        Artifact_SentinelFlare: './widgets/tools/Furin.jsx',
        SitesRegistry: './widgets/sites/ZenRegistryPanel.jsx',
        SitesTargetPanel: './widgets/sites/ZenTargetPanel.jsx',
        ...(BUILD_INCLUDE_EXPERIMENT_TAB
            ? {
                SignalTuner: './widgets/signals/signalScanner/app/ZenSignalTunerContainer.jsx',
                Artifact_GateTuner: './widgets/tools/ShishiOdoshiTuner.jsx',
                Artifact_SentinelFlareTuner: './widgets/tools/FurinTuner.jsx',
            }
            : {}),
    },
});

export default zenThemeSurfaceDescriptor;

import { THEME_IDS } from '../../core/ids.js';
import { createThemeSurfaceDescriptor } from '../../core/runtime/createThemeSurfaceDescriptor.js';

export const scpThemeSurfaceDescriptor = createThemeSurfaceDescriptor({
    id: THEME_IDS.SCP,
    mainWidgetThemeId: THEME_IDS.SCP,
    tabIconVariant: 'clinical',
    widgetLoaders: {
        CoreStatus: './widgets/main/SCPCoreStatus.jsx',
        HomeBriefCard: './widgets/main/SCPHomeBriefCard.jsx',
        FilterTest: './widgets/filter/SCPFilterTest.jsx',
        SignalScanner: './widgets/signals/SCPSignalScanner.jsx',
        SitesRegistry: './widgets/sites/SCPRegistryPanel.jsx',
        SitesTargetPanel: './widgets/sites/SCPTargetPanel.jsx',
        ArtifactIcons: './widgets/tools/SCPArtifactIcons.jsx',
        Artifact_Lens: './widgets/tools/Artifacts/SCPInspectionArray.jsx',
        Artifact_Veil: './widgets/tools/Artifacts/SCPRedactedDossier.jsx',
        Artifact_Brake: './widgets/tools/Artifacts/SCPRestraintClamp.jsx',
        Artifact_Monolith: './widgets/tools/Artifacts/SCPContainmentCapsule.jsx',
        Artifact_Gate: './widgets/tools/Artifacts/SCPBlastAirlock.jsx',
        Artifact_SentinelFlare: './widgets/tools/Artifacts/SCPWarningBeacon.jsx',
        Artifact_Lethe: './widgets/tools/Artifacts/SCPMemoryCartridge.jsx',
    },
});

export default scpThemeSurfaceDescriptor;

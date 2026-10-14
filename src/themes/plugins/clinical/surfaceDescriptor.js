import { THEME_IDS } from '../../core/ids.js';
import { createThemeSurfaceDescriptor } from '../../core/runtime/createThemeSurfaceDescriptor.js';

export const clinicalThemeSurfaceDescriptor = createThemeSurfaceDescriptor({
    id: THEME_IDS.CLINICAL,
    mainWidgetThemeId: THEME_IDS.CLINICAL,
    tabIconVariant: 'clinical',
    widgetLoaders: {
        CoreStatus: './widgets/main/ClinicalCoreStatus.jsx',
        HomeBriefCard: './widgets/main/ClinicalHomeBriefCard.jsx',
        FilterTest: './widgets/filter/ClinicalFilterTest.jsx',
        SignalScanner: './widgets/signals/ClinicalSignalScanner.jsx',
        TargetInfo: './widgets/main/ClinicalActivityGraph.jsx',
        ActivityGraph: './widgets/main/ClinicalActivityGraph.jsx',
        ArtifactIcons: './widgets/tools/ArtifactIcons.jsx',
        Artifact_Lens: './widgets/tools/ClinicalOpticalAssay.jsx',
        Artifact_Veil: './widgets/tools/ClinicalSterileShield.jsx',
        Artifact_Brake: './widgets/tools/ClinicalFlowDamper.jsx',
        Artifact_Monolith: './widgets/tools/ClinicalIsolationCabinet.jsx',
        Artifact_Gate: './widgets/tools/ClinicalExaminationAirlock.jsx',
        Artifact_SentinelFlare: './widgets/tools/ClinicalWarningBeacon.jsx',
        Artifact_Lethe: './widgets/tools/ClinicalSpecimenArchive.jsx',
        SitesRegistry: './widgets/sites/ClinicalRegistryPanel.jsx',
        SitesTargetPanel: './widgets/sites/ClinicalTargetPanel.jsx',
    },
});

export default clinicalThemeSurfaceDescriptor;

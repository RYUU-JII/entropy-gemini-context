#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseJavaScript } from 'espree';

const rootDir = process.cwd();

const paths = {
  sakuraSpecies: 'src/themes/plugins/zen/model/SakuraSpecies.js',
  sakuraHomeSpecies: 'src/themes/plugins/zen/model/SakuraHomeSpecies.js',
  homeSpeciesRegistry: 'src/themes/plugins/zen/model/ZenBonsaiHomeSpeciesRegistry.js',
  sakuraRenderSpecies: 'src/themes/plugins/zen/model/SakuraRenderSpecies.js',
  zenCoreSpeciesRegistry: 'src/themes/plugins/zen/model/ZenCoreSpeciesRegistry.js',
  zenCoreConfigAssetCache: 'src/themes/plugins/zen/model/ZenCoreConfigAssetCache.js',
  sakuraStructuralSpecies: 'src/themes/plugins/zen/model/SakuraStructuralSpecies.js',
  sakuraStructuralAbSpecies: 'src/themes/plugins/zen/model/SakuraStructuralABSpecies.js',
  sakuraTopologyGenerator: 'src/themes/plugins/zen/model/sakura/sakuraTopologyGenerator.js',
  sakuraFullTopologyGeneration: 'src/themes/plugins/zen/model/sakura/sakuraFullTopologyGeneration.js',
  sakuraTopologyPlan: 'src/themes/plugins/zen/model/sakura/sakuraTopologyPlan.js',
  trunkGeminiParams: 'src/themes/plugins/zen/model/sakura/sakuraTrunkGeminiParams.js',
  latentControlsConfig: 'src/themes/plugins/zen/model/ZenLatentControlsConfig.js',
  latentCompileContext: 'src/themes/plugins/zen/model/v2/SakuraLatentCompileContext.js',
  latentTierCompilers: 'src/themes/plugins/zen/model/v2/SakuraLatentTierCompilers.js',
  trunkScaffoldGenerator: 'src/themes/plugins/zen/model/sakura/sakuraTrunkScaffoldGenerator.js',
  structuralBranchGenerator: 'src/themes/plugins/zen/model/sakura/sakuraStructuralBranchGenerator.js',
  structuralAbApi: 'src/themes/plugins/zen/api/structuralAB.js',
  candidateScoreModel: 'src/themes/plugins/zen/model/bonsai/scoring/CandidateScoreModel.js',
  candidateScoreBlending: 'src/themes/plugins/zen/model/bonsai/scoring/candidateScoreBlending.js',
  branchGenerator: 'src/themes/plugins/zen/model/sakura/sakuraBranchGenerator.js',
  passContextFactory: 'src/themes/plugins/zen/model/sakura/sakuraPassContextFactory.js',
  passContracts: 'src/themes/plugins/zen/model/sakura/sakuraPassContracts.js',
  trunkPassInputBuilder: 'src/themes/plugins/zen/model/sakura/sakuraPassInputBuilder.trunk.js',
  scaffoldPassInputBuilder: 'src/themes/plugins/zen/model/sakura/sakuraPassInputBuilder.scaffold.js',
  trunkPass: 'src/themes/plugins/zen/model/sakura/sakuraTrunkPass.js',
  trunkPathPlanContract: 'src/themes/plugins/zen/model/bonsai/generation/trunkPathPlanV1.js',
  branchGeometryModel: 'src/themes/plugins/zen/model/bonsai/geometry/branchGeometryModel.js',
  macroLineageIdentityContract: 'src/themes/plugins/zen/contracts/SakuraMacroLineageIdentityContract.js',
  macroSpineGuide: 'src/themes/plugins/zen/model/sakura/sakuraMacroSpineGuide.js',
  macroSpineIntentPlan: 'src/themes/plugins/zen/model/sakura/sakuraMacroSpineIntentPlan.js',
  articulatedBendKernel: 'src/themes/plugins/zen/model/sakura/sakuraArticulatedBendKernel.js',
  trunkArticulatedBendFlow: 'src/themes/plugins/zen/model/sakura/sakuraTrunkArticulatedBendFlow.js',
  macroSpineGuideCondition: 'src/themes/plugins/zen/model/sakura/sakuraMacroSpineGuideCondition.js',
  spineReferenceFamily: 'src/themes/plugins/zen/model/sakura/sakuraSpineReferenceFamily.js',
  spineReferenceFamilyCondition: 'src/themes/plugins/zen/model/sakura/sakuraSpineReferenceFamilyCondition.js',
  spineGenerationConditionContract: 'src/themes/plugins/zen/contracts/SakuraSpineGenerationConditionContract.js',
  spineGenerationCondition: 'src/themes/plugins/zen/model/sakura/sakuraSpineGenerationCondition.js',
  trunkMacroLineageContract: 'src/themes/plugins/zen/model/sakura/sakuraTrunkMacroLineageContract.js',
  sakuraTrunkPathPlan: 'src/themes/plugins/zen/model/sakura/sakuraTrunkPathPlan.js',
  scaffoldArcStationPlan: 'src/themes/plugins/zen/model/sakura/sakuraScaffoldArcStationPlan.js',
  scaffoldPass: 'src/themes/plugins/zen/model/sakura/sakuraScaffoldPass.js',
  twigPass: 'src/themes/plugins/zen/model/sakura/sakuraTwigPass.js',
  twigSpawnModel: 'src/themes/plugins/zen/model/sakura/sakuraTwigSpawnModel.js',
  twigSilhouettePolicy: 'src/themes/plugins/zen/model/sakura/sakuraTwigSilhouettePolicy.js',
  branchHeuristics: 'src/themes/plugins/zen/model/sakura/sakuraBranchHeuristics.js',
  g15Root: 'src/themes/plugins/zen/model/bonsai/g15',
  g15Species: 'src/themes/plugins/zen/model/bonsai/g15/ZenBonsaiG15Species.js',
  g15Scene: 'src/themes/plugins/zen/model/bonsai/g15/ZenBonsaiG15Scene.js',
  g15RenderPlan: 'src/themes/plugins/zen/model/bonsai/g15/ZenBonsaiG15RenderPlan.js',
  g15RenderSpecies: 'src/themes/plugins/zen/model/bonsai/g15/ZenBonsaiG15RenderSpecies.js',
  g15RenderRuntime: 'src/themes/plugins/zen/model/bonsai/g15/render-runtime.js',
  plumeRoot: 'src/themes/plugins/zen/model/bonsai/plume',
  plumeSpecies: 'src/themes/plugins/zen/model/bonsai/plume/ZenBonsaiPlumeSpecies.js',
  plumeRenderPlan: 'src/themes/plugins/zen/model/bonsai/plume/ZenBonsaiPlumeRenderPlan.js',
  modelCatalog: 'src/themes/plugins/zen/model/ZenBonsaiModelCatalog.js',
  classic2LineageModel: 'src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2LineageModel.js',
  classic2LineageScoringPolicy: 'src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2LineageScoringPolicy.js',
  classic2DevelopmentModel: 'src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2DevelopmentModel.js',
  classic2GrowthExperienceContract: 'src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2GrowthExperienceContract.js',
  activationPresentationModel: 'src/themes/plugins/zen/model/bonsai/presentation/ZenBonsaiActivationPresentation.js',
  bonsaiExperienceModel: 'src/themes/plugins/zen/bonsai/state/ZenBonsaiExperienceModel.js',
  bonsaiRenderSystem: 'src/themes/plugins/zen/bonsai/rendering/useZenBonsaiRenderSystem.js',
  bonsaiDebugOverrides: 'src/themes/plugins/zen/bonsai/debug/zenBonsaiDebugOverrides.js',
  bonsaiDebugPanel: 'src/themes/plugins/zen/bonsai/ui/ZenBonsaiDebugPanel.jsx',
  bonsaiUnlockProgression: 'src/themes/plugins/zen/model/ZenBonsaiUnlockProgression.js',
  bonsaiLifeState: 'src/themes/plugins/zen/model/ZenBonsaiLifeState.js',
  bonsaiGrowthProjection: 'src/themes/plugins/zen/model/ZenBonsaiGrowthProjection.js',
  bonsaiCultivationPolicy: 'src/themes/plugins/zen/model/ZenBonsaiCultivationPolicy.js',
  bonsaiCultivationLedger: 'src/themes/plugins/zen/model/ZenBonsaiCultivationLedger.js',
  bonsaiPresentationPolicy: 'src/themes/plugins/zen/model/ZenBonsaiPresentationPolicy.js',
  sakuraRenderBranchLayer: 'src/themes/plugins/zen/model/sakura/sakuraRenderBranchLayer.js',
  sakuraRenderPaintMetrics: 'src/themes/plugins/zen/model/sakura/sakuraRenderPaintMetrics.js',
  sakuraRenderPlan: 'src/themes/plugins/zen/model/sakura/sakuraRenderPlan.js',
  bonsaiRenderPlan: 'src/themes/plugins/zen/model/bonsai/rendering/zenBonsaiRenderPlan.js',
  sakuraTerminalPresentation: 'src/themes/plugins/zen/model/sakura/sakuraTerminalPresentation.js',
  sakuraRenderer: 'src/themes/plugins/zen/model/sakura/sakuraRenderer.js',
  fullRenderBounds: 'src/themes/plugins/zen/model/bonsai/rendering/measureSakuraFullRenderBounds.js',
  actualAlphaObservationContract: 'src/themes/plugins/zen/model/bonsai/rendering/SakuraActualAlphaObservationContract.js',
  bonsaiSceneSnapshot: 'src/themes/plugins/zen/runtime/zenBonsaiSceneSnapshot.js',
  pixiBonsaiRenderer: 'src/themes/plugins/zen/runtime/pixi/createPixiBonsaiRenderer.js',
  pixiBonsaiBranchRigMotionPolicy: 'src/themes/plugins/zen/runtime/pixi/pixiBonsaiBranchRigMotionPolicy.js',
  canvas2dBonsaiWorkerRenderer: 'src/themes/plugins/zen/runtime/worker/renderers/createCanvas2dBonsaiWorkerRenderer.js',
  mainWorkerRenderer: 'src/themes/plugins/zen/runtime/useZenBonsaiMainWorkerRenderer.js',
  localPreviewRenderer: 'src/themes/plugins/zen/runtime/useZenBonsaiLocalPreviewRenderer.js',
  treeRenderer: 'src/themes/plugins/zen/runtime/useZenTreeRenderer.js',
  renderPlanMemo: 'src/themes/plugins/zen/runtime/useZenBonsaiRenderPlan.js',
  homeTreeRenderer: 'src/themes/plugins/zen/runtime/useZenHomeTreeRenderer.js',
  labTreeRenderer: 'src/themes/plugins/zen/runtime/useZenLabTreeRenderer.js',
  bonsaiPreviewEntry: 'src/themes/plugins/zen/widgets/core/ZenBonsaiPreview.jsx',
  classic2IdentityContract: 'src/themes/plugins/zen/contracts/ZenBonsaiClassic2IdentityContract.js',
  classic2CandidateGraphContract: 'src/themes/plugins/zen/contracts/ZenBonsaiClassic2CandidateGraphContract.js',
  bonsaiProfileAggregateModel: 'src/themes/plugins/zen/model/ZenBonsaiProfileAggregateModel.js',
  bonsaiProfileGenerationGenesis: 'src/themes/plugins/zen/model/ZenBonsaiProfileGenerationGenesis.js',
  bonsaiProfileAggregateStorageContract: 'src/platform/storage/themes/zen/ZenBonsaiProfileAggregateStorageContract.js',
  bonsaiProfileAggregateRepository: 'src/themes/plugins/zen/bonsai/storage/ZenBonsaiProfileAggregateRepository.js',
  bonsaiProfileAggregateResource: 'src/themes/plugins/zen/bonsai/state/ZenBonsaiProfileAggregateResource.js',
  bonsaiAuthoringDraft: 'src/themes/plugins/zen/bonsai/runtime/useZenBonsaiAuthoringDraftState.js',
  classic2LineageRuntime: 'src/themes/plugins/zen/runtime/classic/useZenBonsaiClassic2LineageRuntime.js',
  classic2LineageRuntimeMode: 'src/themes/plugins/zen/runtime/classic/zenBonsaiClassic2LineageRuntimeMode.js',
  classicAnalysisRuntime: 'src/themes/plugins/zen/runtime/classic/useZenClassicAnalysisRuntime.js',
  classicHomeTopologyRuntime: 'src/themes/plugins/zen/runtime/classic/useZenClassicHomeTopologyRuntime.js',
  classic2GrowthSnapshotMatrix: 'scripts/dev/zen-bonsai-growth-snapshot-matrix.mjs',
  classic2LineageDistributionAudit: 'scripts/dev/zen-bonsai-lineage-distribution-audit.mjs',
  classicHomeRuntime: 'src/themes/plugins/zen/runtime/classic/useZenClassicHomeWorkspaceRuntime.js',
  classicWorkspaceViewRuntime: 'src/themes/plugins/zen/runtime/classic/useZenClassicWorkspaceViewRuntime.js',
  classicViewport: 'src/themes/plugins/zen/widgets/core/components/ZenClassicViewport.jsx',
  spineGuideEditor: 'src/themes/plugins/zen/widgets/core/components/ZenSpineGuideEditor.jsx',
  classicSpineGuideDraft: 'src/themes/plugins/zen/state/classic/useZenClassicSpineGuideDraft.js',
  classicExperimentRuntime: 'src/themes/plugins/zen/runtime/classic/useZenClassicWorkspaceSessionRuntime.js',
  classicRuntimeConfig: 'src/themes/plugins/zen/runtime/classic/zenClassicWorkspaceRuntimeConfig.js',
  zenKoiRosterMemoryRuntime: 'src/themes/plugins/zen/pond/app/hooks/useZenKoiRosterMemory.js',
  zenRosterRepository: 'src/themes/plugins/zen/pond/storage/repositories/zenRosterRepository.js',
  experimentTab: 'src/apps/dashboard/tabs/experiment/ExperimentWorkspace.jsx',
  zenThemeModelState: 'src/platform/storage/themes/zen/ZenThemeModelState.js',
  zenThemeModelStateContract: 'src/platform/storage/themes/zen/ZenThemeModelStateContract.js',
  zenModelRepository: 'src/platform/storage/themes/zen/ZenModelRepository.js',
  zenModelRepositoryCore: 'src/platform/storage/themes/zen/ZenModelRepositoryCore.js',
  modelStateRepository: 'src/platform/storage/model/ModelStateRepository.js',
  modelStateStore: 'src/platform/storage/internal/indexeddb/stores/ModelStateStore.js',
  trialContract: 'src/themes/plugins/zen/contracts/TrialContract.js',
  abController: 'src/themes/plugins/zen/runtime/classic/control/useZenABController.js',
  abQuestionLanePolicy: 'src/themes/plugins/zen/model/SakuraABQuestionLanePolicy.js',
  abFormQuestionPolicy: 'src/themes/plugins/zen/model/SakuraABFormQuestionPolicy.js',
  abGenerationReadiness: 'src/themes/plugins/zen/runtime/lab/zenABGenerationReadiness.js',
  classicWorkspaceInteractionRuntime: 'src/themes/plugins/zen/runtime/classic/useZenClassicWorkspaceInteractionRuntime.js',
  abWorker: 'src/themes/plugins/zen/workers/zenAbTrialEvaluator.worker.js',
  abRenderer: 'src/themes/plugins/zen/runtime/useZenBonsaiAbRenderer.js',
  structuralPreviewRenderer: 'src/themes/plugins/zen/model/bonsai/rendering/renderBonsaiStructuralPreview.js',
  structuralCandidateEvaluator: 'src/themes/plugins/zen/model/bonsai/evaluation/BonsaiStructuralCandidateEvaluator.js',
  structuralDescriptorModel: 'src/themes/plugins/zen/model/bonsai/morphology/BonsaiStructuralDescriptorModel.js',
  morphologyEvidenceContract: 'src/themes/plugins/zen/model/bonsai/morphology/BonsaiMorphologyEvidenceContract.js',
  structuralComparisonPlan: 'src/themes/plugins/zen/model/bonsai/rendering/BonsaiStructuralComparisonPlan.js',
  abViewportContract: 'src/themes/plugins/zen/model/bonsai/rendering/BonsaiABViewportContract.js',
  zenCoreConfigOptimizationTuning: 'src/themes/plugins/zen/model/ZenCoreConfigOptimizationTuning.js',
  formReachabilityPolicy: 'src/themes/plugins/zen/model/bonsai/morphology/BonsaiFormReachabilityPolicy.js',
  singleRootFormCompositionPrior: 'src/themes/plugins/zen/model/bonsai/morphology/BonsaiSingleRootFormCompositionPrior.js',
  singleRootFormCompositionAdapter: 'src/themes/plugins/zen/model/sakura/sakuraSingleRootFormCompositionAdapter.js',
  abCandidatePacking: 'src/themes/plugins/zen/model/ZenABCandidatePacking.js',
  abPairSignature: 'src/themes/plugins/zen/model/ABPairSignature.js',
  learningLab: 'src/themes/plugins/zen/runtime/classic/useZenLearningLab.js',
  abFeedback: 'src/themes/plugins/zen/runtime/classic/control/useZenABFeedbackHandlers.js',
  abHistoryOrderContract: 'src/themes/plugins/zen/model/SakuraABHistoryOrderContract.js',
  pairwiseEvidencePolicy: 'src/themes/plugins/zen/model/SakuraPairwiseEvidencePolicy.js',
  morphologyPreferencePosterior: 'src/themes/plugins/zen/model/SakuraMorphologyPreferencePosterior.js',
  preferenceBasinModel: 'src/themes/plugins/zen/model/SakuraPreferenceBasinModel.js',
  reliabilityMetrics: 'src/themes/plugins/zen/model/SakuraReliabilityMetrics.js',
  pairwisePredictionContract: 'src/themes/plugins/zen/model/SakuraPairwisePredictionContract.js',
  pairwiseModel: 'src/themes/plugins/zen/model/SakuraAdditivePairwiseGPModel.js',
  generationSemantics: 'src/themes/plugins/zen/model/v2/SakuraLearningSemantics.js',
  learningFactorPolicy: 'src/themes/plugins/zen/model/v2/SakuraLearningFactorPolicy.js',
};

const failMessages = [];

const assert = (condition, message) => {
  if (!condition) {
    failMessages.push(message);
  }
};

const read = async (relativePath) => {
  const absolutePath = path.resolve(rootDir, relativePath);
  return fs.readFile(absolutePath, 'utf8');
};

const countMatches = (text, regex) => {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
};

const walkJavaScript = (node, visit, parent = null) => {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walkJavaScript(child, visit, node));
    else if (value && typeof value === 'object') walkJavaScript(value, visit, node);
  }
};

const staticString = node => {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  if (node?.type === 'BinaryExpression' && node.operator === '+') {
    const left = staticString(node.left), right = staticString(node.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
  return undefined;
};

const ensureNamedPixiRuntimeDependency = (node, sourcePath) => {
  if (!node.source || !/(?:^|\/)(?:zenPixiWorkerRuntime|zenPondPixiRuntime)(?:\.js)?$/.test(node.source.value)) return;
  if (node.type === 'ImportDeclaration') {
    assert(node.specifiers.length > 0 && node.specifiers.every(specifier => specifier.type === 'ImportSpecifier'),
      `${sourcePath} must import only named Pixi capabilities; passing a runtime namespace widens renderer dependencies.`);
  } else if (node.type === 'ExportAllDeclaration') {
    assert(false, `${sourcePath} must re-export named Pixi capabilities instead of the whole runtime.`);
  }
};

const ensurePlumeGeneratedCopyOwners = async () => {
  const species = paths.plumeSpecies;
  const cloud = `${paths.plumeRoot}/cloud/model.js`;
  const cloudPose = `${paths.plumeRoot}/cloud/pose.js`;
  const bloom = `${paths.plumeRoot}/bloom/model.js`;
  const plume = `${paths.plumeRoot}/plume/model.js`;
  const request = `${paths.plumeRoot}/ZenBonsaiPlumeGeneratedRequest.js`;
  const core = `${paths.plumeRoot}/ZenBonsaiPlumeModelOperationCore.js`;
  const copier = `${paths.plumeRoot}/cloud/zenGeneratedRhythmObservationCopy.js`;
  const operations = `${paths.plumeRoot}/ZenBonsaiPlumeModelOperations.js`;
  const worker = 'src/themes/plugins/zen/workers/zenBonsaiModel.worker.js';
  const live = `${paths.plumeRoot}/live/model.js`;
  const flowerDevelopment = `${paths.plumeRoot}/live/flower-development.js`;
  const bloomRegions = `${paths.plumeRoot}/ZenBonsaiPlumeBloomRegions.js`;
  const bloomPresentation = `${paths.plumeRoot}/ZenBonsaiPlumeBloomPresentation.js`;
  const plumePixiRenderer = `${paths.plumeRoot}/live/pixi-renderer.js`;
  const scaffold = `${paths.plumeRoot}/canopy/f4-scaffold.js`;
  const productStudy = `${paths.plumeRoot}/ZenBonsaiPlumeProductStudy.js`;
  const protocol = `${paths.plumeRoot}/ZenBonsaiPlumeModelProtocol.js`;
  const client = `${paths.plumeRoot}/ZenBonsaiPlumeModelClient.js`;
  const transport = `${paths.plumeRoot}/ZenBonsaiPlumeProjectionTransport.js`;
  const appearance = `${paths.plumeRoot}/ZenBonsaiPlumeLifeAppearance.js`;
  const lifeAdapter = `${paths.plumeRoot}/ZenBonsaiPlumeLifeAdapter.js`;
  const renderPlan = paths.plumeRenderPlan;
  const privateModules = new Map([
    [request, new Set([worker])],
    [core, new Set([operations, request])],
    [copier, new Set([cloud])],
  ]);
  const declaredModuleImporters = new Map([
    ...privateModules,
    [productStudy, new Set([request, protocol, transport])],
    [transport, new Set([request, protocol, client])],
    [appearance, new Set([lifeAdapter, transport, client])],
  ]);
  const privateSymbols = new Map([
    ['applyZenBonsaiPlumeActivation', { owner: renderPlan, callers: new Set() }],
    ['createZenBonsaiPlumeGeneratedRequest', { owner: request, callers: new Set([worker]) }],
    ['runZenBonsaiPlumeModelOperation', { owner: core, callers: new Set([operations, request]) }],
    ['requireZenBonsaiPlumeModelProjectionKey', { owner: core, callers: new Set([request]) }],
    ['createZenGeneratedBonsaiPlumeStudy', { owner: species, callers: new Set() }],
    ['createZenGeneratedBonsaiPlumePreparation', { owner: species, callers: new Set([request]) }],
    ['projectZenGeneratedBonsaiPlumeTopology', { owner: species, callers: new Set() }],
    ['projectZenGeneratedBonsaiPlumePreparedTopology', { owner: species, callers: new Set([request]) }],
    ['projectZenGeneratedBonsaiPlumeSnapshot', { owner: species, callers: new Set([request]) }],
    ['createZenBonsaiPlumeProductStudy', { owner: productStudy, callers: new Set() }],
    ['finalizeZenGeneratedBonsaiPlumeProductStudy', { owner: productStudy, callers: new Set([request]) }],
    ['requireZenGeneratedBonsaiPlumeFrozenCamera', { owner: productStudy, callers: new Set([request]) }],
    ['createZenBonsaiPlumeProductLiveStudy', { owner: productStudy, callers: new Set([request]) }],
    ['createZenBonsaiPlumeProjectionLiveStudy', { owner: productStudy, callers: new Set([request]) }],
    ['createZenBonsaiPlumeProjectionStudy', { owner: productStudy, callers: new Set([transport]) }],
    ['requireZenBonsaiPlumeProjectionStudy', { owner: productStudy, callers: new Set([transport]) }],
    ['requireZenBonsaiPlumeProductStudy', { owner: productStudy, callers: new Set([protocol, transport]) }],
    ['createZenBonsaiPlumeProjectionBinding', { owner: transport, callers: new Set([client]) }],
    ['createZenBonsaiPlumeProjectionRequest', { owner: transport, callers: new Set([client]) }],
    ['requireZenBonsaiPlumeProjectionRequest', { owner: transport, callers: new Set([request]) }],
    ['createZenBonsaiPlumeProjectionResult', { owner: transport, callers: new Set([request]) }],
    ['requireZenBonsaiPlumeProjectionResult', { owner: transport, callers: new Set([protocol]) }],
    ['assembleZenBonsaiPlumeProjectedTopology', { owner: transport, callers: new Set([client]) }],
    ['resolveZenBonsaiPlumeLifeAppearance', { owner: appearance, callers: new Set([lifeAdapter]) }],
    ['requireZenBonsaiPlumeLifeTopology', { owner: appearance, callers: new Set([client]) }],
    ['admitZenBonsaiPlumeLifeTopology', { owner: appearance, callers: new Set([client, transport]) }],
    ['reprojectZenBonsaiPlumeLifeTopology', { owner: appearance, callers: new Set([client]) }],
    ['requireZenBonsaiPlumeProductModelResult', { owner: protocol, callers: new Set([client]) }],
    ['createZenGeneratedCherryPlumeLiveSnapshot', { owner: live, callers: new Set([species]) }],
    ['requireZenGeneratedCherryPlumeFlowerDevelopmentInput', { owner: flowerDevelopment, callers: new Set([live]) }],
    ['requireZenBonsaiPlumeBloomRegionPlan', { owner: bloomRegions, callers: new Set([bloomPresentation]) }],
    ['requireZenBonsaiPlumeBloomPresentationPlan', { owner: bloomPresentation, callers: new Set([plumePixiRenderer]) }],
    ['extractGeneratedF4Scaffold', { owner: scaffold, callers: new Set([species]) }],
    ['createZenGeneratedCherryCloudModel', { owner: cloud, callers: new Set([species]) }],
    ['createZenGeneratedCherryCloudPreparation', { owner: cloud, callers: new Set([species]) }],
    ['createZenGeneratedCherryPlumeCameraSnapshot', { owner: plume, callers: new Set([species]) }],
    ['createZenGeneratedCherryCloudCameraSnapshot', { owner: cloudPose, callers: new Set([plume]) }],
    ['createZenGeneratedCherryBloomCameraSnapshot', { owner: bloom, callers: new Set([cloudPose]) }],
    ['copyZenGeneratedRhythmObservation', { owner: copier, callers: new Set([cloud]) }],
  ]);
  const protectedModules = new Set([species, cloud, cloudPose, bloom, plume, live, flowerDevelopment, bloomRegions, bloomPresentation, scaffold, productStudy, protocol, transport, appearance, renderPlan, ...privateModules.keys()]);
  const moduleImporters = new Map([...declaredModuleImporters.keys()].map(owner => [owner, new Set()]));
  const symbolImporters = new Map([...privateSymbols.keys()].map(name => [name, new Set()]));
  const privateModuleExports = new Map([
    [request, ['createZenBonsaiPlumeGeneratedRequest']],
    [core, ['runZenBonsaiPlumeModelOperation', 'requireZenBonsaiPlumeModelProjectionKey']],
    [copier, ['copyZenGeneratedRhythmObservation']],
  ]);
  const moduleFor = (sourcePath, specifier) => {
    if (typeof specifier !== 'string') return null;
    const clean = specifier.replace(/[?#].*$/, '').replaceAll('\\', '/');
    const resolved = clean.startsWith('.')
      ? path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), clean))
      : clean.startsWith('@/') ? `src/${clean.slice(2)}` : clean.replace(/^\//, '');
    const owner = resolved.endsWith('.js') ? resolved : `${resolved}.js`;
    if (protectedModules.has(owner)) return owner;
    // Unique private/Species filenames remain protected through a source alias.
    if (!clean.includes('/') && !clean.endsWith('.js')) return null;
    return [...protectedModules].find(candidate => path.posix.basename(candidate) !== 'model.js'
      && path.posix.basename(owner) === path.posix.basename(candidate)) ?? null;
  };
  const isLifeInputBridge = (sourcePath, node) => sourcePath === lifeAdapter
    && node?.type === 'ExportNamedDeclaration' && moduleFor(sourcePath, node.source?.value) === appearance
    && node.specifiers.length > 0
    && node.specifiers.every(specifier => ['resolveZenBonsaiPlumeLifeState', 'ZEN_BONSAI_PLUME_PRODUCT_TARGET'].includes(specifier.local.name)
      && specifier.local.name === specifier.exported.name);
  const sourceNames = (await fs.readdir(path.resolve(rootDir, 'src'), { recursive: true }))
    .filter(name => /\.(?:js|jsx|mjs)$/.test(name));
  const sources = await Promise.all(sourceNames.map(async name => {
    const sourcePath = `src/${name.replaceAll('\\', '/')}`;
    return { sourcePath, source: await read(sourcePath) };
  }));
  for (const { sourcePath, source } of sources) {
    const tree = parseJavaScript(source, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } });
    const privateBindings = new Map();
    walkJavaScript(tree, node => {
      ensureNamedPixiRuntimeDependency(node, sourcePath);
      if (node.type !== 'ImportDeclaration') return;
      for (const specifier of node.specifiers) {
        if (specifier.type !== 'ImportSpecifier') continue;
        const name = specifier.imported.name ?? specifier.imported.value;
        if (privateSymbols.has(name)) privateBindings.set(specifier.local.name, name);
      }
    });
    let privateExportCount = 0;
    walkJavaScript(tree, (node, parent) => {
      if (node.type === 'ImportDeclaration') {
        const owner = moduleFor(sourcePath, node.source.value);
        if (!owner) return;
        assert(node.specifiers.length > 0 && node.specifiers.every(specifier => specifier.type === 'ImportSpecifier'),
          `${sourcePath} must use static named imports for the protected Plume owner ${owner}; namespace/default/side-effect imports expose private entries.`);
        if (declaredModuleImporters.has(owner)) {
          moduleImporters.get(owner).add(sourcePath);
          assert(declaredModuleImporters.get(owner).has(sourcePath), `${sourcePath} is not a declared importer of ${owner}.`);
        }
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue;
          const name = specifier.imported.name ?? specifier.imported.value;
          const contract = privateSymbols.get(name);
          if (!contract) continue;
          symbolImporters.get(name).add(sourcePath);
          assert(contract.owner === owner && contract.callers.has(sourcePath),
            `${sourcePath} may not import the private Plume entry ${name}, including under a named alias.`);
        }
      }
      if ((node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source) {
        const owner = moduleFor(sourcePath, node.source.value);
        assert(!owner || isLifeInputBridge(sourcePath, node), `${sourcePath} may not re-export a protected Plume owner.`);
      }
      if (node.type.startsWith('Export') && privateModules.has(sourcePath)) {
        privateExportCount += 1;
        assert(node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'FunctionDeclaration'
          && privateModuleExports.get(sourcePath).includes(node.declaration.id.name),
        `${sourcePath} may export only its declared private functions.`);
      }
      if (node.type === 'ExportSpecifier' && privateBindings.has(node.local.name)) {
        assert(false, `${sourcePath} may not re-export an alias of ${privateBindings.get(node.local.name)}.`);
      }
      const text = node.type === 'Identifier' ? node.name : staticString(node);
      const contract = privateSymbols.get(text);
      if (contract) {
        assert(sourcePath === contract.owner || contract.callers.has(sourcePath),
          `${sourcePath} may not access the private Plume symbol ${text}, including through a namespace or computed property.`);
        if (parent?.type === 'ExportSpecifier') {
          assert(false, `${sourcePath} may not re-export the private Plume symbol ${text}.`);
        }
      }
      if (text !== undefined && node.type !== 'Identifier' && moduleFor(sourcePath, text)) {
        assert((parent?.type === 'ImportDeclaration' && parent.source === node) || isLifeInputBridge(sourcePath, parent),
          `${sourcePath} may reference protected Plume modules only through static named imports; dynamic import, require and indirect module routes are forbidden.`);
      }
    });
    if (privateModules.has(sourcePath)) {
      assert(privateExportCount === privateModuleExports.get(sourcePath).length,
        `${sourcePath} must retain exactly its declared private function exports.`);
    }
  }
  for (const [owner, callers] of declaredModuleImporters) {
    const actual = moduleImporters.get(owner);
    assert(actual.size === callers.size && [...callers].every(caller => actual.has(caller)),
      `${owner} must retain exactly its declared production importers.`);
  }
  for (const [name, { callers }] of privateSymbols) {
    const actual = symbolImporters.get(name);
    assert(actual.size === callers.size && [...callers].every(caller => actual.has(caller)),
      `${name} must retain exactly its declared named production importers.`);
  }
};

const collectGeneProps = (text) => (
  Array.from(new Set(
    Array.from(text.matchAll(/\bgene\.([A-Za-z0-9_]+)/g)).map((match) => match[1]),
  )).sort()
);

const ensureNoPassToPassImport = (contentByPath) => {
  const passEntries = [
    ['trunkPass', 'sakuraTrunkPass'],
    ['scaffoldPass', 'sakuraScaffoldPass'],
    ['twigPass', 'sakuraTwigPass'],
  ];

  passEntries.forEach(([selfKey, selfBase]) => {
    const content = contentByPath[selfKey];
    passEntries.forEach(([otherKey, otherBase]) => {
      if (selfKey === otherKey) return;
      const re = new RegExp(`from\\s+['\"]\\./${otherBase}(?:\\.js)?['\"]`);
      assert(
        !re.test(content),
        `${paths[selfKey]} must not import ${paths[otherKey]} (pass-to-pass import forbidden).`,
      );
    });

    const directCtorRe = /createSakura(Trunk|Scaffold|Twig)Pass\s*\(/g;
    const directCtorCalls = Array.from(content.matchAll(directCtorRe))
      .map((match) => match[0])
      .filter((call) => !call.includes(selfBase.replace('sakura', '')));

    assert(
      directCtorCalls.length === 0,
      `${paths[selfKey]} must not instantiate other pass constructors directly.`,
    );
  });
};

const ensureNoCrossTierRecursionCall = (contentByPath) => {
  const forbiddenByFile = {
    trunkPass: ['generateScaffoldBranch(', 'generateTwigBranch('],
    scaffoldPass: ['generateTrunkBranch(', 'generateTwigBranch('],
    twigPass: ['generateTrunkBranch(', 'generateScaffoldBranch('],
  };

  Object.entries(forbiddenByFile).forEach(([key, forbiddenTokens]) => {
    const content = contentByPath[key];
    forbiddenTokens.forEach((token) => {
      assert(
        !content.includes(token),
        `${paths[key]} contains forbidden cross-tier recursion token \`${token}\`.`,
      );
    });
  });
};

const ensureOrchestratorOrder = (trunkScaffoldSource, branchGeneratorSource) => {
  const rootIdx = trunkScaffoldSource.indexOf('const root = generateTrunkBranch');
  const scaffoldIdx = trunkScaffoldSource.indexOf('emitScaffoldPass(collections)');
  const trunkScaffoldIdx = branchGeneratorSource.indexOf('generateTrunkScaffold(state)');
  const twigIdx = branchGeneratorSource.indexOf('emitTwigPass(collections)');

  assert(rootIdx >= 0, `${paths.trunkScaffoldGenerator} must generate trunk root before pass emission.`);
  assert(scaffoldIdx >= 0, `${paths.trunkScaffoldGenerator} must call emitScaffoldPass.`);
  assert(
    trunkScaffoldIdx >= 0,
    `${paths.branchGenerator} must call the shared trunk/scaffold generator.`,
  );
  assert(twigIdx >= 0, `${paths.branchGenerator} must call emitTwigPass.`);
  if (rootIdx >= 0 && scaffoldIdx >= 0) {
    assert(
      rootIdx < scaffoldIdx,
      `${paths.trunkScaffoldGenerator} must preserve trunk -> scaffold execution order.`,
    );
  }
  if (trunkScaffoldIdx >= 0 && twigIdx >= 0) {
    assert(
      trunkScaffoldIdx < twigIdx,
      `${paths.branchGenerator} must preserve trunk/scaffold -> twig execution order.`,
    );
  }

  assert(
    trunkScaffoldSource.includes('createSakuraPassContextFactory('),
    `${paths.trunkScaffoldGenerator} must create pass context via sakuraPassContextFactory.`,
  );

  assert(
    countMatches(trunkScaffoldSource, /buildTrunkPassInput\(/g) === 1,
    `${paths.trunkScaffoldGenerator} must build trunk input exactly once.`,
  );
  assert(
    countMatches(trunkScaffoldSource, /buildScaffoldPassInput\(/g) === 1,
    `${paths.trunkScaffoldGenerator} must build scaffold input exactly once.`,
  );
  assert(
    countMatches(branchGeneratorSource, /buildTwigPassInput\(/g) === 1,
    `${paths.branchGenerator} must build twig input exactly once.`,
  );
};

const ensureGeneAccessFreeze = (contentByPath) => {
  const allowedGenePropsByFile = {
    trunkPass: new Set(),
    scaffoldPass: new Set(),
    twigPass: new Set(),
  };

  Object.entries(allowedGenePropsByFile).forEach(([key, allowed]) => {
    const content = contentByPath[key];
    const geneProps = collectGeneProps(content);
    const unexpected = geneProps.filter((prop) => !allowed.has(prop));

    assert(
      !/\bgene\s*\[/.test(content),
      `${paths[key]} must not use bracket-based gene access (gene[...]).`,
    );
    assert(
      unexpected.length === 0,
      `${paths[key]} introduces new raw gene properties: ${unexpected.join(', ') || '(none)'}.`,
    );
  });
};

const ensureFilesExist = async () => {
  const keys = Object.keys(paths);
  await Promise.all(keys.map(async (key) => {
    const absolutePath = path.resolve(rootDir, paths[key]);
    try {
      await fs.access(absolutePath);
    } catch {
      failMessages.push(`Required file missing: ${paths[key]}`);
    }
  }));
};

const main = async () => {
  await ensureFilesExist();
  if (failMessages.length > 0) {
    failMessages.forEach((message) => console.error(`[zen-arch-check] ${message}`));
    process.exit(1);
    return;
  }

  const [
    sakuraSpecies,
    sakuraHomeSpecies,
    homeSpeciesRegistry,
    sakuraStructuralSpecies,
    sakuraStructuralAbSpecies,
    sakuraTopologyGenerator,
    sakuraFullTopologyGeneration,
    sakuraTopologyPlan,
    trunkGeminiParams,
    latentControlsConfig,
    latentCompileContext,
    latentTierCompilers,
    branchGenerator,
    trunkScaffoldGenerator,
    structuralBranchGenerator,
    passContextFactory,
    passContracts,
    trunkPassInputBuilder,
    scaffoldPassInputBuilder,
    trunkPass,
    trunkPathPlanContract,
    branchGeometryModel,
    macroLineageIdentityContract,
    macroSpineGuide,
    macroSpineIntentPlan,
    articulatedBendKernel,
    trunkArticulatedBendFlow,
    macroSpineGuideCondition,
    spineReferenceFamily,
    spineReferenceFamilyCondition,
    spineGenerationConditionContract,
    spineGenerationCondition,
    trunkMacroLineageContract,
    sakuraTrunkPathPlan,
    scaffoldArcStationPlan,
    scaffoldPass,
    twigPass,
    twigSpawnModel,
    twigSilhouettePolicy,
    branchHeuristics,
    structuralDescriptorModel,
    formReachabilityPolicy,
    singleRootFormCompositionPrior,
    singleRootFormCompositionAdapter,
  ] = await Promise.all([
    read(paths.sakuraSpecies),
    read(paths.sakuraHomeSpecies),
    read(paths.homeSpeciesRegistry),
    read(paths.sakuraStructuralSpecies),
    read(paths.sakuraStructuralAbSpecies),
    read(paths.sakuraTopologyGenerator),
    read(paths.sakuraFullTopologyGeneration),
    read(paths.sakuraTopologyPlan),
    read(paths.trunkGeminiParams),
    read(paths.latentControlsConfig),
    read(paths.latentCompileContext),
    read(paths.latentTierCompilers),
    read(paths.branchGenerator),
    read(paths.trunkScaffoldGenerator),
    read(paths.structuralBranchGenerator),
    read(paths.passContextFactory),
    read(paths.passContracts),
    read(paths.trunkPassInputBuilder),
    read(paths.scaffoldPassInputBuilder),
    read(paths.trunkPass),
    read(paths.trunkPathPlanContract),
    read(paths.branchGeometryModel),
    read(paths.macroLineageIdentityContract),
    read(paths.macroSpineGuide),
    read(paths.macroSpineIntentPlan),
    read(paths.articulatedBendKernel),
    read(paths.trunkArticulatedBendFlow),
    read(paths.macroSpineGuideCondition),
    read(paths.spineReferenceFamily),
    read(paths.spineReferenceFamilyCondition),
    read(paths.spineGenerationConditionContract),
    read(paths.spineGenerationCondition),
    read(paths.trunkMacroLineageContract),
    read(paths.sakuraTrunkPathPlan),
    read(paths.scaffoldArcStationPlan),
    read(paths.scaffoldPass),
    read(paths.twigPass),
    read(paths.twigSpawnModel),
    read(paths.twigSilhouettePolicy),
    read(paths.branchHeuristics),
    read(paths.structuralDescriptorModel),
    read(paths.formReachabilityPolicy),
    read(paths.singleRootFormCompositionPrior),
    read(paths.singleRootFormCompositionAdapter),
  ]);
  const [
    classic2LineageModel,
    classic2LineageScoringPolicy,
    classic2DevelopmentModel,
    classic2GrowthExperienceContract,
    activationPresentationModel,
    bonsaiExperienceModel,
    bonsaiRenderSystem,
    bonsaiDebugOverrides,
    sakuraRenderBranchLayer,
    sakuraRenderPaintMetrics,
    sakuraRenderPlan,
    bonsaiRenderPlan,
    sakuraTerminalPresentation,
    sakuraRenderer,
    fullRenderBounds,
    actualAlphaObservationContract,
    bonsaiSceneSnapshot,
    pixiBonsaiRenderer,
    pixiBonsaiBranchRigMotionPolicy,
    mainWorkerRenderer,
    localPreviewRenderer,
    treeRenderer,
    renderPlanMemo,
    homeTreeRenderer,
    labTreeRenderer,
    bonsaiPreviewEntry,
    classic2IdentityContract,
    classic2CandidateGraphContract,
    bonsaiProfileAggregateModel,
    bonsaiProfileGenerationGenesis,
    bonsaiProfileAggregateStorageContract,
    bonsaiProfileAggregateRepository,
    bonsaiProfileAggregateResource,
    bonsaiAuthoringDraft,
    classic2LineageRuntime,
    classic2LineageRuntimeMode,
    classicAnalysisRuntime,
    classicHomeTopologyRuntime,
    classic2GrowthSnapshotMatrix,
    classic2LineageDistributionAudit,
    classicHomeRuntime,
    classicWorkspaceViewRuntime,
    classicViewport,
    spineGuideEditor,
    classicSpineGuideDraft,
    classicExperimentRuntime,
    classicRuntimeConfig,
    zenKoiRosterMemoryRuntime,
    zenRosterRepository,
    experimentTab,
    zenThemeModelState,
    zenThemeModelStateContract,
    zenModelRepository,
    zenModelRepositoryCore,
    modelStateRepository,
    modelStateStore,
    modelCatalog,
  ] = await Promise.all([
    read(paths.classic2LineageModel),
    read(paths.classic2LineageScoringPolicy),
    read(paths.classic2DevelopmentModel),
    read(paths.classic2GrowthExperienceContract),
    read(paths.activationPresentationModel),
    read(paths.bonsaiExperienceModel),
    read(paths.bonsaiRenderSystem),
    read(paths.bonsaiDebugOverrides),
    read(paths.sakuraRenderBranchLayer),
    read(paths.sakuraRenderPaintMetrics),
    read(paths.sakuraRenderPlan),
    read(paths.bonsaiRenderPlan),
    read(paths.sakuraTerminalPresentation),
    read(paths.sakuraRenderer),
    read(paths.fullRenderBounds),
    read(paths.actualAlphaObservationContract),
    read(paths.bonsaiSceneSnapshot),
    read(paths.pixiBonsaiRenderer),
    read(paths.pixiBonsaiBranchRigMotionPolicy),
    read(paths.mainWorkerRenderer),
    read(paths.localPreviewRenderer),
    read(paths.treeRenderer),
    read(paths.renderPlanMemo),
    read(paths.homeTreeRenderer),
    read(paths.labTreeRenderer),
    read(paths.bonsaiPreviewEntry),
    read(paths.classic2IdentityContract),
    read(paths.classic2CandidateGraphContract),
    read(paths.bonsaiProfileAggregateModel),
    read(paths.bonsaiProfileGenerationGenesis),
    read(paths.bonsaiProfileAggregateStorageContract),
    read(paths.bonsaiProfileAggregateRepository),
    read(paths.bonsaiProfileAggregateResource),
    read(paths.bonsaiAuthoringDraft),
    read(paths.classic2LineageRuntime),
    read(paths.classic2LineageRuntimeMode),
    read(paths.classicAnalysisRuntime),
    read(paths.classicHomeTopologyRuntime),
    read(paths.classic2GrowthSnapshotMatrix),
    read(paths.classic2LineageDistributionAudit),
    read(paths.classicHomeRuntime),
    read(paths.classicWorkspaceViewRuntime),
    read(paths.classicViewport),
    read(paths.spineGuideEditor),
    read(paths.classicSpineGuideDraft),
    read(paths.classicExperimentRuntime),
    read(paths.classicRuntimeConfig),
    read(paths.zenKoiRosterMemoryRuntime),
    read(paths.zenRosterRepository),
    read(paths.experimentTab),
    read(paths.zenThemeModelState),
    read(paths.zenThemeModelStateContract),
    read(paths.zenModelRepository),
    read(paths.zenModelRepositoryCore),
    read(paths.modelStateRepository),
    read(paths.modelStateStore),
    read(paths.modelCatalog),
  ]);

  const contentByPath = {
    branchGenerator,
    passContextFactory,
    trunkPass,
    scaffoldPass,
    twigPass,
  };

  ensureNoPassToPassImport(contentByPath);
  ensureNoCrossTierRecursionCall(contentByPath);
  ensureOrchestratorOrder(trunkScaffoldGenerator, branchGenerator);
  ensureGeneAccessFreeze(contentByPath);

  const [
    sakuraRenderSpecies,
    zenCoreSpeciesRegistry,
    zenCoreConfigAssetCache,
    canvas2dBonsaiWorkerRenderer,
    g15Species,
    g15Scene,
    g15RenderPlan,
    g15RenderSpecies,
    g15RenderRuntime,
  ] = await Promise.all([
    read(paths.sakuraRenderSpecies),
    read(paths.zenCoreSpeciesRegistry),
    read(paths.zenCoreConfigAssetCache),
    read(paths.canvas2dBonsaiWorkerRenderer),
    read(paths.g15Species),
    read(paths.g15Scene),
    read(paths.g15RenderPlan),
    read(paths.g15RenderSpecies),
    read(paths.g15RenderRuntime),
  ]);

  const g15Entries = await fs.readdir(path.resolve(rootDir, paths.g15Root), {
    withFileTypes: true,
  });
  const g15JavaScriptSources = await Promise.all(
    g15Entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
      .map(async (entry) => ({
        fileName: entry.name,
        source: await read(`${paths.g15Root}/${entry.name}`),
      })),
  );

  const g15Source = new Map(g15JavaScriptSources.map(({ fileName, source }) => [fileName, source]));
  const plumeEntries = await fs.readdir(path.resolve(rootDir, paths.plumeRoot), { recursive: true });
  const plumeSources = await Promise.all(plumeEntries.filter(name => name.endsWith('.js'))
    .map(name => read(`${paths.plumeRoot}/${name}`)));
  const [plumeSpecies, plumeRenderPlan, plumeLifeAdapter] = await Promise.all([
    read(paths.plumeSpecies), read(paths.plumeRenderPlan), read(`${paths.plumeRoot}/ZenBonsaiPlumeLifeAdapter.js`),
  ]);
  const [plumeAnnual, plumeRhythmAnnual, plumeAnnualObservationCopy] = await Promise.all([
    read(`${paths.plumeRoot}/annual/model.js`),
    read(`${paths.plumeRoot}/rhythm/annual-core.js`),
    read(`${paths.plumeRoot}/annual/zenAnnualObservationCopy.js`),
  ]);
  const plumeAnnualObservationCallers = new Set([
    `${paths.plumeRoot}/annual/model.js`, `${paths.plumeRoot}/rhythm/annual-core.js`,
  ]);
  const plumeAnnualObservationImportPattern = /(?:from|import|require)\s*(?:\(\s*)?['"][^'"]*zenAnnualObservationCopy(?:\.js)?['"]/;
  const plumeAnnualObservationImporters = (await Promise.all(
    (await fs.readdir(path.resolve(rootDir, 'src'), { recursive: true }))
      .filter(name => /\.(?:js|jsx|mjs)$/.test(name))
      .map(async name => {
        const sourcePath = `src/${name.replaceAll('\\', '/')}`;
        return plumeAnnualObservationImportPattern.test(await read(sourcePath)) ? sourcePath : null;
      }),
  )).filter(sourcePath => sourcePath !== null);
  assert(
    plumeAnnual.includes("import { copyZenCherryAnnualObservation } from './zenAnnualObservationCopy.js'")
      && plumeRhythmAnnual.includes("import { copyZenCherryAnnualObservation } from '../annual/zenAnnualObservationCopy.js'")
      && [plumeAnnual, plumeRhythmAnnual].every(source => (
        countMatches(source, /\bcopyZenCherryAnnualObservation\s*\(/g) === 1
      ))
      && countMatches(plumeSources.join('\n'), /from\s*['"][^'"]*zenAnnualObservationCopy\.js['"]/g) === 2
      && plumeAnnualObservationImporters.length === plumeAnnualObservationCallers.size
      && plumeAnnualObservationImporters.every(sourcePath => plumeAnnualObservationCallers.has(sourcePath))
      && countMatches(plumeAnnualObservationCopy, /export\s+function\s+copyZenCherryAnnualObservation\s*\(/g) === 1
      && !/\bimport\b|\bDate\b|Math\.random|\bchrome\b|\blocalStorage\b|\bindexedDB\b|\b(?:Map|WeakMap)\s*\(/.test(plumeAnnualObservationCopy),
    'Complete annual observation copying must stay inside its two closed producer graphs, with one stateless copy owner and no storage, shared cache or public scaffold cloning.',
  );
  await ensurePlumeGeneratedCopyOwners();
  const [plumeGeneratedRequest, plumeOperationCore, plumeOperations, plumeCloud, plumeGeneratedCopy, plumeModelWorker,
    plumeLive, plumeScaffold, plumeProductStudy, plumeProtocol, plumeProjectionTransport, plumeLifeAppearance, plumeCameraModelClient] = await Promise.all([
    read(`${paths.plumeRoot}/ZenBonsaiPlumeGeneratedRequest.js`),
    read(`${paths.plumeRoot}/ZenBonsaiPlumeModelOperationCore.js`),
    read(`${paths.plumeRoot}/ZenBonsaiPlumeModelOperations.js`),
    read(`${paths.plumeRoot}/cloud/model.js`),
    read(`${paths.plumeRoot}/cloud/zenGeneratedRhythmObservationCopy.js`),
    read('src/themes/plugins/zen/workers/zenBonsaiModel.worker.js'),
    read(`${paths.plumeRoot}/live/model.js`),
    read(`${paths.plumeRoot}/canopy/f4-scaffold.js`),
    read(`${paths.plumeRoot}/ZenBonsaiPlumeProductStudy.js`),
    read(`${paths.plumeRoot}/ZenBonsaiPlumeModelProtocol.js`),
    read(`${paths.plumeRoot}/ZenBonsaiPlumeProjectionTransport.js`),
    read(`${paths.plumeRoot}/ZenBonsaiPlumeLifeAppearance.js`),
    read(`${paths.plumeRoot}/ZenBonsaiPlumeModelClient.js`),
  ]);
  assert(
    plumeGeneratedRequest.includes('createZenBonsaiPlumeGeneratedRequest(operation, payload, messageId)')
      && plumeGeneratedRequest.includes('createZenBonsaiPlumeWorkerDiagnostics(payload?.diagnosticIdentity, messageId)')
      && countMatches(plumeGeneratedRequest, /\bcreateZenBonsaiPlumeWorkerDiagnostics\s*\(/g) === 1
      && /runZenBonsaiPlumeModelOperation\(operation, payload, diagnostics,\s*createProductStudy, projectProductTopology\)/.test(plumeGeneratedRequest)
      && countMatches(plumeGeneratedRequest, /function\s+createProductStudy\s*\(/g) === 1
      && countMatches(plumeGeneratedRequest, /function\s+projectProductTopology\s*\(/g) === 1
      && plumeGeneratedRequest.includes('createZenGeneratedBonsaiPlumePreparation(seed, diagnostics)')
      && plumeGeneratedRequest.includes('finalizeZenGeneratedBonsaiPlumeProductStudy(preparation)')
      && plumeGeneratedRequest.includes('requireZenBonsaiPlumeProjectionRequest(payload)')
      && plumeGeneratedRequest.includes('projectZenGeneratedBonsaiPlumeSnapshot(study, payload, diagnostics)')
      && plumeGeneratedRequest.includes('projectZenGeneratedBonsaiPlumePreparedTopology(liveStudy, payload, diagnostics,')
      && plumeOperations.includes('executeZenBonsaiPlumeModelOperation(operation, payload, diagnostics = null)')
      && /runZenBonsaiPlumeModelOperation\(operation, payload, diagnostics,\s*createZenBonsaiPlumeStudy, projectZenBonsaiPlumeTopology\)/.test(plumeOperations)
      && plumeOperationCore.includes('runZenBonsaiPlumeModelOperation(operation, payload, diagnostics, createStudy, projectTopology)')
      && countMatches(plumeOperationCore, /\bprojectTopology\s*\(/g) === 4
      && plumeOperationCore.includes('projectTopology(payload.study, payload, diagnostics)')
      && plumeOperationCore.includes('projectTopology(payload.study, payload)')
      && plumeOperationCore.includes('ZEN_PLUME_MODEL_PROJECTION_IDENTITY_INVALID')
      && plumeOperationCore.includes('ZEN_PLUME_MODEL_OPERATION_INVALID')
      && plumeSpecies.includes('createZenBonsaiPlumeStudy(seed, diagnostics = null)')
      && plumeSpecies.includes('assemblePlumeStudy(seed, diagnostics, createZenCherryCloudModel, extractScaffold, createZenCherryPlumeSnapshot)')
      && plumeSpecies.includes('assemblePlumeStudy(seed, diagnostics, createZenGeneratedCherryCloudModel, extractGeneratedF4Scaffold, createZenCherryPlumeSnapshot)')
      && /assemblePlumeStudy\(seed, diagnostics, createZenGeneratedCherryCloudPreparation,\s*extractGeneratedF4Scaffold, createZenGeneratedCherryPlumeCameraSnapshot\)/.test(plumeSpecies)
      && plumeSpecies.includes('diagnostics ? diagnostics.measure(stage, task) : task()')
      && countMatches(plumeSpecies, /function\s+assemblePlumeStudy\s*\(/g) === 1,
    'Public Operations/Species keep injected-diagnostics semantics and fixed public producers/projectors. The Worker fixes complete validated preparation to retained-only finalization and admits only the camera-free private PROJECT through the shared snapshot body.',
  );
  assert(
    plumeSpecies.includes('diagnostics, createZenCherryPlumeLiveSnapshot, freeze)')
      && plumeSpecies.includes('diagnostics, createZenGeneratedCherryPlumeLiveSnapshot, freeze)')
      && countMatches(plumeSpecies, /function\s+projectPlumeTopology\s*\(/g) === 1
      && countMatches(plumeSpecies, /function\s+projectPlumeSnapshot\s*\(/g) === 1
      && plumeLive.includes('projectLiveSnapshot(study,options,prepareCompiledPose)')
      && plumeLive.includes('projectLiveSnapshot(study,options,prepareGeneratedPose)')
      && countMatches(plumeLive, /function\s+projectLiveSnapshot\s*\(/g) === 1
      && plumeLive.includes('createZenCherryPlumeSnapshot(raw,{seed:study.seed,strength:1,stage})')
      && plumeLive.includes('requireZenGeneratedCherryPlumeFlowerDevelopmentInput(snapshot.flowers,{seed:study.seed})')
      && plumeScaffold.includes('const original = JSON.stringify(graph)')
      && plumeScaffold.includes("if (JSON.stringify(graph) !== original) throw Error('ZEN_CHERRY_F4_SOURCE_MUTATED')")
      && plumeScaffold.includes('freezeGeneratedSource(graph, new Set())')
      && plumeScaffold.includes('Object.getOwnPropertyDescriptor(value, key)')
      && countMatches(plumeScaffold, /function\s+buildScaffold\s*\(/g) === 1
      && ['NON_DATA', 'SHAPE', 'ACCESSOR'].every(code => plumeScaffold.includes(`ZEN_CHERRY_F4_GENERATED_SOURCE_${code}`)),
    'Generated Worker operations own one-use poses, early flower input admission and complete immutable F4 source proof through shared live/scaffold bodies. Public compiled pose and before/after native JSON audit contracts remain intact; no input flag, shape dispatch or recovery path is admitted.',
  );
  assert(
    !plumeSpecies.includes('ZenBonsaiPlumeProductStudy')
      && plumeGeneratedRequest.includes('const liveStudy = createZenBonsaiPlumeProductLiveStudy(study)')
      && plumeProductStudy.includes("'zen_bonsai_plume_product_study_v1'")
      && plumeProductStudy.includes("['nodes', 'segments', 'annualUnits', 'buds', 'flowers', 'attachments']")
      && plumeProductStudy.includes('f4History: source.f4History, cameraSnapshots: source.cameraSnapshots, product: source.product')
      && plumeProductStudy.includes('freezeRetainedGraph(createProductStudyGraph(preparation))')
      && plumeProductStudy.includes("'zen_bonsai_plume_projection_study_v1'")
      && plumeProductStudy.includes('study.cloud.snapshots.length !== 9')
      && plumeProductStudy.includes('study.cameraSnapshots.length !== 10')
      && plumeProtocol.includes('requireZenBonsaiPlumeProductStudy(result.study, { seed: identity.seed })')
      && !/\b(?:WeakMap|Map)\s*\(|\bstructuredClone\b|\bcatch\b|\bchrome\b|\blocalStorage\b|\bindexedDB\b|from\s*['"][^'"]*(?:generation\/|LifeAdapter)/.test(plumeProductStudy),
    'The compute-only GeneratedRequest owns product conversion/adaptation; Species must not import that transport into its renderer closure. Product transport retains all nine complete organ collections, F4 and camera histories under a distinct strict schema, with no legacy admission, cache, copy strategy or presentation/generation import.',
  );
  assert(
    plumeProjectionTransport.includes('requireZenBonsaiPlumeProjectionStudy(payload.study, { seed: payload.seed })')
      && plumeProjectionTransport.includes('result.preparationKey !== identity.preparationKey')
      && plumeProjectionTransport.includes('cameraSnapshots: binding.cameraSnapshots')
      && plumeProjectionTransport.includes('admitZenBonsaiPlumeLifeTopology(')
      && plumeCameraModelClient.includes('binding !== this.#projectionBinding')
      && plumeCameraModelClient.includes('prepared.study !== this.#prepared.study')
      && plumeCameraModelClient.includes('prepared.topology.lifeState.growth === life.growth')
      && plumeLifeAppearance.includes('admittedTopologies.has(topology)')
      && plumeLifeAppearance.includes('immutableNodes.has(node)')
      && plumeLifeAppearance.includes("fail('GROWTH_CHANGED')")
      && !/\b(?:Map|WeakMap)\s*\(|\bchrome\b|\blocalStorage\b|\bindexedDB\b|from\s*['"][^'"]*(?:generation\/|LifeAdapter|InitialForm|BloomTransition|BranchEstablishment)/.test(plumeLifeAppearance),
    'Private PROJECT excludes fixed camera data, binds exact preparation/source identity, and reattaches only the retained camera. Same-growth life binding requires complete immutable admission and shares current pose without generation, a strong cache or repeated structural transforms.',
  );
  assert(
    plumeCloud.includes('createZenCherryCloudModel(reference, { seed })')
      && plumeCloud.includes('developCloudModel(reference, seed, publicObservationOwner, publicWoodOwner)')
      && plumeCloud.includes('const copyPublicCloudObservation = source => structuredClone(source)')
      && plumeCloud.includes('developCloudModel(reference, seed, generatedObservationOwner, generatedWoodOwner)')
      && plumeCloud.includes('developCloudModel(reference, seed, preparationObservationOwner, generatedWoodOwner)')
      && plumeCloud.includes('copy: copyPublicCloudObservation, finishObservation: finishFullObservation, finishCloud: finishFullCloud')
      && plumeCloud.includes('copy: copyZenGeneratedRhythmObservation, finishObservation: finishFullObservation, finishCloud: finishFullCloud')
      && plumeCloud.includes('copy: copyPreparationObservation, finishObservation: finishPreparationObservation, finishCloud: finishPreparationCloud')
      && countMatches(plumeCloud, /function\s+developCloudModel\s*\(/g) === 1
      && countMatches(plumeCloud, /\bobservationOwner\.copy\s*\(source\)/g) === 1
      && plumeCloud.includes('snapshot.axes = source.axes.slice()')
      && plumeCloud.includes('snapshot.cloud = { ledgers: cloneCloudRecords(ledgers) }')
      && plumeCloud.includes('structuredClone(retained)')
      && plumeGeneratedCopy.includes('copyZenGeneratedRhythmObservation(source)')
      && plumeGeneratedCopy.includes('const seen = new Map()')
      && countMatches(plumeGeneratedCopy, /new\s+Map\s*\(/g) === 1
      && plumeGeneratedCopy.includes('new Array(value.length)')
      && plumeGeneratedCopy.includes('Object.keys(value)')
      && ['NON_DATA', 'SHAPE', 'KEY'].every(code => plumeGeneratedCopy.includes(`ZEN_CHERRY_CLOUD_GENERATED_OBSERVATION_${code}`))
      && !/\bimport\b|\bstructuredClone\b|\bcatch\b|\bWeakMap\b|\bDate\b|Math\.random|\bchrome\b|\blocalStorage\b|\bindexedDB\b/.test(plumeGeneratedCopy),
    'Cloud keeps late native public copying/lazy geometry and complete generated audit clones. Only closed preparation omits discarded audit copies, retaining independent organs and complete validation ledgers; generated wood owns invariant geometry and conservative bounds. No fallback, shared cache or storage.',
  );
  assert(
    plumeProductStudy.includes('const generatedFrozenCameraRoots = new WeakSet()')
      && plumeProductStudy.includes('generatedFrozenCameraRoots.add(study.cameraSnapshots)')
      && plumeProductStudy.includes('generatedFrozenCameraRoots.has(study.cameraSnapshots)')
      && plumeGeneratedRequest.includes('requireZenGeneratedBonsaiPlumeFrozenCamera(study)')
      && plumeSpecies.includes('new Set([frozenCamera])'),
    'Only the generated product finalizer may prove complete camera immutability. Its weak identity proof is carried by GeneratedRequest into initial projection; public/native clones retain complete traversal and no graph is retained by the proof.',
  );
  const requestCreateAt = plumeModelWorker.indexOf('createZenBonsaiPlumeGeneratedRequest(type, payload, id)');
  const requestDiagnosticsAt = plumeModelWorker.indexOf('diagnostics = request.diagnostics', requestCreateAt);
  const requestReceiptAt = plumeModelWorker.indexOf("diagnostics?.record('request_received')", requestDiagnosticsAt);
  const requestExecuteAt = plumeModelWorker.indexOf('request.execute()', requestReceiptAt);
  assert(
    requestCreateAt >= 0 && requestDiagnosticsAt > requestCreateAt
      && requestReceiptAt > requestDiagnosticsAt && requestExecuteAt > requestReceiptAt
      && plumeModelWorker.includes('createZenBonsaiPlumeWorkerDiagnostics(data.diagnosticIdentity, null)')
      && plumeModelWorker.includes("diagnostics?.record('operation_failed')")
      && plumeModelWorker.includes("diagnostics?.record('result_post_start')")
      && plumeModelWorker.includes("diagnostics.record('result_post_end')")
      && plumeModelWorker.includes('runZenBonsaiPlumeModelProfileBarrier({ id, type, diagnostics })')
      && plumeModelWorker.includes('profileBarrier.then(sendResult).catch(sendError)')
      && !plumeModelWorker.includes('executeZenBonsaiPlumeModelOperation'),
    'The model Worker must use its ephemeral generated request while retaining PING diagnostics, request-before-execute ordering, error/RESULT receipts and the existing before-RESULT profile barrier with the same recorder.',
  );
  assert(
    plumeSources.length > 0
      && plumeSources.every(source => !source.includes('scripts/dev/zen-bonsai-morphology-research'))
      && !plumeEntries.some(name => /(?:^|[\\/])(?:index\.html|lab-controller\.js|app\.js)$/.test(name))
      && plumeSpecies.includes("from './generation/source/research/factor-growth-4/candidate-entry.js'")
      && plumeSpecies.includes('createZenBonsaiPlumeStudy')
      && plumeSpecies.includes('projectZenBonsaiPlumeTopology')
      && plumeRenderPlan.includes('resolveZenBonsaiPlumeTopologySignature')
      && plumeRenderPlan.includes('requireZenBonsaiPlumeRenderPlanV1')
      && plumeRenderPlan.includes('ZEN_BONSAI_PLUME_RENDER_PLAN_SIGNATURE_MISMATCH')
      && !/from\s*['"][^'"]*(?:generation\/|ZenBonsaiPlumeSpecies|ZenBonsaiPlumeLifeAdapter|live\/(?:model|compiled-pose|f4-history))/.test(plumeRenderPlan)
      && bonsaiRenderPlan.includes('createZenBonsaiPlumeRenderPlanV1'),
    'Plume promotion must own its source in src, exclude workbench controllers, and hydrate a signed display plan independently from private F4/study generation. The public worker artifact guard enforces its transitive generation exclusion.',
  );
  assert(
    countMatches(plumeRenderPlan, /export\s+function\s+applyZenBonsaiPlumeActivation\s*\(/g) === 1
      && plumeRenderPlan.includes('const snapshot=applyZenBonsaiPlumeActivation(topology.snapshot,activationPresentation)')
      && /import\s*\{\s*resolveZenBonsaiPlumeSourceSeed\s*\}\s*from\s*['"]\.\/ZenBonsaiPlumeIdentity\.js['"]/.test(plumeRenderPlan)
      && /import\s*\{[^}]*normalizeZenBonsaiActivationPresentation[^}]*resolveZenBonsaiActivationPresentationSignal[^}]*\}\s*from\s*['"]\.\.\/presentation\/ZenBonsaiActivationPresentation\.js['"]/.test(plumeRenderPlan)
      && !/applyZenBonsaiPlumeActivation|ZenBonsaiActivationPresentation|ZenBonsaiPlumeRenderPlan/.test(plumeLifeAdapter),
    'Plume activation is owned and consumed only by its canonical RenderPlan, using the shared activation contract and pure seed Identity. Generation/life projection must not import or re-export the render-only activation owner.',
  );
  const g15Clock = g15Source.get('ZenBonsaiG15DevelopmentClock.js');
  const [plumeTopologyHook, plumeDescriptor, plumeModelClient] = await Promise.all([
    read('src/themes/plugins/zen/runtime/classic/useZenBonsaiPlumeTopology.js'),
    read(`${paths.plumeRoot}/ZenBonsaiPlumeSpeciesDescriptor.js`),
    read(`${paths.plumeRoot}/ZenBonsaiPlumeModelClient.js`),
  ]);
  assert(
    plumeTopologyHook.includes('ZenBonsaiPlumeModelClient')
      && !/createZenBonsaiPlumeStudy|projectZenBonsaiPlumeTopology|ZenBonsaiPlumeSpecies\.js/.test(plumeTopologyHook)
      && plumeModelClient.includes('WORKER_RUNTIME_SURFACE_IDS.ZEN_BONSAI_MODEL')
      && !/generateTopology|ZenBonsaiPlumeSpecies\.js|generation\//.test(plumeDescriptor),
    'Plume UI topology must use its strict admitted compute client; the renderer descriptor must not expose or import local generation.',
  );
  const g15Geometry = g15Source.get('ZenBonsaiG15GrowthGeometry.js');
  const g15Organs = g15Source.get('ZenBonsaiG15OrganDevelopment.js');
  assert(
    Boolean(g15Organs)
      && ['sakura-canopy-twig-volume.js', 'sakura-flowering-presentation.js'].every((file) => (
        g15Source.get(file).includes("from './ZenBonsaiG15OrganDevelopment.js'")
      ))
      && !/\bimport\b|\bDate\b|Math\.random|\bchrome\b|\blocalStorage\b|\bindexedDB\b/.test(g15Organs),
    'G15 canopy and flowering must share one pure organ age/reservation owner, independent of storage, wall clocks and scheduling.',
  );
  assert(
    Boolean(g15Clock) && Boolean(g15Geometry)
      && g15Source.get('product-life-state-adapter.js').includes("from './ZenBonsaiG15DevelopmentClock.js'")
      && g15Scene.includes("from './ZenBonsaiG15DevelopmentClock.js'")
      && g15Species.includes('eventBudget: targetEventCount')
      && !g15Species.includes('maximumEvents:')
      && g15Source.get('scene-command-builder.js').includes("from './ZenBonsaiG15GrowthGeometry.js'")
      && [g15Clock, g15Geometry].every((source) => (
        !/\bimport\b|\bDate\b|Math\.random|\bchrome\b|\blocalStorage\b|\bindexedDB\b/.test(source)
      )),
    'G15 product generation and scene rendering must share the pure development clock; carrier interpolation must stay renderer-only and independent of storage and scheduling.',
  );

  assert(
    !g15Entries.some((entry) => ['index.html', 'lab-controller.js'].includes(entry.name))
      && g15JavaScriptSources.every(({ source }) => (
        !source.includes('scripts/dev/zen-bonsai-morphology-research')
      ))
      && g15Species.includes("from './index.js'")
      && g15Species.includes('export const ZenBonsaiG15Species')
      && g15Scene.includes("from './render-runtime.js'")
      && g15RenderPlan.includes(
        "ZEN_BONSAI_G15_RENDER_PLAN_CONTRACT = 'zen-bonsai-g15-render-plan-v1'",
      )
      && g15RenderPlan.includes('resolveZenBonsaiG15TopologySignature')
      && g15RenderPlan.includes('validatedPlans = new WeakSet()')
      && g15RenderPlan.includes('buildG15Scene({')
      && bonsaiRenderPlan.includes('createZenBonsaiG15RenderPlanV1')
      && bonsaiRenderPlan.includes('createSakuraRenderPlanV1')
      && bonsaiRenderPlan.includes('ZEN_BONSAI_RENDER_PLAN_CONTRACT_INVALID')
      && !g15RenderRuntime.includes("import './frontier-growth-kernel.js'")
      && !g15RenderRuntime.includes("import './graph-inspector.js'")
      && !g15RenderRuntime.includes("import './fork-transaction.js'")
      && g15RenderSpecies.includes("from './render-runtime.js'")
      && sakuraRenderSpecies.includes('ZenBonsaiG15RenderSpecies')
      && !sakuraRenderSpecies.includes('ZenBonsaiG15Species.js'),
    'G15.4 product source must exclude workbench owners and keep worker rendering independent from graph generation.',
  );

  const g15TerminalBindings = [
    'SAKURA_CLUSTER_COMPOSITION_TEMPLATES',
    'SAKURA_TERMINAL_MORPHOLOGY_PLAN_CONTRACT',
    'createSakuraBlossomPose',
    'createSakuraTerminalMorphologyPlan',
    'paintProjectedSakuraBlossom',
    'resolveProjectedBlossomAtlasDescriptor',
  ];
  const g15TerminalOwner = g15Source.get('ZenBonsaiG15TerminalMorphology.js');
  const terminalExports = parseJavaScript(g15TerminalOwner, {
    ecmaVersion: 'latest', sourceType: 'module',
  }).body;
  assert(
    terminalExports.length === 1
      && terminalExports[0].type === 'ExportNamedDeclaration'
      && terminalExports[0].source?.value === '../../sakura/lab/ZenSakuraTwigPedicelStudy.js'
      && terminalExports[0].specifiers.length === g15TerminalBindings.length
      && terminalExports[0].specifiers.every(specifier => specifier.type === 'ExportSpecifier'
        && specifier.local.name === specifier.exported.name
        && g15TerminalBindings.includes(specifier.local.name)),
    'G15 product terminal morphology must expose only its six named canonical Sakura bindings; standalone study/drawing exports belong to their existing owner.',
  );
  const terminalConsumers = new Map([
    ['sakura-terminal-lab-adapter.js', ['createSakuraTerminalMorphologyPlan', 'SAKURA_TERMINAL_MORPHOLOGY_PLAN_CONTRACT']],
    ['sakura-flowering-presentation.js', ['SAKURA_CLUSTER_COMPOSITION_TEMPLATES', 'createSakuraBlossomPose', 'resolveProjectedBlossomAtlasDescriptor']],
    ['frontier-growth-renderer.js', ['paintProjectedSakuraBlossom']],
  ]);
  for (const [fileName, names] of terminalConsumers) {
    const source = g15Source.get(fileName);
    const imports = parseJavaScript(source, { ecmaVersion: 'latest', sourceType: 'module' }).body
      .filter(node => node.type === 'ImportDeclaration'
        && node.source.value === './ZenBonsaiG15TerminalMorphology.js');
    assert(
      !source.includes('ZenSakuraTerminalMorphologyModule')
        && imports.length === 1
        && imports[0].specifiers.length === names.length
        && imports[0].specifiers.every(specifier => specifier.type === 'ImportSpecifier'
          && names.includes(specifier.imported.name)),
      `${fileName} must consume its declared canonical terminal bindings through named ESM imports, without installing the generated study namespace.`,
    );
  }
  const g15Math = g15Source.get('ZenBonsaiG15Math.js');
  const g15Ontogeny = g15Source.get('ontogenetic-growth-state.js');
  const g15StudyRuntime = g15Source.get('ZenBonsaiG15TerminalStudyRuntime.js');
  const g15StudyBindings = [
    'SAKURA_CLUSTER_COMPOSITION_TEMPLATES',
    'SAKURA_TERMINAL_BRANCHING_DEFAULTS',
    'SAKURA_TERMINAL_CLUSTER_COVERAGE_DEFAULT',
    'SAKURA_TERMINAL_KEYED_RANDOM_CONTRACT',
    'SAKURA_TERMINAL_MORPHOLOGY_PLAN_CONTRACT',
    'SAKURA_TERMINAL_MORPHOLOGY_PLAN_VERSION',
    'SAKURA_TERMINAL_ORGAN_POSE_CONTRACT',
    'SAKURA_TERMINAL_SOCKET_FIXTURES',
    'createSakuraBlossomPose',
    'createSakuraTerminalMorphologyPlan',
    'createSakuraTerminalSocketStudyPlan',
    'drawSakuraTwigPedicelStudy',
    'paintProjectedSakuraBlossom',
    'resolveProjectedBlossomAtlasDescriptor',
  ];
  const studyImports = parseJavaScript(g15StudyRuntime, { ecmaVersion: 'latest', sourceType: 'module' }).body
    .filter(node => node.type === 'ImportDeclaration');
  assert(
    studyImports.length === 1
      && studyImports[0].source.value === '../../sakura/lab/ZenSakuraTwigPedicelStudy.js'
      && studyImports[0].specifiers.length === g15StudyBindings.length
      && studyImports[0].specifiers.every((specifier, index) => specifier.type === 'ImportSpecifier'
        && specifier.imported.name === g15StudyBindings[index]
        && specifier.local.name === specifier.imported.name)
      && g15StudyRuntime.includes("Object.defineProperty(studyNamespace, '__esModule', { value: true })")
      && g15StudyRuntime.includes('globalThis.ZenSakuraTerminalMorphologyModule = studyNamespace')
      && !g15Entries.some(entry => entry.name === 'sakura-terminal-lab-runtime.generated.js')
      && !g15JavaScriptSources.some(({ source }) => (
        /\b(?:import|export)\b[^;]*['"][^'"]*sakura-terminal-lab-runtime\.generated\.js['"]/.test(source)
      )),
    'Full G15 study publication must preserve all 14 ordered canonical ESM bindings and the existing global object contract; active product imports may not retain the duplicated generated snapshot.',
  );
  assert(
    g15Math.includes('export const clamp =')
      && g15Math.includes('export const rounded =')
      && !/\bimport\b|\bglobalThis\b|\bDate\b|Math\.random|\bchrome\b|\blocalStorage\b|\bindexedDB\b/.test(g15Math)
      && [g15Ontogeny, g15Source.get('developmental-programs.js')].every(source => (
        source.includes("import { clamp, rounded } from './ZenBonsaiG15Math.js'")
      ))
      && !g15Ontogeny.includes('ZenBonsaiTypedDevelopmentalSchedulerPrograms')
      && !g15RenderRuntime.includes('developmental-programs.js')
      && !g15RenderRuntime.includes('sakura-terminal-lab-runtime.generated.js')
      && !g15RenderRuntime.includes('ZenBonsaiG15TerminalStudyRuntime.js')
      && g15Source.get('index.js').includes("import './developmental-programs.js'")
      && g15Source.get('index.js').includes("import './ZenBonsaiG15TerminalStudyRuntime.js'"),
    'G15 render ontogeny must share exact pure numeric foundations without importing generation programs or full study publication; full generation retains its programs and complete ESM study bridge.',
  );

  assert(
    sakuraRenderSpecies.includes('export const SakuraRenderSpecies')
      && !sakuraRenderSpecies.includes('generateTopology')
      && !sakuraRenderSpecies.includes('SakuraStructuralSpecies')
      && zenCoreSpeciesRegistry.includes("from './SakuraSpecies.js'")
      && zenCoreConfigAssetCache.includes('resolveRenderSpecies')
      && !zenCoreConfigAssetCache.includes("from './SakuraSpecies'")
      && canvas2dBonsaiWorkerRenderer.includes('resolveRenderSpecies')
      && !canvas2dBonsaiWorkerRenderer.includes('resolveSpecies')
      && pixiBonsaiRenderer.includes('resolveRenderSpecies')
      && !pixiBonsaiRenderer.includes('resolveSpecies')
      && pixiBonsaiRenderer.includes("from '../../model/sakura/sakuraSpeciesRuntimeContract.js'")
      && !pixiBonsaiRenderer.includes("from '../../model/SakuraSpecies"),
    'Home Canvas2D/Pixi renderer workers must consume the renderer-only Sakura species and may not import the generation-capable species registry.',
  );
  assert(
    treeRenderer.includes('useMainWorkerRenderer({')
      && treeRenderer.includes('useLocalPreviewRenderer({')
      && treeRenderer.includes('useAbRenderer({')
      && !treeRenderer.includes("from './useZenBonsaiMainWorkerRenderer")
      && !treeRenderer.includes("from './useZenBonsaiLocalPreviewRenderer")
      && !treeRenderer.includes("from './useZenBonsaiAbRenderer")
      && homeTreeRenderer.includes('useZenBonsaiMainWorkerRenderer')
      && !homeTreeRenderer.includes('useZenBonsaiLocalPreviewRenderer')
      && !homeTreeRenderer.includes('useZenBonsaiAbRenderer')
      && labTreeRenderer.includes('useZenBonsaiLocalPreviewRenderer')
      && labTreeRenderer.includes('useZenBonsaiAbRenderer')
      && !labTreeRenderer.includes('useZenBonsaiMainWorkerRenderer')
      && classicHomeRuntime.includes('useZenHomeTreeRenderer')
      && !classicHomeRuntime.includes('useZenLabTreeRenderer')
      && bonsaiPreviewEntry.includes("lazy(")
      && bonsaiPreviewEntry.includes(
        "import('../../runtime/preview/ZenBonsaiPreviewRuntime.jsx')",
      )
      && !bonsaiPreviewEntry.includes("export { default } from '../../runtime/preview/"),
    'Home and Lab must select disjoint renderer implementations at their module entrypoints while sharing only the renderer core.',
  );
  assert(
    bonsaiSceneSnapshot.includes('topologySignature: providedTopologySignature = null')
      && bonsaiSceneSnapshot.includes(
        'resolvedRenderPlan.source.topologySignature !== topologySignature',
      )
      && mainWorkerRenderer.includes(
        'topologySignature: renderPlan.source.topologySignature',
      )
      && localPreviewRenderer.includes(
        'topologySignature: renderPlan.source.topologySignature',
      ),
    'Canvas scene snapshots must reuse and verify the render-plan topology signature instead of traversing the same topology again.',
  );
  assert(
    classicHomeRuntime.includes('useZenClassicHomeTopologyRuntime')
      && !classicHomeRuntime.includes('useZenClassicAnalysisRuntime')
      && classicHomeTopologyRuntime.includes('ZEN_BONSAI_MODEL_SURFACES.HOME')
      && classicHomeTopologyRuntime.includes('generateG15Topology(JSON.parse(g15GenerationKey))')
      && countMatches(classicHomeTopologyRuntime, /generateG15Topology\(/g) === 1
      && classicHomeTopologyRuntime.includes('modelMaterializationReady: usesDirectTopology')
      && classicHomeTopologyRuntime.includes('useZenBonsaiPlumeTopology({')
      && classicHomeTopologyRuntime.includes('resolveZenBonsaiPlumeBioticSignal({')
      && classicHomeTopologyRuntime.includes(
        "'zen_g15_home_visible_tree'",
      )
      && !classicHomeTopologyRuntime.includes('BonsaiCandidateEvaluator')
      && !classicHomeTopologyRuntime.includes('CandidateScoreModel')
      && !classicHomeTopologyRuntime.includes('resolveSakuraV2ReliabilityGate')
      && !classicHomeTopologyRuntime.includes('resolveSakuraGeneratorLearningProgress'),
    'Home must own one Plume study projection and explicit G15 comparison generation, expose model-neutral materialization readiness, and derive observed petal supply without importing experiment evaluation.',
  );

  assert(
    countMatches(sakuraTopologyGenerator, /createSakuraTrunkPathPlanV1\(/g) === 1
      && sakuraTopologyGenerator.includes('trunkPathPlan,')
      && passContextFactory.includes('trunkPathPlan,')
      && trunkPass.includes('requireTrunkPathPlanV1(trunkPolicy.trunkPathPlan)'),
    'Sakura generation must materialize one TrunkPathPlanV1 and pass that exact plan into the trunk emitter.',
  );
  assert(
    trunkPathPlanContract.includes('TRUNK_PATH_PLAN_VERSION = 1')
      && trunkPathPlanContract.includes('branchSegment.startX !== span.currentX')
      && trunkPathPlanContract.includes('branchSegment.endX !== span.childState.currentX')
      && trunkPathPlanContract.includes('span.isTerminal !== reachedLimit'),
    `${paths.trunkPathPlanContract} must reject partial, disconnected, or limit-inconsistent paths.`,
  );
  assert(
    sakuraTrunkPathPlan.includes(
      'SAKURA_TRUNK_PATH_PLANNER_ID = SAKURA_MACRO_SPINE_INTENT_PLANNER_ID',
    )
      && sakuraTrunkPathPlan.includes(
        "SAKURA_TRUNK_PATH_LEGACY_PLANNER_ID = 'sakura_segment_flow_proposal_v1'",
      )
      && sakuraTrunkPathPlan.includes(
        'export const createSakuraLegacyTrunkMacroGuideProposalV1 =',
      )
      && sakuraTrunkPathPlan.includes("role: 'proposal_ablation_only'")
      && countMatches(
        sakuraTrunkPathPlan,
        /createSakuraLegacyTrunkMacroGuideProposalV1/g,
      ) === 1
      && countMatches(sakuraTrunkPathPlan, /createLegacySakuraTrunkPathPlanV1/g) === 2
      && sakuraTrunkPathPlan.includes('const createTrunkCurveFlow =')
      && sakuraTrunkPathPlan.includes('const resolveTrunkGeminiContinuation =')
      && sakuraTrunkPathPlan.includes('resolveSakuraTrunkArticulatedBendStepV1')
      && countMatches(sakuraTrunkPathPlan, /createSakuraMacroSpineIntentPlanV1\(/g) === 1
      && countMatches(sakuraTrunkPathPlan, /fitSakuraMacroSpineIntentPlanV1\(/g) === 1
      && sakuraTrunkPathPlan.includes(
        'const activeGuide = createSakuraMacroSpineIntentDiagnosticGuideV1(activeIntentPlan)',
      )
      && sakuraTrunkPathPlan.includes('plan.guideId = spineShape.guideId')
      && /subdivideSakuraMacroSpineShapeV1\(\s*spineShape,/s.test(sakuraTrunkPathPlan)
      && sakuraTrunkPathPlan.includes('plan.adaptiveDiscretization = adaptive')
      && sakuraTrunkPathPlan.includes(
        'const resolvedStructuralMaxDepth = structuralMaxDepth',
      )
      && !sakuraTrunkPathPlan.includes('physicalSpanDepth')
      && !/from\s+['"][^'"]*vnext/i.test(sakuraTrunkPathPlan)
      && !branchGenerator.includes('createTrunkCurveFlow')
      && !branchGenerator.includes('resolveTrunkGeminiContinuation')
      && !trunkPass.includes('BranchGeometryModel')
      && !trunkPass.includes('resolveSakuraTrunkGeminiTaperWidth'),
    'SakuraTrunkPathPlan must activate bend-aware MacroSpineIntentPlan, isolate legacy 32-step flow as proposal-only, and keep adaptive physical spans independent from biological structural depth.',
  );
  assert(
    macroSpineIntentPlan.includes(
      "SAKURA_MACRO_SPINE_INTENT_PLAN_CONTRACT = (\n    'zen_sakura_macro_spine_intent_plan_v1'",
    )
      && macroSpineIntentPlan.includes(
        "SAKURA_MACRO_SPINE_INTENT_PLANNER_ID = (\n    'sakura_macro_spine_intent_bend_aware_v1'",
      )
      && macroSpineIntentPlan.includes("REST: 'rest'")
      && macroSpineIntentPlan.includes("FLOW: 'flow'")
      && macroSpineIntentPlan.includes("SWEEP: 'sweep'")
      && macroSpineIntentPlan.includes("SHOULDER_IN: 'shoulder_in'")
      && macroSpineIntentPlan.includes("CORE: 'core'")
      && macroSpineIntentPlan.includes("SHOULDER_OUT: 'shoulder_out'")
      && macroSpineIntentPlan.includes("BRIDGE: 'bridge'")
      && macroSpineIntentPlan.includes("BEND_RHYTHM_POLICY_ID = 'sakura_nonperiodic_bend_rhythm_v1'")
      && macroSpineIntentPlan.includes("LATERAL_SWEEP_POLICY_ID = 'sakura_backbone_lateral_sweep_v1'")
      && macroSpineIntentPlan.includes("sourceField: 'trunkGeminiParams.waveFreq'")
      && macroSpineIntentPlan.includes("sourceField: 'gene.trunkBackboneAmp'")
      && macroSpineIntentPlan.includes(
        "trunk_curve_amp: 'bend_rhythm.curve_event_angle'",
      )
      && macroSpineIntentPlan.includes(
        "trunk_curve_freq: 'bend_rhythm.curve_event_count_and_continuous_cadence'",
      )
      && macroSpineIntentPlan.includes("backbone_tilt_bias: 'posture.global_turn'")
      && macroSpineIntentPlan.includes(
        "backbone_sway: 'lateral_sweep.finite_support_turn'",
      )
      && macroSpineIntentPlan.includes('cadenceProgress')
      && macroSpineIntentPlan.includes('const curveEventCount = 1')
      && !macroSpineIntentPlan.includes('waveAmplitude <= 0.08')
      && macroSpineIntentPlan.includes(
        'eventCount: curveEventCount + articulatedEventCount',
      )
      && macroSpineIntentPlan.includes('return tilt * lerp(0.42, 3.6, cascade);')
      && !macroSpineIntentPlan.includes('trunkGeminiParams?.mainCurve')
      && macroSpineIntentPlan.includes('export const conditionSakuraMacroSpineIntentPlanV1 =')
      && macroSpineIntentPlan.includes('export const fitSakuraMacroSpineIntentPlanV1 =')
      && macroSpineIntentPlan.includes('intentEventIndex: span.eventIndex')
      && macroSpineGuide.includes('intentEventIndex: sourceSegment.intentEventIndex'),
    'MacroSpineIntentPlan must publish disjoint curve-amplitude, continuous-rhythm, posture, lateral-sweep, and articulated-event owners and carry their roles through bend-aware fitting and render-only subdivision.',
  );
  assert(
    trunkGeminiParams.includes('SAKURA_TRUNK_ROOT_HEADING_RAD = -Math.PI / 2')
      && trunkGeminiParams.includes(
        'resolveSakuraTrunkGeminiRootAngle = () => SAKURA_TRUNK_ROOT_HEADING_RAD',
      )
      && !trunkGeminiParams.includes('const tiltBias = Number(latent?.backbone_tilt_bias)')
      && !trunkGeminiParams.includes('const backboneSway = Number(latent?.backbone_sway)')
      && !trunkGeminiParams.includes("direct.trunkGeminiRoughness = clampByPhenotypeKey")
      && trunkGeminiParams.includes('SAKURA_TRUNK_PROPOSAL_ONLY_LATENT_KEYS')
      && trunkGeminiParams.includes('PROPOSAL_ONLY_LATENT_KEY_SET.has(latentKey)')
      && trunkGeminiParams.includes('SAKURA_TRUNK_ACTIVE_CONTROLS')
      && trunkGeminiParams.includes("{ key: 'trunk_curve_amp', label: 'Curve Amp' }")
      && trunkGeminiParams.includes("{ key: 'trunk_curve_freq', label: 'Bend Rhythm' }")
      && !trunkGeminiParams.includes('SAKURA_TRUNK_GEMINI_CONTROLS')
      && latentControlsConfig.includes('SAKURA_TRUNK_ACTIVE_CONTROLS')
      && !latentControlsConfig.includes('SAKURA_TRUNK_GEMINI_CONTROLS')
      && sakuraTopologyGenerator.includes(
        'const rootBaseAngle = resolveSakuraTrunkGeminiRootAngle()',
      )
      && !sakuraTopologyPlan.includes('globalTiltBias')
      && !sakuraTopologyPlan.includes('gene.trunkBackboneTiltBias')
      && latentCompileContext.includes('FIXED_BRANCH_DRESSING_CURVE_PRIOR')
      && latentCompileContext.includes(
        '1 - (nAngleStd * 0.7) - FIXED_BRANCH_DRESSING_CURVE_PRIOR',
      )
      && !latentCompileContext.includes("latentNorm(latent, 'trunk_curve_amp')")
      && !latentCompileContext.includes("latentNorm(latent, 'trunk_curve_freq')")
      && latentTierCompilers.includes("curvatureBase: clampByPhenotypeKey('curvatureBase', 0.29)")
      && latentTierCompilers.includes("curvatureFreq: clampByPhenotypeKey('curvatureFreq', 0.86)")
      && latentTierCompilers.includes('0.72 + (nBackboneSway * 0.88)')
      && !latentTierCompilers.includes('(nCurveAmp * 0.16)')
      && !latentTierCompilers.includes('(nBackboneSway - 0.5) * 0.12')
      && !latentTierCompilers.includes('0.74 + (nBackboneSway * 0.32)')
      && !latentTierCompilers.includes(
        'blendStyleMode(trunkStyleMode, 0.12, 0.44, 0.9) +',
      ),
    'Active trunk learning axes must enter one intent channel each: fixed root, direct tilt posture, curve-event amplitude/rhythm, and direct lateral sweep; generic branch curvature and scaffold side may not mirror them.',
  );
  assert(
    articulatedBendKernel.includes("SWEEP: 'sweep'")
      && articulatedBendKernel.includes("KNUCKLE: 'knuckle'")
      && articulatedBendKernel.includes("COMPOUND: 'compound'")
      && articulatedBendKernel.includes("role: 'bridge'")
      && articulatedBendKernel.includes('resolveSakuraArticulatedBendTurnDeltaV1')
      && trunkArticulatedBendFlow.includes('supportEndArcNorm')
      && trunkArticulatedBendFlow.includes('nextBendEligibleArcNorm')
      && !trunkArticulatedBendFlow.includes('nodeId')
      && !trunkArticulatedBendFlow.includes('scaffold'),
    'Sakura trunk kink semantics must remain a finite-support geometry-only articulated bend; node/scaffold identity stays outside the bend kernel.',
  );
  assert(
    branchGeometryModel.includes('createExactCubicSegment')
      && branchGeometryModel.includes('createExactCubicControl')
      && sakuraTrunkPathPlan.includes('BranchGeometryModel.createExactCubicSegment')
      && sakuraTrunkPathPlan.includes('exactCubicControl: geometry.exactCubicControl')
      && sakuraTrunkPathPlan.includes(
        'ZEN_SAKURA_TRUNK_MACRO_PHYSICAL_GEOMETRY_EXACT_CONTROL_DRIFT',
      ),
    'The fitted macro guide must reach emitted trunk spans through the exact cubic carrier instead of a lossy scalar curve projection.',
  );
  assert(
    macroLineageIdentityContract.includes(
      'SAKURA_MACRO_LINEAGE_IDENTITY_DECIMALS = 7',
    )
      && macroLineageIdentityContract.includes(
        'SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM',
      )
      && macroSpineGuide.includes(
        "from '../../contracts/SakuraMacroLineageIdentityContract.js'",
      )
      && macroSpineGuide.includes('const snapToShapeBoundary = (arcNorm) =>')
      && macroSpineGuide.includes(
        'nearest?.distance <= SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM',
      )
      && macroSpineIntentPlan.includes(
        '> SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM',
      )
      && trunkMacroLineageContract.includes(
        'SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM',
      )
      && macroSpineGuide.includes('SAKURA_MACRO_SPINE_ANCHOR_MIN = 3')
      && macroSpineGuide.includes('SAKURA_MACRO_SPINE_ANCHOR_MAX = 7')
      && macroSpineGuide.includes('SAKURA_MACRO_SPINE_MAX_ARC_NORM = 1.35')
      && macroSpineGuide.includes('export const fitSakuraMacroSpineGuideC1V1 =')
      && macroSpineGuide.includes('const resolveFiniteTurnRegions =')
      && macroSpineGuide.includes('const createArticulatedStationCandidateGroups =')
      && macroSpineGuide.includes('const selectArticulatedStationGroups =')
      && macroSpineGuide.includes('export const blendSakuraMacroSpineGuidesV1 =')
      && macroSpineGuide.includes('export const subdivideSakuraMacroSpineShapeV1 =')
      && /SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY\s*=\s*Object\.freeze\(\{[^}]*min:\s*8,\s*base:\s*12,\s*soft:\s*32,\s*hard:\s*48,/s.test(
        macroSpineGuide,
      )
      && macroSpineGuide.includes('targetAdjacentArcRatio: 4')
      && macroSpineGuide.includes('const splitIntervalAtArcMidpoint =')
      && macroSpineGuide.includes('ZEN_SAKURA_MACRO_SPINE_ADJACENT_ARC_RATIO_POLICY_INVALID')
      && macroSpineGuide.includes('achievedMaxAdjacentArcRatio')
      && macroSpineGuide.includes('arcBalanceLimitedByHardCap')
      && !macroSpineGuide.includes('ZEN_SAKURA_MACRO_SPINE_ARC_BALANCE_LIMIT_EXCEEDED')
      && macroSpineGuide.includes("policyId: 'sakura_curvature_adaptive_8_12_32_48_v1'")
      && macroSpineGuideCondition.includes(
        "'zen_sakura_macro_spine_guide_condition_v1'",
      )
      && macroSpineGuideCondition.includes(
        "SAKURA_MACRO_SPINE_GUIDE_ROLE = 'fixed_generation_context'",
      )
      && macroSpineGuideCondition.includes('guide.guideId')
      && macroSpineGuideCondition.includes('Number(adherence.toFixed(7))'),
    `${paths.macroSpineGuide} must share one lineage identity quantum, snap near-coincident intent/guide cuts before partitioning, own the 3-7 anchor guide and curvature-adaptive 8/12/32/48 subdivision, and bind guideId plus adherence.`,
  );
  assert(
    structuralDescriptorModel.includes('TRUNK_ARC_GRID_INTERVALS = 64')
      && structuralDescriptorModel.includes('TRUNK_TURN_GRID_INTERVALS = 8')
      && structuralDescriptorModel.includes('sampleTrunkChainOnStableArcGrid')
      && structuralDescriptorModel.includes(
        'const trunkPoints = sampleTrunkChainOnStableArcGrid(trunkChain)',
      ),
    `${paths.structuralDescriptorModel} must measure trunk posture on a fixed arc grid so adaptive emission span count cannot leak into morphology.`,
  );
  assert(
    /BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS\s*=\s*Object\.freeze\(\[\s*BONSAI_FORM_ID\.FORMAL_UPRIGHT,\s*BONSAI_FORM_ID\.UMBRELLA_CROWN,\s*BONSAI_FORM_ID\.SLANTING,\s*BONSAI_FORM_ID\.INFORMAL_UPRIGHT,\s*BONSAI_FORM_ID\.LITERATI,\s*BONSAI_FORM_ID\.FULL_CASCADE,\s*BONSAI_FORM_ID\.SEMI_CASCADE,\s*BONSAI_FORM_ID\.WEEPING,\s*\]\)/s.test(
      formReachabilityPolicy,
    )
      && /BONSAI_SINGLE_ROOT_UNSUPPORTED_FORM_IDS\s*=\s*Object\.freeze\(\[\s*BONSAI_FORM_ID\.TWIN_TRUNK,\s*BONSAI_FORM_ID\.MULTI_TRUNK,\s*\]\)/s.test(
        formReachabilityPolicy,
      )
      && singleRootFormCompositionPrior.includes(
        "BONSAI_SINGLE_ROOT_FORM_COMPOSITION_GROUP_KEYS = Object.freeze([",
      )
      && singleRootFormCompositionPrior.includes("'trunk'")
      && singleRootFormCompositionPrior.includes("'scaffold'")
      && singleRootFormCompositionPrior.includes("'crown'")
      && singleRootFormCompositionPrior.includes("'negativeSpace'")
      && countMatches(singleRootFormCompositionPrior, /envelope: 'low_triangle'/g) === 1
      && singleRootFormCompositionPrior.includes(
        'BONSAI_SINGLE_ROOT_UNSUPPORTED_FORM_IDS.includes(formId)',
      )
      && singleRootFormCompositionAdapter.includes(
        "'zen_sakura_single_root_form_composition_plan_v1'",
      )
      && singleRootFormCompositionAdapter.includes(
        "const RESIDUAL_POLICY_ID = 'sakura_form_target_bounded_latent_residual_v1'",
      )
      && singleRootFormCompositionAdapter.includes('phenotypeComposition: Object.freeze({')
      && singleRootFormCompositionAdapter.includes(
        'export const createSakuraSingleRootFormCompositionProvenanceV1 =',
      )
      && singleRootFormCompositionAdapter.includes(
        'export const requireSakuraSingleRootFormCompositionProvenanceV1 =',
      )
      && singleRootFormCompositionAdapter.includes('if (!hasPrior && !hasFormId) {')
      && singleRootFormCompositionAdapter.includes('return null;')
      && !singleRootFormCompositionAdapter.includes('BonsaiFormClassifier')
      && sakuraTopologyGenerator.includes(
        'resolveSakuraSingleRootFormCompositionInputV1({',
      )
      && sakuraTopologyGenerator.includes('const gene = formCompositionPlan?.effectiveGene || baseGene')
      && sakuraTopologyGenerator.includes('root.formCompositionPlan = formCompositionPlan')
      && sakuraTopologyGenerator.includes('root.formCompositionProvenance = (')
      && sakuraTopologyPlan.includes('const negativeSpace = formCompositionPlan?.negativeSpace || null')
      && sakuraTopologyPlan.includes('const formScaffold = formCompositionPlan?.scaffold || null')
      && !sakuraTopologyPlan.includes('BonsaiFormClassifier')
      && sakuraStructuralAbSpecies.includes(
        'formCompositionPrior: options?.formCompositionPrior ?? null',
      )
      && sakuraStructuralAbSpecies.includes('formId: options?.formId ?? null')
      && sakuraStructuralAbSpecies.includes(
        'formVariantSeed: options?.formVariantSeed ?? null',
      )
      && countMatches(
        `${sakuraStructuralSpecies}\n${sakuraFullTopologyGeneration}`,
        /formCompositionPrior: options\?\.formCompositionPrior \?\? null/g,
      ) === 2
      && countMatches(
        `${sakuraStructuralSpecies}\n${sakuraFullTopologyGeneration}`,
        /formId: options\?\.formId \?\? null/g,
      ) === 2
      && countMatches(
        `${sakuraStructuralSpecies}\n${sakuraFullTopologyGeneration}`,
        /formVariantSeed: options\?\.formVariantSeed \?\? null/g,
      ) === 2,
    'The exact eight-form single-root composition prior must opt in through one target-plus-bounded-residual adapter shared by full and structural generation; classification stays read-only, low_triangle stays a formal crown target, and default generation remains latent-only.',
  );
  assert(
    spineGenerationConditionContract.includes(
      'export const validateSakuraSpineGenerationConditionIdV1 =',
    )
      && spineGenerationConditionContract.includes('value === null')
      && spineGenerationCondition.includes(
        'export const resolveSakuraSpineGenerationConditionIdV1 =',
      )
      && spineGenerationCondition.includes(
        "throw new Error('ZEN_SAKURA_SPINE_GENERATION_CONDITION_CONFLICT')",
      )
      && spineGenerationCondition.includes(': null);')
      && bonsaiProfileAggregateModel.includes("'spineGenerationConditionId'")
      && bonsaiProfileAggregateModel.includes(
        'validateSakuraSpineGenerationConditionIdV1(',
      )
      && bonsaiProfileGenerationGenesis.includes('spineGenerationConditionId: null')
      && classicAnalysisRuntime.includes(
        'resolveSakuraSpineGenerationConditionIdV1({',
      )
      && classicAnalysisRuntime.includes(
        'ZEN_BONSAI_CLASSIC2_SPINE_GENERATION_CONDITION_IDENTITY_MISMATCH',
      )
      && classicAnalysisRuntime.includes('spineGenerationConditionId,')
      && classic2LineageRuntime.includes(
        'EPHEMERAL_PREVIEW_IDENTITY_ROTATION',
      ),
    'Spine generation condition must be an exact nullable identity input: durable genesis defaults to null, while authored ephemeral condition changes rotate isolated preview lineage.',
  );
  assert(
    sakuraTopologyGenerator.includes('createSakuraScaffoldArcStationPlan({')
      && sakuraTopologyGenerator.includes('guideShapeId: trunkPathPlan.guideShapeId')
      && passContextFactory.includes('scaffoldStationPlan,')
      && scaffoldPassInputBuilder.includes('trunkPathPlan,')
      && passContracts.includes('input?.schedule?.trunkPathPlan')
      && scaffoldPass.includes('requireSakuraScaffoldArcStationPlan(scaffoldStationPlan)')
      && scaffoldPass.includes('collections.trunkSpanRegistry')
      && scaffoldPass.includes('station.arcNorm >= span.arcStartNorm')
      && scaffoldPass.includes('createSakuraScaffoldStationRandom(topologyRandom, station)')
      && sakuraTrunkPathPlan.includes(
        'export const resolveSakuraTrunkMacroStationGeometryV1 =',
      )
      && sakuraTrunkPathPlan.includes(
        'sampleSakuraMacroSpineShapeAtArcNorm(plan.shape, stationArcNorm)',
      )
      && scaffoldPass.includes('resolveSakuraTrunkMacroStationGeometryV1({')
      && scaffoldPass.includes('const childAttach = anchor.macroStationGeometry')
      && scaffoldArcStationPlan.includes("SAKURA_SCAFFOLD_ARC_STATION_POLICY_ID = 'sakura_macro_spine_arc_station_active_v1'")
      && scaffoldArcStationPlan.includes('stationId')
      && scaffoldArcStationPlan.includes('placementId')
      && scaffoldArcStationPlan.includes('decisionType: station.stationId')
      && passContracts.includes('collections?.trunkSpanRegistry'),
    'Active scaffold identity, RNG, and root geometry must be owned by stable guide arc stations and the continuous macro shape, with physical spans limited to render-parent lookup.',
  );
  const activeScaffoldOwnershipSources = [
    trunkScaffoldGenerator,
    passContextFactory,
    trunkPassInputBuilder,
    scaffoldPassInputBuilder,
    trunkPass,
    scaffoldPass,
  ].join('\n');
  assert(
    !/scaffoldAnchors|scheduledScaffold(?:Depth)?|scaffoldAnchorPolicy|trunkScaffoldDepths|isTrunkScaffoldDepth/i.test(
      activeScaffoldOwnershipSources,
    )
      && !/nearest[^\n]*(?:depth|anchor)|(?:depth|anchor)[^\n]*nearest/i.test(
        activeScaffoldOwnershipSources,
      )
      && !/anchorSpan\.(?:branchSegment|arcEndWidth|lastDir|currentX|currentY|angle)/.test(
        scaffoldPass,
      )
      && !/anchor\.(?:branchSegment|arcEndWidth|currentX|currentY|parentAngle)/.test(
        scaffoldPass,
      )
      && !scaffoldPass.includes('pointAndAngleAt(')
      && !scaffoldPass.includes('BranchGeometryModel'),
    'Active trunk/scaffold passes must not restore scaffoldAnchors, scheduled/nearest-depth projection, depth-owned RNG, or physical-span-owned scaffold geometry.',
  );
  assert(
    twigSilhouettePolicy.includes('export const resolveSakuraCanopyNegativeSpace =')
      && twigSilhouettePolicy.includes('export const resolveSakuraTwigRootOpenOffset =')
      && twigSilhouettePolicy.includes('export const resolveSakuraTwigOpenForkBias =')
      && twigSpawnModel.includes("from './sakuraTwigSilhouettePolicy'")
      && twigSpawnModel.includes('resolveSakuraCanopyNegativeSpace(scaffoldDepthNorm)')
      && twigPass.includes('resolveSakuraTwigRootOpenOffset({')
      && branchHeuristics.includes('resolveSakuraTwigOpenForkBias(twigDepth)')
      && !/trunkSegmentLimit|traversalDepth|adaptiveSpan/i.test(twigSilhouettePolicy)
      && !/trunkSegmentLimit|traversalDepth|adaptiveSpan/i.test(twigSpawnModel),
    'Twig silhouette density must be owned by role-local scaffold/twig semantics and cannot depend on adaptive trunk subdivision or traversal depth.',
  );

  const [
    structuralAbApi,
    candidateScoreModel,
    candidateScoreBlending,
    trialContract,
    abController,
    abQuestionLanePolicy,
    abFormQuestionPolicy,
    abGenerationReadiness,
    classicWorkspaceInteractionRuntime,
    abWorker,
    abRenderer,
    structuralPreviewRenderer,
    structuralCandidateEvaluator,
    morphologyEvidenceContract,
    structuralComparisonPlan,
    abViewportContract,
    zenCoreConfigOptimizationTuning,
    abCandidatePacking,
    abPairSignature,
    learningLab,
    abFeedback,
    abHistoryOrderContract,
    pairwiseEvidencePolicy,
    morphologyPreferencePosterior,
    preferenceBasinModel,
    reliabilityMetrics,
    pairwisePredictionContract,
    pairwiseModel,
    generationSemantics,
    learningFactorPolicy,
  ] = await Promise.all([
    read(paths.structuralAbApi),
    read(paths.candidateScoreModel),
    read(paths.candidateScoreBlending),
    read(paths.trialContract),
    read(paths.abController),
    read(paths.abQuestionLanePolicy),
    read(paths.abFormQuestionPolicy),
    read(paths.abGenerationReadiness),
    read(paths.classicWorkspaceInteractionRuntime),
    read(paths.abWorker),
    read(paths.abRenderer),
    read(paths.structuralPreviewRenderer),
    read(paths.structuralCandidateEvaluator),
    read(paths.morphologyEvidenceContract),
    read(paths.structuralComparisonPlan),
    read(paths.abViewportContract),
    read(paths.zenCoreConfigOptimizationTuning),
    read(paths.abCandidatePacking),
    read(paths.abPairSignature),
    read(paths.learningLab),
    read(paths.abFeedback),
    read(paths.abHistoryOrderContract),
    read(paths.pairwiseEvidencePolicy),
    read(paths.morphologyPreferencePosterior),
    read(paths.preferenceBasinModel),
    read(paths.reliabilityMetrics),
    read(paths.pairwisePredictionContract),
    read(paths.pairwiseModel),
    read(paths.generationSemantics),
    read(paths.learningFactorPolicy),
  ]);

  assert(
    sakuraTopologyGenerator.includes('export { getSakuraPotDimensions, SAKURA_CONFIG };')
      && sakuraTopologyGenerator.includes('export const generateSakuraTopology =')
      && !sakuraTopologyGenerator.includes('sakuraBranchGenerator')
      && !sakuraTopologyGenerator.includes('sakuraCanopyBloom')
      && !sakuraTopologyGenerator.includes('measureBonsaiSceneBounds')
      && sakuraStructuralAbSpecies.includes('Object.freeze({')
      && sakuraStructuralAbSpecies.includes('DEFAULT_Phenotype:')
      && sakuraStructuralAbSpecies.includes('getPotDimensions: getSakuraPotDimensions,')
      && sakuraStructuralAbSpecies.includes('generateStructuralTopology,')
      && !sakuraStructuralAbSpecies.includes('generateTopology:')
      && !sakuraStructuralAbSpecies.includes('measureSceneBounds')
      && !sakuraStructuralAbSpecies.includes('sakuraBranchGenerator')
      && !sakuraStructuralAbSpecies.includes('sakuraCanopyBloom')
      && structuralBranchGenerator.includes('createSakuraTrunkScaffoldGenerator(context)')
      && !structuralBranchGenerator.includes('sakuraTwigPass')
      && !trunkScaffoldGenerator.includes('sakuraTwigPass')
      && sakuraStructuralSpecies.includes('export const SakuraStructuralSpecies = {')
      && sakuraStructuralSpecies.includes(
        'generateStructuralTopology: SakuraStructuralABSpecies.generateStructuralTopology,',
      )
      && sakuraStructuralSpecies.includes('measureSceneBounds:')
      && sakuraStructuralSpecies.includes('generateSakuraFullTopology({')
      && !sakuraStructuralSpecies.includes('sakuraRenderer')
      && sakuraFullTopologyGeneration.includes('createSakuraBranchGenerator')
      && sakuraFullTopologyGeneration.includes('createSakuraCanopyBloomLayer')
      && !sakuraFullTopologyGeneration.includes('SakuraStructuralABSpecies')
      && sakuraSpecies.includes('...SakuraStructuralSpecies,')
      && sakuraSpecies.includes("from './SakuraRenderSpecies.js'")
      && sakuraSpecies.includes('...SakuraRenderSpecies,')
      && !sakuraSpecies.includes('generateTopology:')
      && !sakuraSpecies.includes('getPotDimensions:'),
    'SakuraStructuralSpecies must singly own structural generation/pot/measurement while SakuraSpecies only composes render methods.',
  );
  assert(
    sakuraHomeSpecies.includes('export const SakuraHomeSpecies = Object.freeze({')
      && sakuraHomeSpecies.includes('generateSakuraFullTopology({')
      && !sakuraHomeSpecies.includes('SakuraStructuralSpecies')
      && !sakuraHomeSpecies.includes('SakuraStructuralABSpecies')
      && !sakuraHomeSpecies.includes('SakuraRenderSpecies')
      && !sakuraHomeSpecies.includes('measureBonsaiSceneBounds')
      && !sakuraHomeSpecies.includes('ZenPotRenderer')
      && !sakuraHomeSpecies.includes('render:')
      && !sakuraHomeSpecies.includes('renderPot:')
      && homeSpeciesRegistry.includes("from './SakuraHomeSpecies.js'")
      && homeSpeciesRegistry.includes('export const resolveHomeSpecies =')
      && classicHomeTopologyRuntime.includes('resolveHomeSpecies')
      && !classicHomeTopologyRuntime.includes('resolveSpecies')
      && !classicHomeTopologyRuntime.includes('ZenCoreSpeciesRegistry')
      && !classicHomeRuntime.includes('createAssetCache')
      && !classicHomeRuntime.includes('ZenCoreConfigAssetCache')
      && !classicHomeRuntime.includes('assetCache,'),
    'Main/Home must use the generation-and-anchor-only Sakura species seam without importing Lab structural A/B or main-thread paint owners.',
  );
  assert(
    structuralAbApi.includes('BonsaiStructuralCandidateEvaluator.js')
      && structuralAbApi.includes('CandidateScoreModel.js')
      && structuralAbApi.includes('SakuraStructuralABSpecies,')
      && structuralAbApi.includes('model/SakuraStructuralABSpecies.js')
      && !structuralAbApi.includes('researchLearning')
      && !structuralAbApi.includes('SakuraSpecies.js')
      && !structuralAbApi.includes('sakuraRenderer')
      && candidateScoreModel.includes("from './candidateScoreBlending'")
      && !candidateScoreModel.includes('ZenCoreScoring')
      && candidateScoreBlending.includes('export const blendScores =')
      && candidateScoreBlending.includes('export const scoreAdaptiveObjective ='),
    `${paths.structuralAbApi} must remain a narrow render-free worker graph instead of forwarding through broad research/scoring barrels.`,
  );

  assert(
    spineReferenceFamily.includes('SAKURA_SPINE_REFERENCE_DEFAULT_LIKENESS = 0.72')
      && spineReferenceFamily.includes("'sakura_spine_reference_low_frequency_field_v1'")
      && spineReferenceFamily.includes('const sampleRandom = rootRandom.fork({')
      && spineReferenceFamily.includes("nodeRole: 'spine_reference_family'")
      && spineReferenceFamily.includes("normalDrift: centeredSample(random, 'normal_drift')")
      && spineReferenceFamily.includes("normalWave: centeredSample(random, 'normal_wave')")
      && spineReferenceFamily.includes('createSakuraMacroSpineGuideV1({')
      && sakuraTrunkPathPlan.includes('if (spineGuide && spineReferenceFamily)')
      && sakuraTrunkPathPlan.includes('sampleSakuraSpineReferenceFamilyV1({')
      && sakuraTrunkPathPlan.includes('const conditioningGuide = spineGuide')
      && sakuraTrunkPathPlan.includes(': (referenceSample?.guide || null)')
      && sakuraTrunkPathPlan.includes('conditionSakuraMacroSpineIntentPlanV1({')
      && sakuraTrunkPathPlan.includes(
        'createSakuraMacroSpineIntentDiagnosticGuideV1(activeIntentPlan)',
      )
      && sakuraTrunkPathPlan.includes(
        'ZEN_SAKURA_TRUNK_INTENT_GUIDE_SIGNATURE_MISMATCH',
      )
      && !sakuraTrunkPathPlan.includes('let activeGuide = proceduralGuide;')
      && !sakuraTrunkPathPlan.includes('fitSakuraMacroSpineGuideC1V1(activeGuide)')
      && spineReferenceFamilyCondition.includes(
        "SAKURA_SPINE_REFERENCE_FAMILY_ROLE = 'fixed_generation_context'",
      )
      && !spineReferenceFamilyCondition.includes('latent')
      && !learningFactorPolicy.includes('spineReference'),
    'Inspired spine references must remain deterministic low-frequency conditioning context, never a learned latent; active guide provenance must be re-derived from the conditioned intent geometry.',
  );
  assert(
    classicSpineGuideDraft.includes('const [guideDraft, setGuideDraft] = useState(null)')
      && classicSpineGuideDraft.includes('simplifySakuraSpineStrokeToMacroGuideV1({')
      && classicSpineGuideDraft.includes('createSakuraMacroSpineGuideV1({')
      && classicSpineGuideDraft.includes("const [mode, setMode] = useState('sculpted')")
      && classicSpineGuideDraft.includes(
        'useState(SAKURA_SPINE_REFERENCE_DEFAULT_LIKENESS)',
      )
      && classicSpineGuideDraft.includes(
        "spineGuide: enabled && mode === 'sculpted' ? guideDraft : null",
      )
      && classicSpineGuideDraft.includes("enabled && mode === 'inspired' && guideDraft")
      && !/localStorage|chrome\.storage|indexedDB|ZenThemeModelState/.test(classicSpineGuideDraft)
      && spineGuideEditor.includes('fitSakuraMacroSpineGuideC1V1(guide)')
      && spineGuideEditor.includes('onMoveAnchor')
      && spineGuideEditor.includes('Guide adherence')
      && spineGuideEditor.includes("{ id: 'sculpted', label: 'Sculpted' }")
      && spineGuideEditor.includes("{ id: 'inspired', label: 'Inspired' }")
      && spineGuideEditor.includes('`Likeness ${Math.round(likeness * 100)}%`')
      && classicViewport.includes('experimental && !isCollectionMode')
      && classicViewport.includes('<ZenSpineGuideEditor'),
    'The macro-spine editor must remain an ephemeral Single-workspace draft with Sculpted default, Inspired likeness 0.72, preserved editable anchors, and one mode-specific strength control.',
  );
  assert(
    generationSemantics.includes(
      "SAKURA_GENERATION_SEMANTICS_ID = 'sakura_generation_semantics_v5'",
    )
      && pairwisePredictionContract.includes('SAKURA_PAIRWISE_MODEL_VERSION = 5')
      && pairwisePredictionContract.includes(
        "'sakura_pairwise_gp_v5_canonical_learning_latent_rff_generation_semantics_v5'",
      )
      && pairwiseModel.includes('SAKURA_GENERATION_SEMANTICS_ID')
      && pairwiseModel.includes('state.generationSemantics !== this.generationSemantics')
      && pairwiseModel.includes('state.version !== MODEL_VERSION')
      && pairwiseModel.includes('state.learningKeyspaceProfile !== this.learningKeyspaceProfile')
      && pairwiseModel.includes('if (!this.isStateValid(state))')
      && pairwiseModel.includes('ZEN_PAIRWISE_MODEL_STATE_INVALID')
      && zenThemeModelStateContract.includes('!hasExactKeys(state, keys)')
      && zenThemeModelStateContract.includes('state.version !== 5')
      && zenThemeModelStateContract.includes("const keys = [...baseKeys, 'generationSemantics']")
      && trialContract.includes('generationSemantics: SAKURA_GENERATION_SEMANTICS_ID'),
    'Active MacroSpineIntentPlan generation must be isolated as generation semantics v5, with exact current V5 model envelopes and fail-loud model/version/keyspace/semantics admission.',
  );
  assert(
    trialContract.includes('ZEN_TRIAL_CONTRACT_VERSION = 1')
      && trialContract.includes("STRUCTURAL_SCOUT\n)")
      && trialContract.includes("ZEN_AB_CANDIDATE_OBJECTIVE_MODE = 'lane_split'")
      && trialContract.includes('generationSemantics: SAKURA_GENERATION_SEMANTICS_ID')
      && trialContract.includes('INVALID_FORM_COMPOSITION')
      && trialContract.includes('createBonsaiSingleRootFormCompositionPrior({')
      && trialContract.includes(
        'A/B structural candidates require the explicit coverage/preference lane objective.',
      ),
    `${paths.trialContract} must keep its release V1 envelope while pinning structural generation semantics v5, exact single-root form conditions, and split coverage/preference lane objectives.`,
  );
  assert(
    abController.includes('evaluationProfile: ZEN_AB_CANDIDATE_EVALUATION_PROFILE')
      && abController.includes('generationDetail: ZEN_AB_CANDIDATE_GENERATION_DETAIL')
      && abController.includes('objectiveMode: ZEN_AB_CANDIDATE_OBJECTIVE_MODE')
      && abController.includes('resolveSakuraABFormQuestionPlan({')
      && abController.includes('plannedLatentB = isStructuralDiscoveryQuestion')
      && abController.includes("pairType: questionLanePolicy.pairType")
      && abController.includes('resolveBonsaiStructuralScreenDistanceV1(')
      && abController.includes('entry.structuralScreenDistance.passed')
      && abController.includes('if (!candidatePairPool.length) {')
      && abController.includes("stage: 'visible_distance_admission'")
      && abController.includes("stage: 'trial_planning'")
      && abController.includes("stage: 'source_pair_reconstruction'")
      && abController.includes('latticeSelectionEnabled: false')
      && abController.includes("active: questionLane === SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY")
      && abController.includes('ZEN_AB_STRUCTURAL_WORKER_EMPTY_RESULT')
      && !abController.includes('referenceFeatures,'),
    `${paths.abController} must generate form-balanced source pairs, reject sub-threshold screen-space comparisons without fallback, and report coverage separately from preference confidence.`,
  );
  assert(
    classicWorkspaceInteractionRuntime.includes('spineGuide,')
      && classicWorkspaceInteractionRuntime.includes('useZenABController({')
      && abController.includes('spineGuide = null,')
      && abController.includes('createSakuraMacroSpineGuideConditionV1(activeSpineGuide)')
      && abController.includes('spineGuideConditionId: spineGuideCondition.conditionId')
      && abController.includes('spineGuideId: spineGuideCondition.guideId')
      && abController.includes('spineGuideAdherence: spineGuideCondition.adherence')
      && abController.includes('spineGuide: activeSpineGuide')
      && abController.includes("cancelActiveGeneration('ZEN_AB_SPINE_GUIDE_CHANGED'")
      && abController.includes('setAbPair(null)')
      && trialContract.includes('const spineGuide = cloneSpineGuide(payload?.spineGuide)')
      && trialContract.includes('createSakuraMacroSpineGuideConditionV1(spineGuide)')
      && abWorker.includes('const generationOptions = normalizedPayload?.spineGuide')
      && abWorker.includes('{ spineGuide: normalizedPayload.spineGuide }')
      && structuralCandidateEvaluator.includes('spineGuide: generationOptions.spineGuide')
      && structuralCandidateEvaluator.includes('spineGuideConditionId: spineGuideCondition.conditionId')
      && abCandidatePacking.includes('guideA.conditionId !== guideB.conditionId')
      && abCandidatePacking.includes('spineGuideAdherence: guideA.adherence')
      && abRenderer.includes('requireSakuraMacroSpineGuideV1(render.spineGuide)')
      && abRenderer.includes('{ spineGuide: renderInput.spineGuide }')
      && abPairSignature.includes('`spineCondition:${spineGuideConditionId}`')
      && abPairSignature.includes('`spineAdherence:${roundNumber('),
    'Single and structural A/B must share one typed spine-guide condition through trial normalization, worker evaluation, packed provenance, signature, and preview; guide changes must cancel stale work.',
  );
  assert(
    classicWorkspaceInteractionRuntime.includes('spineReferenceFamily,')
      && abController.includes('spineReferenceFamily = null,')
      && abController.includes('createSakuraSpineReferenceFamilyConditionV1(')
      && abController.includes("throw new Error('ZEN_AB_SPINE_CONDITION_CONFLICT')")
      && abController.includes('spineReferenceFamily: activeSpineReferenceFamily')
      && abController.includes('const seedA = randomSeed();')
      && abController.includes("cancelActiveGeneration('ZEN_AB_SPINE_REFERENCE_FAMILY_CHANGED'")
      && trialContract.includes(
        'const spineReferenceFamily = cloneSpineReferenceFamily(payload?.spineReferenceFamily)',
      )
      && trialContract.includes('CONFLICTING_SPINE_CONDITION')
      && trialContract.includes('createSakuraSpineReferenceFamilyConditionV1(spineReferenceFamily)')
      && abWorker.includes('normalizedPayload?.spineReferenceFamily')
      && abWorker.includes('{ spineReferenceFamily: normalizedPayload.spineReferenceFamily }')
      && structuralCandidateEvaluator.includes('spineReferenceVariantGuideId')
      && abCandidatePacking.includes(
        'ZEN_SAKURA_AB_SPINE_REFERENCE_FAMILY_PAIR_SEED_MISMATCH',
      )
      && abCandidatePacking.includes(
        'ZEN_SAKURA_AB_SPINE_REFERENCE_FAMILY_PAIR_VARIANT_MISMATCH',
      )
      && abRenderer.includes('requireSakuraSpineReferenceFamilyV1(render.spineReferenceFamily)')
      && abRenderer.includes('{ spineReferenceFamily: renderInput.spineReferenceFamily }')
      && abPairSignature.includes('`spineFamilyCondition:${spineReferenceFamilyConditionId}`')
      && abPairSignature.includes('render.spineReferenceVariantGuideId'),
    'Inspired generation must use one fail-loud fixed family condition and one shared topology-seeded variant inside each structural A/B pair, with provenance preserved through preview and signatures.',
  );
  assert(
    abWorker.includes('BonsaiStructuralCandidateEvaluator')
      && abWorker.includes("api/structuralAB.js")
      && abWorker.includes('SakuraStructuralABSpecies')
      && !abWorker.includes('BonsaiCandidateEvaluator')
      && !abWorker.includes('NeuralZen')
      && !abWorker.includes('api/researchLearning.js')
      && !abWorker.includes('SakuraSpecies,')
      && abWorker.includes("const objectiveMode = structuralCoverageOnly ? 'neutral' : 'pairwise'")
      && abWorker.includes('const structuralCoverageOnly = lanes.length > 0')
      && abWorker.includes('if (!skipModelLoad && !structuralCoverageOnly)')
      && abWorker.includes("? 'morphology_coverage'")
      && abWorker.includes(": 'latent_and_morphology_preference'")
      && abWorker.includes('candidate.render.acquisitionObjective = acquisitionObjective'),
    `${paths.abWorker} must evaluate structural candidates without full TreeAnalyzer/Neural loading, keep coverage scoring neutral, skip latent GP for coverage-only batches, and stamp the active acquisition objective.`,
  );
  assert(
    abRenderer.includes('renderBonsaiStructuralPreview')
      && abRenderer.includes('species.generateStructuralTopology(')
      && !abRenderer.includes('species.render(')
      && !abRenderer.includes('resolveZenBonsaiWindState')
      && !abRenderer.includes('assetCache'),
    `${paths.abRenderer} must render A/B trunk/scaffold projections without the full species renderer.`,
  );
  assert(
    structuralPreviewRenderer.includes("profile: 'structural_line_preview_v1'")
      && !structuralPreviewRenderer.includes('drawImage(')
      && !structuralPreviewRenderer.includes('createPattern('),
    `${paths.structuralPreviewRenderer} must remain a texture-free cubic line renderer.`,
  );
  assert(
    countMatches(learningLab, /BONSAI_CANDIDATE_EVALUATION_PROFILE\.STRUCTURAL_SCOUT/g) >= 2,
    `${paths.learningLab} must keep structural A/B samples out of Neural and full-tree reference training.`,
  );
  assert(
    abQuestionLanePolicy.includes("FORM_DISCOVERY: 'form_discovery_pair'")
      && !abQuestionLanePolicy.includes("MIXED: 'mixed_pair'")
      && !abQuestionLanePolicy.includes("DIVERSITY: 'diversity_pair'")
      && abFormQuestionPolicy.includes(
        "'sakura_ab_form_balanced_coverage_and_within_form_preference_v1'",
      )
      && abFormQuestionPolicy.includes('BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS')
      && abFormQuestionPolicy.includes("relation: discovery ? 'cross_form_coverage'")
      && abCandidatePacking.includes("formRelation !== 'cross_form_coverage'")
      && abCandidatePacking.includes("formRelation !== 'within_form_preference'")
      && abCandidatePacking.includes('ZEN_SAKURA_AB_FORM_PAIR_VARIANT_MISMATCH'),
    'A/B question ownership must use form-balanced cross-form coverage and within-form preference lanes; mixed/diversity latent discovery is retired.',
  );
  assert(
    morphologyEvidenceContract.includes(
      "BONSAI_MORPHOLOGY_EVIDENCE_CONTRACT = 'bonsai_morphology_evidence_v1'",
    )
      && morphologyEvidenceContract.includes('BONSAI_STRUCTURAL_DESCRIPTOR_VERSION')
      && morphologyEvidenceContract.includes('BONSAI_FORM_CLASSIFIER_VERSION')
      && morphologyEvidenceContract.includes('SAKURA_GENERATION_SEMANTICS_ID')
      && structuralCandidateEvaluator.includes('createBonsaiMorphologyEvidenceV1({')
      && structuralCandidateEvaluator.includes('createBonsaiStructuralComparisonPlanV1({')
      && structuralCandidateEvaluator.includes(
        'measureBonsaiStructuralComparisonSceneBoundsV1({',
      )
      && !structuralCandidateEvaluator.includes('measureBonsaiSceneBounds')
      && !structuralCandidateEvaluator.includes('ZenPotRenderer')
      && abCandidatePacking.includes('requireBonsaiMorphologyEvidenceV1(')
      && abCandidatePacking.includes('requireBonsaiStructuralComparisonPlanV1(')
      && learningLab.includes('requireBonsaiMorphologyEvidenceV1(value.morphologyEvidence)')
      && learningLab.includes('requireSakuraSingleRootFormCompositionProvenanceV1('),
    'Every admitted structural candidate must preserve versioned generation semantics, descriptor/classifier evidence, comparison geometry, and exact form provenance through packing and history.',
  );
  assert(
    structuralComparisonPlan.includes('BONSAI_STRUCTURAL_MIN_VISIBLE_DISTANCE_PX = 7.5')
      && structuralComparisonPlan.includes(
        "'minimum_supported_css_px_240x240_ab_camera_v1'",
      )
      && abViewportContract.includes('BONSAI_AB_MIN_SUPPORTED_CARD_EXTENT_CSS_PX = 240')
      && structuralComparisonPlan.includes('BONSAI_AB_MIN_SUPPORTED_CARD_VIEWPORT')
      && zenCoreConfigOptimizationTuning.includes(
        'MIN_AB_RENDER_SIZE = BONSAI_AB_MIN_SUPPORTED_CARD_EXTENT_CSS_PX',
      )
      && structuralComparisonPlan.includes('const sharedScale = Math.min(fitA.scale, fitB.scale)')
      && structuralComparisonPlan.includes('passed: roundedVisibleDistance >= threshold')
      && abController.includes('const candidatePairPool = distanceEvaluatedPool.filter')
      && abController.includes('entry.structuralScreenDistance.passed')
      && !abController.includes(
        'candidatePairPool.length ? candidatePairPool : distanceEvaluatedPool',
      ),
    'A/B admission must use a DPR-independent canonical CSS screen distance and must not fall back to pairs below the 7.5px visibility floor.',
  );
  assert(
    abCandidatePacking.includes('FORM_CONTEXT_PROVENANCE_FIELDS')
      && abCandidatePacking.includes('requirePackedFormContextConsistency({')
      && abCandidatePacking.includes('ZEN_SAKURA_AB_FORM_CONTEXT_PROVENANCE_INCOMPLETE')
      && abController.includes('targetFormIdA: formQuestionPlan.formIdA')
      && abController.includes('formVariantSeedB: formQuestionPlan.formVariantSeedB')
      && abCandidatePacking.includes(
        'ZEN_SAKURA_AB_FORM_CONTEXT_PROVENANCE_MISMATCH:${field}',
      ),
    'A/B packing must fail loudly when existing form policy, form identity, or variant provenance disagrees with candidate-derived ownership.',
  );
  assert(
    morphologyPreferencePosterior.includes('this.global = createAxisState()')
      && morphologyPreferencePosterior.includes('this.perForm = Object.fromEntries(')
      && morphologyPreferencePosterior.includes('this.formBias = Object.fromEntries(')
      && morphologyPreferencePosterior.includes('export const summarizeSakuraMorphologyCoverage')
      && morphologyPreferencePosterior.includes(
        'export const summarizeSakuraMorphologyDiscoveryCoverage',
      )
      && morphologyPreferencePosterior.includes('proposalNormalizedEntropy')
      && morphologyPreferencePosterior.includes('realizedPrimaryNormalizedEntropy')
      && morphologyPreferencePosterior.includes('realizedMembershipNormalizedEntropy')
      && morphologyPreferencePosterior.includes('targetAcceptanceRate')
      && morphologyPreferencePosterior.includes(
        'const primaryFormId = evidence.classification.primaryFormId',
      )
      && abController.includes('buildSakuraMorphologyPreferencePosterior(')
      && abController.includes('summarizeSakuraMorphologyDiscoveryCoverage(')
      && abController.includes('realizedMembershipCoverageRatio:')
      && learningLab.includes('requireHistoryMorphologyGenerationSemantics(')
      && morphologyEvidenceContract.includes(
        'ZEN_BONSAI_MORPHOLOGY_EVIDENCE_PRIMARY_MEMBERSHIP_MISMATCH',
      )
      && morphologyEvidenceContract.includes(
        'ZEN_BONSAI_MORPHOLOGY_EVIDENCE_SECONDARY_FORMS_MISMATCH',
      )
      && abHistoryOrderContract.includes('requireSakuraABHistoryNewestFirst')
      && abHistoryOrderContract.includes('createSakuraABHistoryChronologicalReplay')
      && learningLab.includes('return requireSakuraABHistoryNewestFirst(normalized)')
      && learningLab.includes(
        'ZEN_SAKURA_AB_HISTORY_MORPHOLOGY_GENERATION_SEMANTICS_MISMATCH',
      )
      && morphologyPreferencePosterior.includes(
        'createSakuraABHistoryChronologicalReplay(history)',
      ),
    'Morphology preference must keep lane-separated coverage, internally consistent classifier membership, strict newest-first history admission, chronological derived-posterior replay, and cross-boundary generation semantics as explicit contracts.',
  );
  assert(
    pairwiseEvidencePolicy.includes('isABControlledAttributionPair')
      && pairwiseEvidencePolicy.includes('isABStructuralDiscoveryPair')
      && pairwiseEvidencePolicy.includes('requireBonsaiMorphologyEvidenceV1')
      && pairwiseEvidencePolicy.includes('structural_discovery_is_morphology_only')
      && pairwiseEvidencePolicy.includes('latentGpEligible: false')
      && pairwiseEvidencePolicy.includes('morphologyCaptureEligible')
      && pairwiseEvidencePolicy.includes('preferenceBasinEligible: false')
      && abFeedback.includes('resolveSakuraPairwiseEvidencePolicy(abPair)')
      && abFeedback.includes('if (evidencePolicy.latentGpEligible)')
      && abFeedback.includes('evidencePolicy.morphologyCaptureEligible')
      && preferenceBasinModel.includes('resolveSakuraPairwiseEvidencePolicy(entry)')
      && preferenceBasinModel.includes('preferenceBasinEligible')
      && reliabilityMetrics.includes(
        'resolveSakuraPairwiseEvidencePolicy(entry).predictiveGateEligible',
      )
      && reliabilityMetrics.includes(
        'const pairwiseSteps = predictiveSamples.length + tieCalibrationSamples.length',
      )
      && reliabilityMetrics.includes('globalPairwiseReliability')
      && reliabilityMetrics.includes('hasCurrentPairwisePredictionContract')
      && reliabilityMetrics.includes('Math.min(pairwiseVolume, pairwiseLossQuality)')
      && pairwisePredictionContract.includes(
        'SAKURA_PAIRWISE_PREDICTION_CONTRACT_ID',
      )
      && abFeedback.includes('modelMeta.predictionContractId')
      && learningLab.includes("['pairwiseProbabilityA', 'source', 'modelContractId']"),
    'Evidence eligibility must be shared by live feedback and current derived-history statistics: structural discovery is morphology-only, while controlled within-form rows alone enter latent GP, basin, and predictive populations.',
  );
  assert(
    abQuestionLanePolicy.includes('resolveSakuraABQuestionLaneHistoryCursor')
      && abQuestionLanePolicy.includes('roundOrdinal')
      && abQuestionLanePolicy.includes('discoveryOrdinal')
      && abQuestionLanePolicy.includes('SAKURA_AB_QUESTION_PAIR_TYPE.FORM_DISCOVERY')
      && abController.includes('resolveSakuraABQuestionLaneHistoryCursor(')
      && abController.includes('questionLaneHistoryCursor.roundOrdinal + 1')
      && abGenerationReadiness.includes(
        "ZEN_AB_GENERATION_READINESS_REASON.PROFILE_PENDING",
      )
      && abGenerationReadiness.includes("if (treeType !== 'sakura')")
      && abGenerationReadiness.includes(
        "error.code = 'ZEN_AB_GENERATION_SPECIES_UNSUPPORTED'",
      )
      && classicWorkspaceInteractionRuntime.includes(
        'resolveZenABGenerationReadiness({',
      )
      && classicWorkspaceInteractionRuntime.includes(
        'abPlanReady: abGenerationReadiness.ready',
      ),
    'A/B question-lane cadence must resume from canonical history, and generation must wait for hydrated profile, learning, and cold-start readiness with fail-loud species admission.',
  );
  assert(
    learningLab.includes("sharedSeedPolicy !== 'shared'")
      && learningLab.includes("hasOwn(value, 'evaluationProfile')")
      && learningLab.includes("hasOwn(value, 'generationDetail')")
      && learningLab.includes('sanitizeFormQuestionTags(context')
      && learningLab.includes('sanitizeLearningObjectives(')
      && learningLab.includes("hasOwn(value, 'acquisitionObjective')")
      && learningLab.includes('requireSakuraSingleRootFormCompositionProvenanceV1('),
    `${paths.learningLab} must preserve exact discovery seed, form/acquisition provenance, morphology evidence, and separate coverage/preference diagnostics for replay.`,
  );
  assert(
    fullRenderBounds.includes(
      "ZEN_SAKURA_FULL_RENDER_BOUNDS_CONTRACT = 'zen-sakura-full-render-bounds-v1'",
    )
      && sakuraRenderPlan.includes(
        "ZEN_SAKURA_RENDER_PLAN_CONTRACT = 'zen-sakura-render-plan-v1'",
      )
      && sakuraRenderPlan.includes('projectZenBonsaiGrowthNode')
      && sakuraRenderPlan.includes('resolveSakuraBranchMotionEnvelope')
      && sakuraRenderPlan.includes('resolveSakuraTerminalPresentationContext')
      && sakuraRenderPlan.includes('SAKURA_TERMINAL_PAINT_METRICS')
      && sakuraRenderPlan.includes('validatedRenderPlanIdentities = new WeakSet()')
      && sakuraRenderPlan.includes('createFullSignaturePayload')
      && sakuraRenderPlan.includes('createBakeSignaturePayload')
      && sakuraRenderPlan.includes('ZEN_SAKURA_RENDER_PLAN_ENVELOPE_DERIVATION_INVALID')
      && sakuraRenderPlan.includes('ZEN_SAKURA_RENDER_PLAN_BOUNDS_DERIVATION_INVALID')
      && fullRenderBounds.includes('requireSakuraRenderPlanV1')
      && !fullRenderBounds.includes('createSakuraRenderPlanV1')
      && fullRenderBounds.includes('requireSakuraActualAlphaObservationV1')
      && !fullRenderBounds.includes('projectZenBonsaiGrowthNode')
      && fullRenderBounds.includes('maximumMotionReserveBounds')
      && sakuraRenderBranchLayer.includes('SAKURA_TERMINAL_PAINT_METRICS')
      && sakuraRenderBranchLayer.includes('requireSakuraRenderPlanV1')
      && sakuraRenderBranchLayer.includes('resolveSakuraRenderPlanRecordPoseV1')
      && !sakuraRenderBranchLayer.includes('projectZenBonsaiGrowthNode')
      && !sakuraRenderBranchLayer.includes('shouldRenderZenBonsaiGrowthNode')
      && pixiBonsaiRenderer.includes('requireSakuraRenderPlanV1')
      && pixiBonsaiRenderer.includes('resolveSakuraRenderPlanRecordPoseV1')
      && !pixiBonsaiRenderer.includes('projectZenBonsaiGrowthNode')
      && !pixiBonsaiRenderer.includes('shouldRenderZenBonsaiGrowthNode')
      && pixiBonsaiBranchRigMotionPolicy.includes(
        'shouldBakePixiBonsaiRenderPlanSubtree',
      )
      && pixiBonsaiBranchRigMotionPolicy.includes(
        'collectPixiBonsaiRenderPlanRigStats',
      )
      && !pixiBonsaiBranchRigMotionPolicy.includes('projectZenBonsaiGrowthNode')
      && !pixiBonsaiBranchRigMotionPolicy.includes('shouldRenderZenBonsaiGrowthNode')
      && !pixiBonsaiBranchRigMotionPolicy.includes('shouldBakePixiBonsaiBranchSubtree')
      && bonsaiSceneSnapshot.includes('resolvedRenderPlan.bakeSignature')
      && bonsaiSceneSnapshot.includes(
        'ZEN_BONSAI_MAIN_SCENE_RENDER_PLAN_SURFACE_SIZE_MISMATCH',
      )
      && bonsaiSceneSnapshot.includes(
        'ZEN_BONSAI_MAIN_SCENE_RENDER_PLAN_CLIP_MISMATCH',
      )
      && sakuraRenderPaintMetrics.includes('maximumReach: 1.18')
      && sakuraTerminalPresentation.includes('resolveSakuraTerminalPresentationContext'),
    'One immutable Sakura render plan must own projected geometry, life/motion/terminal presentation, and bounds for camera, Canvas2D, and Pixi; backend consumers may not project topology again.',
  );
  assert(
    actualAlphaObservationContract.includes(
      "ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_MODE = 'one-shot'",
    )
      && actualAlphaObservationContract.includes(
        "'tree-only-pre-clip-viewport-device-pixel'",
      )
      && actualAlphaObservationContract.includes(
        "'transient-render-diagnostics-only'",
      )
      && actualAlphaObservationContract.includes(
        'assertSakuraActualAlphaObservationMatchesRequestV1',
      ),
    'Actual-alpha diagnostics must remain one-shot, identity-scoped, tree-only pre-clip evidence and must never become final-framebuffer or durable learning state.',
  );
  assert(
    treeRenderer.includes('useZenBonsaiRenderPlan({')
      && renderPlanMemo.includes('createZenBonsaiRenderPlanV1({')
      && renderPlanMemo.includes('projectionKey')
      && renderPlanMemo.includes('const lifeState = g15 || plume ? null : options.lifeState')
      && renderPlanMemo.includes('const requestedActivation = g15 ? null : options.activationPresentation')
      && renderPlanMemo.includes('plume && samePlumeActivation(activationRef.current, requestedActivation)')
      && treeRenderer.includes('renderPlan: mainRenderPlan')
      && treeRenderer.includes('measureSakuraFullRenderBounds(mainRenderPlan)')
      && treeRenderer.includes('measureZenBonsaiRenderPlanBoundsV1(mainRenderPlan')
      && treeRenderer.includes('isZenBonsaiIntrinsicCanvasRenderPlan(mainRenderPlan)')
      && treeRenderer.includes("fitSource: 'intrinsic-canvas'")
      && treeRenderer.includes('activationPresentation,')
      && treeRenderer.includes('lifeState: bonsaiLifeState')
      && treeRenderer.includes("fitSource: 'maximum-motion-reserve'")
      && treeRenderer.includes('predictedMaximumMotionReserveOverflowPx')
      && !treeRenderer.includes('treeCameraTopology')
      && !classicAnalysisRuntime.includes('treeCameraTopology')
      && !classicHomeRuntime.includes('treeCameraTopology')
      && !classicWorkspaceViewRuntime.includes('treeCameraTopology'),
    'Home and Lab must create the canonical model render plan: Sakura cameras fit the projected paint reserve while Plume and G15 scene-command plans retain intrinsic canvas coordinates without a second camera owner; Plume retains its activation input.',
  );
  assert(
    sakuraRenderer.includes('homeGardenBedGeometry.sceneViewport.width')
      && sakuraRenderer.includes('homeGardenBedGeometry.sceneViewport.height')
      && sakuraRenderer.includes('ctx.clip()')
      && pixiBonsaiRenderer.includes('resolvePixiBonsaiSceneViewportClip')
      && pixiBonsaiRenderer.includes('applyPixiBonsaiSceneViewportClip({')
      && pixiBonsaiRenderer.includes('branchRigRoot.mask = branchRigMask'),
    'Classic Home garden-bed may extend beyond its frame, but Canvas2D and Pixi tree paint must share one explicit scene-viewport clip contract.',
  );
  assert(
    treeRenderer.includes('resolveZenHomeGardenBedCanopyViewport(homeGardenBedGeometry)')
      && treeRenderer.includes('framingViewport:')
      && treeRenderer.includes('viewport: treeViewport')
      && bonsaiSceneSnapshot.includes('resolveZenHomeGardenBedCanopyViewport(resolveZenHomeGardenBedDeviceMesh('),
    'Plume Home canopy expansion must use the shared garden geometry owner for planning and worker surface identity, with the ground plane in the same tree-local coordinates.',
  );
  const [plumeCamera, plumeHomeFraming, plumeProjection, plumeFlowerMaterial, mainWorkerRenderBudget] = await Promise.all([
    read(`${paths.plumeRoot}/ZenBonsaiPlumeCamera.js`),
    read(`${paths.plumeRoot}/ZenBonsaiPlumeHomeFraming.js`),
    read(`${paths.plumeRoot}/annual/render.js`),
    read(`${paths.plumeRoot}/live/flower-material.js`),
    read('src/themes/plugins/zen/runtime/zenMainWorkerRenderBudget.js'),
  ]);
  assert(
    /import\s*\{[^}]*fitZenBonsaiPlumeHomeCamera[^}]*resolveZenBonsaiPlumeHomeOrientation[^}]*\}\s*from\s*['"]\.\/ZenBonsaiPlumeHomeFraming\.js['"]/.test(plumeCamera)
      && countMatches(plumeSources.join('\n'), /export\s+function\s+fitZenBonsaiPlumeHomeCamera\s*\(/g) === 1
      && countMatches(plumeCamera, /\bfitZenBonsaiPlumeHomeCamera\s*\(/g) === 1
      && plumeHomeFraming.includes('ZEN_PLUME_HOME_FRAMING_POLICY')
      && plumeHomeFraming.includes('ZEN_PLUME_HOME_MATURE_HEIGHT_RATIO')
      && plumeHomeFraming.includes('snapshot.scaffoldSegments')
      && plumeHomeFraming.includes('targetHeightRatio:')
      && plumeHomeFraming.includes('envelopeHeightRatio:')
      && plumeHomeFraming.includes('plantingSeam:')
      && treeRenderer.includes('plantingSeam:')
      && !/function\s+fitHomeCanopy\b|reference\.scale/.test(plumeCamera + plumeHomeFraming),
    'Plume Home must use one history-owned HomeFraming policy for mature height and pondward orientation; the camera must not retain a second slot-relative fit or multiplier.',
  );
  assert(
    plumeProjection.includes('export function requireZenCherryCamera(')
      && /camera\.horizontalSign\s*!==\s*1\s*&&\s*camera\.horizontalSign\s*!==\s*-1/.test(plumeProjection)
      && plumeProjection.includes('ZEN_CHERRY_RENDER_CAMERA')
      && plumeProjection.includes('export function projectZenCherryDirection(')
      && /import\s*\{[^}]*projectZenCherryDirection[^}]*\}\s*from/.test(plumeFlowerMaterial)
      && /\bprojectZenCherryDirection\(/.test(plumeFlowerMaterial)
      && plumeRenderPlan.includes('requireZenCherryCamera(camera)')
      && plumeRenderPlan.includes('projection:ZEN_PLUME_RENDER_PROJECTION')
      && !/horizontalSign\s*(?:\?\?|\|\|)/.test(plumeProjection + plumeCamera + plumeHomeFraming),
    'Plume point and blossom-axis projection must share an explicit signed camera contract carried by the canonical worker render plan; missing orientation may not silently default.',
  );
  assert(
    countMatches(mainWorkerRenderBudget, /export\s+const\s+ZEN_HOME_BONSAI_FULL_PIXEL_RATIO_CAP\s*=/g) === 1
      && /resolveZenMainBonsaiWorkerRenderBudget\s*=\s*[\s\S]*?ZEN_HOME_BONSAI_FULL_PIXEL_RATIO_CAP/.test(mainWorkerRenderBudget)
      && /resolveZenMainWorkerRenderBudget\s*=\s*[\s\S]*?pixelRatioCap:\s*preset\s*===\s*ZEN_QUALITY_MODES\.FULL\s*\?\s*ZEN_HOME_BONSAI_FULL_PIXEL_RATIO_CAP/.test(mainWorkerRenderBudget)
      && /import\s*\{\s*ZEN_HOME_BONSAI_FULL_PIXEL_RATIO_CAP,?\s*\}\s*from\s*['"]\.\.\/zenMainWorkerRenderBudget\.js['"]/.test(classicRuntimeConfig)
      && /resolveZenClassicBonsaiPixelRatioCap\s*\([\s\S]*?return\s+homeEmbedded\s*\?\s*ZEN_HOME_BONSAI_FULL_PIXEL_RATIO_CAP/.test(classicRuntimeConfig)
      && !/(?:const|let)\s+ZEN_HOME_BONSAI_FULL_PIXEL_RATIO_CAP\s*=/.test(classicRuntimeConfig),
    'The Home bonsai full-quality DPR cap must have one budget owner consumed by both Main worker allocation and Classic workspace canvas sizing; a second local cap may not silently downsample Plume.',
  );

  const [
    bonsaiDebugPanel,
    bonsaiUnlockProgression,
    bonsaiLifeState,
    bonsaiGrowthProjection,
    bonsaiCultivationPolicy,
    bonsaiCultivationLedger,
    bonsaiPresentationPolicy,
  ] = await Promise.all([
    read(paths.bonsaiDebugPanel),
    read(paths.bonsaiUnlockProgression),
    read(paths.bonsaiLifeState),
    read(paths.bonsaiGrowthProjection),
    read(paths.bonsaiCultivationPolicy),
    read(paths.bonsaiCultivationLedger),
    read(paths.bonsaiPresentationPolicy),
  ]);

  assert(
    bonsaiUnlockProgression.includes('bonsaiRelease: snapshot.bonsaiRelease')
      && bonsaiUnlockProgression.includes('DEBUG_PROGRESSION_PREVIEW')
      && bonsaiUnlockProgression.includes('READ_ONLY')
      && !bonsaiUnlockProgression.includes('daysTracked:')
      && !bonsaiUnlockProgression.includes('protectedVisitCount:')
      && !bonsaiUnlockProgression.includes('registeredSiteDomains:'),
    `${paths.bonsaiUnlockProgression} must project release age without fabricating habit evidence.`,
  );
  assert(
    bonsaiLifeState.includes('export const normalizeZenBonsaiLifeState')
      && bonsaiGrowthProjection.includes("from './ZenBonsaiLifeState.js'")
      && !bonsaiGrowthProjection.includes("from './ZenBonsaiLifecycle.js'"),
    'Renderer growth projection must consume the narrow bonsai life-state contract.',
  );
  assert(
    bonsaiCultivationPolicy.includes('const rawGrowthScore = bonsaiRelease')
      && bonsaiCultivationPolicy.includes('smoothstep01(bonsaiRelease.releaseRatio)')
      && bonsaiCultivationPolicy.includes('releaseDriven: bonsaiRelease !== null'),
    `${paths.bonsaiCultivationPolicy} must let canonical bonsaiRelease own structural maturity.`,
  );
  assert(
    bonsaiCultivationLedger.includes('structuralGrowthAuthoritative')
      && bonsaiCultivationLedger.includes('cultivationState?.releaseDriven === true'),
    `${paths.bonsaiCultivationLedger} must cap vigor without delaying release-authorized structure.`,
  );
  assert(
    bonsaiPresentationPolicy.includes("LAB_PREVIEW: 'lab_preview'")
      && bonsaiPresentationPolicy.includes("DEBUG_PROGRESSION_PREVIEW: 'debug_progression_preview'"),
    `${paths.bonsaiPresentationPolicy} must keep Lab and Main progression previews explicit and ephemeral.`,
  );
  assert(
    bonsaiDebugPanel.includes('label="렌더 성장도"')
      && bonsaiDebugPanel.includes('min={50}')
      && bonsaiDebugPanel.includes('label="개화도"')
      && !classicHomeRuntime.includes('forcedGrowthPercent')
      && !bonsaiDebugOverrides.includes('ForcedLifeState'),
    'Home growth diagnostics must expose the Plume domain through the explicit read-only target preview, never an independent durable growth authority.',
  );

  assert(
    modelCatalog.includes("PLUME: 'plume'")
      && modelCatalog.includes("G15_4: 'g15_4'")
      && modelCatalog.includes("CLASSIC2: 'classic2'")
      && modelCatalog.includes("CLASSIC: 'classic'")
      && modelCatalog.includes("VNEXT: 'vnext'")
      && modelCatalog.includes("role: ZEN_BONSAI_MODEL_ROLES.PRODUCTION")
      && modelCatalog.includes("role: ZEN_BONSAI_MODEL_ROLES.COMPARISON")
      && modelCatalog.includes("role: ZEN_BONSAI_MODEL_ROLES.RESEARCH")
      && modelCatalog.includes("displayName: 'Main · Plume Sakura'")
      && modelCatalog.includes("displayName: 'Comparison · G15.4 Sakura'")
      && modelCatalog.includes("displayName: 'Comparison · Classic2'")
      && modelCatalog.includes("displayName: 'Comparison · Classic'")
      && modelCatalog.includes("displayName: 'Research · vNext'")
      && modelCatalog.includes('requireZenBonsaiModelId')
      && modelCatalog.includes('requireZenBonsaiModelAdmission')
      && modelCatalog.includes('resolveZenBonsaiDefaultModelId'),
    `${paths.modelCatalog} must be the single strict owner of production, comparison, and research model roles.`,
  );
  assert(
    !/return\s+ZEN_BONSAI_MODEL_IDS\.(?:CLASSIC|VNEXT)[^;]*;\s*\/\/.*fallback/iu.test(modelCatalog)
      && !/unknown[^\n]*(?:plume|g15_4|classic|classic2|vnext)/iu.test(modelCatalog),
    `${paths.modelCatalog} must reject unknown ids and must never substitute a comparison or research model for Plume.`,
  );

  assert(
    classic2LineageModel.includes('treeIdentityFingerprint')
      && classic2LineageModel.includes('treeFingerprint')
      && classic2LineageModel.includes("status: 'selected'")
      && classic2LineageModel.includes("candidateAdmission: 'all_parent_causal'")
      && classic2LineageModel.includes("habitTopologyEffect: 'none'")
      && !classic2LineageModel.includes("status: 'retired'"),
    `${paths.classic2LineageModel} must record every parent-causal candidate without habit-driven branch retirement.`,
  );
  assert(
    trunkPass.includes('node.trunkArcStartNorm = Number(span.arcStartNorm)')
      && trunkPass.includes('node.trunkArcEndNorm = Number(span.arcEndNorm)')
      && scaffoldArcStationPlan.includes(
        "'sakura_scaffold_root_arc_attachment_v1'",
      )
      && scaffoldPass.includes(
        'scaffoldRoot.scaffoldArcAttachment = createSakuraScaffoldRootArcAttachment',
      )
      && classic2CandidateGraphContract.includes('const TRUNK_DESCRIPTOR_KEYS')
      && classic2CandidateGraphContract.includes("'classic2_macro_lineage_graph_v2'")
      && classic2CandidateGraphContract.includes("'trunkGuideShapeId'")
      && classic2CandidateGraphContract.includes("'trunkArcStart'")
      && classic2CandidateGraphContract.includes("'trunkArcEnd'")
      && classic2LineageModel.includes('validateZenBonsaiClassic2CandidateDescriptor')
      && classic2LineageModel.includes("fail('CANDIDATE_TRUNK_ARC_INCOMPLETE'")
      && classic2LineageModel.includes("fail('CANDIDATE_TRUNK_ARC_DISCONNECTED'")
      && classic2LineageModel.includes("fail('STATE_CANDIDATE_GRAPH_INVALID'")
      && classic2CandidateGraphContract.includes(
        'ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_NODE_BUDGET = 2400',
      )
      && classic2LineageModel.includes(
        'ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_NODE_BUDGET',
      )
      && classic2LineageModel.includes(
        'ZEN_BONSAI_CLASSIC2_PHYSICAL_TRAVERSAL_BUDGET = 2448',
      )
      && classic2LineageModel.includes(
        'physicalNodeIds.size > ZEN_BONSAI_CLASSIC2_PHYSICAL_TRAVERSAL_BUDGET',
      )
      && classic2LineageModel.includes(
        'ordered.length > ZEN_BONSAI_CLASSIC2_LINEAGE_CANDIDATE_BUDGET',
      )
      && classic2LineageModel.includes('const macroRootDescriptor = {')
      && classic2LineageModel.includes('physicalTrunkSpanCount: trunkRecords.length')
      && classic2LineageModel.includes('RENDER_BINDING_BRAND.add(renderBinding)')
      && classic2LineageModel.includes('attachment.stationId !== scaffoldRootId')
      && !classic2LineageModel.includes('trunkArcStart: null')
      && classic2DevelopmentModel.includes('TRUNK_ARC_PACING_REFERENCE')
      && classic2DevelopmentModel.includes(
        'ZEN_BONSAI_CLASSIC2_TRUNK_ARC_REFERENCE_SEGMENTS',
      )
      && classic2DevelopmentModel.includes(
        '(descriptor.trunkArcStart + descriptor.trunkArcEnd) * 0.5',
      )
      && classic2DevelopmentModel.includes('resolvePhysicalTrunkLineagePresentation')
      && classic2DevelopmentModel.includes('requireZenBonsaiClassic2LineageRenderBinding')
      && classic2LineageRuntime.includes('renderBinding')
      && !bonsaiProfileAggregateStorageContract.includes('renderBinding'),
    'Classic2 must persist one macro trunk, cap the logical graph at 2,400 candidates, and independently cap render-only physical traversal at 2,448 nodes.',
  );
  assert(
    classic2CandidateGraphContract.includes(
      'export const validateZenBonsaiClassic2CandidateGraph =',
    )
      && classic2CandidateGraphContract.includes('if (rootIds.length !== 1) return null;')
      && classic2CandidateGraphContract.includes('const expectedChildIdsByNode = new Map(')
      && classic2CandidateGraphContract.includes(
        'const expectedChildIds = expectedChildIdsByNode.get(nodeId);',
      )
      && classic2CandidateGraphContract.includes('const pending = [rootNodeId];')
      && classic2CandidateGraphContract.includes('if (visited.has(nodeId)) return null;')
      && classic2CandidateGraphContract.includes('pending.push(childIds[index]);')
      && classic2CandidateGraphContract.includes(
        'visited.size !== nodeIds.length',
      )
      && classic2CandidateGraphContract.includes(
        'resolveZenBonsaiClassic2CandidateGraphRootNodeId',
      )
      && classic2CandidateGraphContract.includes(
        'resolveZenBonsaiClassic2CandidateGraphFingerprint',
      )
      && classic2LineageModel.includes(
        'validateZenBonsaiClassic2CandidateGraph(candidateGraph)',
      )
      && classic2LineageModel.includes(
        'resolveZenBonsaiClassic2CandidateGraphRootNodeId(candidateGraph)',
      )
      && classic2LineageModel.includes(
        'resolveZenBonsaiClassic2CandidateGraphFingerprint(',
      ),
    'Classic2 candidate validation and fingerprinting must cover one rooted, reverse-edge-exact, acyclic, fully reachable role hierarchy.',
  );
  assert(
    classic2DevelopmentModel.includes('const resolveTrunkExtensionFrontierArc =')
      && classic2DevelopmentModel.includes('const resolveTrunkExtensionProfile =')
      && classic2DevelopmentModel.includes('const integrateTo = (arcPosition) =>')
      && classic2DevelopmentModel.includes(
        'trunkExtensionProfile.resolveSpan(trunkArcStart, trunkArcEnd)',
      )
      && classic2DevelopmentModel.includes(
        'trunkExtensionFrontierArc: trunkExtensionProfile.frontierArc',
      )
      && classic2DevelopmentModel.includes('trunkIntegratedExtension: lineageEnabled')
      && classic2DevelopmentModel.includes(
        '? trunkExtensionProfile.integratedExtension',
      ),
    'Classic2 physical trunk extension must project one continuous global-arc frontier and additive integral instead of span-local growth intervals.',
  );
  assert(
    trunkMacroLineageContract.includes(
      "'sakura_trunk_macro_render_attestation_v1'",
    )
      && trunkMacroLineageContract.includes(
        'export const resolveSakuraTrunkPhysicalGeometryFingerprint =',
      )
      && trunkMacroLineageContract.includes(
        'export const createSakuraTrunkMacroRenderAttestation =',
      )
      && sakuraTopologyGenerator.includes(
        'root.trunkMacroRenderAttestation = createSakuraTrunkMacroRenderAttestation({',
      )
      && sakuraTopologyGenerator.includes(
        'physicalTrunkSpans: resolveSakuraTrunkMacroPhysicalGeometrySpansV1(trunkPathPlan)',
      )
      && classic2LineageModel.includes(
        'const resolvePhysicalTrunkGeometryAttestation = ({',
      )
      && classic2LineageModel.includes(
        'physicalTrunkGeometryFingerprint: physicalTrunkGeometry.geometryFingerprint',
      )
      && classic2LineageModel.includes(
        'export const requireZenBonsaiClassic2LineageRenderBindingForTopology =',
      )
      && classic2LineageModel.includes(
        "fail('RENDER_BINDING_PHYSICAL_NODE_COVERAGE_MISMATCH')",
      )
      && classic2LineageModel.includes(
        "fail('RENDER_BINDING_TRUNK_GUIDE_MISMATCH')",
      )
      && classic2LineageModel.includes(
        "fail('RENDER_BINDING_TRUNK_GEOMETRY_MISMATCH')",
      )
      && classic2LineageModel.includes(
        "fail('RENDER_BINDING_NODE_MAPPING_MISMATCH', record.nodeId)",
      )
      && classic2DevelopmentModel.includes(
        'requireZenBonsaiClassic2LineageRenderBindingForTopology(',
      )
      && classic2DevelopmentModel.includes('lineageRenderBinding,')
      && classic2DevelopmentModel.includes('topology,'),
    'Classic2 projection must attest the exact current physical topology, guide, trunk geometry, node coverage, and logical mapping before consuming a render binding.',
  );
  assert(
    classicAnalysisRuntime.includes(
      'lineageRenderBinding: classic2LineageRuntime.renderBinding',
    )
      && classicAnalysisRuntime.includes('woodClockPolicy: classic2WoodClockPolicy')
      && classic2GrowthSnapshotMatrix.includes(
        'prepareZenBonsaiClassic2LineageCandidate({',
      )
      && classic2GrowthSnapshotMatrix.includes(
        'preparedCandidate: classic2PreparedCandidate',
      )
      && classic2GrowthSnapshotMatrix.includes(
        'lineageRenderBinding: classic2PreparedCandidate.renderBinding',
      )
      && classic2GrowthSnapshotMatrix.includes(
        'woodClockPolicy: ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES.PERSISTED_HISTORY',
      )
      && classic2LineageDistributionAudit.includes(
        'preparedCandidate: candidate.preparedCandidate',
      )
      && classic2LineageDistributionAudit.includes(
        'lineageRenderBinding: candidate.preparedCandidate.renderBinding',
      )
      && classic2LineageDistributionAudit.includes(
        'woodClockPolicy: ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES.PERSISTED_HISTORY',
      ),
    'Every active Classic2 lineage projection owner and diagnostic must carry its prepared render binding and explicit wood-clock policy.',
  );
  assert(
    !/from\s+['"][^'"]*vnext/i.test(classic2LineageModel)
      && !/from\s+['"][^'"]*vnext/i.test(classic2LineageScoringPolicy)
      && !/from\s+['"][^'"]*vnext/i.test(classic2DevelopmentModel)
      && !/from\s+['"][^'"]*vnext/i.test(classic2LineageRuntime),
    'Classic2 production lineage must not import the vNext research runtime as a parallel truth source.',
  );
  assert(
    classic2LineageScoringPolicy.includes("'classic2_candidate_score_v1'")
      && classic2LineageScoringPolicy.includes("'classic2_apical_resource_features_v1'")
      && classic2LineageScoringPolicy.includes("'candidate_graph_and_canonical_history'")
      && classic2LineageScoringPolicy.includes('apicalContinuity')
      && classic2LineageScoringPolicy.includes('localClearance')
      && classic2LineageScoringPolicy.includes('resourceHistoryMismatchPenalty')
      && !/Date\.now|Math\.random|localStorage|indexedDB|chrome\.storage/.test(
        classic2LineageScoringPolicy,
      ),
    `${paths.classic2LineageScoringPolicy} must remain a deterministic Classic2-owned development-observation seam.`,
  );
  assert(
    classic2DevelopmentModel.includes(
      "ZEN_BONSAI_CLASSIC2_WOOD_PRESENTATION_POLICY_VERSION = 'classic2_wood_presentation_v1'",
    )
      && classic2DevelopmentModel.includes(
        'resolveZenBonsaiClassic2LineagePresentationSchedule(normalizedLineageState)',
      )
      && classic2DevelopmentModel.includes('ZEN_BONSAI_CLASSIC2_TRUNK_MASS_PRESENTATION_KNOTS')
      && classic2DevelopmentModel.includes('girthPresentationAge')
      && classic2DevelopmentModel.includes('naturalGirthAge')
      && classic2DevelopmentModel.includes('trunkMassScale')
      && classic2DevelopmentModel.includes("PERSISTED_HISTORY: 'persisted_history'")
      && classic2DevelopmentModel.includes("EPHEMERAL_SCRUB: 'ephemeral_scrub'"),
    `${paths.classic2DevelopmentModel} must own the release V1 Classic2 lineage-to-wood presentation seam.`,
  );
  assert(
    classic2DevelopmentModel.includes(
      'resolvedWoodClockPolicy === ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES.EPHEMERAL_SCRUB',
    )
      && classic2DevelopmentModel.includes(
        'Math.min(currentLifeGrowth, normalizedLineageState.maxObservedGrowth)',
      )
      && classic2DevelopmentModel.includes(': normalizedLineageState.maxObservedGrowth'),
    `${paths.classic2DevelopmentModel} must keep persisted-history Main time separate from bounded ephemeral scrub time.`,
  );
  assert(
    classic2GrowthExperienceContract.includes('classic2_growth_experience_release_v1')
      && classic2GrowthExperienceContract.includes('ZEN_BONSAI_CLASSIC2_GROWTH_CHECKPOINTS')
      && classic2GrowthExperienceContract.includes('rootLengthRatio')
      && classic2GrowthExperienceContract.includes('rootWidthRatio')
      && classic2GrowthExperienceContract.includes('rootBaseToTrunkRatio')
      && classic2GrowthExperienceContract.includes('blossomPresentation')
      && classic2GrowthExperienceContract.includes('fullRatio')
      && classic2GrowthExperienceContract.includes('activationPixelDelta'),
    `${paths.classic2GrowthExperienceContract} must own the measurable root/nebari, wood, carrier, blossom, and activation target envelopes.`,
  );
  assert(
    activationPresentationModel.includes('createZenBonsaiActivationPresentation')
      && activationPresentationModel.includes('resolveZenBonsaiActivationPresentationSignal')
      && bonsaiExperienceModel.includes('activationPresentation')
      && bonsaiRenderSystem.includes('resolveZenBonsaiExperienceModel({')
      && bonsaiRenderSystem.includes(
        'activationPresentation: experience.presentation.activationPresentation',
      )
      && classicHomeRuntime.includes('resolveZenBonsaiDebugForcedActivationPresentation(')
      && classicHomeRuntime.includes('bonsaiRenderSystem.activationPresentation,')
      && classicHomeRuntime.includes('activationPresentation: debugActivationPresentation')
      && bonsaiDebugOverrides.includes('if (forcedActivationPercent === null)')
      && bonsaiDebugOverrides.includes('return livePresentation')
      && bonsaiDebugOverrides.includes('return createZenBonsaiActivationPresentation({')
      && !bonsaiDebugOverrides.includes('localStorage')
      && !bonsaiDebugOverrides.includes('chrome.storage')
      && !bonsaiDebugOverrides.includes('ZenThemeModelState')
      && bonsaiSceneSnapshot.includes('activationBakeSignature')
      && activationPresentationModel.includes('resolveZenBonsaiActivationBakePresentation')
      && pixiBonsaiRenderer.includes(
        'activationPresentation: resolveZenBonsaiActivationBakePresentation(',
      )
      && sakuraRenderBranchLayer.includes('resolveSakuraActivationBloomStage'),
    'Current activation must use one ephemeral ExperienceModel source, an optional render-only debug projection, then the scene -> shared Sakura presentation path.',
  );
  const [homeDebugWorkspace, bonsaiTargetModel] = await Promise.all([
    read('src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx'),
    read('src/themes/plugins/zen/bonsai/state/ZenBonsaiTargetModel.js'),
  ]);
  assert(
    homeDebugWorkspace.includes('const bonsaiDebugPreviewAvailable = BUILD_INCLUDE_DEBUG_TOOLS')
      && homeDebugWorkspace.includes('&& !bonsaiFirstVisionPresentation')
      && homeDebugWorkspace.includes('&& !mainPresentationInteractionLocked')
      && homeDebugWorkspace.includes('&& !zenMainCaptureProfile')
      && homeDebugWorkspace.includes('projectZenBonsaiDebugLifecycleInput(bonsaiLifecycleFrameInput.input, bonsaiDebugPreview)')
      && homeDebugWorkspace.includes('&& bonsaiDebugPreview.activationPercent === null')
      && homeDebugWorkspace.includes('buildZenBonsaiMaterializationInputSignature(bonsaiLifecycleInput)')
      && bonsaiTargetModel.includes('resolveZenBonsaiDebugLifePreview(')
      && bonsaiDebugOverrides.includes('BUILD_INCLUDE_DEBUG_TOOLS')
      && bonsaiDebugOverrides.includes('ZEN_BONSAI_PRESENTATION_MODES.DEBUG_PROGRESSION_PREVIEW')
      && bonsaiDebugOverrides.includes('ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES.READ_ONLY')
      && bonsaiDebugOverrides.includes('ZEN_BONSAI_DEBUG_LIFE_PREVIEW_CONTRACT_INVALID')
      && !/localStorage|chrome\.storage|indexedDB|ZenThemeModelState/.test(bonsaiDebugOverrides),
    'Home growth/bloom diagnostics must be debug-only exact read-only materializations, excluded from First Vision, locked scenes and named captures, with no persistence owner.',
  );
  assert(
    /const sceneSignature = \[[\s\S]*activationRuntimeSignature,\s*activationBakeSignature,/.test(
      bonsaiSceneSnapshot,
    ),
    `${paths.bonsaiSceneSnapshot} scene dispatch signature must subsume the activation bake cohort.`,
  );
  assert(
    sakuraRenderBranchLayer.includes('deferBranchSagToRuntime = false')
      && pixiBonsaiRenderer.includes('deferBranchSagToRuntime: true')
      && pixiBonsaiRenderer.includes('resolvePixiBonsaiRuntimeBranchSag(scene)'),
    'Pixi must defer branch sag during texture bake and apply life/imprint/activation sag once at runtime.',
  );
  assert(
    !/activationPresentation/i.test(classic2DevelopmentModel)
      && !/activationPresentation/i.test(classic2LineageModel)
      && !/activationPresentation/i.test(classic2LineageRuntime)
      && !/activationPresentation/i.test(bonsaiProfileAggregateModel)
      && !/activationPresentation/i.test(bonsaiProfileAggregateRepository),
    'Ephemeral activation presentation must not enter Classic2 wood, lineage identity, or persistence.',
  );
  assert(
    bonsaiProfileAggregateStorageContract.includes(
      "ZEN_BONSAI_PROFILE_AGGREGATE_CONTRACT = 'zen_bonsai_profile_aggregate_v1'",
    )
      && bonsaiProfileAggregateStorageContract.includes(
        'validateZenBonsaiProfileAggregateStorageValue',
      )
      && classic2IdentityContract.includes(
        'resolveZenBonsaiClassic2TreeIdentityFingerprint',
      )
      && classic2CandidateGraphContract.includes(
        "'classic2_macro_lineage_graph_v2'",
      )
      && classic2CandidateGraphContract.includes(
        'validateZenBonsaiClassic2CandidateDescriptor',
      )
      && classic2LineageModel.includes(
        "from '../../contracts/ZenBonsaiClassic2IdentityContract.js'",
      )
      && classic2LineageModel.includes(
        "from '../../contracts/ZenBonsaiClassic2CandidateGraphContract.js'",
      )
      && bonsaiProfileAggregateStorageContract.includes(
        "from '../../../../themes/plugins/zen/contracts/ZenBonsaiClassic2CandidateGraphContract.js'",
      )
      && !classic2LineageModel.includes('LINEAGE_CANDIDATE_DESCRIPTOR_KEYS')
      && !bonsaiProfileAggregateStorageContract.includes('CLASSIC2_DESCRIPTOR_KEYS')
      && bonsaiProfileAggregateModel.includes(
        "from '../contracts/ZenBonsaiClassic2IdentityContract.js'",
      )
      && bonsaiProfileAggregateModel.includes('candidateGraphContract')
      && bonsaiProfileGenerationGenesis.includes('candidateGraphContract')
      && bonsaiProfileGenerationGenesis.includes(
        'createInitialZenBonsaiProfileGenerationAggregate',
      )
      && bonsaiProfileGenerationGenesis.includes('lineageState: null')
      && bonsaiProfileAggregateModel.includes('profileEpoch')
      && bonsaiProfileAggregateModel.includes('activeIdentityFingerprint')
      && bonsaiProfileAggregateModel.includes('lineageState')
      && bonsaiProfileAggregateRepository.includes('AGGREGATE_CAS_MAX_ATTEMPTS')
      && bonsaiProfileAggregateRepository.includes('verifyOnly: true')
      && bonsaiProfileAggregateRepository.includes('normalizeCasLatestSnapshot(casResult)')
      && bonsaiProfileAggregateRepository.includes('ZEN_BONSAI_PROFILE_AGGREGATE_CAS_RETRY_EXHAUSTED')
      && bonsaiProfileAggregateRepository.includes('compareAndSetBonsaiProfileAggregate')
      && bonsaiProfileAggregateRepository.includes('getBonsaiProfileAggregateSnapshot')
      && bonsaiProfileAggregateRepository.includes('expectedProfileEpoch')
      && bonsaiProfileAggregateRepository.includes('updateActiveLineageState')
      && classic2LineageRuntime.includes('resolvedRepository.updateActiveLineageState')
      && zenThemeModelStateContract.includes(
        'BONSAI_PROFILE_AGGREGATE: ZEN_BONSAI_PROFILE_AGGREGATE_MODEL_STATE_KEY',
      )
      && zenThemeModelStateContract.includes("owner: 'ZenBonsaiProfileAggregateRepository'")
      && !zenThemeModelStateContract.includes('BONSAI_CLASSIC2_LINEAGE_STATE')
      && !zenThemeModelStateContract.includes('zen_bonsai_classic2_lineage_state_v1')
      && zenThemeModelState.includes('compareAndSetBonsaiProfileAggregate(options)')
      && zenThemeModelState.includes('this.modelStateStore.compareAndSetValueWithProfileEpoch(')
      && zenThemeModelState.includes('ZEN_BONSAI_PROFILE_AGGREGATE_EPOCH_READ_REQUIRED')
      && zenThemeModelState.includes('const snapshot = await this.getBonsaiProfileAggregateSnapshot()')
      && zenThemeModelState.includes('rejectCasOwnedDirectWrite(normalizedEntries)')
      && !zenThemeModelState.includes('compareAndSetBonsaiClassic2LineageState')
      && zenModelRepository.includes('ZenModelRepositoryCore')
      && zenModelRepositoryCore.includes('compareAndSetBonsaiProfileAggregate(options)')
      && !zenModelRepositoryCore.includes('compareAndSetBonsaiClassic2LineageState')
      && modelStateRepository.includes('compareAndSetValueWithProfileEpoch(key, options)')
      && modelStateRepository.includes('initializeProfileGeneration(profileEpoch, options)')
      && modelStateRepository.includes('resetForProfileEpoch(resetId, options)')
      && modelStateStore.includes('async compareAndSetEntryWithProfileEpoch(key, options = null)')
      && modelStateStore.includes('async initializeProfileGeneration(profileEpoch, options = null)')
      && modelStateStore.includes(
        "from '../../../themes/zen/ZenBonsaiProfileAggregateStorageContract.js'",
      )
      && !bonsaiProfileAggregateRepository.includes('bootstrapProfileAggregate(')
      && !bonsaiProfileAggregateResource.includes('bootstrapProfileAggregate(')
      && !bonsaiProfileAggregateResource.includes('pristineInitialSnapshot')
      && !zenModelRepositoryCore.includes('initializeBonsaiProfileGeneration(')
      && !zenThemeModelState.includes('initializeBonsaiProfileGeneration(')
      && !zenThemeModelState.includes('pristineInitialSnapshot')
      && modelStateStore.includes('async resetForProfileEpoch(resetId, options = null)'),
    'Classic2 active identity and lineage must share one typed profile aggregate and bounded CAS seam.',
  );
  assert(
    classic2LineageModel.includes(
      "ZEN_BONSAI_CLASSIC2_LINEAGE_CONTRACT = 'classic2_development_lineage_release_v1'",
    )
      && classic2LineageModel.includes('candidateCarrierMetadata')
      && classic2LineageModel.includes('candidateCarrierFingerprint')
      && classic2LineageModel.includes('GENERATOR_CARRIER_DRIFT_DETECTED')
      && !/migrat|legacy|previous_lineage|policyCutover|reopenedDecision/i.test(
        classic2LineageModel,
      )
      && !/migrat|legacy|policyCutover|reopenedDecision/i.test(
        bonsaiProfileAggregateRepository,
      )
      && !/policy_migration|migrateLineagePolicy/i.test(classic2LineageRuntime),
    'Classic2 durable Main must accept one exact release contract without schema or policy migration paths.',
  );
  assert(
    !bonsaiProfileAggregateRepository.includes('updateBonsaiClassic2LineageState')
      && !bonsaiProfileAggregateRepository.includes('setLineageState(')
      && !zenThemeModelState.includes('updateBonsaiClassic2LineageState')
      && !zenThemeModelState.includes('setBonsaiClassic2LineageState')
      && !zenModelRepository.includes('updateBonsaiClassic2LineageState')
      && !bonsaiProfileAggregateResource.includes('localStorage')
      && !bonsaiAuthoringDraft.includes('localStorage')
      && bonsaiAuthoringDraft.includes('applyDraftToMain')
      && bonsaiAuthoringDraft.includes('commitActiveIdentity')
      && !modelStateRepository.includes('updateValue(key, updater)')
      && !modelStateStore.includes('async updateEntry(key, updater)'),
    'Classic2 aggregate ownership must not retain localStorage or the retired lineage updater chain.',
  );
  assert(
    classicAnalysisRuntime.includes('useZenBonsaiClassic2LineageRuntime')
      && classicAnalysisRuntime.includes('requireLineage: true')
      && classicAnalysisRuntime.includes('classic2LineageRuntime.ready')
      && classicAnalysisRuntime.includes(
        'resolveZenBonsaiClassic2WoodClockPolicyForLineageMode(classic2LineageMode)',
      )
      && !classicHomeRuntime.includes('classic2WoodClockPolicy:')
      && !classicExperimentRuntime.includes('classic2WoodClockPolicy:'),
    `${paths.classicAnalysisRuntime} must gate Classic2 projection on the canonical lineage runtime.`,
  );
  assert(
    classicRuntimeConfig.includes('resolveZenClassicHomeBonsaiLineageMode')
      && classicRuntimeConfig.includes('resolveZenClassicExperimentBonsaiLineageMode')
      && classicRuntimeConfig.includes('resolveZenBonsaiModelForSurface')
      && classicRuntimeConfig.includes('ZEN_BONSAI_MODEL_SURFACES.HOME')
      && classicRuntimeConfig.includes('ZEN_BONSAI_MODEL_SURFACES.EXPERIMENT')
      && classic2LineageRuntimeMode.includes(
        'resolveZenBonsaiClassic2WoodClockPolicyForLineageMode',
      )
      && classic2LineageRuntimeMode.includes(
        'ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES.PERSISTED_HISTORY',
      )
      && classic2LineageRuntimeMode.includes(
        'ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES.EPHEMERAL_SCRUB',
      )
      && classicRuntimeConfig.includes(
        'HOME_BONSAI_GROWTH_MODEL = ZEN_BONSAI_MODEL_IDS.PLUME',
      )
      && !classicRuntimeConfig.includes('normalizeZenBonsaiClassicGrowthModelId')
      && classicHomeRuntime.includes('isZenBonsaiEphemeralPresentationScene')
      && classicHomeRuntime.includes('ephemeralPresentationScene: ephemeralBonsaiPresentationScene')
      && classicExperimentRuntime.includes('resolveZenClassicExperimentBonsaiLineageMode()')
      && experimentTab.includes(
        'useState(ZEN_BONSAI_MODEL_IDS.PLUME)',
      )
      && experimentTab.includes(
        'setBonsaiGrowthModel(ZEN_BONSAI_MODEL_IDS.PLUME)',
      ),
    'Plume must own Home and Experiment defaults while Classic2 comparison mode remains the sole owner of Classic2 wood time.',
  );
  assert(
    zenRosterRepository.includes('repository.getValue(')
      && !zenRosterRepository.includes('bootstrapValue(')
      && zenKoiRosterMemoryRuntime.includes('ZEN_KOI_ROSTER_MEMORY_HYDRATION_FAILED')
      && zenKoiRosterMemoryRuntime.includes('ZEN_KOI_ROSTER_MEMORY_PERSIST_FAILED')
      && zenKoiRosterMemoryRuntime.includes('ZEN_KOI_ROSTER_MEMORY_CLEAR_FAILED')
      && zenKoiRosterMemoryRuntime.includes('throw runtimeError')
      && !zenKoiRosterMemoryRuntime.includes('console.warn')
      && !zenKoiRosterMemoryRuntime.includes('warnZenRosterMemory'),
    'Zen koi roster memory must cold-read without write-on-read bootstrap and fail loudly on durable I/O errors.',
  );
  assert(
    sakuraRenderer.includes('const resolveNebariGeometrySeed = (topology, potModel) =>')
      && sakuraRenderer.includes('const resolveNebariSurfaceSeed = (geometrySeed, growthProjection = null) =>')
      && sakuraRenderer.includes('export const resolveNebariSeedPlan = ({')
      && sakuraRenderer.includes('const { geometrySeed, surfaceSeed } = resolveNebariSeedPlan({')
      && sakuraRenderer.includes('seed: geometrySeed,')
      && sakuraRenderer.includes('seed: surfaceSeed,')
      && sakuraRenderer.includes('const rootSpread = smoothstepRange(lineagedRoot ? girthProgress : progress')
      && sakuraRenderer.includes('const rootMass = smoothstepRange(girthProgress')
      && /if \(renderBackLayer && !skipPot\) \{[\s\S]*renderSakuraPot\([\s\S]*drawSakuraNebari\(/.test(
        sakuraRenderer,
      )
      && /if \(renderFrontLayer && !skipPot\) \{\s*drawGlazedPotFrontOverlay\(/.test(
        sakuraRenderer,
      )
      && !sakuraRenderer.includes('drawNebariTrunkFlare'),
    'Shared Sakura rendering must own one girth-clocked nebari geometry, separate immutable geometry/surface seeds, and BACK-root/FRONT-pot layering.',
  );
  assert(
    classicHomeRuntime.includes('const bonsaiRenderReady = (')
      && classic2LineageRuntime.includes('const materializationReady = (() => {')
      && classic2LineageRuntime.includes('Number.isSafeInteger(state?.stateRevision)')
      && classic2LineageRuntime.includes(
        "throw new Error('ZEN_BONSAI_CLASSIC2_LINEAGE_STATE_REVISION_INVALID')",
      )
      && classicHomeTopologyRuntime.includes(
        'modelMaterializationReady: usesDirectTopology',
      )
      && classicHomeRuntime.includes(
        'homeTopologyRuntime.modelMaterializationReady === true',
      )
      && classicExperimentRuntime.includes(
        'analysisRuntime.modelMaterializationReady !== true',
      )
      && classicHomeRuntime.includes('const bonsaiMaterializationKey = useMemo(() => {')
      && classicHomeRuntime.includes('const rendererIdentity = preparedBonsaiMaterialization || retainedRendererIdentityRef.current')
      && classicHomeRuntime.includes('const retainedRendererIdentityRevisionRef = useRef(null)')
      && classicHomeRuntime.includes('retainedRendererIdentityRevisionRef.current = workspaceState.identityRevision')
      && classicHomeRuntime.includes('retainedRendererIdentityRef.current.sceneCommitKey === presentationSceneCommitKey')
      && classicHomeRuntime.includes('retainedRendererIdentityRef.current.inputSignature === bonsaiLifecycleInputSignature')
      && classicHomeRuntime.includes('retainedRendererIdentityRevisionRef.current === workspaceState.identityRevision')
      && classicHomeRuntime.includes('const canvasPresentationIdentity = preparedBonsaiMaterialization')
      && classicHomeRuntime.includes('bonsaiFrameAck?.sceneCommitKey === canvasPresentationIdentity.sceneCommitKey')
      && classicHomeRuntime.includes('bonsaiFrameAck?.inputSignature === canvasPresentationIdentity.inputSignature')
      && classicHomeRuntime.includes('=== canvasPresentationIdentity.bonsaiMaterializationKey')
      && classicHomeRuntime.includes('const retainedAckCanvasRef = useRef(null)')
      && classicHomeRuntime.includes('const retainedAckTreeIdentityRef = useRef(null)')
      && classicHomeRuntime.includes('retainedAckCanvasRef.current === canvasRef.current')
      && classicHomeRuntime.includes('bonsaiFrameAck.sceneCommitKey === presentationSceneCommitKey')
      && classicHomeRuntime.includes('retainedAckTreeIdentityRef.current === workspaceState.activeIdentityFingerprint')
      && classicHomeRuntime.includes('enableMainRender: mainRendererLifetimeEnabled')
      && classicHomeRuntime.includes('&& isTabActive !== false')
      && classicHomeRuntime.includes('&& (preparedBonsaiMaterialization !== null || animateRetainedModelScene)')
      && classicHomeRuntime.includes('homeTopologyRuntime.modelProjectionPending === true')
      && classicHomeRuntime.includes('&& homeTopologyRuntime.modelReady === true')
      && classicHomeRuntime.includes('&& bonsaiCanvasPaintVisible')
      && classicHomeRuntime.includes('submittedScene.profileEpoch === workspaceState.profileEpoch')
      && classicHomeRuntime.includes('useLayoutEffect(() => {\n        if (preparedBonsaiMaterialization !== null)')
      && classicHomeRuntime.includes('suppressMainRenderSceneSync: (')
      && classicHomeRuntime.includes('isTabActive === false || preparedBonsaiMaterialization === null')
      && classicHomeRuntime.includes('mainCanvasPresentationReady: bonsaiCanvasPresentationReady')
      && classicHomeRuntime.includes('mainCanvasPaintVisible: bonsaiCanvasPaintVisible')
      && classicViewport.includes('data-main-canvas-presentation-ready=')
      && classicViewport.includes('data-main-canvas-paint-visible=')
      && classicViewport.includes('opacity: resolvedMainCanvasPaintVisible ? 1 : 0'),
    `${paths.classicHomeRuntime} must keep exact current readiness separate from retained ACK paint and same-profile pending-model animation, while re-gating scene or tree changes on the exact bonsai materialization ACK.`,
  );

  assert(
    passContextFactory.includes('buildTrunkPassInput')
      && passContextFactory.includes('buildScaffoldPassInput')
      && passContextFactory.includes('buildTwigPassInput'),
    `${paths.passContextFactory} must expose all three pass input builders.`,
  );

  if (failMessages.length > 0) {
    failMessages.forEach((message) => console.error(`[zen-arch-check] ${message}`));
    process.exit(1);
    return;
  }

  console.log('[zen-arch-check] PASS: Zen bonsai architecture guards are satisfied.');
};

main().catch((error) => {
  console.error('[zen-arch-check] Unexpected error:', error);
  process.exit(1);
});

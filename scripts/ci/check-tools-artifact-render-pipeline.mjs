#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@babel/parser';

import {
  PROTECTION_CANONICAL_ARTIFACT_CATALOG,
  PROTECTION_CANONICAL_ARTIFACT_ID_LIST,
} from '../../src/domains/protection/catalog/artifactFamilyCatalog.js';
import {
  ARTIFACT_DISCLOSURE_FAMILY_ORDER,
} from '../../src/domains/progression/policy/artifactDisclosurePolicy.js';
import {
  CANONICAL_ARTIFACT_NON_RELEASE_CHILD_ROLES,
  CANONICAL_ARTIFACT_RUNTIME_BINDINGS,
} from '../../src/domains/protection/runtime/canonicalArtifactRuntimeBinding.js';
import {
  TOOLS_ARTIFACT_DEFINITIONS,
  TOOLS_ARTIFACT_WIDGET_TYPES,
} from '../../src/themes/core/tools/artifacts.js';
import {
  getThemeSurfaceDescriptorList,
} from '../../src/themes/core/surfaceDescriptor.js';
import { ZEN_ARTIFACT_SCENE_FACTORIES } from '../../src/themes/plugins/zen/presentation/artifacts/engine/zenArtifactDescriptor.js';

const rootDir = process.cwd();
const failures = [];

const requiredFiles = Object.freeze([
  'src/apps/dashboard/tabs/tools/ARTIFACTS.md',
  'src/apps/dashboard/tabs/tools/components/ArtifactRenderer.jsx',
  'src/themes/core/tools/ARTIFACT_RENDER_PIPELINE.md',
  'src/themes/core/tools/ArtifactRenderStage.jsx',
  'src/themes/core/tools/useArtifactPresentationCommit.js',
  'src/themes/core/tools/artifactStageGeometry.js',
  'src/themes/core/tools/artifactGalleryPreparation.js',
  'src/themes/plugins/zen/presentation/artifacts/engine/zenArtifactModules.js',
  'src/themes/core/tools/artifactMotionBudget.js',
  'src/themes/core/tools/artifactRenderContext.js',
  'src/themes/core/tools/useArtifactRenderChannels.js',
  'src/themes/core/artifacts/runtime/useArtifactSimulationController.js',
  'src/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js',
  'src/themes/plugins/zen/widgets/tools/ARTIFACT_WIDGETS.md',
  'src/themes/plugins/zen/widgets/tools/recipes/zenFurinRuntimeRecipe.js',
  'src/themes/plugins/zen/widgets/tools/recipes/zenShishiOdoshiRuntimeRecipe.js',
  'src/themes/plugins/zen/widgets/tools/useZenArtifactRenderChannels.js',
  'src/apps/dashboard/tabs/tools/components/ArtifactControlRowInput.jsx',
  'src/apps/dashboard/tabs/tools/components/ArtifactControlGroupDisclosure.jsx',
]);

const artifactFamilyDashboardOwnerFiles = Object.freeze({
  veil: 'src/apps/dashboard/hooks/artifactSettings/useVeilArtifactSettingsFamily.js',
  lens: 'src/apps/dashboard/hooks/artifactSettings/useLensArtifactSettingsFamily.js',
  barrier: 'src/apps/dashboard/hooks/artifactSettings/useBarrierArtifactSettingsFamily.js',
  gate: 'src/apps/dashboard/hooks/artifactSettings/useGateArtifactSettingsFamily.js',
  brake: 'src/apps/dashboard/hooks/artifactSettings/useBrakeArtifactSettingsFamily.js',
  flare: 'src/apps/dashboard/hooks/artifactSettings/useFlareArtifactSettingsFamily.js',
  echo: 'src/apps/dashboard/hooks/useProtectionEchoArtifactControl.js',
});

const artifactFamilyCardOwnerFiles = Object.freeze({
  veil: 'src/apps/dashboard/tabs/tools/artifactCards/buildVeilCard.jsx',
  lens: 'src/apps/dashboard/tabs/tools/artifactCards/buildLensCard.jsx',
  barrier: 'src/apps/dashboard/tabs/tools/artifactCards/buildBarrierCard.jsx',
  gate: 'src/apps/dashboard/tabs/tools/artifactCards/buildGateCard.jsx',
  brake: 'src/apps/dashboard/tabs/tools/artifactCards/buildBrakeCard.jsx',
  flare: 'src/apps/dashboard/tabs/tools/artifactCards/buildSentinelFlareCard.jsx',
  echo: 'src/apps/dashboard/tabs/tools/artifactCards/buildMemoryPurgeCard.jsx',
});

// This one released child observes Settings policy. Every other released child
// retains exact state + editable-handler coverage below.
const artifactReadOnlyDashboardChildren = Object.freeze({
  flare: Object.freeze(['sentinelFlare']),
});

const themeArtifactWidgets = Object.freeze([
  Object.freeze({
    themeId: 'zen',
    descriptor: 'src/themes/plugins/zen/surfaceDescriptor.js',
    descriptorBinding: 'zenThemeSurfaceDescriptor',
    manifest: 'src/themes/plugins/zen/manifest.js',
    adapter: 'useZenArtifactRenderChannels',
    files: Object.freeze([
      {
        widgetType: 'Artifact_Lens',
        file: 'src/themes/plugins/zen/widgets/tools/Shoji.jsx',
        loader: "Artifact_Lens: './widgets/tools/Shoji.jsx'",
      },
      {
        widgetType: 'Artifact_Veil',
        file: 'src/themes/plugins/zen/widgets/tools/Enso.jsx',
        loader: "Artifact_Veil: './widgets/tools/Enso.jsx'",
      },
      {
        widgetType: 'Artifact_Monolith',
        file: 'src/themes/plugins/zen/widgets/tools/Ishidouro.jsx',
        loader: "Artifact_Monolith: './widgets/tools/Ishidouro.jsx'",
      },
      {
        widgetType: 'Artifact_Gate',
        file: 'src/themes/plugins/zen/widgets/tools/ShishiOdoshi.jsx',
        loader: "Artifact_Gate: './widgets/tools/ShishiOdoshi.jsx'",
      },
      {
        widgetType: 'Artifact_Lethe',
        file: 'src/themes/plugins/zen/widgets/tools/GreatWave.jsx',
        loader: "Artifact_Lethe: './widgets/tools/GreatWave.jsx'",
      },
      {
        widgetType: 'Artifact_SentinelFlare',
        file: 'src/themes/plugins/zen/widgets/tools/Furin.jsx',
        loader: "Artifact_SentinelFlare: './widgets/tools/Furin.jsx'",
      },
    ]),
  }),
  Object.freeze({
    themeId: 'entropy',
    descriptor: 'src/themes/plugins/entropy/surfaceDescriptor.js',
    descriptorBinding: 'entropyThemeSurfaceDescriptor',
    manifest: 'src/themes/plugins/entropy/manifest.js',
    adapter: 'useEntropyArtifactPresentation',
    adapterFile: 'src/themes/plugins/entropy/widgets/tools/useEntropyArtifactPresentation.js',
    frameFile: 'src/themes/plugins/entropy/widgets/tools/EntropyArtifactFrame.jsx',
    iconsFile: 'src/themes/plugins/entropy/widgets/tools/ArtifactIcons.jsx',
    files: Object.freeze([
      {
        widgetType: 'Artifact_Lens',
        file: 'src/themes/plugins/entropy/widgets/tools/Artifacts/ApertureRack.jsx',
        loader: "Artifact_Lens: './widgets/tools/Artifacts/ApertureRack.jsx'",
      },
      {
        widgetType: 'Artifact_Veil',
        file: 'src/themes/plugins/entropy/widgets/tools/Artifacts/ScrimEngine.jsx',
        loader: "Artifact_Veil: './widgets/tools/Artifacts/ScrimEngine.jsx'",
      },
      {
        widgetType: 'Artifact_Brake',
        file: 'src/themes/plugins/entropy/widgets/tools/Artifacts/InertialDamper.jsx',
        loader: "Artifact_Brake: './widgets/tools/Artifacts/InertialDamper.jsx'",
      },
      {
        widgetType: 'Artifact_Monolith',
        file: 'src/themes/plugins/entropy/widgets/tools/Artifacts/Monolith.jsx',
        loader: "Artifact_Monolith: './widgets/tools/Artifacts/Monolith.jsx'",
      },
      {
        widgetType: 'Artifact_Gate',
        file: 'src/themes/plugins/entropy/widgets/tools/Artifacts/EventHorizon.jsx',
        loader: "Artifact_Gate: './widgets/tools/Artifacts/EventHorizon.jsx'",
      },
      {
        widgetType: 'Artifact_Lethe',
        file: 'src/themes/plugins/entropy/widgets/tools/Artifacts/Lethe.jsx',
        loader: "Artifact_Lethe: './widgets/tools/Artifacts/Lethe.jsx'",
      },
      {
        widgetType: 'Artifact_SentinelFlare',
        file: 'src/themes/plugins/entropy/widgets/tools/Artifacts/SentinelFlare.jsx',
        loader: "Artifact_SentinelFlare: './widgets/tools/Artifacts/SentinelFlare.jsx'",
      },
    ]),
  }),
  Object.freeze({
    themeId: 'matrix',
    descriptor: 'src/themes/plugins/matrix/surfaceDescriptor.js',
    descriptorBinding: 'matrixThemeSurfaceDescriptor',
    manifest: 'src/themes/plugins/matrix/manifest.js',
    adapter: 'useArtifactRenderChannels',
    files: Object.freeze([
      {
        widgetType: 'Artifact_Lens',
        file: 'src/themes/plugins/matrix/widgets/tools/Artifacts/GlyphPrism.jsx',
        loader: "Artifact_Lens: './widgets/tools/Artifacts/GlyphPrism.jsx'",
      },
      {
        widgetType: 'Artifact_Veil',
        file: 'src/themes/plugins/matrix/widgets/tools/Artifacts/CipherScrim.jsx',
        loader: "Artifact_Veil: './widgets/tools/Artifacts/CipherScrim.jsx'",
      },
      {
        widgetType: 'Artifact_Brake',
        file: 'src/themes/plugins/matrix/widgets/tools/Artifacts/MatrixPulseDamper.jsx',
        loader: "Artifact_Brake: './widgets/tools/Artifacts/MatrixPulseDamper.jsx'",
      },
      {
        widgetType: 'Artifact_Monolith',
        file: 'src/themes/plugins/matrix/widgets/tools/Artifacts/Monolith.jsx',
        loader: "Artifact_Monolith: './widgets/tools/Artifacts/Monolith.jsx'",
      },
      {
        widgetType: 'Artifact_Gate',
        file: 'src/themes/plugins/matrix/widgets/tools/Artifacts/EventHorizon.jsx',
        loader: "Artifact_Gate: './widgets/tools/Artifacts/EventHorizon.jsx'",
      },
      {
        widgetType: 'Artifact_Lethe',
        file: 'src/themes/plugins/matrix/widgets/tools/Artifacts/Lethe.jsx',
        loader: "Artifact_Lethe: './widgets/tools/Artifacts/Lethe.jsx'",
      },
      {
        widgetType: 'Artifact_SentinelFlare',
        file: 'src/themes/plugins/matrix/widgets/tools/Artifacts/SentinelFlare.jsx',
        loader: "Artifact_SentinelFlare: './widgets/tools/Artifacts/SentinelFlare.jsx'",
      },
    ]),
  }),
  Object.freeze({
    themeId: 'cyberpunk',
    descriptor: 'src/themes/plugins/cyberpunk/surfaceDescriptor.js',
    descriptorBinding: 'cyberpunkThemeSurfaceDescriptor',
    manifest: 'src/themes/plugins/cyberpunk/manifest.js',
    adapter: 'useArtifactRenderChannels',
    files: Object.freeze([
      {
        widgetType: 'Artifact_Lens',
        file: 'src/themes/plugins/cyberpunk/widgets/tools/Artifacts/VisorPrism.jsx',
        loader: "Artifact_Lens: './widgets/tools/Artifacts/VisorPrism.jsx'",
      },
      {
        widgetType: 'Artifact_Veil',
        file: 'src/themes/plugins/cyberpunk/widgets/tools/Artifacts/GhostMesh.jsx',
        loader: "Artifact_Veil: './widgets/tools/Artifacts/GhostMesh.jsx'",
      },
      {
        widgetType: 'Artifact_Brake',
        file: 'src/themes/plugins/cyberpunk/widgets/tools/Artifacts/CyberpunkInertiaUnit.jsx',
        loader: "Artifact_Brake: './widgets/tools/Artifacts/CyberpunkInertiaUnit.jsx'",
      },
      {
        widgetType: 'Artifact_Monolith',
        file: 'src/themes/plugins/cyberpunk/widgets/tools/Artifacts/CyberpunkMonolith.jsx',
        loader: "Artifact_Monolith: './widgets/tools/Artifacts/CyberpunkMonolith.jsx'",
      },
      {
        widgetType: 'Artifact_Gate',
        file: 'src/themes/plugins/cyberpunk/widgets/tools/Artifacts/CyberpunkEventHorizon.jsx',
        loader: "Artifact_Gate: './widgets/tools/Artifacts/CyberpunkEventHorizon.jsx'",
      },
      {
        widgetType: 'Artifact_Lethe',
        file: 'src/themes/plugins/cyberpunk/widgets/tools/Artifacts/CyberpunkLethe.jsx',
        loader: "Artifact_Lethe: './widgets/tools/Artifacts/CyberpunkLethe.jsx'",
      },
      {
        widgetType: 'Artifact_SentinelFlare',
        file: 'src/themes/plugins/cyberpunk/widgets/tools/Artifacts/CyberpunkSentinelFlare.jsx',
        loader: "Artifact_SentinelFlare: './widgets/tools/Artifacts/CyberpunkSentinelFlare.jsx'",
      },
    ]),
  }),
  ...[
    { themeId: 'clinical', prefix: 'Clinical', folder: '', icons: 'ArtifactIcons.jsx', frame: 'ClinicalArtifactInstrument.jsx', bodies: [
      ['Artifact_Lens', 'ClinicalOpticalAssay'], ['Artifact_Veil', 'ClinicalSterileShield'],
      ['Artifact_Brake', 'ClinicalFlowDamper'], ['Artifact_Monolith', 'ClinicalIsolationCabinet'],
      ['Artifact_Gate', 'ClinicalExaminationAirlock'], ['Artifact_SentinelFlare', 'ClinicalWarningBeacon'],
      ['Artifact_Lethe', 'ClinicalSpecimenArchive'],
    ] },
    { themeId: 'scp', prefix: 'SCP', folder: 'Artifacts/', icons: 'SCPArtifactIcons.jsx', frame: 'SCPArtifactFrame.jsx', bodies: [
      ['Artifact_Lens', 'SCPInspectionArray'], ['Artifact_Veil', 'SCPRedactedDossier'],
      ['Artifact_Brake', 'SCPRestraintClamp'], ['Artifact_Monolith', 'SCPContainmentCapsule'],
      ['Artifact_Gate', 'SCPBlastAirlock'], ['Artifact_SentinelFlare', 'SCPWarningBeacon'],
      ['Artifact_Lethe', 'SCPMemoryCartridge'],
    ] },
  ].map(({ themeId, prefix, folder, icons, frame, bodies }) => Object.freeze({
    themeId,
    descriptor: `src/themes/plugins/${themeId}/surfaceDescriptor.js`,
    descriptorBinding: `${themeId}ThemeSurfaceDescriptor`,
    manifest: `src/themes/plugins/${themeId}/manifest.js`,
    adapter: `use${prefix}ArtifactPresentation`,
    adapterFile: `src/themes/plugins/${themeId}/widgets/tools/use${prefix}ArtifactPresentation.js`,
    frameFile: `src/themes/plugins/${themeId}/widgets/tools/${frame}`,
    iconsFile: `src/themes/plugins/${themeId}/widgets/tools/${icons}`,
    files: Object.freeze(bodies.map(([widgetType, body]) => Object.freeze({
      widgetType,
      file: `src/themes/plugins/${themeId}/widgets/tools/${folder}${body}.jsx`,
      loader: `${widgetType}: './widgets/tools/${folder}${body}.jsx'`,
    }))),
  })),
]);

const absolute = (relativePath) => path.resolve(rootDir, relativePath);

const addFailure = (message) => {
  failures.push(message);
};

const readUtf8 = async (relativePath) => fs.readFile(absolute(relativePath), 'utf8');

const collectFilesUnder = async (relativeDir) => {
  const directory = absolute(relativeDir);
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    addFailure(`${relativeDir}: cannot read directory for artifact coordinate contract scan: ${error.message}`);
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFilesUnder(relativePath));
      continue;
    }
    if (entry.isFile()) {
      files.push(relativePath.replaceAll(path.sep, '/'));
    }
  }
  return files;
};

const ensureFilesExist = async () => {
  const files = [
    ...requiredFiles,
    ...themeArtifactWidgets.flatMap((theme) => [theme.descriptor, theme.manifest]),
  ];
  for (const file of [...new Set(files)]) {
    try {
      await fs.access(absolute(file));
    } catch {
      addFailure(`${file}: required artifact pipeline file is missing.`);
    }
  }
};

const requireIncludes = (source, relativePath, snippets) => {
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      addFailure(`${relativePath}: missing required artifact pipeline marker: ${snippet}`);
    }
  }
};

const forbidIncludes = (source, relativePath, snippets) => {
  for (const snippet of snippets) {
    if (source.includes(snippet)) {
      addFailure(`${relativePath}: forbidden artifact pipeline marker is present: ${snippet}`);
    }
  }
};

const forbidPattern = (source, relativePath, pattern, message) => {
  if (pattern.test(source)) {
    addFailure(`${relativePath}: ${message}`);
  }
};

const requireAnyIncludes = (source, relativePath, snippets, message) => {
  if (snippets.some((snippet) => source.includes(snippet))) return;
  addFailure(`${relativePath}: ${message}`);
};

const compareExactIdCoverage = (ownerLabel, actualIds, expectedIds) => {
  const actual = Array.isArray(actualIds) ? actualIds : [];
  const expected = Array.isArray(expectedIds) ? expectedIds : [];
  const missing = expected.filter((artifactId) => !actual.includes(artifactId));
  const unknown = actual.filter((artifactId) => !expected.includes(artifactId));
  const duplicate = actual.find((artifactId, index) => actual.indexOf(artifactId) !== index);
  if (missing.length || unknown.length || duplicate) {
    addFailure(
      `${ownerLabel}: artifact family coverage drifted (missing=${missing.join(',') || 'none'}, unknown=${unknown.join(',') || 'none'}, duplicate=${duplicate || 'none'}).`,
    );
  }
};

const checkCanonicalArtifactFamilyCoverage = async () => {
  const canonicalIds = [...PROTECTION_CANONICAL_ARTIFACT_ID_LIST];
  compareExactIdCoverage(
    'src/domains/protection/catalog/artifactFamilyCatalog.js',
    Object.keys(PROTECTION_CANONICAL_ARTIFACT_CATALOG),
    canonicalIds,
  );
  compareExactIdCoverage(
    'src/domains/protection/runtime/canonicalArtifactRuntimeBinding.js',
    Object.keys(CANONICAL_ARTIFACT_RUNTIME_BINDINGS),
    canonicalIds,
  );
  compareExactIdCoverage(
    'src/themes/core/tools/artifacts.js',
    TOOLS_ARTIFACT_DEFINITIONS.map((definition) => definition.id),
    canonicalIds,
  );
  compareExactIdCoverage(
    'src/domains/progression/policy/artifactDisclosurePolicy.js',
    [...ARTIFACT_DISCLOSURE_FAMILY_ORDER],
    canonicalIds,
  );

  const nonReleaseRoles = new Set(Object.values(CANONICAL_ARTIFACT_NON_RELEASE_CHILD_ROLES));
  canonicalIds.forEach((artifactId) => {
    const definition = PROTECTION_CANONICAL_ARTIFACT_CATALOG[artifactId];
    const binding = CANONICAL_ARTIFACT_RUNTIME_BINDINGS[artifactId];
    if (Object.prototype.hasOwnProperty.call(definition, 'order')) {
      addFailure(
        `src/domains/protection/catalog/artifactFamilyCatalog.js: "${artifactId}" must not own disclosure order.`,
      );
    }

    const releaseChildren = definition.releaseChildren;
    const boundChildren = Object.keys(binding?.children || {});
    const missingChildren = releaseChildren.filter((childId) => !boundChildren.includes(childId));
    if (missingChildren.length) {
      addFailure(
        `src/domains/protection/runtime/canonicalArtifactRuntimeBinding.js: "${artifactId}" is missing release children ${missingChildren.join(', ')}.`,
      );
    }
    boundChildren
      .filter((childId) => !releaseChildren.includes(childId))
      .forEach((childId) => {
        if (!nonReleaseRoles.has(binding.children[childId]?.nonReleaseRole)) {
          addFailure(
            `src/domains/protection/runtime/canonicalArtifactRuntimeBinding.js: non-release child "${artifactId}.${childId}" needs an explicit role.`,
          );
        }
      });
  });

  const cardSchemaFile = 'src/apps/dashboard/tabs/tools/artifactCardSchemas.jsx';
  const cardSchemaSource = await readUtf8(cardSchemaFile);
  const builderMapMatch = cardSchemaSource.match(
    /const TOOLS_ARTIFACT_CARD_SCHEMA_BUILDERS = Object\.freeze\(\{([\s\S]*?)\n\}\);\n\nfunction assertToolsArtifactCardSchemaContract/,
  );
  if (!builderMapMatch) {
    addFailure(`${cardSchemaFile}: canonical card schema builder map could not be located.`);
  } else {
    const builderIds = [...builderMapMatch[1].matchAll(/^  ([a-z][A-Za-z0-9]*): \1CardSchema,/gm)]
      .map((match) => match[1]);
    compareExactIdCoverage(cardSchemaFile, builderIds, canonicalIds);
  }
  for (const artifactId of canonicalIds) {
    const schemaFile = `src/apps/dashboard/tabs/tools/artifactCards/schemas/${artifactId}CardSchema.js`;
    const schemaSource = await readUtf8(schemaFile);
    requireIncludes(schemaSource, schemaFile, [`id: '${artifactId}'`, 'extendDerivedState:', 'buildVisualState:', 'build:']);
    const family = artifactId[0].toUpperCase() + artifactId.slice(1);
    const controllerFile = `src/apps/dashboard/tabs/tools/selectedControllers/Selected${family}ArtifactController.jsx`;
    const controllerSource = await readUtf8(controllerFile);
    requireIncludes(controllerSource, controllerFile, [`../artifactCards/schemas/${artifactId}CardSchema.js`]);
    forbidIncludes(controllerSource, controllerFile, ['buildToolsArtifacts', 'artifactCardSchemas.jsx']);
  }
  for (const localFile of ['selectedControllers/useSelectedArtifactCard.js', 'createToolsSelectedArtifactBuilder.js', 'artifactCardMaterialization.jsx']) {
    const file = `src/apps/dashboard/tabs/tools/${localFile}`;
    forbidIncludes(await readUtf8(file), file, ['buildToolsArtifacts.jsx', 'artifactCardSchemas.jsx']);
  }
};

const checkThemeArtifactWidgetFamilyCoverage = async () => {
  const artifactThemeIds = [];
  for (const descriptor of getThemeSurfaceDescriptorList()) {
    const declaredWidgetTypes = TOOLS_ARTIFACT_WIDGET_TYPES.filter(
      (widgetType) => Object.prototype.hasOwnProperty.call(
        descriptor.widgetLoaders,
        widgetType,
      ),
    );
    artifactThemeIds.push(descriptor.id);
    compareExactIdCoverage(
      `src/themes/plugins/${descriptor.id}/surfaceDescriptor.js`,
      declaredWidgetTypes,
      TOOLS_ARTIFACT_WIDGET_TYPES,
    );
  }
  compareExactIdCoverage(
    'theme artifact render guard configuration',
    themeArtifactWidgets.map((theme) => theme.themeId),
    artifactThemeIds,
  );
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractObjectFreezeBodies = (source, marker) => {
  const bodies = [];
  let searchFrom = 0;
  while (searchFrom < source.length) {
    const markerIndex = source.indexOf(marker, searchFrom);
    if (markerIndex < 0) break;
    const openingBraceIndex = source.indexOf('{', markerIndex + marker.length - 1);
    let depth = 1;
    let cursor = openingBraceIndex + 1;
    while (cursor < source.length && depth > 0) {
      if (source[cursor] === '{') depth += 1;
      if (source[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    if (depth !== 0) return [];
    bodies.push(source.slice(openingBraceIndex + 1, cursor - 1));
    searchFrom = cursor;
  }
  return bodies;
};

const extractArtifactChildKeys = (body, suffix) => (
  [...body.matchAll(new RegExp(
    `^\\s+([A-Za-z][A-Za-z0-9]*): createArtifact[A-Za-z0-9]*Child${suffix}\\(`,
    'gm',
  ))].map((match) => match[1])
);

const checkArtifactDashboardChildCoverage = async () => {
  const canonicalIds = [...PROTECTION_CANONICAL_ARTIFACT_ID_LIST];
  compareExactIdCoverage(
    'artifact dashboard family state/handler owners',
    Object.keys(artifactFamilyDashboardOwnerFiles),
    canonicalIds,
  );
  compareExactIdCoverage(
    'artifact dashboard card owners',
    Object.keys(artifactFamilyCardOwnerFiles),
    canonicalIds,
  );

  for (const artifactId of canonicalIds) {
    const dashboardOwnerFile = artifactFamilyDashboardOwnerFiles[artifactId];
    const cardOwnerFile = artifactFamilyCardOwnerFiles[artifactId];
    const dashboardOwnerSource = await readUtf8(dashboardOwnerFile);
    const cardOwnerSource = await readUtf8(cardOwnerFile);
    const childMapBodies = extractObjectFreezeBodies(
      dashboardOwnerSource,
      'children: Object.freeze({',
    );
    const rangeMap = artifactId === 'lens'
      ? dashboardOwnerSource.match(/const FEATURE_BY_CHILD = Object.freeze\(\{([^}]+)\}\)/u)
      : null;
    if (rangeMap) {
      const keys = Array.from(rangeMap[1].matchAll(/([A-Za-z]+):\s*'[^']+'/gu), match => match[1]);
      compareExactIdCoverage(`${dashboardOwnerFile} range feature map`, keys, PROTECTION_CANONICAL_ARTIFACT_CATALOG[artifactId].releaseChildren);
      const projections = dashboardOwnerSource.match(/children: Object.freeze\(Object.fromEntries\(Object.entries\(FEATURE_BY_CHILD\).map/gu) || [];
      if (projections.length !== 2) addFailure(`${dashboardOwnerFile}: range state and handlers must each exhaust the same feature map.`);
    } else if (childMapBodies.length !== 2) {
      addFailure(`${dashboardOwnerFile}: expected one family state child map and one handler child map.`);
      continue;
    }

    const releaseChildren = PROTECTION_CANONICAL_ARTIFACT_CATALOG[artifactId].releaseChildren;
    const readOnlyChildren = artifactReadOnlyDashboardChildren[artifactId] || [];
    const editableChildren = releaseChildren.filter(childId => !readOnlyChildren.includes(childId));
    if (!rangeMap) compareExactIdCoverage(
      `${dashboardOwnerFile} state children`,
      extractArtifactChildKeys(childMapBodies[0], 'State'),
      releaseChildren,
    );
    if (!rangeMap) compareExactIdCoverage(
      `${dashboardOwnerFile} handler children`,
      extractArtifactChildKeys(childMapBodies[1], 'Handlers'),
      editableChildren,
    );

    if (artifactId === 'lens') {
      // Presentation groups partition the existing released children. Grouping
      // must not omit a setting or duplicate a release catalog in the theme.
      const groups = PROTECTION_CANONICAL_ARTIFACT_CATALOG.lens.releaseChildGroups;
      if (!Array.isArray(groups) || groups.length === 0
        || groups.some(group => !group || typeof group.id !== 'string' || !group.id.trim()
          || !Array.isArray(group.children) || group.children.length === 0)
        || new Set(groups.map(group => group.id)).size !== groups.length) {
        addFailure('Lens releaseChildGroups must declare distinct identities and nonempty child groups.');
      } else {
        const groupedChildren = groups.flatMap(group => group.children);
        compareExactIdCoverage('Lens releaseChildGroups', groupedChildren, releaseChildren);
        if (new Set(groupedChildren).size !== groupedChildren.length) {
          addFailure('Lens presentation groups must include every release child exactly once.');
        }
      }
      const catalogRows = cardOwnerSource.match(
          /\.releaseChildren\.map\(\(childKey\) => buildArtifactRangeControlRowModel\(\{([\s\S]*?)\}\)\)/u,
      );
      if (!catalogRows) {
        addFailure(`${cardOwnerFile}: Lens must render every canonical release child directly as a range row, without filtering the catalog.`);
      } else {
        requireIncludes(cardOwnerSource, cardOwnerFile, ["getCanonicalArtifactDefinition('lens')", 'releaseChildGroups']);
        requireIncludes(catalogRows[1], cardOwnerFile, [
          'childKey,',
          "label: resolveArtifactChildTitle(t, 'lens', childKey)",
          "description: resolveArtifactChildDescription(t, 'lens', childKey)",
          "enabled: resolveArtifactChildConfiguredEnabled(state, 'lens', childKey)",
          "onToggle: requireArtifactChildHandler(lensHandlerChildren, 'lens', childKey, 'toggle')",
        ]);
      }
    }

    for (const childId of releaseChildren) {
      const dashboardKeyMatches = dashboardOwnerSource.match(
        new RegExp(`\\b${escapeRegExp(childId)}\\s*:`, 'g'),
      ) || [];
      if (!rangeMap && dashboardKeyMatches.length < (readOnlyChildren.includes(childId) ? 1 : 2)) {
        addFailure(
          `${dashboardOwnerFile}: release child "${artifactId}.${childId}" must retain its declared state${readOnlyChildren.includes(childId) ? '' : ' and handler'} paths.`,
        );
      }
      if (artifactId !== 'lens' && !cardOwnerSource.includes(`'${childId}'`) && !cardOwnerSource.includes(`"${childId}"`)) {
        addFailure(
          `${cardOwnerFile}: release child "${artifactId}.${childId}" is missing from its card surface.`,
        );
      }
    }
  }

  const flareDashboardOwnerFile = artifactFamilyDashboardOwnerFiles.flare;
  const flareCardOwnerFile = artifactFamilyCardOwnerFiles.flare;
  const flareDashboardOwnerSource = await readUtf8(flareDashboardOwnerFile);
  const flareCardOwnerSource = await readUtf8(flareCardOwnerFile);
  requireIncludes(flareDashboardOwnerSource, flareDashboardOwnerFile, [
    'createArtifactBinaryChildState', 'hasEnabledGoalEnd(nudgeConfig)',
    "isGoalEndEnabled(nudgeConfig, 'site')", "isGoalEndEnabled(nudgeConfig, 'global')",
    'Object.freeze({ site: siteEnabled, global: globalEnabled })', 'children: Object.freeze({})',
  ]);
  forbidIncludes(flareDashboardOwnerSource, flareDashboardOwnerFile, [
    'setNudgeConfig', 'setGoalEndEnabled', 'commitConfig', 'createArtifactBinaryChildHandlers',
    'handleAutoToggle', 'applyFlareConfig', 'nudgeConfig.enabled',
  ]);
  requireIncludes(flareCardOwnerSource, flareCardOwnerFile, [
    'buildArtifactStatusBlockModel', '<FurinControlFeedback', 'goalEnds={sentinelFlareFamily.goalEnds}',
    '<FurinTemporaryPauseControl', 'setSuspended={flareHandlers.setSuspended}',
    'suspended={flareFamily.suspended === true}', 'globallyPaused={flareFamily.globallyPaused === true}',
  ]);
  forbidIncludes(flareCardOwnerSource, flareCardOwnerFile, [
    'buildArtifactBinaryControlRowModel', 'buildArtifactMasterControl', 'onToggle', 'requireArtifactChildHandler',
    'setNudgeConfig', 'setGoalEndEnabled', 'commitConfig', 'applyRecommendation',
  ]);
  const flareControllerFile = 'src/apps/dashboard/tabs/tools/selectedControllers/SelectedFlareArtifactController.jsx';
  forbidIncludes(await readUtf8(flareControllerFile), flareControllerFile, [
    'setNudgeConfig', 'setGoalEndEnabled', 'useArtifactSettingsCommands',
  ]);
  const flareFeedbackFile = 'src/apps/dashboard/tabs/tools/components/FurinControlFeedback.jsx';
  const flareFeedbackSource = await readUtf8(flareFeedbackFile);
  requireIncludes(flareFeedbackSource, flareFeedbackFile, [
    'requireNudgeGoalEnds(goalEnds)', 'enabled !== (goalEnds.site || goalEnds.global)',
    "guidance.navigate('settings', { section: 'protection' })", 'FURIN_TEMPORARY_PAUSE_OWNER_REQUIRED',
    'if (!enabled && !suspended) return null', 'await setSuspended(!suspended)', 'disabled={pending || globallyPaused}',
  ]);
  forbidIncludes(flareFeedbackSource, flareFeedbackFile, [
    'setNudgeConfig', 'setGoalEndEnabled', 'commitConfig', 'applyRecommendation',
    'chrome.storage', 'localStorage', 'settingsCommandBus',
  ]);
  [
    'createArtifactThresholdChild',
    'thresholdMinutes',
    'setThresholdMinutes',
    'thresholdMs',
  ].forEach((token) => {
    if (flareDashboardOwnerSource.includes(token) || flareCardOwnerSource.includes(token)) {
      addFailure(`${flareDashboardOwnerFile}: Furin must not expose independent time-control token ${token}.`);
    }
  });

  const nudgeConfigFile = 'src/domains/settings/config/nudgeConfig.js';
  const nudgeConfigSource = await readUtf8(nudgeConfigFile);
  if (!nudgeConfigSource.includes("Object.hasOwn(canonicalSource, 'thresholdMs')")
    || !nudgeConfigSource.includes("throw new Error('NUDGE_CONFIG_RETIRED_FIELD:thresholdMs')")) {
    addFailure(`${nudgeConfigFile}: current nudge input must explicitly reject the retired Furin threshold field.`);
  }
  if (nudgeConfigSource.includes('delete canonicalSource.thresholdMs')) {
    addFailure(`${nudgeConfigFile}: retired Furin threshold input must not be silently repaired.`);
  }
  if (nudgeConfigSource.includes('thresholdMs: 30 * 60 * 1000')) {
    addFailure(`${nudgeConfigFile}: DEFAULT_NUDGE_SETTINGS must not restore a private Furin time threshold.`);
  }

  const artifactCardSharedFile = 'src/apps/dashboard/tabs/tools/artifactCards/shared.jsx';
  const artifactCardSharedSource = await readUtf8(artifactCardSharedFile);
  [
    'SENTINEL_FLARE_THRESHOLD_OPTIONS',
    'artifact_altar.minutes_short',
    'buildArtifactThresholdControlRowModel',
  ].forEach((token) => {
    if (artifactCardSharedSource.includes(token)) {
      addFailure(`${artifactCardSharedFile}: retired Furin time-preset token ${token} must stay removed.`);
    }
  });

  const recommendationCatalogFile = 'src/domains/protection/catalog/artifactRecommendationCatalog.js';
  const recommendationCatalogSource = await readUtf8(recommendationCatalogFile);
  if (recommendationCatalogSource.includes('thresholdMinutes')) {
    addFailure(`${recommendationCatalogFile}: Flare recommendation must remain ON/OFF-only.`);
  }

  for (const localeFile of [
    'src/i18n/locales/en/tools.json',
    'src/i18n/locales/ko/tools.json',
  ]) {
    const localeSource = await readUtf8(localeFile);
    if (localeSource.includes('"minutes_short": {')) {
      addFailure(`${localeFile}: retired Furin 20/45/90 minute preset copy must stay removed.`);
    }
  }
};

const getQuotedAttribute = (source, attributeName) => {
  const match = source.match(new RegExp(`\\b${attributeName}=(["'])((?:(?!\\1).)*)\\1`));
  return match?.[2] ?? null;
};

const isAbsoluteSvgFilterRegionValue = (value) => (
  typeof value === 'string'
  && /^-?\d+(?:\.\d+)?$/.test(value.trim())
);

const isPercentSvgFilterRegionValue = (value) => (
  typeof value === 'string'
  && /^-?\d+(?:\.\d+)?%$/.test(value.trim())
);

const getSvgFilterRegionValues = (attributes) => (
  ['x', 'y', 'width', 'height'].map((attributeName) => getQuotedAttribute(attributes, attributeName))
);

const checkSvgFilterCoordinateContracts = (source, relativePath) => {
  const filterTagPattern = /<filter\b([\s\S]*?)>/g;
  let match = filterTagPattern.exec(source);
  while (match) {
    const attributes = match[1] || '';
    const usesRegionHelper = attributes.includes('ARTIFACT_SVG_FILTER_REGIONS.');
    const filterId = getQuotedAttribute(attributes, 'id') || 'unnamed';

    if (usesRegionHelper) {
      if (!source.includes('artifactSvgCoordinateSystem.js')) {
        addFailure(`${relativePath}: SVG filter "${filterId}" uses the artifact coordinate helper without importing artifactSvgCoordinateSystem.js.`);
      }
      match = filterTagPattern.exec(source);
      continue;
    }

    const regionValues = getSvgFilterRegionValues(attributes);
    const usesAbsoluteRegion = regionValues.some(isAbsoluteSvgFilterRegionValue);
    const usesPercentRegion = regionValues.some(isPercentSvgFilterRegionValue);
    const filterUnits = getQuotedAttribute(attributes, 'filterUnits');

    if (!filterUnits) {
      addFailure(`${relativePath}: SVG filter "${filterId}" must use ARTIFACT_SVG_FILTER_REGIONS or declare filterUnits explicitly.`);
    }

    if (usesAbsoluteRegion && filterUnits !== 'userSpaceOnUse') {
      addFailure(`${relativePath}: SVG filter "${filterId}" uses absolute region coordinates without filterUnits="userSpaceOnUse".`);
    }

    if (usesPercentRegion && filterUnits !== 'objectBoundingBox') {
      addFailure(`${relativePath}: SVG filter "${filterId}" uses percentage region coordinates without filterUnits="objectBoundingBox".`);
    }

    match = filterTagPattern.exec(source);
  }
};

const checkArtifactSvgCoordinateSystem = async () => {
  const file = 'src/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';
  const source = await readUtf8(file);
  requireIncludes(source, file, [
    'ARTIFACT_SVG_FILTER_UNITS',
    'ARTIFACT_SVG_VIEWBOX_ORIGIN',
    'createArtifactSvgViewBox',
    'createArtifactUserSpaceFilterRegion',
    'createArtifactObjectBoundingBoxFilterRegion',
    'ARTIFACT_SVG_FILTER_REGIONS',
    "userSpaceOnUse: 'userSpaceOnUse'",
    "objectBoundingBox: 'objectBoundingBox'",
  ]);
};

const checkArtifactSvgFilterCoordinateUsage = async () => {
  const files = (await collectFilesUnder('src/themes/plugins'))
    .filter((file) => file.includes('/widgets/tools/'))
    .filter((file) => /\.(?:js|jsx)$/.test(file));

  for (const file of files) {
    const source = await readUtf8(file);
    if (source.includes('<filter')) {
      checkSvgFilterCoordinateContracts(source, file);
    }
  }
};

const checkRendererHandoff = async () => {
  const file = 'src/apps/dashboard/tabs/tools/components/ArtifactRenderer.jsx';
  const source = await readUtf8(file);
  requireIncludes(source, file, [
    'ArtifactRenderStage',
    'buildArtifactRenderContext',
    'artifactRenderContext',
    'shouldAnimate: isEnabled',
    '<ArtifactComponent artifactRenderContext={artifactRenderContext}',
    'getArtifactGalleryWidgetType(systemMode, visualKey)',
    "const retainsScene = widgetName === 'ArtifactGalleryVisual'",
    'managesReadiness={retainsScene}',
    'synchronousPresentation={retainsScene}',
    'useArtifactPresentationCommit(requestedPresentation',
    'return presentation.renderFrame(',
    'onPrepared={retainsScene ? onPrepared : undefined}',
  ]);
  forbidIncludes(source, file, [
    'artifactWidgetProps',
    'Compatibility props stay until non-Zen artifact widgets migrate to artifactRenderContext.',
    '<ResolvedArtifactComponent',
    'useDocumentVisibility',
    'useElementVisibility',
    'documentVisible',
    'inViewport',
    'stageRef',
    'isActive={artifactRenderState',
    'shouldAnimate={artifactRenderState',
    'flushSync',
    'setCommittedPresentation',
  ]);

  const galleryFile = 'src/apps/dashboard/tabs/tools/components/ArtifactGalleryView.jsx';
  const gallerySource = await readUtf8(galleryFile);
  requireIncludes(gallerySource, galleryFile, ['renderFrame={renderFrame}']);
  requireIncludes(gallerySource, galleryFile, [
    'data-artifact-gallery-scene-viewport="true" className="relative min-h-0 w-full flex-1"',
    'data-artifact-gallery-quickbar="true"',
    'className="relative shrink-0 w-full"',
    'role="navigation"',
    "aria-label={resolveLabel('artifact_altar.navigation.label'",
    'data-artifact-gallery-slot-count={navigationSlotCount}',
    'aria-current={isSelected',
    'aria-busy={isPending || isRequested',
    'aria-disabled={isSelectionBlocked',
    'onFocus={handleIntentPreload}',
    'onPointerDown={handleIntentPreload}',
    'data-artifact-gallery-item-label="true"',
    'data-artifact-gallery-locked-slot="true"',
    'data-artifact-workspace-layer="control-rail"',
  ]);
  forbidIncludes(gallerySource, galleryFile, [
    'resolveArtifactNavigationLayout', '--artifact-gallery-indicator-x', '--artifact-gallery-indicator-y',
    'ResizeObserver', 'window.innerWidth', 'window.innerHeight', 'localStorage', 'chrome.storage',
  ]);
  const workspaceCssFile = 'src/apps/dashboard/tabs/tools/components/artifactWorkspace.css';
  requireIncludes(await readUtf8(workspaceCssFile), workspaceCssFile, [
    "[data-artifact-gallery-quickbar='true'] {\n  position: relative;",
    'grid-template-columns: repeat(auto-fit, minmax(78px, 1fr))',
    'min-height: 64px',
    "button[data-artifact-gallery-select-slot]:focus-visible",
    'outline: 2px solid var(--color-accent)',
    "[data-artifact-gallery-item-label='true'] {\n  position: static;\n  display: block;",
    'overflow-wrap: anywhere',
    '@media (prefers-reduced-motion: reduce)',
  ]);
  const controlDockFile = 'src/themes/core/tools/ArtifactControlDock.jsx';
  requireIncludes(await readUtf8(controlDockFile), controlDockFile, [
    'data-artifact-control-dock-scroll="content"', 'overflow-x-hidden overflow-y-auto',
  ]);
  const zenPanelFile = 'src/themes/plugins/zen/widgets/tools/ZenArtifactPanel.jsx';
  requireIncludes(await readUtf8(zenPanelFile), zenPanelFile, [
    'data-artifact-control-garden="true"', 'flex-1 min-h-0 overflow-y-auto',
  ]);
  forbidIncludes(gallerySource, galleryFile, ['committedPlacement', 'onPresentationCommit', 'flushSync']);

  const ownerFile = 'src/themes/core/tools/useArtifactPresentationCommit.js';
  const ownerSource = await readUtf8(ownerFile);
  requireIncludes(ownerSource, ownerFile, ['useLayoutEffect', 'current.request === request', 'frames.candidate?.request === request', 'candidate.submit()', 'ARTIFACT_PRESENTATION_COMMIT_RECEIPT_INVALID']);
  forbidIncludes(ownerSource, ownerFile, ['flushSync']);

  const hostFile = 'src/themes/plugins/zen/widgets/tools/ZenArtifactGalleryVisual.jsx';
  const hostSource = await readUtf8(hostFile);
  requireIncludes(hostSource, hostFile, ['getZenArtifactMaterialKey', 'instance.prepareFrame', 'instance.commitFrame', 'onPrepared(submit)', 'getZenArtifactGalleryGeometry']);
  forbidIncludes(hostSource, hostFile, ['engine.select(', 'instance.select(', 'flushSync', 'onPresentationCommit']);
  requireIncludes(hostSource, hostFile, ['loadZenArtifactGalleryClient()', 'prepared.request === frameRequest']);
  forbidIncludes(hostSource, hostFile, ['createZenArtifactEngine(', "getContext('webgl", 'new Worker(']);
  const clientFile = 'src/themes/plugins/zen/runtime/worker/ZenArtifactWorkerClient.js';
  const clientSource = await readUtf8(clientFile);
  requireIncludes(clientSource, clientFile, ['acquireZenHomeRendererWorkerChannel', 'ZEN_HOME_RENDERER_CHANNEL.ARTIFACTS',
    'transferFromImageBitmap', 'ticket.generation !== generation', 'pause()', 'runRenderLoop']);
  forbidIncludes(clientSource, clientFile, ['new Worker(', "from 'pixi.js'", 'new Renderer(']);
  const compilerFile = 'src/themes/plugins/zen/presentation/artifacts/engine/zenSvgMaterialCompiler.js';
  const compilerSource = await readUtf8(compilerFile);
  forbidIncludes(compilerSource, compilerFile, ["from 'pixi.js'", 'zenPixiWorkerRuntime', 'new Worker(']);

  const admissionFile = 'src/apps/dashboard/tabs/tools/components/SelectedArtifactControllerBoundary.jsx';
  const admissionSource = await readUtf8(admissionFile);
  requireIncludes(admissionSource, admissionFile, ['getArtifactGalleryWidgetType(themeId, visualKey)', 'preloadArtifactGalleryRuntime(themeId, visualKey)']);
  forbidIncludes(admissionSource, admissionFile, ['getToolsArtifactDefinition(artifactId)?.widgetType']);
  const resolutionFile = 'src/themes/core/tools/artifactGalleryRenderer.js';
  const resolutionSource = await readUtf8(resolutionFile);
  requireIncludes(resolutionSource, resolutionFile, ['hasDeclaredThemeWidget']);
  forbidIncludes(resolutionSource, resolutionFile, ['getThemeWidget(']);

  const modulesFile = 'src/themes/plugins/zen/presentation/artifacts/engine/zenArtifactModules.js';
  const modulesSource = await readUtf8(modulesFile);
  requireIncludes(modulesSource, modulesFile, ['loadZenArtifactGalleryClient', 'preloadZenArtifactGalleryModules']);
  forbidIncludes(modulesSource, modulesFile, ['createZenArtifactEngine(', 'createElement(', 'new Renderer(', 'new Application(']);
  const engineFile = 'src/themes/plugins/zen/presentation/artifacts/engine/zenArtifactEngine.js';
  const engineSource = await readUtf8(engineFile);
  requireIncludes(engineSource, engineFile, ['loadZenArtifactSceneFactory']);
  forbidIncludes(engineSource, engineFile, ['const LOADERS =', 'const SCENE_LOADERS =', 'module[ZEN_ARTIFACT_SCENE_FACTORIES']);
  requireIncludes(engineSource, engineFile, ['renderGround(request)', 'createZenKaresansuiHeightfieldRenderer({ renderer })', 'ground?.dispose()']);
  const groundFile = 'src/themes/plugins/zen/presentation/artifacts/karesansui/zenKaresansuiHeightfieldRenderer.js';
  const groundSource = await readUtf8(groundFile);
  forbidIncludes(groundSource, groundFile, ['new OffscreenCanvas(', 'getContext(', 'new Renderer(', 'loseContext(']);
  const workerFile = 'src/themes/plugins/zen/runtime/worker/zenArtifactRendererRuntime.js';
  const workerSource = await readUtf8(workerFile);
  requireIncludes(workerSource, workerFile, ['engine.renderGround(message.ground)', 'ZEN_ARTIFACT_WORKER_NOT_INITIALIZED']);
  forbidIncludes(workerSource, workerFile, ['createZenKaresansuiHeightfieldRenderer(']);
};

// Syntax checks pin ownership and public boundaries, not panel class names or
// an incidental arrangement of controls. Behavioral tests cover state ordering.
const checkSceneAndControlOwnership = async () => {
  const visit = (node, callback) => {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
    callback(node);
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(value => visit(value, callback));
      else visit(child, callback);
    }
  };
  const nodesIn = node => { const nodes = []; visit(node, value => nodes.push(value)); return nodes; };
  const propertyName = node => node?.computed ? node.property?.value : node?.property?.name;
  const callName = node => node?.callee?.type === 'Identifier' ? node.callee.name : propertyName(node?.callee);
  const hasCall = (nodes, name) => nodes.some(node => ['CallExpression', 'OptionalCallExpression'].includes(node.type) && callName(node) === name);
  const hasMember = (nodes, name) => nodes.some(node => ['MemberExpression', 'OptionalMemberExpression'].includes(node.type) && propertyName(node) === name);
  const declaration = (nodes, name) => nodes.find(node => node.type === 'FunctionDeclaration' && node.id?.name === name);
  const load = async file => {
    const source = await readUtf8(file);
    const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
    return { file, source, nodes: nodesIn(ast) };
  };
  const requireSyntax = (condition, owner, reason) => {
    if (!condition) addFailure(`${owner.file}: ${reason}`);
  };
  const presentationOnly = owner => {
    for (const node of owner.nodes) {
      if (node.type === 'ImportDeclaration'
        && /(?:platform\/storage|dbManager|settingsCommandBus|SettingsService)/u.test(node.source.value)) {
        addFailure(`${owner.file}: artifact presentation must consume projections, not import a storage/settings mutation owner.`);
      }
      if (['MemberExpression', 'OptionalMemberExpression'].includes(node.type)
        && (['localStorage', 'indexedDB'].includes(propertyName(node))
          || (propertyName(node) === 'storage' && ['chrome', 'browser'].includes(node.object?.name)))) {
        addFailure(`${owner.file}: artifact presentation must not read or write raw business storage.`);
      }
      if (node.type === 'Identifier' && ['localStorage', 'indexedDB'].includes(node.name)) {
        addFailure(`${owner.file}: artifact presentation must not acquire a browser storage owner.`);
      }
    }
  };
  const noScheduler = owner => {
    for (const name of ['setTimeout', 'setInterval', 'requestAnimationFrame', 'runRenderLoop']) {
      requireSyntax(!hasCall(owner.nodes, name), owner, `scene presentation must share engine frame time; ${name} cannot create another scheduler here.`);
    }
  };

  const base = 'src/themes/plugins/zen/presentation/artifacts/';
  const toolsPolicy = await load('src/themes/core/toolsVisualPolicy.js');
  const themePolicies = toolsPolicy.nodes.find(node => node.type === 'VariableDeclarator'
    && node.id?.name === 'TOOLS_THEME_POLICY_OVERRIDES');
  const zenPolicy = nodesIn(themePolicies).find(node => node.type === 'ObjectProperty' && node.key?.name === 'zen');
  const bodyPolicyDeclarations = toolsPolicy.nodes.filter(node => node.type === 'ObjectProperty'
    && node.key?.name === 'preserveBodyAppearance');
  requireSyntax(bodyPolicyDeclarations.length === 1
    && nodesIn(zenPolicy).includes(bodyPolicyDeclarations[0])
    && bodyPolicyDeclarations[0].value.type === 'BooleanLiteral' && bodyPolicyDeclarations[0].value.value,
  toolsPolicy, 'body appearance preservation must be declared once by the Zen theme policy, outside per-family overrides.');
  const renderStage = await load('src/themes/core/tools/ArtifactRenderStage.jsx');
  requireSyntax(hasMember(renderStage.nodes, 'preserveBodyAppearance'), renderStage,
    'the common stage must consume the declared body appearance policy.');
  requireSyntax(!['themeId', 'systemMode', 'artifactId', 'visualKey'].some(name => hasMember(renderStage.nodes, name)),
    renderStage, 'body appearance policy must not add theme/family identity branches to the common stage.');
  presentationOnly(renderStage);
  const admission = await load(`${base}engine/zenArtifactSceneModules.js`);
  for (const factory of Object.values(ZEN_ARTIFACT_SCENE_FACTORIES)) {
    requireSyntax(admission.nodes.some(node => node.type === 'ArrowFunctionExpression'
      && node.params[0]?.type === 'ObjectPattern'
      && node.params[0].properties.some(property => property.key?.name === factory)
      && node.body.type === 'Identifier' && node.body.name === factory), admission,
    `scene admission must select the named ${factory} capability instead of retaining its module namespace.`);
  }
  for (const [id, factory] of Object.entries(ZEN_ARTIFACT_SCENE_FACTORIES)) {
    const scene = await load(`${base}engine/${id === 'tome-ishi' ? 'zenTomeIshi' : id === 'great-wave' ? 'zenGreatWave'
      : id === 'shishi-odoshi' ? 'zenShishiOdoshi' : `zen${id[0].toUpperCase()}${id.slice(1)}`}Scene.js`);
    requireSyntax(Boolean(declaration(scene.nodes, factory)), scene, 'the canonical scene factory must exist.');
    requireSyntax(!scene.nodes.some(node => node.type === 'Identifier' && node.name === 'preserveBodyAppearance'),
      scene, 'whole-body presentation policy belongs to the common stage, not Worker scene materials.');
    presentationOnly(scene); noScheduler(scene);
    if (id === 'enso') {
      requireSyntax(hasCall(scene.nodes, 'createZenEnsoBrushCompiler') && !hasCall(scene.nodes, 'createZenEnsoRenderer'),
        scene, 'gallery compilation must use the narrow held-brush API, not the document renderer.');
    }
  }

  const brush = await load('src/themes/plugins/zen/presentation/ZenEnsoCanvas.js');
  const brushFunctions = new Map(brush.nodes.filter(node => node.type === 'FunctionDeclaration').map(node => [node.id.name, node]));
  const reached = new Set();
  const inspectBrushCalls = name => {
    if (reached.has(name) || !brushFunctions.has(name)) return;
    reached.add(name);
    for (const node of nodesIn(brushFunctions.get(name))) {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier') inspectBrushCalls(node.callee.name);
    }
  };
  inspectBrushCalls('createZenEnsoBrushCompiler');
  for (const name of ['buildPaper', 'buildStaticSnapshotCacheKey', 'readStaticSnapshotCache', 'writeStaticSnapshotCache', 'createZenEnsoRenderer']) {
    requireSyntax(!reached.has(name), brush, `the gallery brush call graph must not acquire document-only ${name}.`);
  }

  const engine = await load(`${base}engine/zenArtifactEngine.js`);
  requireSyntax(hasCall(engine.nodes, 'loadZenArtifactSceneFactory'), engine, 'preparation must consume the selected factory capability.');
  requireSyntax(engine.nodes.filter(node => node.type === 'CallExpression' && callName(node) === 'runRenderLoop').length === 1,
    engine, 'the engine must retain one render loop.');

  const panel = await load('src/themes/plugins/zen/widgets/tools/ZenArtifactSwitchBand.jsx');
  requireSyntax(hasMember(panel.nodes, 'Control') && hasMember(panel.nodes, 'childKey'),
    panel, 'theme disclosure must retain injected app controls and semantic row identity.');
  const rowModes = ['binary', 'choice', 'level', 'number', 'range'];
  requireSyntax(panel.nodes.some(node => node.type === 'ArrayExpression'
    && node.elements.length === rowModes.length && rowModes.every(mode => node.elements.some(element => element?.value === mode))),
  panel, 'one disclosed row contract must admit all five declared input modes.');
  presentationOnly(panel); noScheduler(panel);
  const rows = await load('src/apps/dashboard/tabs/tools/artifactCards/shared.jsx');
  requireSyntax(rows.nodes.some(node => node.type === 'ObjectProperty' && node.key?.name === 'Control'
    && node.value?.name === 'ArtifactControlRowInput'), rows, 'all row modes must inject the same app-owned input renderer.');
  requireSyntax(rows.nodes.some(node => node.type === 'ObjectProperty' && node.key?.name === 'Control'
    && node.value?.name === 'ArtifactControlGroupDisclosure'), rows, 'row groups must inject the shared app-owned disclosure renderer.');
  for (const owner of [rows, panel]) {
    requireSyntax(owner.nodes.some(node => node.type === 'MemberExpression' && propertyName(node) === 'Control'
      && node.object?.type === 'MemberExpression' && propertyName(node.object) === 'disclosure'),
    owner, 'default and theme row renderers must consume the injected disclosure owner.');
  }
  const group = await load('src/apps/dashboard/tabs/tools/components/ArtifactControlGroupDisclosure.jsx');
  requireSyntax(group.nodes.some(node => node.type === 'JSXOpeningElement' && node.name?.name === 'details')
    && group.nodes.some(node => node.type === 'JSXOpeningElement' && node.name?.name === 'summary'),
  group, 'group disclosure must keep the native keyboard/accessibility owner.');
  presentationOnly(group); noScheduler(group);
  for (const file of Object.values(artifactFamilyCardOwnerFiles)) {
    const card = await load(file);
    for (const call of card.nodes.filter(node => node.type === 'CallExpression'
      && /^buildArtifact(?:Binary|Choice|Level|Number|Range)ControlRowModel$/u.test(callName(node)))) {
      const identity = call.arguments[0]?.properties?.find(node => node.type === 'ObjectProperty' && node.key?.name === 'childKey');
      requireSyntax(Boolean(identity) && (identity.value.type !== 'StringLiteral' || identity.value.value.trim().length > 0),
        card, 'every declared row must supply its stable child identity to the common row owner.');
    }
  }
};

const checkCoreRuntimePolicy = async () => {
  const file = 'src/themes/core/tools/artifactMotionBudget.js';
  const source = await readUtf8(file);
  requireIncludes(source, file, [
    'ARTIFACT_MOTION_BUDGETS',
    'ARTIFACT_FIXED_RENDER_BUDGET',
    "policyId: 'artifact-fixed'",
    'renderBudget: ARTIFACT_FIXED_RENDER_BUDGET',
    'targetFps: 60',
    'simHz: 60',
    'allowHeavyEffects: true',
  ]);
};

const checkSimulationControllerVisibilityPolicy = async () => {
  const file = 'src/themes/core/artifacts/runtime/useArtifactSimulationController.js';
  const source = await readUtf8(file);
  requireIncludes(source, file, [
    'artifactRenderState?.shouldAnimate',
    'budgetAllowsRuntime',
    'runArtifactSimulationLoop',
  ]);
  forbidIncludes(source, file, [
    'useVisibilityGate',
    'useDocumentVisibility',
    'useElementVisibility',
    'shouldAnimateViewport',
    'visibilityGate',
  ]);
};

const checkThemeSurfaceDescriptors = async () => {
  const descriptorMap = Object.fromEntries(
    getThemeSurfaceDescriptorList().map((descriptor) => [descriptor.id, descriptor]),
  );
  for (const theme of themeArtifactWidgets) {
    const descriptor = descriptorMap[theme.themeId];
    const descriptorSource = await readUtf8(theme.descriptor);
    const manifestSource = await readUtf8(theme.manifest);
    requireIncludes(
      descriptorSource,
      theme.descriptor,
      theme.files.map((widget) => widget.loader),
    );
    requireIncludes(manifestSource, theme.manifest, [
      `import { ${theme.descriptorBinding} } from './surfaceDescriptor.js';`,
      `widgets: { loaders: ${theme.descriptorBinding}.widgetLoaders },`,
    ]);
    forbidIncludes(
      manifestSource,
      theme.manifest,
      theme.files.map((widget) => widget.loader),
    );

    if (!descriptor) {
      addFailure(`${theme.descriptor}: runtime surface descriptor is missing.`);
      continue;
    }
    for (const widget of theme.files) {
      const expectedModulePath = widget.loader.match(/:\s*'([^']+)'/u)?.[1] || '';
      if (descriptor.widgetLoaders[widget.widgetType] !== expectedModulePath) {
        addFailure(
          `${theme.descriptor}: ${widget.widgetType} must resolve to ${expectedModulePath}.`,
        );
      }
    }
  }
};

const checkArtifactWidgets = async () => {
  for (const theme of themeArtifactWidgets) {
    for (const widget of theme.files) {
      const source = await readUtf8(widget.file);
      requireIncludes(source, widget.file, [theme.adapter]);
      const motionFile = theme.adapterFile || widget.file;
      const motionSource = theme.adapterFile ? await readUtf8(theme.adapterFile) : source;
      if (theme.adapterFile) requireIncludes(source, widget.file, [`${theme.adapter}(`, `${theme.adapter}.js`]);
      requireAnyIncludes(motionSource, motionFile, [
        'shouldAnimateMotion',
        'shouldAnimateAmbient',
        'shouldAnimateFull',
        'shouldAnimateActiveVisual',
        'motionBudgetMode',
        'useArtifactSimulationController',
      ], 'canonical artifact widgets must derive continuous animation from shared render channels.');
      forbidIncludes(source, widget.file, [
        'useVisibilityGate',
        'useDocumentVisibility',
        'useElementVisibility',
        'documentVisible',
        'inViewport',
        'artifactRenderState?.shouldAnimateMotion',
        'shouldAnimate = artifactRenderState',
        'visualWeight = artifactRenderState',
      ]);
      forbidPattern(
        source,
        widget.file,
        /\b(?:const|let|var)\s+should(?:Animate|Run)\w*\s*=\s*(?:renderChannels\.)?isVisuallyActive\b/,
        'continuous animation eligibility must not be derived from isVisuallyActive; use shouldAnimateMotion/Ambient/Full, shouldAnimateActiveVisual, or the simulation controller.',
      );
      forbidPattern(
        source,
        widget.file,
        /\b(?:const|let|var)\s+should(?:Animate|Run)\w*\s*=\s*renderChannels\.shouldRenderEffects\b/,
        'continuous animation eligibility must not be derived from shouldRenderEffects; use the shared motion budget.',
      );
      if (theme.adapter === 'useArtifactRenderChannels') {
        requireIncludes(source, widget.file, ['artifactRenderContext = null']);
      }
    }
  }
};

const checkThemeAdapters = async () => {
  const file = 'src/themes/plugins/zen/widgets/tools/useZenArtifactRenderChannels.js';
  const source = await readUtf8(file);
  requireIncludes(source, file, ['useArtifactRenderChannels', "systemMode: 'zen'"]);
  for (const theme of themeArtifactWidgets.filter(entry => entry.adapterFile)) {
    const adapterSource = await readUtf8(theme.adapterFile);
    requireIncludes(adapterSource, theme.adapterFile, ['useArtifactRenderChannels']);
    forbidIncludes(adapterSource, theme.adapterFile, [
      'useVisibilityGate', 'useDocumentVisibility', 'useElementVisibility',
      'documentVisible', 'inViewport',
      'requestAnimationFrame', 'setInterval', 'setTimeout', 'localStorage',
      'artifactRenderState?.shouldAnimateMotion', 'shouldAnimate = artifactRenderState',
      'visualWeight = artifactRenderState',
    ]);
    forbidPattern(adapterSource, theme.adapterFile,
      /\b(?:const|let|var)\s+should(?:Animate|Run)\w*\s*=\s*(?:(?:renderChannels|channels)\.)?isVisuallyActive\b/,
      'theme presentation adapters must not manufacture motion permission from static visual state.');
    forbidPattern(adapterSource, theme.adapterFile,
      /\b(?:const|let|var)\s+should(?:Animate|Run)\w*\s*=\s*(?:renderChannels|channels)\.shouldRenderEffects\b/,
      'theme presentation adapters must consume the shared motion budget.');
    for (const file of await collectFilesUnder(`src/themes/plugins/${theme.themeId}/widgets/tools`)) {
      if (!/\.(?:js|jsx)$/.test(file)) continue;
      forbidIncludes(await readUtf8(file), file, [
        'requestAnimationFrame', 'setInterval', 'setTimeout', 'useAnimationFrame',
        'chrome.storage', 'localStorage', 'dbManager', 'useProtocolStore',
        'new Worker', '/plugins/zen/', '/plugins/matrix/', '/plugins/entropy/', '/plugins/cyberpunk/',
      ]);
    }
    const frameSource = await readUtf8(theme.frameFile);
    requireIncludes(frameSource, theme.frameFile, ['createArtifactSvgViewBox']);
    requireAnyIncludes(`${adapterSource}\n${frameSource}`, theme.frameFile,
      ['useArtifactSvgIdScope('], 'the instrument presentation must allocate canonical instance-scoped SVG IDs.');
    const iconsSource = await readUtf8(theme.iconsFile);
    requireIncludes(iconsSource, theme.iconsFile, ['ARTIFACT_ICON_KEY_UNDECLARED']);
    const descriptor = getThemeSurfaceDescriptorList().find(entry => entry.id === theme.themeId);
    const iconPath = `./widgets/tools/${path.basename(theme.iconsFile)}`;
    if (descriptor?.widgetLoaders.ArtifactIcons !== iconPath) {
      addFailure(`${theme.descriptor}: ArtifactIcons must resolve to ${iconPath}.`);
    }
  }
};

const checkZenWidgets = async () => {
  const zenTheme = themeArtifactWidgets.find((theme) => theme.themeId === 'zen');
  for (const widget of zenTheme.files) {
    const source = await readUtf8(widget.file);
    requireIncludes(source, widget.file, ['useZenArtifactRenderChannels']);
    forbidIncludes(source, widget.file, ['useVisibilityGate']);
  }
};

const checkZenSimulationWidgets = async () => {
  for (const file of [
    'src/themes/plugins/zen/widgets/tools/Furin.jsx',
    'src/themes/plugins/zen/widgets/tools/ShishiOdoshi.jsx',
  ]) {
    const source = await readUtf8(file);
    requireIncludes(source, file, [
      'useArtifactSimulationController',
      'renderChannels.runtimeBudget',
      'runtimeBudget: renderChannels.runtimeBudget',
    ]);
  }

  const furinFile = 'src/themes/plugins/zen/widgets/tools/Furin.jsx';
  const furinSource = await readUtf8(furinFile);
  requireIncludes(furinSource, furinFile, [
    'createFurinPhysicsState',
    'resolveFurinSimulationRecipe',
    'stepFurinPhysics',
    'resolveDailyFurinMantra',
  ]);
  forbidIncludes(furinSource, furinFile, [
    'VALID_WIND_DEBUG_MODES',
    'FURIN_MANTRA_POOL',
  ]);

  const furinRecipeFile = 'src/themes/plugins/zen/widgets/tools/recipes/zenFurinRuntimeRecipe.js';
  const furinRecipeSource = await readUtf8(furinRecipeFile);
  requireIncludes(furinRecipeSource, furinRecipeFile, [
    'createFurinPhysicsState',
    'resolveFurinQualityProfile',
    'resolveFurinSimulationRecipe',
    'stepFurinPhysics',
  ]);
  forbidIncludes(furinRecipeSource, furinRecipeFile, [
    'resolveDailyFurinMantra',
    'zenFurinInscriptions.js',
    'FURIN_MANTRA_POOL',
  ]);
  const furinInscriptionsFile = 'src/themes/plugins/zen/widgets/tools/recipes/zenFurinInscriptions.js';
  const furinInscriptionsSource = await readUtf8(furinInscriptionsFile);
  requireIncludes(furinInscriptionsSource, furinInscriptionsFile, [
    'ZEN_FURIN_INSCRIPTIONS',
    'selectZenFurinInscription',
    'resolveDailyFurinMantra',
    'cycleState?.resetPolicy?.effectiveResetHour',
  ]);

  const shishiFile = 'src/themes/plugins/zen/widgets/tools/ShishiOdoshi.jsx';
  const shishiSource = await readUtf8(shishiFile);
  requireIncludes(shishiSource, shishiFile, [
    'createShishiOdoshiFrameState',
    'createShishiOdoshiPhysicsState',
    'resolveConnectedShishiOdoshiGround',
    'stepShishiOdoshiPhysics',
  ]);
  forbidIncludes(shishiSource, shishiFile, [
    'resolveMouthLowerBoundaryWorldY',
    'DEFAULT_RIPPLE_SCALE_X_BASE',
    'GROUND_RIPPLE_SPEED_BASE',
  ]);

  const shishiRecipeFile = 'src/themes/plugins/zen/widgets/tools/recipes/zenShishiOdoshiRuntimeRecipe.js';
  const shishiRecipeSource = await readUtf8(shishiRecipeFile);
  requireIncludes(shishiRecipeSource, shishiRecipeFile, [
    'createShishiOdoshiFrameState',
    'createShishiOdoshiPhysicsState',
    'resolveShishiOdoshiQualityProfile',
    'resolveShishiOdoshiRestStreamHeight',
    'stepShishiOdoshiPhysics',
  ]);
};

const checkZenEnsoBootParity = async () => {
  const ensoFile = 'src/themes/plugins/zen/widgets/tools/Enso.jsx';
  const bootFile = 'src/themes/plugins/zen/presentation/ZenEnsoCanvas.js';
  const ensoSource = await readUtf8(ensoFile);
  const bootSource = await readUtf8(bootFile);
  requireIncludes(ensoSource, ensoFile, [
    'mountZenEnsoCanvas',
    "renderMode: 'static'",
  ]);
  requireIncludes(bootSource, bootFile, [
    "renderMode = 'animated'",
    "renderMode === 'static'",
  ]);
};

const checkLocalGuides = async () => {
  const guides = [
    {
      file: 'src/apps/dashboard/tabs/tools/ARTIFACTS.md',
      markers: ['artifactActivationState.js', 'artifactRenderContext', 'only render context'],
    },
    {
      file: 'src/themes/core/tools/ARTIFACT_RENDER_PIPELINE.md',
      markers: ['artifactMotionBudget.js', 'useArtifactRenderChannels.js', 'artifactSvgCoordinateSystem.js', 'renderBudget', 'fixed'],
    },
    {
      file: 'src/themes/plugins/zen/widgets/tools/ARTIFACT_WIDGETS.md',
      markers: ['useZenArtifactRenderChannels', 'ARTIFACT_SVG_FILTER_REGIONS', 'ZenEnsoCanvas', 'static completed mode', 'zenFurinRuntimeRecipe.js', 'zenShishiOdoshiRuntimeRecipe.js'],
    },
  ];

  for (const guide of guides) {
    const source = await readUtf8(guide.file);
    requireIncludes(source, guide.file, guide.markers);
  }
};

const main = async () => {
  await ensureFilesExist();
  await checkCanonicalArtifactFamilyCoverage();
  await checkThemeArtifactWidgetFamilyCoverage();
  await checkArtifactDashboardChildCoverage();
  await checkRendererHandoff();
  await checkSceneAndControlOwnership();
  await checkCoreRuntimePolicy();
  await checkSimulationControllerVisibilityPolicy();
  await checkArtifactSvgCoordinateSystem();
  await checkArtifactSvgFilterCoordinateUsage();
  await checkThemeSurfaceDescriptors();
  await checkArtifactWidgets();
  await checkThemeAdapters();
  await checkZenWidgets();
  await checkZenSimulationWidgets();
  await checkZenEnsoBootParity();
  await checkLocalGuides();

  if (failures.length > 0) {
    console.error('[tools-artifact-render-pipeline] Contract violation detected:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
    return;
  }

  console.log('[tools-artifact-render-pipeline] PASS: artifact render pipeline guards are satisfied.');
};

main().catch((error) => {
  console.error('[tools-artifact-render-pipeline] Unexpected error:', error);
  process.exit(1);
});

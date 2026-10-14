export const ZEN_ARTIFACT_SCENE_FACTORIES = Object.freeze({
  shoji: 'createZenShojiScene', 'great-wave': 'createZenGreatWaveScene',
  enso: 'createZenEnsoScene', 'tome-ishi': 'createZenTomeIshiScene',
  ishidouro: 'createZenIshidouroScene', furin: 'createZenFurinScene',
  'shishi-odoshi': 'createZenShishiOdoshiScene',
});

// Material identity is independent of placement, animation eligibility and live
// simulation inputs. Both the engine cache and gallery preparation use this key.
export function getZenArtifactMaterialKey(descriptor) {
  if (!descriptor || !Object.hasOwn(ZEN_ARTIFACT_SCENE_FACTORIES, descriptor.id)) throw new Error('ZEN_ARTIFACT_SCENE_UNKNOWN');
  if (descriptor.id === 'shoji') {
    if (!Number.isFinite(descriptor.nightDepth) || descriptor.nightDepth < 0 || descriptor.nightDepth > 1) {
      throw new Error('ZEN_ARTIFACT_SHOJI_NIGHT_DEPTH_INVALID');
    }
    return `shoji:${descriptor.nightDepth}`;
  }
  if (!/^#[\da-f]{6}$/i.test(descriptor.color) || typeof descriptor.isActive !== 'boolean') {
    throw new Error('ZEN_ARTIFACT_PRESENTATION_INVALID');
  }
  for (const field of ['visualWeight', 'spiritualIntensity']) {
    if (descriptor[field] !== undefined && (!Number.isFinite(descriptor[field]) || descriptor[field] < 0 || descriptor[field] > 1)) throw new Error('ZEN_ARTIFACT_PRESENTATION_INVALID');
  }
  const key = `${descriptor.id}:${descriptor.color}:${descriptor.isActive}`;
  if (descriptor.id === 'great-wave' || descriptor.id === 'shishi-odoshi') return key;
  if (descriptor.id === 'furin') {
    if (!Array.isArray(descriptor.mantra) || descriptor.mantra.length !== 4 || descriptor.mantra.some(char => typeof char !== 'string' || [...char].length !== 1)) {
      throw new Error('ZEN_ARTIFACT_FURIN_MANTRA_INVALID');
    }
    return `${key}:${descriptor.mantra.join('')}`;
  }
  if (!Number.isFinite(descriptor.nightDepth) || descriptor.nightDepth < 0 || descriptor.nightDepth > 1) throw new Error('ZEN_ARTIFACT_NIGHT_DEPTH_INVALID');
  if (descriptor.id !== 'enso') return `${key}:${descriptor.nightDepth}${descriptor.id === 'tome-ishi' ? `:${descriptor.visualWeight ?? Number(descriptor.isActive)}` : ''}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(descriptor.dayKey) || typeof descriptor.constellationVisible !== 'boolean') throw new Error('ZEN_ARTIFACT_ENSO_PRESENTATION_INVALID');
  // Enso's state is its stage, a live presentation input animated in place, so
  // activity and intensity are not material: toggling a signal must not rebuild it.
  return `enso:${descriptor.color}:${descriptor.nightDepth}:${descriptor.dayKey}`;
}

export function snapshotZenArtifactDescriptor(descriptor) {
  getZenArtifactMaterialKey(descriptor);
  // Snapshot only the inputs owned by the selected scene. Material identity
  // covers these fields except Enso's live constellation visibility.
  const { id, color, isActive, nightDepth } = descriptor;
  if (id === 'shoji') return { id, nightDepth };
  const material = { id, color, isActive };
  switch (id) {
    case 'great-wave': case 'shishi-odoshi': return material;
    case 'furin': return { ...material, mantra: [...descriptor.mantra] };
    case 'tome-ishi': return { ...material, nightDepth, visualWeight: descriptor.visualWeight };
    case 'ishidouro': return { ...material, nightDepth };
    case 'enso': return { id, color, isActive, nightDepth, dayKey: descriptor.dayKey,
      constellationVisible: descriptor.constellationVisible };
    default: throw new Error('ZEN_ARTIFACT_SCENE_UNKNOWN');
  }
}

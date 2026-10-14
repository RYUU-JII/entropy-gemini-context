import { ARTIFACT_DISCLOSURE_FAMILY_ORDER } from '../../../src/domains/progression/policy/artifactDisclosurePolicy.js';

// Read-only projection serialized into an exact owned Dashboard. Input stays
// with each protocol's existing native, hit-tested click driver.
export function inspectSettingsArtifactGalleryNavigation(observedDocument = document) {
  const index = observedDocument.querySelector('[data-artifact-gallery-index]');
  const variant = index?.getAttribute('data-artifact-gallery-index');
  const pathOrder = index?.getAttribute('data-artifact-path-order');
  const pathLocked = index?.getAttribute('data-artifact-path-locked');
  if (variant === 'path' && (!pathOrder || pathLocked === null)) {
    throw new Error('QA_SETTINGS_ARTIFACT_PATH_INVENTORY_REQUIRED');
  }
  const nodes = index ? Array.from(index.querySelectorAll('[data-artifact-gallery-family-id]')) : [];
  const families = variant === 'path'
    ? pathOrder.split('|').map(id => ({ id, locked: pathLocked.split('|').includes(id) }))
    : nodes.map(node => ({ id: node.getAttribute('data-artifact-gallery-family-id'),
      locked: node.getAttribute('data-artifact-gallery-select-slot') === 'locked' }));
  const selectedFamily = variant === 'path' ? index.getAttribute('data-artifact-path-current')
    : index?.querySelector('button[data-artifact-gallery-family-id][aria-current="true"]')?.getAttribute('data-artifact-gallery-family-id');
  return { variant, families, selectedFamily,
    pending: variant === 'path' ? index.getAttribute('aria-busy') === 'true' : Boolean(index?.querySelector('[aria-busy="true"]')),
    stageReady: observedDocument.querySelector('[data-artifact-render-stage-ready]')?.getAttribute('data-artifact-render-stage-ready') === 'true',
    errors: index ? Array.from(index.querySelectorAll('[role="alert"],[data-artifact-gallery-load-state="error"]')).map(node => node.textContent.slice(0, 200)) : [],
    missingRenderer: Boolean(observedDocument.querySelector('[data-artifact-renderer-widget-status="missing"]')) };
}

export const readSettingsArtifactGalleryNavigation = readDom => readDom(`(${inspectSettingsArtifactGalleryNavigation.toString()})()`);

export function requireSettingsArtifactGalleryInventory(state) {
  if (!['path', 'quickbar'].includes(state?.variant) || !Array.isArray(state.families)
    || state.families.length !== ARTIFACT_DISCLOSURE_FAMILY_ORDER.length
    || ARTIFACT_DISCLOSURE_FAMILY_ORDER.some((id, index) => state.families[index]?.id !== id
      || state.families[index].locked !== false)) {
    throw new Error('QA_SETTINGS_ARTIFACT_GALLERY_FULL_ACCESS_REQUIRED');
  }
  return state.families.map(family => family.id);
}

async function settle(driver, page, expected = null) {
  const state = await driver.until(`artifact_gallery_settled:${expected || 'current'}`, () => driver.readNavigation(page), value => {
    if (value.errors.length || value.missingRenderer) throw new Error('QA_SETTINGS_ARTIFACT_GALLERY_SELECTION_FAILED');
    return ['path', 'quickbar'].includes(value.variant) && value.stageReady && !value.pending
      && typeof value.selectedFamily === 'string' && (expected === null || value.selectedFamily === expected);
  }, 45_000);
  requireSettingsArtifactGalleryInventory(state);
  return state;
}

async function step(driver, page, state, direction) {
  const order = requireSettingsArtifactGalleryInventory(state);
  const from = order.indexOf(state.selectedFamily);
  if (from < 0) throw new Error('QA_SETTINGS_ARTIFACT_GALLERY_CURRENT_FAMILY_REQUIRED');
  const expected = order[(from + direction + order.length) % order.length];
  await driver.click(page, `document.querySelector('[data-artifact-gallery-index="path"] button[data-artifact-path-threshold="${direction > 0 ? 'next' : 'previous'}"]')`);
  return settle(driver, page, expected);
}

export async function selectSettingsArtifactGalleryFamily(driver, page, family) {
  let state = await settle(driver, page);
  const order = requireSettingsArtifactGalleryInventory(state);
  const target = order.indexOf(family);
  if (target < 0) throw new Error('QA_SETTINGS_ARTIFACT_GALLERY_FAMILY_INVALID');
  const visited = [];
  if (state.variant === 'quickbar') {
    if (state.selectedFamily !== family) {
      await driver.click(page, `document.querySelector('[data-artifact-gallery-index="quickbar"] button[data-artifact-gallery-family-id="${family}"]')`);
      state = await settle(driver, page, family);
      visited.push(state.selectedFamily);
    }
  } else {
    const forward = (target - order.indexOf(state.selectedFamily) + order.length) % order.length;
    const direction = forward <= order.length - forward ? 1 : -1;
    const count = Math.min(forward, order.length - forward);
    for (let index = 0; index < count; index++) {
      state = await step(driver, page, state, direction);
      visited.push(state.selectedFamily);
    }
  }
  if (state.selectedFamily !== family) throw new Error('QA_SETTINGS_ARTIFACT_GALLERY_SELECTION_MISMATCH');
  return { family, variant: state.variant, visited };
}

export async function proveSettingsArtifactPathReachability(driver, page) {
  let state = await settle(driver, page);
  if (state.variant !== 'path') throw new Error('QA_SETTINGS_ARTIFACT_PATH_REQUIRED');
  const order = requireSettingsArtifactGalleryInventory(state), initialFamily = state.selectedFamily, visited = [];
  for (let index = 0; index < order.length; index++) {
    state = await step(driver, page, state, 1);
    visited.push(state.selectedFamily);
  }
  if (new Set(visited).size !== order.length || state.selectedFamily !== initialFamily) {
    throw new Error('QA_SETTINGS_ARTIFACT_PATH_REACHABILITY_REQUIRED');
  }
  return { initialFamily, visited, steps: visited.length, wrapped: true };
}

export function inspectSettingsArtifactPathGeometry(observedDocument = document) {
  const view = observedDocument.defaultView, index = observedDocument.querySelector('[data-artifact-gallery-index="path"]');
  const bounds = observedDocument.querySelector('[data-artifact-gallery-canvas-region="true"]')?.getBoundingClientRect();
  const controls = index ? Array.from(index.querySelectorAll('button[data-artifact-path-threshold]')).map(node => {
    const rect = node.getBoundingClientRect(), style = view.getComputedStyle(node);
    return { direction: node.getAttribute('data-artifact-path-threshold'), width: rect.width, height: rect.height,
      disabled: node.disabled || node.getAttribute('aria-disabled') === 'true',
      visible: !observedDocument.hidden && rect.width > 0 && rect.height > 0 && style.visibility === 'visible' && Number(style.opacity) > 0,
      contained: Boolean(bounds && rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom),
      inViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= view.innerWidth && rect.bottom <= view.innerHeight,
      hit: node.contains(observedDocument.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
  }) : [];
  return { viewportWidth: view.innerWidth, viewportHeight: view.innerHeight, apertureWidth: bounds?.width, controls };
}

export function matchesSettingsArtifactPathGeometry(value) {
  return Boolean(value?.viewportWidth > 0 && value.viewportHeight > 0 && value.apertureWidth > 0
    && value.controls.length === 2 && value.controls.map(control => control.direction).sort().join(',') === 'next,previous'
    && value.controls.every(control => control.disabled === false && control.visible && control.contained && control.inViewport
      && control.hit && control.width >= 44 && control.height >= 44));
}

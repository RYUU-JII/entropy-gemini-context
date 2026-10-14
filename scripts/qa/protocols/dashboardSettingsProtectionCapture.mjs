async function protectionDisplayOperation(operation, original) {
  const owner = document.getElementById('settings-content-area');
  const selected = document.querySelector('#settings nav button[aria-current="page"]');
  if (!owner || selected?.dataset.settingsSectionId !== 'protection') {
    throw new Error('QA_SETTINGS_PROTECTION_SECTION_REQUIRED');
  }
  const disclosures = owner.querySelectorAll('details');
  if (disclosures.length !== 1 || !disclosures[0].querySelector('summary')) {
    throw new Error('QA_SETTINGS_PROTECTION_DISCLOSURE_REQUIRED');
  }
  const details = disclosures[0];
  if (operation === 'open') {
    if (!details.open) details.querySelector('summary').click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return;
  }
  if (operation === 'bottom') {
    owner.scrollTop = owner.scrollHeight;
    return;
  }
  if (operation === 'restore') {
    if (details.open !== original.disclosureOpen) details.querySelector('summary').click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    owner.scrollTop = original.scrollTop;
    return;
  }
  if (operation !== 'inspect') throw new Error('QA_SETTINGS_PROTECTION_OPERATION_INVALID');
  const bounds = node => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      width: rect.width, height: rect.height };
  };
  const radios = [...owner.querySelectorAll('input[type="radio"]')];
  const switches = [...owner.querySelectorAll('button[role="switch"]')];
  if (radios.length !== 3 || switches.length !== 2) {
    throw new Error('QA_SETTINGS_PROTECTION_CONTROLS_REQUIRED');
  }
  const presets = radios.map(node => {
    const label = node.closest('label');
    if (!label || !label.textContent.trim()) throw new Error('QA_SETTINGS_PROTECTION_PRESET_LABEL_REQUIRED');
    return { value: node.value, label: label.textContent.trim(), checked: node.checked, bounds: bounds(label) };
  });
  const goals = switches.map(node => {
    const label = node.getAttribute('aria-label');
    const checked = node.getAttribute('aria-checked');
    if (!label?.trim() || !['true', 'false'].includes(checked)) {
      throw new Error('QA_SETTINGS_PROTECTION_SWITCH_LABEL_REQUIRED');
    }
    return { label, checked: checked === 'true', bounds: bounds(node) };
  });
  const buttons = details.querySelectorAll('button');
  if (details.open && (buttons.length !== 1 || !buttons[0].textContent.trim())) {
    throw new Error('QA_SETTINGS_PROTECTION_BARRIER_ACTION_REQUIRED');
  }
  return {
    scrollTop: owner.scrollTop, scrollHeight: owner.scrollHeight,
    clientWidth: owner.clientWidth, clientHeight: owner.clientHeight, scrollWidth: owner.scrollWidth,
    disclosureOpen: details.open, content: bounds(owner), disclosure: bounds(details), presets, goals,
    barrierAction: details.open ? { label: buttons[0].textContent.trim(), bounds: bounds(buttons[0]) } : null,
  };
}

function requireUnclippedLayout(snapshot) {
  if (snapshot.clientWidth <= 0 || snapshot.clientHeight <= 0
      || snapshot.scrollWidth > snapshot.clientWidth + 1) {
    throw new Error('QA_SETTINGS_PROTECTION_HORIZONTAL_OVERFLOW');
  }
  for (const item of [...snapshot.presets, ...snapshot.goals]) {
    if (item.bounds.width <= 0 || item.bounds.height <= 0
        || item.bounds.left < snapshot.content.left - 1 || item.bounds.right > snapshot.content.right + 1) {
      throw new Error('QA_SETTINGS_PROTECTION_CONTROL_CLIPPED');
    }
  }
}

function requireLowerContentVisible(snapshot) {
  if (!snapshot.disclosureOpen || !snapshot.barrierAction) {
    throw new Error('QA_SETTINGS_PROTECTION_DISCLOSURE_NOT_OPEN');
  }
  for (const bounds of [snapshot.disclosure, snapshot.barrierAction.bounds]) {
    if (bounds.width <= 0 || bounds.height <= 0
        || bounds.top < snapshot.content.top - 1 || bounds.bottom > snapshot.content.bottom + 1
        || bounds.left < snapshot.content.left - 1 || bounds.right > snapshot.content.right + 1) {
      throw new Error('QA_SETTINGS_PROTECTION_LOWER_CONTENT_CLIPPED');
    }
  }
}

// All browser operations belong to the existing dashboard/capture page. Only
// display state is changed; preset radios and goal switches are never activated.
export async function runDashboardSettingsProtectionCapture({ evaluate, waitForSettled, capture }) {
  if ([evaluate, waitForSettled, capture].some(operation => typeof operation !== 'function')) {
    throw new Error('QA_SETTINGS_PROTECTION_CAPTURE_OPERATIONS_REQUIRED');
  }
  const operate = (operation, original) => evaluate(`(${protectionDisplayOperation.toString()})(${JSON.stringify(operation)}, ${JSON.stringify(original)})`);
  const original = await operate('inspect');
  requireUnclippedLayout(original);
  let expanded;
  let screenshotPath;
  let failure;
  try {
    await operate('open');
    await waitForSettled();
    await operate('bottom');
    await waitForSettled();
    expanded = await operate('inspect');
    requireUnclippedLayout(expanded);
    requireLowerContentVisible(expanded);
    screenshotPath = await capture('protection-details');
    if (typeof screenshotPath !== 'string' || screenshotPath.length === 0) {
      throw new Error('QA_SETTINGS_PROTECTION_CAPTURE_PATH_REQUIRED');
    }
  } catch (error) {
    failure = error;
  }
  let restored;
  try {
    await operate('restore', original);
    await waitForSettled();
    restored = await operate('inspect');
    if (restored.disclosureOpen !== original.disclosureOpen
        || Math.abs(restored.scrollTop - original.scrollTop) > 0.25) {
      throw new Error('QA_SETTINGS_PROTECTION_DISPLAY_RESTORATION_FAILED');
    }
  } catch (error) {
    if (failure) throw new AggregateError([failure, error], 'QA_SETTINGS_PROTECTION_CAPTURE_AND_RESTORATION_FAILED');
    throw error;
  }
  if (failure) throw failure;
  return { schemaVersion: 1, scope: 'display_only', settingsWrites: false,
    original, expanded, screenshotPath,
    restored: { disclosureOpen: restored.disclosureOpen, scrollTop: restored.scrollTop } };
}

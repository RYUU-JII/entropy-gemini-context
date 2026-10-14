const ATTRIBUTE_SELECTOR_PATTERN = /\[\s*([_a-zA-Z][\w:.-]*)/gu;
const ATTRIBUTE_NAME_PATTERN = /^[_a-zA-Z][\w:.-]*$/u;

export const DEFAULT_INITIAL_SCAN_ONLY_SELECTOR_ATTRIBUTES = Object.freeze([
  'class',
  'style',
]);

function fail(reason, value = '') {
  const suffix = value ? `:${value}` : '';
  const error = new Error(`SELECTOR_ATTRIBUTE_DEPENDENCY_INVALID:${reason}${suffix}`);
  error.code = 'SELECTOR_ATTRIBUTE_DEPENDENCY_INVALID';
  error.details = Object.freeze({ reason, value });
  throw error;
}

function validateDenseStringArrayShape(values, field) {
  for (let index = 0; index < values.length; index += 1) {
    if (!Object.hasOwn(values, index)) {
      fail(`${field}_sparse_array_forbidden`, String(index));
    }
  }
  Reflect.ownKeys(values).forEach((key) => {
    if (key === 'length') return;
    if (typeof key !== 'string') fail(`${field}_symbol_property_forbidden`);
    if (!/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= values.length) {
      fail(`${field}_array_property_forbidden`, key);
    }
    const descriptor = Object.getOwnPropertyDescriptor(values, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail(`${field}_enumerable_data_property_required`, key);
    }
  });
}

function normalizeStringList(values, field) {
  if (!Array.isArray(values)) fail(`${field}_array_required`);
  validateDenseStringArrayShape(values, field);
  const normalized = [];
  const seen = new Set();
  values.forEach((value) => {
    if (typeof value !== 'string' || !value.trim()) fail(`${field}_entry_invalid`);
    const entry = value.trim();
    if (seen.has(entry)) return;
    seen.add(entry);
    normalized.push(entry);
  });
  return normalized;
}

function normalizeAttributeList(values, field) {
  const normalized = normalizeStringList(values, field).map((value) => {
    if (!ATTRIBUTE_NAME_PATTERN.test(value)) fail(`${field}_entry_invalid`, value);
    return value.toLowerCase();
  });
  return Array.from(new Set(normalized));
}

function addImplicitIdentityDependencies(selector, attributes) {
  let bracketDepth = 0;
  let quote = '';
  let escaped = false;

  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '[') {
      bracketDepth += 1;
      continue;
    }
    if (character === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (bracketDepth > 0) continue;

    const next = selector[index + 1] || '';
    if (!/[-_a-zA-Z]/u.test(next)) continue;
    if (character === '.') attributes.add('class');
    if (character === '#') attributes.add('id');
  }
}

export function extractSelectorAttributeDependencies(selectors) {
  const selectorList = typeof selectors === 'string' ? [selectors] : selectors;
  const normalizedSelectors = normalizeStringList(selectorList, 'selectors');
  const attributes = new Set();

  normalizedSelectors.forEach((selector) => {
    for (const match of selector.matchAll(ATTRIBUTE_SELECTOR_PATTERN)) {
      attributes.add(match[1].toLowerCase());
    }
    addImplicitIdentityDependencies(selector, attributes);
  });

  return Object.freeze(Array.from(attributes).sort());
}

export function compileSelectorAttributeDependencyPlan({
  selectors = [],
  semanticAttributes = [],
  requiredObservedAttributes = [],
  initialScanOnlyAttributes = DEFAULT_INITIAL_SCAN_ONLY_SELECTOR_ATTRIBUTES,
} = {}) {
  const selectorAttributes = extractSelectorAttributeDependencies(selectors);
  const semantic = normalizeAttributeList(semanticAttributes, 'semantic_attributes');
  const required = normalizeAttributeList(
    requiredObservedAttributes,
    'required_observed_attributes',
  );
  const initialOnlySet = new Set(normalizeAttributeList(
    initialScanOnlyAttributes,
    'initial_scan_only_attributes',
  ));
  const allAttributes = Array.from(new Set([
    ...selectorAttributes,
    ...semantic,
    ...required,
  ])).sort();
  const requiredSet = new Set(required);
  const observedAttributes = [];
  const initialOnlyAttributes = [];

  allAttributes.forEach((attributeName) => {
    if (initialOnlySet.has(attributeName) && !requiredSet.has(attributeName)) {
      initialOnlyAttributes.push(attributeName);
    } else {
      observedAttributes.push(attributeName);
    }
  });

  return Object.freeze({
    selectorAttributes,
    semanticAttributes: Object.freeze(semantic),
    observedAttributes: Object.freeze(observedAttributes),
    initialScanOnlyAttributes: Object.freeze(initialOnlyAttributes),
  });
}

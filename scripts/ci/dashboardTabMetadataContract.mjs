import { parse } from '@babel/parser';

// These are the registry's declaration owners, including entries omitted from
// public builds. Locale roots do not define which Dashboard tabs exist.
export const DASHBOARD_TAB_METADATA_SOURCE_PATHS = Object.freeze([
  'src/apps/dashboard/tabs/registry.js',
  'src/apps/dashboard/labEntries/experimentEntry.dev.js',
  'src/apps/dashboard/tabEntries/filterEntry.dev.js',
]);

const COPY_FIELDS = Object.freeze({
  navKey: 'nav',
  titleKey: 'title',
  descriptionKey: 'desc',
});

function propertyName(property) {
  if (property.type !== 'ObjectProperty' && property.type !== 'ObjectMethod') return null;
  if (!property.computed && property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'StringLiteral') return property.key.value;
  return null;
}

export function collectDashboardTabMetadata(sources) {
  const metadata = [];
  const ids = new Set();
  for (const { filePath, source } of sources) {
    const visit = (node) => {
      if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
      if (node.type === 'ObjectExpression') {
        const properties = new Map(node.properties.map(property => [propertyName(property), property]));
        if (properties.has('load') || Object.keys(COPY_FIELDS).some(field => properties.has(field))) {
          const id = properties.get('id')?.value;
          if (id?.type !== 'StringLiteral' || !id.value.trim()) {
            throw new Error(`DASHBOARD_TAB_METADATA_ID_REQUIRED:${filePath}:${node.loc.start.line}`);
          }
          if (ids.has(id.value)) throw new Error(`DASHBOARD_TAB_METADATA_ID_DUPLICATE:${id.value}`);
          const keys = {};
          for (const [field, name] of Object.entries(COPY_FIELDS)) {
            const key = properties.get(field)?.value;
            if (key?.type !== 'StringLiteral' || !key.value.trim()) {
              throw new Error(`DASHBOARD_TAB_METADATA_KEY_REQUIRED:${id.value}:${field}`);
            }
            keys[name] = key.value;
          }
          ids.add(id.value);
          metadata.push({ id: id.value, keys });
        }
      }
      for (const child of Object.values(node)) {
        if (Array.isArray(child)) child.forEach(visit);
        else visit(child);
      }
    };
    visit(parse(source, { sourceType: 'module' }));
  }
  if (metadata.length === 0) throw new Error('DASHBOARD_TAB_METADATA_DECLARATIONS_EMPTY');
  return metadata;
}

export function findDashboardTabMetadataViolations(resource, metadata, language) {
  const violations = [];
  for (const { keys } of metadata) {
    for (const key of Object.values(keys)) {
      const copy = key.split('.').reduce((value, segment) => value?.[segment], resource);
      if (typeof copy !== 'string' || !copy.trim()) {
        violations.push(`${language}:dashboard.${key}: missing tab metadata leaf`);
      }
    }
  }
  return violations;
}

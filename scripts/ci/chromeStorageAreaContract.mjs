import { parse } from '@babel/parser';

function propertyName(node) {
  if (!['MemberExpression', 'OptionalMemberExpression'].includes(node?.type)) return null;
  if (!node.computed) return node.property.name;
  if (node.property.type === 'StringLiteral') return node.property.value;
  return null;
}

// Inspect actual syntax so aliased namespaces, optional chains and bracket
// access cannot hide a raw area read, while strings/comments remain harmless.
export function inspectChromeStorageAreaAccess(source) {
  if (!source.includes('storage')) return [];
  const accesses = [];
  const visit = node => {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
    const area = propertyName(node);
    if (['local', 'session'].includes(area) && propertyName(node.object) === 'storage') {
      accesses.push({ area, line: node.loc.start.line });
    }
    const binding = node.type === 'VariableDeclarator' ? node.id
      : node.type === 'AssignmentExpression' ? node.left : null;
    const value = node.type === 'VariableDeclarator' ? node.init : node.right;
    if (binding?.type === 'ObjectPattern' && propertyName(value) === 'storage') {
      for (const property of binding.properties) {
        const name = property.key?.name ?? property.key?.value;
        if (['local', 'session'].includes(name)) {
          accesses.push({ area: name, line: property.loc.start.line });
        }
      }
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  visit(parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] }));
  return accesses;
}

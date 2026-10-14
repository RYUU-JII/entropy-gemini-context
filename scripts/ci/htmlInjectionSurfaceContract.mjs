import path from 'node:path';
import { parse } from '@babel/parser';

const inventoryPath = 'docs/operations/security-surface-html-sinks.json';
const indicatorPath = 'src/domains/nudge/indicator/view.js';
const overlayPath = 'src/domains/nudge/runtime/NudgeOverlayHost.js';
const gameTemplatePath = 'src/domains/nudge/nudge/nudgeGameTemplate.js';
const templateOwners = new Map([
  [indicatorPath, 'mountIndicatorTemplate'],
  [overlayPath, 'mountNudgeOverlayTemplate'],
]);
const templateInputs = new Set([indicatorPath, overlayPath, gameTemplatePath]);
const privateMountNames = new Set(templateOwners.values());

function walk(node, visit, parent = null, key = null) {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  visit(node, parent, key);
  for (const [childKey, child] of Object.entries(node)) {
    if (Array.isArray(child)) {
      for (const item of child) walk(item, visit, node, childKey);
    } else {
      walk(child, visit, node, childKey);
    }
  }
}

function literalString(node) {
  if (node?.type === 'StringLiteral') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  if (node?.type === 'BinaryExpression' && node.operator === '+') {
    const left = literalString(node.left);
    const right = literalString(node.right);
    if (typeof left === 'string' && typeof right === 'string') return left + right;
  }
  return null;
}

function memberName(node) {
  if (!['MemberExpression', 'OptionalMemberExpression'].includes(node?.type)) return null;
  return node.computed ? literalString(node.property) : node.property.name;
}

function topLevelConst(program, name) {
  for (const statement of program.body) {
    const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type !== 'VariableDeclaration' || declaration.kind !== 'const') continue;
    const binding = declaration.declarations.find((entry) => entry.id.type === 'Identifier' && entry.id.name === name);
    if (binding) return binding.init;
  }
  return null;
}

function hasNamedExport(program, name) {
  return program.body.some((statement) => statement.type === 'ExportNamedDeclaration' && (
    statement.declaration?.type === 'VariableDeclaration'
      ? statement.declaration.declarations.some((entry) => entry.id.type === 'Identifier' && entry.id.name === name)
      : !statement.source && statement.specifiers.some((entry) => (
        entry.local?.name === name && (entry.exported?.name ?? entry.exported?.value) === name
      ))
  ));
}

function hasReviewedImport(program, importer, name, owner) {
  return program.body.some((statement) => {
    if (statement.type !== 'ImportDeclaration') return false;
    const specifier = statement.source.value;
    const resolved = specifier.startsWith('@/')
      ? `src/${specifier.slice(2)}`
      : path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
    return resolved === owner && statement.specifiers.some((entry) => (
      entry.type === 'ImportSpecifier'
      && entry.local.name === name
      && (entry.imported.name ?? entry.imported.value) === name
    ));
  });
}

function hasStaticTemplate(node, names) {
  if (names.length === 0) return typeof literalString(node) === 'string';
  return node?.type === 'TemplateLiteral'
    && node.expressions.length === names.length
    && names.every((name) => node.expressions.some((entry) => entry.type === 'Identifier' && entry.name === name));
}

/**
 * Inventory remains a count tripwire. The AST checks below prove only the two
 * reviewed private template mounts and their fixed inputs, not global taint flow.
 * Reads, parsing and diagnostics are deterministic; this helper performs no I/O.
 */
export function inspectHtmlInjectionSurface({ contract, sources }) {
  const failures = [];
  const fail = (file, message, node = null, detail) => {
    failures.push({ path: file, line: node?.loc?.start?.line ?? 1, message, detail });
  };
  if (contract?.schemaVersion !== 2 || !Array.isArray(contract.sinks)
    || Object.hasOwn(contract, 'indirectSinks')) {
    fail(inventoryPath, 'HTML injection surface contract requires schema 2 direct sinks only.');
    return failures;
  }
  if (!(sources instanceof Map)) throw new Error('HTML_SURFACE_SOURCES_MAP_REQUIRED');

  const reviewed = new Map();
  for (const sink of contract.sinks) {
    const file = typeof sink?.path === 'string' ? sink.path.trim() : '';
    if (!file.startsWith('src/') || file.includes('..') || reviewed.has(file)
      || !Number.isInteger(sink?.innerHTMLWrites) || sink.innerHTMLWrites < 0
      || !Number.isInteger(sink?.dangerouslySetInnerHTML) || sink.dangerouslySetInnerHTML < 0
      || typeof sink?.rationale !== 'string' || !sink.rationale.trim()) {
      fail(inventoryPath, 'HTML injection surface entry is invalid or duplicated.', null, file || '<missing-path>');
      continue;
    }
    reviewed.set(file, sink);
  }

  const observed = new Map();
  const programs = new Map();
  for (const [file, source] of sources) {
    const counts = {
      dangerouslySetInnerHTML: [...source.matchAll(/\bdangerouslySetInnerHTML\s*=/gu)].length,
      innerHTMLWrites: [...source.matchAll(/\.innerHTML\s*=/gu)].length,
    };
    const forbiddenCount = [...source.matchAll(/\.outerHTML\s*=|\.insertAdjacentHTML\s*\(|\bdocument\.write\s*\(/gu)].length;
    if (forbiddenCount > 0) {
      fail(file, 'Unreviewed outerHTML, insertAdjacentHTML, or document.write sink is forbidden.', null, `count=${forbiddenCount}`);
    }
    if (counts.innerHTMLWrites > 0 || counts.dangerouslySetInnerHTML > 0) observed.set(file, counts);

    if (!templateInputs.has(file)
      && !/setHtml|FastStyleEngine|mountIndicatorTemplate|mountNudgeOverlayTemplate|innerHTML/u.test(source)) continue;
    let program;
    try {
      program = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] }).program;
    } catch (error) {
      fail(file, `HTML boundary source could not be parsed: ${error.message}`);
      continue;
    }
    programs.set(file, program);
    walk(program, (node) => {
      if ((node.type === 'Identifier' && node.name === 'setHtml')
        || literalString(node) === 'setHtml') {
        fail(file, 'The retired setHtml primitive cannot be declared, imported, exported, aliased, or accessed.', node);
      }
      if (node.type === 'ImportSpecifier'
        && privateMountNames.has(node.imported?.name ?? node.imported?.value)) {
        fail(file, 'Private HTML template mounts cannot be imported by another owner.', node);
      }
      const referencedMount = node.type === 'Identifier' ? node.name : literalString(node);
      if (privateMountNames.has(referencedMount) && templateOwners.get(file) !== referencedMount) {
        fail(file, 'Private HTML template mounts cannot be imported, re-exported, or accessed by another owner.', node);
      }
      // Count review does not authorize alternate computed/compound spellings.
      if (node.type === 'AssignmentExpression' && memberName(node.left) === 'innerHTML'
        && (node.left.computed || node.operator !== '=')) {
        fail(file, 'Computed or compound innerHTML writes require an explicit security contract.', node);
      }
    });
  }

  for (const [file, counts] of observed) {
    const expected = reviewed.get(file);
    if (!expected) {
      fail(file, 'HTML injection sink is missing release review metadata.', null, JSON.stringify(counts));
    } else if (counts.innerHTMLWrites !== expected.innerHTMLWrites
      || counts.dangerouslySetInnerHTML !== expected.dangerouslySetInnerHTML) {
      fail(file, 'HTML injection sink count drift requires security review.', null,
        `expected=${expected.innerHTMLWrites}/${expected.dangerouslySetInnerHTML} actual=${counts.innerHTMLWrites}/${counts.dangerouslySetInnerHTML}`);
    }
  }
  for (const file of reviewed.keys()) {
    if (!observed.has(file)) fail(inventoryPath, 'Stale HTML injection sink review entry must be removed.', null, file);
  }

  for (const file of templateInputs) {
    if (!programs.has(file)) fail(file, 'Reviewed static HTML template owner is missing or invalid.');
  }
  const gameProgram = programs.get(gameTemplatePath);
  if (gameProgram && (!hasNamedExport(gameProgram, 'NUDGE_GAME_TEMPLATE')
    || !hasStaticTemplate(topLevelConst(gameProgram, 'NUDGE_GAME_TEMPLATE'), []))) {
    fail(gameTemplatePath, 'NUDGE_GAME_TEMPLATE must remain an exported immutable literal without dynamic interpolation.');
  }

  for (const [file, mountName] of templateOwners) {
    const program = programs.get(file);
    if (!program) continue;
    const mount = program.body.find((node) => node.type === 'FunctionDeclaration' && node.id?.name === mountName);
    if (!mount || mount.async || mount.generator || mount.params.length !== 1 || mount.params[0].type !== 'Identifier') {
      fail(file, `${mountName} must remain a private top-level function accepting only its target.`);
      continue;
    }
    const target = mount.params[0].name;
    const assignment = mount.body.body.length === 1 && mount.body.body[0].type === 'ExpressionStatement'
      ? mount.body.body[0].expression : null;
    if (assignment?.type !== 'AssignmentExpression' || assignment.operator !== '='
      || memberName(assignment.left) !== 'innerHTML' || assignment.left.computed
      || assignment.left.object.type !== 'Identifier' || assignment.left.object.name !== target) {
      fail(file, `${mountName} must only assign its reviewed template to the target innerHTML.`, mount);
    }
    const staticNames = file === indicatorPath ? ['INDICATOR_CSS'] : ['NUDGE_GAME_TEMPLATE'];
    if (staticNames.includes(target)) fail(file, 'HTML mount target must not shadow a reviewed static template binding.', mount);
    if (file === indicatorPath) {
      if (!hasStaticTemplate(assignment?.right, ['INDICATOR_CSS'])
        || !hasStaticTemplate(topLevelConst(program, 'INDICATOR_CSS'), [])) {
        fail(file, 'Indicator HTML must use only its immutable code-owned INDICATOR_CSS literal.');
      }
    } else if (assignment?.right?.type !== 'Identifier' || assignment.right.name !== 'NUDGE_GAME_TEMPLATE'
      || !hasReviewedImport(program, file, 'NUDGE_GAME_TEMPLATE', gameTemplatePath)) {
      fail(file, 'Nudge overlay HTML must use the fixed imported NUDGE_GAME_TEMPLATE.');
    }

    let calls = 0;
    let writes = 0;
    walk(program, (node, parent, key) => {
      if (node.type === 'AssignmentExpression' && memberName(node.left) === 'innerHTML') {
        writes += 1;
        if (node !== assignment) fail(file, 'Raw HTML insertion must remain inside the reviewed private mount.', node);
      }
      if (node.type !== 'Identifier' || node.name !== mountName) return;
      if (node === mount.id) return;
      if (parent?.type === 'CallExpression' && key === 'callee' && parent.callee === node) {
        calls += 1;
        if (parent.arguments.length !== 1
          || !['Identifier', 'MemberExpression'].includes(parent.arguments[0].type)) {
          fail(file, `${mountName} calls must provide only the DOM target.`, parent);
        }
        return;
      }
      fail(file, 'Private HTML template mount cannot be exported, aliased, shadowed, or passed as a value.', node);
    });
    if (calls === 0 || writes !== 1) fail(file, 'Reviewed HTML owner must retain one private sink and direct target-only calls.');
  }
  return failures;
}

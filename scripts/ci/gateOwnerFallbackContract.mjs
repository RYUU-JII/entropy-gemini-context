import { parse } from '@babel/parser';

const isIdentifier = (node, name) => node?.type === 'Identifier' && node.name === name;
const isFalse = node => node?.type === 'BooleanLiteral' && node.value === false;

function isHistoryEffectFailureReturn(node, ancestors) {
  const branch = ancestors.at(-1);
  const task = ancestors.findLast(candidate => candidate.type === 'ArrowFunctionExpression');
  const owner = ancestors.findLast(candidate => candidate.type === 'FunctionDeclaration');
  if (owner?.id?.name !== 'enqueueGateHistory'
    || !ancestors.some(candidate => candidate.type === 'CallExpression'
      && isIdentifier(candidate.callee, 'runProfileMutationAdmittedTaskOwner'))
    || branch?.type !== 'IfStatement' || branch.consequent !== node || branch.alternate) return false;
  const { test } = branch;
  if (test.type !== 'LogicalExpression' || test.operator !== '&&'
    || test.left.type !== 'BinaryExpression' || test.left.operator !== '!=='
    || !isIdentifier(test.left.left, 'effectCompletion') || !isIdentifier(test.left.right, 'undefined')
    || test.right.type !== 'BinaryExpression' || test.right.operator !== '!=='
    || test.right.left.type !== 'AwaitExpression' || !isIdentifier(test.right.left.argument, 'effectCompletion')
    || test.right.right.type !== 'BooleanLiteral' || test.right.right.value !== true) return false;
  const [effectGate, predecessor, work] = task?.body?.body || [];
  return effectGate === branch
    && predecessor?.type === 'ExpressionStatement' && predecessor.expression.type === 'AwaitExpression'
    && isIdentifier(predecessor.expression.argument, 'predecessor')
    && work?.type === 'ReturnStatement' && work.argument?.type === 'CallExpression'
    && isIdentifier(work.argument.callee, 'work') && work.argument.arguments.length === 0;
}

export function findGateOwnerFallbackViolations(source, { requireHistoryEffectGate = false } = {}) {
  const violations = [];
  let historyEffectGates = 0;
  const visit = (node, ancestors = []) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ReturnStatement' && isFalse(node.argument)) {
      if (requireHistoryEffectGate && isHistoryEffectFailureReturn(node, ancestors)) historyEffectGates += 1;
      else violations.push(`unowned_false_return:${node.loc.start.line}`);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(child => visit(child, [...ancestors, node]));
      else if (value && typeof value === 'object' && typeof value.type === 'string') visit(value, [...ancestors, node]);
    }
  };
  visit(parse(source, { sourceType: 'module' }));
  if (requireHistoryEffectGate && historyEffectGates !== 1) violations.push('history_effect_failure_gate_required');
  return violations;
}

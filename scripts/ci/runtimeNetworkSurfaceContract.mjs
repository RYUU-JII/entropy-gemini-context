import { parse } from '@babel/parser';

const ASSET_OWNER = 'src/platform/extension/packagedAssetFetch.js';
const NETWORK_PRIMITIVES = new Set([
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon',
  'WebTransport', 'RTCPeerConnection', 'webkitRTCPeerConnection', 'mozRTCPeerConnection',
]);

function staticString(node) {
  if (node?.type === 'StringLiteral') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  if (node?.type === 'BinaryExpression' && node.operator === '+') {
    const left = staticString(node.left);
    const right = staticString(node.right);
    return typeof left === 'string' && typeof right === 'string' ? left + right : null;
  }
  return null;
}

function memberName(node) {
  if (node?.type !== 'MemberExpression' && node?.type !== 'OptionalMemberExpression') return null;
  return node.computed ? staticString(node.property) : node.property.name;
}

function walk(node, visit, parent = null, key = null) {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  visit(node, parent, key);
  for (const [childKey, child] of Object.entries(node)) {
    if (Array.isArray(child)) {
      for (const entry of child) walk(entry, visit, node, childKey);
    } else walk(child, visit, node, childKey);
  }
}

// Reject authored primitive references as well as calls, so ordinary aliases,
// destructuring and statically computed properties cannot evade the tripwire.
// This is a source architecture check, not whole-program taint analysis or a
// containment guarantee for arbitrary compromised trusted JavaScript.
export function inspectRuntimeNetworkSurface({ file, source }) {
  const failures = [];
  let ast;
  try {
    ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] });
  } catch (error) {
    return [{ path: file, line: error.loc?.line ?? 1, message: `Network surface parse failed: ${error.message}` }];
  }
  const reported = new Set();
  function fail(node, primitive) {
    if (reported.has(node.start)) return;
    reported.add(node.start);
    failures.push({ path: file, line: node.loc?.start?.line ?? 1,
      message: `Native ${primitive} references are forbidden outside the exact own-extension asset call.` });
  }
  walk(ast, (node, parent, key) => {
    if (node.type === 'Identifier' && NETWORK_PRIMITIVES.has(node.name)) {
      if (parent?.type === 'MemberExpression' || parent?.type === 'OptionalMemberExpression') {
        if (key === 'property' && !parent.computed) return; // The member itself is checked below.
      }
      const reviewedCall = file === ASSET_OWNER && node.name === 'fetch'
        && parent?.type === 'CallExpression' && key === 'callee';
      if (!reviewedCall) fail(node, node.name);
    }
    const property = memberName(node);
    if (NETWORK_PRIMITIVES.has(property)) fail(node, property);
    if ((node.type === 'CallExpression' || node.type === 'OptionalCallExpression')
      && ['get', 'getOwnPropertyDescriptor'].includes(memberName(node.callee))) {
      const primitive = staticString(node.arguments[1]);
      if (NETWORK_PRIMITIVES.has(primitive)) fail(node, primitive);
    }
    if (node.type === 'ObjectProperty' && parent?.type === 'ObjectPattern') {
      const propertyName = node.computed ? staticString(node.key)
        : node.key.type === 'Identifier' ? node.key.name : staticString(node.key);
      if (NETWORK_PRIMITIVES.has(propertyName)) fail(node, propertyName);
    }
  });
  return failures;
}

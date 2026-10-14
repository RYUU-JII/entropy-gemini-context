const DOCUMENT_NODE = 9;
const ELEMENT_NODE = 1;

function requireDocument(documentRef) {
  if (!documentRef || documentRef.nodeType !== DOCUMENT_NODE) {
    throw new Error('SOCIAL_METRICS_NODE_IDENTITY_DOCUMENT_REQUIRED');
  }
  return documentRef;
}

function requireOwnedElement(node, documentRef) {
  if (!node || node.nodeType !== ELEMENT_NODE) {
    throw new Error('SOCIAL_METRICS_NODE_IDENTITY_ELEMENT_REQUIRED');
  }
  if (node.ownerDocument !== documentRef) {
    throw new Error('SOCIAL_METRICS_NODE_IDENTITY_FOREIGN_DOCUMENT');
  }
  return node;
}

/**
 * Creates a non-iterable, document-local identity owner for Social Metrics
 * diagnostic candidates and targets. The registry deliberately retains no DOM
 * path, text, attributes, or strong collection of identified elements.
 */
export function createDocumentNodeIdentityRegistry({
  documentRef = globalThis.document,
} = {}) {
  const ownedDocument = requireDocument(documentRef);
  let generation = 1;
  let nextNodeId = 1;
  let identityByNode = new WeakMap();

  function getNodeIdentity(node) {
    const element = requireOwnedElement(node, ownedDocument);
    const existing = identityByNode.get(element);
    if (existing) return existing;
    if (!Number.isSafeInteger(nextNodeId)) {
      throw new Error('SOCIAL_METRICS_NODE_IDENTITY_ID_EXHAUSTED');
    }

    const identity = Object.freeze({
      generation,
      nodeId: nextNodeId,
    });
    nextNodeId += 1;
    identityByNode.set(element, identity);
    return identity;
  }

  function getNodeId(node) {
    return getNodeIdentity(node).nodeId;
  }

  function getGeneration() {
    return generation;
  }

  function reset() {
    if (!Number.isSafeInteger(generation + 1)) {
      throw new Error('SOCIAL_METRICS_NODE_IDENTITY_GENERATION_EXHAUSTED');
    }
    generation += 1;
    identityByNode = new WeakMap();
    return generation;
  }

  return Object.freeze({
    getGeneration,
    getNodeId,
    getNodeIdentity,
    reset,
  });
}

export default createDocumentNodeIdentityRegistry;

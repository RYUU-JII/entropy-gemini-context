const ARRAY_EMPTY = Object.freeze([]);

function normalizeNodeChildren(children) {
  if (Array.isArray(children)) {
    return children.filter((child) => child !== null && child !== undefined);
  }
  if (children === null || children === undefined) {
    return ARRAY_EMPTY;
  }
  return [children];
}

export function createArtifactSceneNode(tag, props = null, children = ARRAY_EMPTY) {
  if (typeof tag !== 'string' || !tag.trim()) {
    throw new Error('[artifactSceneGraph] Scene node tag must be a non-empty string.');
  }

  return {
    tag: tag.trim(),
    props: props && typeof props === 'object' ? { ...props } : {},
    children: normalizeNodeChildren(children),
  };
}

export function createArtifactSceneGroup(props = null, children = ARRAY_EMPTY) {
  return createArtifactSceneNode('g', props, children);
}

export function createArtifactScenePath(props = null, children = ARRAY_EMPTY) {
  return createArtifactSceneNode('path', props, children);
}

export function createArtifactSceneRect(props = null, children = ARRAY_EMPTY) {
  return createArtifactSceneNode('rect', props, children);
}

export function createArtifactSceneCircle(props = null, children = ARRAY_EMPTY) {
  return createArtifactSceneNode('circle', props, children);
}

export function createArtifactSceneEllipse(props = null, children = ARRAY_EMPTY) {
  return createArtifactSceneNode('ellipse', props, children);
}

export function createArtifactSceneDefs(children = ARRAY_EMPTY) {
  return createArtifactSceneNode('defs', null, children);
}

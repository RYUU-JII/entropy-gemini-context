import React from 'react';

function renderArtifactSceneNode(node, keyPrefix = 'node') {
  if (node === null || node === undefined || node === false) {
    return null;
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return node;
  }

  if (React.isValidElement(node)) {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((child, index) => renderArtifactSceneNode(child, `${keyPrefix}-${index}`));
  }

  if (typeof node !== 'object') {
    return null;
  }

  const { tag, props = {}, children = [] } = node;
  if (typeof tag !== 'string' || !tag.trim()) {
    return null;
  }

  const { key, ...restProps } = props;
  const renderedChildren = Array.isArray(children)
    ? children.map((child, index) => renderArtifactSceneNode(child, `${keyPrefix}-${index}`))
    : renderArtifactSceneNode(children, `${keyPrefix}-0`);

  return React.createElement(
    tag,
    {
      key: key ?? keyPrefix,
      ...restProps,
    },
    renderedChildren,
  );
}

export default function ArtifactSvgStage({
  width,
  height,
  viewBox,
  defs = [],
  nodes = [],
  className = '',
  style,
  preserveAspectRatio = 'xMidYMid meet',
  ...rest
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      className={className}
      style={style}
      {...rest}
    >
      {Array.isArray(defs) && defs.length > 0 ? <defs>{defs.map((node, index) => renderArtifactSceneNode(node, `def-${index}`))}</defs> : null}
      {Array.isArray(nodes) ? nodes.map((node, index) => renderArtifactSceneNode(node, `scene-${index}`)) : renderArtifactSceneNode(nodes, 'scene-0')}
    </svg>
  );
}

export { renderArtifactSceneNode };

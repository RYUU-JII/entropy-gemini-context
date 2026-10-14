import React from 'react';

export const TEXT_STYLE = {
  letterSpacing: 'var(--preview-letter-spacing)',
  opacity: 'var(--preview-text-opacity)',
  textShadow: 'var(--preview-text-shadow)',
};

export const MEDIA_STYLE = {
  filter: 'var(--preview-media-filter)',
  willChange: 'filter',
};

export const ICON_STYLE = {
  transition: 'opacity 0.18s ease, filter 0.18s ease, transform 0.18s ease',
};

const SURFACE_MUTED_STYLE = Object.freeze({
  opacity: 0.16,
  filter: 'blur(6px) saturate(0.74)',
  transform: 'translateZ(0)',
  transition: 'opacity 0.18s ease, filter 0.18s ease, transform 0.18s ease',
});

export function PreviewText({ as: Component = 'div', className, style, isDynamic = false, children }) {
  const mergedStyle = { ...TEXT_STYLE, ...style };
  const dataAttrs = isDynamic ? { 'data-mock-dynamic-text': 'true' } : {};
  return (
    <Component className={className} style={mergedStyle} {...dataAttrs}>
      {children}
    </Component>
  );
}

export function PreviewMediaImg({ className, alt, src, decoding = 'async' }) {
  const classes = ['block', className].filter(Boolean).join(' ');
  const resolvedSrc = src || undefined;
  return (
    <img
      className={classes}
      decoding={decoding}
      alt={alt || ''}
      src={resolvedSrc}
      style={MEDIA_STYLE}
    />
  );
}

export function MockMetric({ kind, hidden, className, style, children }) {
  const classes = ['tabular-nums', className].filter(Boolean).join(' ');
  const mergedStyle = {
    ...TEXT_STYLE,
    ...style,
    ...(hidden ? { opacity: '0.22', filter: 'blur(7px)' } : null),
  };
  return (
    <span className={classes} style={mergedStyle} data-mock-metric-kind={kind}>
      {children}
    </span>
  );
}

export function MockSurface({
  as: Component = 'div',
  hidden = false,
  className,
  style,
  children,
}) {
  const mergedStyle = {
    ...style,
    ...(hidden ? SURFACE_MUTED_STYLE : null),
  };
  return (
    <Component className={className} style={mergedStyle} data-mock-surface={hidden ? 'muted' : 'clear'}>
      {children}
    </Component>
  );
}

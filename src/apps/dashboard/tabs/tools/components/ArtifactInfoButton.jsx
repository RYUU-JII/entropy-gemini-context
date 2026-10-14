import React from 'react';

/** The owning control keeps its explanation in the reading flow. */
export default function ArtifactInfoButton({ body = '', className = '' }) {
  const text = typeof body === 'string' ? body.trim() : '';
  if (!text) return null;
  return <p className={`text-[11px] leading-relaxed whitespace-pre-line text-on-surface-muted ${className}`}>
    {text}
  </p>;
}

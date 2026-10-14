import React from 'react';

/**
 * Standardized Typography Component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {'header' | 'label' | 'metric'} [props.variant='header']
 * @param {string} [props.className]
 */
export function UiHeader({ children, variant = 'header', className = '', ...props }) {
  const baseClasses = {
    header: 'ui-header-text text-xs',
    label: 'ui-label-text',
    metric: 'font-mono text-xl font-bold tracking-tighter text-on-surface',
  };

  const appliedClass = baseClasses[variant] || baseClasses.header;
  const Component = variant === 'label' ? 'span' : 'div';

  return (
    <Component className={`${appliedClass} ${className}`} {...props}>
      {children}
    </Component>
  );
}

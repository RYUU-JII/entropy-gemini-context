import React from 'react';

/**
 * Standardized Button Component
 *
 * @param {Object} props
 * @param {boolean} [props.active=false] - Active state styling
 * @param {boolean} [props.alert=false] - Danger/Alert state styling
 * @param {'sm' | 'md'} [props.size='md'] - Button size
 * @param {React.ReactNode} props.children
 */
export function UiButton({
  active = false,
  alert = false,
  size = 'md',
  className = '',
  children,
  ...props
}) {
  // Base classes are theme-token driven and intentionally neutral.
  let colorClass = 'border-accent/20 text-on-surface-muted hover:text-on-surface hover:border-accent';

  if (active) {
    colorClass = 'active bg-accent text-black border-accent';
  } else if (alert) {
    colorClass = 'border-danger/50 text-danger hover:border-danger hover:text-danger';
  }

  const sizeClass = size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-1';

  return (
    <button
      type="button"
      className={`ui-btn font-bold uppercase tracking-widest border transition-all ${colorClass} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

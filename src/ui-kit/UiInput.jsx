import React, { forwardRef } from 'react';

/**
 * Standardized Input Component
 * Enforces shared design-token consistency for text inputs.
 *
 * @param {Object} props
 * @param {boolean} [props.alert=false] - If true, uses the 'alert' (red) styling
 * @param {string} [props.className] - Additional classes
 */
export const UiInput = forwardRef(({ alert = false, className = '', ...props }, ref) => {
  const baseClass = alert ? 'ui-input-alert' : 'ui-input';

  return (
    <input
      ref={ref}
      className={`${baseClass} ${className}`}
      autoComplete="off"
      spellCheck="false"
      {...props}
    />
  );
});

UiInput.displayName = 'UiInput';

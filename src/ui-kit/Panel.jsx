import React from 'react';

/**
 * Standardized Unified Panel Component
 * Automatically adapts styles based on the active theme tokens.
 */
export function Panel({ children, className = '', ...props }) {
    const hasFlexDir = className.includes('flex-row') || className.includes('flex-col-reverse') || className.includes('flex-row-reverse');
    const directionClass = hasFlexDir ? '' : 'flex-col';

    // utilize theme-agnostic 'ui-module' class which responds to CSS variables
    const baseClass = `ui-module flex ${directionClass} h-full`;

    return (
        <div className={`${baseClass} ${className}`} {...props}>
            {children}
        </div>
    );
}

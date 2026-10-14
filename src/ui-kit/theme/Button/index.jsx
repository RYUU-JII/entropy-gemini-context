import React from 'react';
// Removed unused useTheme

// VARIANT: Molded (Entropy)
// Industrial, hard edges, click feedback, amber glow
// Uses ui-* classes styled by entropy.css but allows flexible width/aspect.
const MoldedButton = ({ children, className = '', withLamp = false, variant = 'default', ...props }) => {
    const isSquare = variant === 'control' || variant === 'square';
    const isAccent = variant === 'accent';

    return (
        <button
            className={`
                ui-ctrl-btn
                ${isAccent ? 'ui-ctrl-btn--accent' : ''}
                /* Layout Overrides: CSS defines square by default, override for text buttons */
                ${isSquare
                    ? 'flex flex-col items-center justify-center'
                    : '!w-auto !aspect-auto px-6 py-3 flex items-center justify-center gap-2'}
                ${className}
            `}
            {...props}
        >
            {withLamp && (
                <div className={`ui-btn-lamp ${isSquare ? 'mb-1.5' : '!mb-0'}`} />
            )}
            {children}
        </button>
    );
};

// WRAPPER
export const Button = ({ mode: propMode, ...props }) => {
    return <MoldedButton {...props} />;
};

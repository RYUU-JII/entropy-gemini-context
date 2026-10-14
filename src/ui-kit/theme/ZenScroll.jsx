import React from 'react';

const ZEN_SCROLL_PAPER_TEXTURE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E\")";

/**
 * ZenScroll - A wrapper component that provides a traditional scroll (Kakejiku) aesthetic.
 * Includes wooden rollers at the top and bottom with a parchment paper background.
 */
export default function ZenScroll({ children, className = "", contentClassName = "", showRollers = true, showString = false }) {
    const frameMarginClass = showRollers ? 'mx-4' : 'mx-0';
    const frameBorderClass = showRollers
        ? 'border-x border-[#D7CCC8]/30'
        : 'border border-[#D7CCC8]/35';

    return (
        <div className={`relative flex flex-col min-h-0 ${className}`}>
            {/* Top Roller (Wood) */}
            {showRollers && (
                <div className="shrink-0 h-4 relative z-30 mx-2 mb-[-4px]">
                    <div className="absolute inset-x-4 inset-y-0.5 bg-[#5D4037] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform group-hover:scale-x-[1.02]" />
                    <div className="absolute left-0 top-0 w-8 h-4 bg-[#4E342E] rounded-full shadow-sm" />
                    <div className="absolute right-0 top-0 w-8 h-4 bg-[#4E342E] rounded-full shadow-sm" />
                </div>
            )}

            {/* Scroll Content Area (Paper) */}
            <div className={`
                relative flex-1 min-h-0 z-20 ${frameMarginClass}
                bg-[#FCFAF2] 
                before:absolute before:inset-0 before:bg-noise-pattern before:opacity-[0.03] before:pointer-events-none
                shadow-[0_10px_40px_rgba(62,39,35,0.12),inset_0_0_80px_rgba(239,231,220,0.4)]
                ${frameBorderClass}
                ${contentClassName}
            `}>
                {/* Subtle paper texture overlay */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-multiply"
                    style={{ backgroundImage: ZEN_SCROLL_PAPER_TEXTURE }}
                />

                <div className="relative h-full overflow-y-auto fr-scroll custom-scrollbar-zen">
                    {children}
                </div>
            </div>

            {/* Bottom Roller (Wood) */}
            {showRollers && (
                <div className="shrink-0 h-5 relative z-30 mx-1 mt-[-4px]">
                    <div className="absolute inset-x-6 inset-y-0.5 bg-[#4E342E] rounded-full shadow-[0_-2px_6px_rgba(0,0,0,0.2)]" />
                    <div className="absolute left-0 top-0 w-10 h-5 bg-[#3E2723] rounded-full shadow-md" />
                    <div className="absolute right-0 top-0 w-10 h-5 bg-[#3E2723] rounded-full shadow-md" />
                </div>
            )}

            {/* Hanging String (Top) - Optional Decorative */}
            {showString && showRollers && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-32 h-6 border-t-[1.5px] border-x-[1.5px] border-[#8D6E63]/40 rounded-t-[120%] pointer-events-none" />
            )}
        </div>
    );
}

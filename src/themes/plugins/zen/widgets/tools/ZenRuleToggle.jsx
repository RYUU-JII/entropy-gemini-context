import React from 'react';

/**
 * Zen Theme Toggle Component
 * Concept: "Stone on Sand" (Karesansui)
 * - Replaces the standard "Switch" with a minimalist stone placement interaction.
 * - Uses the 'stone' color palette instead of 'green'.
 * - Slow, deliberate transitions (duration-500) to enforce mindfulness.
 */
export default function ZenRuleToggle({ label, description, checked, onChange }) {
    return (
        <div 
            onClick={() => onChange(!checked)}
            className="group flex items-center justify-between py-4 px-3 cursor-pointer hover:bg-stone-900/5 transition-colors duration-500 border-b border-stone-100 last:border-0"
        >
            <div className="flex flex-col gap-1">
                {/* Serif font for Zen aesthetic */}
                <span className={`font-serif text-sm tracking-widest transition-colors duration-500 ${checked ? 'text-stone-800 font-medium' : 'text-stone-400'}`}>
                    {label}
                </span>
                {description && (
                    <span className="text-[10px] text-stone-400 font-sans font-light tracking-wide">
                        {description}
                    </span>
                )}
            </div>

            {/* Toggle Mechanism: Stone & Line (Minimalist) */}
            <div className="relative w-10 h-6 flex items-center justify-center">
                {/* The Line (Sand Rake Trace) */}
                <div className={`absolute w-full h-[1px] transition-colors duration-700 ${checked ? 'bg-stone-600' : 'bg-stone-200'}`} />
                
                {/* The Stone (Go Stone style) */}
                <div className={`relative z-10 w-3 h-3 rounded-full shadow-sm transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${checked ? 'translate-x-3 bg-stone-800 scale-110' : '-translate-x-3 bg-stone-300 scale-90'}`} />
            </div>
        </div>
    );
}

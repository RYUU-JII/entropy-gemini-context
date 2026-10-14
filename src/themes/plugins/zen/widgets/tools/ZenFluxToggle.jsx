import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useDocumentVisibility } from '@/ui-kit/hooks/useDocumentVisibility';
import { useElementVisibility } from '@/ui-kit/hooks/useElementVisibility';

/**
 * ZenFluxToggle - "Fuchin" (Scroll Weight) Edition
 * 
 * Concept: A decorative stone weight (Fuchin) at the bottom of a hanging scroll.
 * - Interaction: "Grounding" the energy.
 * - OFF (Still): The stone sways gently, suspended in the air. Pale/Dormant.
 * - ON (Flow): The stone descends slightly to "lock" (ground) itself. Glows with Matcha Green energy.
 */
export default function ZenFluxToggle({ active, onChange, color = '#bef264' }) { // default: lime-300
    const isOn = !!active;
    const { t } = useAppTranslation('tools');
    const rootRef = useRef(null);
    const documentVisible = useDocumentVisibility();
    const inViewport = useElementVisibility(rootRef, { threshold: 0.08, rootMargin: '140px' });
    const shouldSway = !isOn && documentVisible && inViewport;

    return (
        <button
            ref={rootRef}
            onClick={(e) => { e.stopPropagation(); onChange(!isOn); }}
            className="group relative flex flex-col items-center justify-center focus:outline-hidden w-16 h-24 cursor-pointer z-50 pointer-events-auto"
            aria-label={isOn ? t('matrix.flux_toggle.deactivate_flow') : t('matrix.flux_toggle.activate_flow')}
            style={{ cursor: 'pointer' }} // Inline style force just in case
        >
            {/* 1. The String/Cord (Connecting to Scroll) */}
            <div className="absolute top-0 w-[2px] bg-stone-300 h-1/2 origin-top" />

            {/* 2. The Stone (Fuchin) */}
            <motion.div
                animate={{
                    y: isOn ? 12 : 0, // Moves down when grounded
                    rotate: shouldSway ? [0, 2, -2, 0] : 0, // Sways when suspended (OFF)
                    filter: isOn
                        ? `drop-shadow(0px 0px 15px ${color})` // Glow when ON
                        : 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))' // Shadow when OFF
                }}
                transition={{
                    y: { type: "spring", stiffness: 200, damping: 20 },
                    rotate: shouldSway
                        ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0.2, ease: "linear" },
                    filter: { duration: 0.5 }
                }}
                className={`relative w-10 h-14 rounded-full border-2 transition-colors duration-500 z-10 flex items-center justify-center overflow-hidden
                    ${isOn ? 'bg-stone-800 border-lime-800/50' : 'bg-stone-200 border-stone-300'}
                `}
            >
                {/* Stone Texture */}
                <div className="absolute inset-0 opacity-40 bg-noise-pattern mix-blend-overlay" />

                {/* Inner Symbol / Gem */}
                <motion.div
                    animate={{ scale: isOn ? 1 : 0.8, opacity: isOn ? 1 : 0.4 }}
                    className={`w-3 h-3 rounded-full ${isOn ? 'bg-lime-400' : 'bg-stone-400'}`}
                />
            </motion.div>

            {/* 3. Label (Vertical) */}
            <div className="absolute -right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 pointer-events-none">
                <span className={`text-[10px] font-serif uppercase tracking-widest writing-vertical-rl transition-colors duration-500 ${isOn ? 'text-lime-700 font-bold' : 'text-stone-400'}`}>
                    {isOn ? t('matrix.flux_toggle.flow') : t('matrix.flux_toggle.still')}
                </span>
            </div>

        </button>
    );
}

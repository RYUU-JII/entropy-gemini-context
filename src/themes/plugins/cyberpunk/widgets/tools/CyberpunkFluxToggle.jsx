import React from 'react';
import { motion } from 'framer-motion';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { getInteractionMotionStyle } from '@/themes/core/motion/index.js';

const SIZE_MAP = Object.freeze({
    sm: { height: 'h-9', text: 'text-[9px]', padding: 'px-2' },
    md: { height: 'h-12', text: 'text-[10px]', padding: 'px-3' },
});
const STABLE_INTERACTION_STYLE = getInteractionMotionStyle('stable');

export default function CyberpunkFluxToggle({
    active,
    onChange,
    color = '#00f3ff',
    size = 'md',
}) {
    const { t } = useAppTranslation('tools');
    const sizeTokens = SIZE_MAP[size] || SIZE_MAP.md;

    return (
        <motion.button
            onClick={() => onChange(!active)}
            className={`group relative w-full overflow-hidden border border-[#1a4569] bg-[#020815] font-mono ${sizeTokens.height}`}
            style={STABLE_INTERACTION_STYLE}
        >
            <motion.div
                className="absolute inset-0"
                initial={false}
                animate={{
                    opacity: active ? 1 : 0.14,
                    background:
                        active
                            ? `linear-gradient(90deg, ${color}20 0%, ${color}66 50%, #6a5cff44 100%)`
                            : 'linear-gradient(90deg, rgba(26,69,105,0.22) 0%, rgba(26,69,105,0.05) 100%)',
                }}
                transition={{ duration: 0.24 }}
            />

            <div
                className="pointer-events-none absolute inset-0 opacity-24"
                style={{
                    background:
                        'repeating-linear-gradient(180deg, rgba(0,243,255,0.1) 0px, rgba(0,243,255,0.1) 1px, transparent 1px, transparent 4px)',
                }}
            />

            <div className={`relative z-10 flex h-full items-center justify-between ${sizeTokens.padding}`}>
                <div className="flex items-center gap-1.5">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <motion.span
                            key={`cell-${index}`}
                            className="h-2 w-2 border border-[#2a5a81]"
                            animate={{
                                backgroundColor: active && index <= 2 ? color : '#041022',
                                boxShadow: active && index <= 2 ? `0 0 8px ${color}` : 'none',
                            }}
                            transition={{ duration: 0.18, delay: index * 0.03 }}
                        />
                    ))}
                </div>

                <span className={`${sizeTokens.text} font-black uppercase tracking-[0.18em] text-[#b3deff]`}>
                    {active ? t('artifacts.toggle_neural_armed') : t('artifacts.toggle_arm_neural')}
                </span>

                <motion.span
                    className={`${sizeTokens.text} font-black uppercase tracking-[0.2em]`}
                    animate={{ color: active ? color : '#7d8da1' }}
                    transition={{ duration: 0.18 }}
                >
                    {active ? t('status.on') : t('status.off')}
                </motion.span>
            </div>
        </motion.button>
    );
}

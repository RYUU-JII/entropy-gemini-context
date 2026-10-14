import React from 'react';
import { motion } from 'framer-motion';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { getInteractionMotionStyle } from '@/themes/core/motion/index.js';

const STABLE_INTERACTION_STYLE = getInteractionMotionStyle('stable');

export default function MatrixFluxToggle({ active, onChange, color = '#39ff14' }) {
    const { t } = useAppTranslation('tools');

    return (
        <motion.button
            onClick={() => onChange(!active)}
            className="group relative h-12 w-full overflow-hidden border border-[#14532d] bg-black font-mono"
            style={STABLE_INTERACTION_STYLE}
        >
            <motion.div
                className="absolute inset-0"
                initial={false}
                animate={{
                    opacity: active ? 1 : 0.12,
                    background:
                        active
                            ? `linear-gradient(90deg, ${color}22 0%, ${color}55 50%, ${color}22 100%)`
                            : 'linear-gradient(90deg, rgba(20,83,45,0.18) 0%, rgba(20,83,45,0.05) 100%)',
                }}
                transition={{ duration: 0.25 }}
            />

            <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                    background:
                        'repeating-linear-gradient(180deg, rgba(57,255,20,0.12) 0px, rgba(57,255,20,0.12) 1px, transparent 1px, transparent 4px)',
                }}
            />

            <div className="relative z-10 flex h-full items-center justify-between px-3">
                <div className="flex items-center gap-1.5">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <motion.span
                            key={`cell-${index}`}
                            className="h-2 w-2 border border-[#14532d]"
                            animate={{
                                backgroundColor: active && index <= 2 ? color : '#020402',
                                boxShadow: active && index <= 2 ? `0 0 8px ${color}` : 'none',
                            }}
                            transition={{ duration: 0.2, delay: index * 0.04 }}
                        />
                    ))}
                </div>

                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#bbf7d0]">
                    {active ? t('matrix.flux_toggle.armed') : t('matrix.flux_toggle.arm')}
                </span>

                <motion.span
                    className="text-[10px] font-black uppercase tracking-[0.18em]"
                    animate={{ color: active ? color : '#6b7280' }}
                    transition={{ duration: 0.2 }}
                >
                    {active ? t('status.on') : t('status.off')}
                </motion.span>
            </div>
        </motion.button>
    );
}

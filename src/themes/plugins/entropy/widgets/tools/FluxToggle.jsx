import React from 'react';
import { motion } from 'framer-motion';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { getInteractionMotionStyle } from '@/themes/core/motion/index.js';

const STABLE_INTERACTION_STYLE = getInteractionMotionStyle('stable');

export default function FluxToggle({ active, onChange, color = '#00ff41' }) {
    const { t } = useAppTranslation('tools');
    return (
        <motion.button
            onClick={() => onChange(!active)}
            className="group relative w-full h-12 flex items-center overflow-hidden rounded-sm border border-white/20 hover:border-white/40 transition-colors"
            style={STABLE_INTERACTION_STYLE}
        >
            {/* Active Fill Background */}
            <motion.div
                className="absolute inset-0 z-0 origin-left"
                initial={false}
                animate={{
                    scaleX: active ? 1 : 0,
                    backgroundColor: active ? color : '#000000',
                    opacity: active ? 0.9 : 0
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />

            {/* Glowing Edge when active */}
            <motion.div
                className="absolute inset-0 z-0 opacity-0"
                animate={{ opacity: active ? 1 : 0, boxShadow: `inset 0 0 20px ${color}` }}
            />

            {/* Content Container */}
            <div className="relative z-10 w-full flex justify-between items-center px-4">
                {/* Status Indicator Bar */}
                <div className="flex gap-1 h-3">
                    {[...Array(3)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="w-1 h-full rounded-sm bg-white/20"
                            animate={{
                                backgroundColor: active ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.2)',
                            }}
                        />
                    ))}
                </div>

                {/* Text Label */}
                <span
                    className="font-mono text-sm font-bold tracking-[0.2em] uppercase transition-colors duration-300"
                    style={{
                        color: active ? '#000' : 'rgba(255,255,255,0.7)',
                        textShadow: active ? 'none' : '0 0 10px rgba(0,0,0,0.5)'
                    }}
                >
                    {active ? t('artifacts.toggle_system_active') : t('artifacts.toggle_activate_system')}
                </span>
            </div>

            {/* Scanline Overlay */}
            <div className="absolute inset-0 pointer-events-none z-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20" />
        </motion.button>
    );
}

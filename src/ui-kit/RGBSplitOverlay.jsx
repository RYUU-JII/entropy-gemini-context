// RGBSplitOverlay.jsx
// RGB Split (Chromatic Aberration) overlay for page transitions
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * RGBSplitOverlay
 * 
 * Displays a brief RGB split (chromatic aberration) effect during page transitions.
 * Duration: 0.1s as per CHRONOS spec.
 * 
 * @param {boolean} isActive - Whether the transition effect should be visible
 */
export default function RGBSplitOverlay({ isActive = false }) {
    return (
        <AnimatePresence>
            {isActive && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.05 }}
                    className="fixed inset-0 z-[9998] pointer-events-none"
                    style={{ mixBlendMode: 'screen' }}
                >
                    {/* Red Channel - Offset Left */}
                    <div
                        className="absolute inset-0"
                        style={{
                            background: 'linear-gradient(90deg, rgba(255,0,0,0.15) 0%, transparent 50%)',
                            transform: 'translateX(-3px)',
                        }}
                    />

                    {/* Cyan Channel - Offset Right */}
                    <div
                        className="absolute inset-0"
                        style={{
                            background: 'linear-gradient(90deg, transparent 50%, rgba(0,255,255,0.15) 100%)',
                            transform: 'translateX(3px)',
                        }}
                    />

                    {/* Horizontal Scan Lines */}
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
                            backgroundSize: '100% 4px',
                        }}
                    />

                    {/* Random Noise Flash */}
                    <div
                        className="absolute inset-0 opacity-10"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                        }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}

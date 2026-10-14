// ZenRake.jsx
import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { useDocumentVisibility } from '@/ui-kit/hooks/useDocumentVisibility';
import { useElementVisibility } from '@/ui-kit/hooks/useElementVisibility';

// Cyber-Zen Rake (Kumade)
// Metaphor: Smoothing out the sands of time (history).
// Visual: Minimalist wooden rake moving over rippled digital sand.

export default function ZenRake({
    isActive = true,
    color = '#0ea5e9',
}) {
    const rootRef = useRef(null);
    const documentVisible = useDocumentVisibility();
    const inViewport = useElementVisibility(rootRef, { threshold: 0.08, rootMargin: '140px' });
    const shouldAnimate = isActive && documentVisible && inViewport;
    // Sand Ripples
    const ripples = Array.from({ length: 6 }).map((_, i) => i);

    return (
        <div ref={rootRef} className="relative w-[300px] h-[300px] flex flex-col items-center justify-center overflow-hidden pointer-events-none rounded-full">
            {/* Base/Sand container */}
            <div className="absolute inset-0 bg-neutral-900/50 rounded-full" />

            {/* Sand Ripples (Static or Subtle Shift) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 opacity-30">
                {ripples.map((i) => (
                    <motion.div
                        key={i}
                        className="w-[120%] h-[2px] bg-current"
                        style={{ color: isActive ? color : '#555' }}
                        animate={shouldAnimate ? { x: [-10, 0, -10] } : { x: 0 }}
                        transition={shouldAnimate ? { duration: 4, repeat: Infinity, ease: "linear" } : { duration: 0.2, ease: "linear" }}
                    />
                ))}
            </div>

            {/* The Rake */}
            <motion.div
                className="absolute z-10"
                initial={{ x: -100, rotate: 15 }}
                animate={shouldAnimate ? { x: [-60, 60, -60] } : { x: 0 }}
                transition={shouldAnimate ? { duration: 6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2, ease: "linear" }}
            >
                {/* Handle */}
                <div className="w-[180px] h-2 bg-neutral-600 rounded-full -rotate-45 origin-bottom-right translate-y-8" />

                {/* Head */}
                <div className="flex gap-3">
                    {[1, 2, 3, 4, 5].map(t => (
                        <div key={t} className="w-1.5 h-10 bg-neutral-400 rounded-b-sm shadow-sm" />
                    ))}
                    {/* Horizontal bar holding tines */}
                    <div className="absolute top-0 left-0 w-full h-2 bg-neutral-500 rounded-sm" />
                </div>

                {/* Digital trail behind rake */}
                {isActive && (
                    <div className="absolute top-10 left-0 w-full h-20 opacity-20 bg-linear-to-b/srgb from-current to-transparent" style={{ color }} />
                )}
            </motion.div>

            {/* Entropy Overlay on Sand */}
            {isActive && (
                <motion.div
                    className="absolute inset-0 z-20 mix-blend-overlay opacity-30"
                    style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${color} 2px, ${color} 4px)` }}
                    animate={shouldAnimate ? { backgroundPosition: ["0% 0%", "0% 100%"] } : { backgroundPosition: "0% 0%" }}
                    transition={shouldAnimate ? { duration: 20, repeat: Infinity, ease: "linear" } : { duration: 0.2, ease: "linear" }}
                />
            )}
        </div>
    );
}

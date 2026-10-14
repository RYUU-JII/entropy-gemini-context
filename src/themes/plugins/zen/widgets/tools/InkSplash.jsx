// InkSplash.jsx
import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Digital Ink Splash (Sumi-e Entropy)
// Visual: Black/Neon ink droplets mixed with 0/1 characters flying upwards.

export default function ZenInkSplash({
    isActive = false,
    color = '#000000', // Ink color (usually black or dark blurred)
    accentColor = '#ef4444', // Entropy accent
    count = 12, // Number of major droplets
    onComplete
}) {
    // Generate static particle config to avoid re-renders
    const particles = useMemo(() => {
        return Array.from({ length: count }).map((_, i) => ({
            id: i,
            x: (Math.random() - 0.5) * 150, // Spread horizontally
            y: -100 - Math.random() * 150, // Shoot UPWARDS (negative Y)
            scale: 0.5 + Math.random() * 1.5,
            rotation: Math.random() * 360,
            delay: Math.random() * 0.1,
            isEntropyGlyph: Math.random() > 0.7, // 30% chance to be a entropy glyph
            char: Math.random() > 0.5 ? '1' : '0',
            duration: 0.6 + Math.random() * 0.4
        }));
    }, [count]);

    return (
        <AnimatePresence onExitComplete={onComplete}>
            {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 overflow-visible pointer-events-none z-50">
                    {particles.map((p) => (
                        <motion.div
                            key={p.id}
                            initial={{
                                x: 0,
                                y: 0,
                                opacity: 1,
                                scale: 0
                            }}
                            animate={{
                                x: p.x,
                                y: p.y,
                                opacity: 0,
                                scale: p.scale,
                                rotate: p.rotation
                            }}
                            transition={{
                                duration: p.duration,
                                ease: [0.22, 1, 0.36, 1], // Custom cubic-bezier for "splash" feel
                                delay: p.delay
                            }}
                            className="absolute flex items-center justify-center font-mono font-bold"
                            style={{
                                color: p.isEntropyGlyph ? accentColor : color,
                                textShadow: p.isEntropyGlyph ? `0 0 5px ${accentColor}` : 'none',
                                // Ink blob styling if not text
                                width: p.isEntropyGlyph ? 'auto' : `${8 * p.scale}px`,
                                height: p.isEntropyGlyph ? 'auto' : `${8 * p.scale}px`,
                                borderRadius: p.isEntropyGlyph ? '0' : '40% 60% 70% 30% / 40% 50% 60% 50%', // Blobby shape
                                backgroundColor: p.isEntropyGlyph ? 'transparent' : color,
                            }}
                        >
                            {p.isEntropyGlyph && p.char}
                        </motion.div>
                    ))}

                    {/* Main Impact Ring */}
                    <motion.div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2"
                        style={{ borderColor: accentColor }}
                        initial={{ width: 10, height: 10, opacity: 1, borderWidth: 4 }}
                        animate={{ width: 200, height: 200, opacity: 0, borderWidth: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>
            )}
        </AnimatePresence>
    );
}

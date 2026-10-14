import { resolveRasterResolution } from '@/platform/rendering/renderBudgetContract.js';
import { observeDevicePixelRatio, readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
import React, { useEffect, useRef } from 'react';
import { runRenderLoop } from '@/platform/rendering/renderLoop.js';

const STAR_COUNT = 400;

export default function Starfield() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        // Set canvas size
        const resizeCanvas = () => {
            const { innerWidth, innerHeight } = window;
            // Handle high DPI displays
            const { effectivePixelRatio: dpr, pixelWidth, pixelHeight } = resolveRasterResolution({ cssWidth: Math.max(1, innerWidth), cssHeight: Math.max(1, innerHeight), devicePixelRatio: readDevicePixelRatio(),
            pixelRatioCap: 2, maxRenderPixels: 8_294_400 });
            if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
            if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
            canvas.style.width = `${innerWidth}px`;
            canvas.style.height = `${innerHeight}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        const stopDpr = observeDevicePixelRatio({ onChange: resizeCanvas });
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Initialize stars
        const stars = [];
        const layers = [
            { speed: 0.05, size: 0.5, count: STAR_COUNT, opacity: 0.5 },           // Far (Tiny, slow)
            { speed: 0.1, size: 1.0, count: Math.floor(STAR_COUNT / 2), opacity: 0.7 }, // Mid
            { speed: 0.2, size: 1.5, count: Math.floor(STAR_COUNT / 4), opacity: 0.9 }  // Near (Brighter, faster)
        ];

        // Create stars
        layers.forEach(layer => {
            for (let i = 0; i < layer.count; i++) {
                stars.push({
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight,
                    size: layer.size * (0.8 + Math.random() * 0.4), // Slight size variation
                    speed: layer.speed * (0.9 + Math.random() * 0.2), // Slight speed variation
                    baseOpacity: layer.opacity,
                    // Add slight random flicker
                    flicker: Math.random() * Math.PI * 2,
                    flickerSpeed: 0.01 + Math.random() * 0.03
                });
            }
        });

        // Animation Loop with delta time normalization
        const render = ({ elapsedMs: deltaTime = 16.67 } = {}) => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const speedMultiplier = deltaTime / 16.67;

            ctx.clearRect(0, 0, width, height);

            stars.forEach(star => {
                // Update position
                star.y += star.speed * speedMultiplier;

                // Reset if off screen
                if (star.y > height) {
                    star.y = -5;
                    star.x = Math.random() * width;
                }

                // Update flicker
                star.flicker += star.flickerSpeed * speedMultiplier;
                // Subtle flicker: oscillates slightly around base opacity
                const opacity = Math.min(1, Math.max(0.1, star.baseOpacity + Math.sin(star.flicker) * 0.15));

                // Draw
                ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                ctx.beginPath();
                // Use arc for circular stars
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            });
        };

        const stopLoop = runRenderLoop({
            pauseWhenDocumentHidden: true,
            respectReducedMotion: true,
            onRender: render,
        });

        return () => {
            stopLoop();
            window.removeEventListener('resize', resizeCanvas);
            stopDpr();
        };
    }, []);

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Vignette Overlay (Helmet/Window Effect) */}
            <div
                className="absolute inset-0 z-10"
                style={{
                    background: 'radial-gradient(circle at center, transparent 40%, rgba(0, 0, 0, 0.4) 80%, rgba(0, 0, 0, 0.8) 100%)',
                    pointerEvents: 'none',
                }}
            />
            <canvas
                ref={canvasRef}
                className="block w-full h-full"
            />
        </div>
    );
}

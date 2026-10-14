import { resolveRasterResolution } from '@/platform/rendering/renderBudgetContract.js';
import { observeDevicePixelRatio, readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
import React, { useEffect, useRef } from 'react';
import { runRenderLoop } from '@/platform/rendering/renderLoop.js';

export default function MatrixRain({
    className = 'fixed inset-0 overflow-hidden pointer-events-none z-0',
    style = {},
    canvasClassName = 'block w-full h-full',
    canvasStyle = {},
}) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;
        let rasterSignature = '';
        const fontSize = 14;
        let columns = Math.floor(width / fontSize);
        let drops = Array(columns).fill(1);
        const chars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ01234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        const resize = () => {
            const { innerWidth, innerHeight } = window;
            const { effectivePixelRatio: dpr, pixelWidth, pixelHeight } = resolveRasterResolution({ cssWidth: Math.max(1, innerWidth), cssHeight: Math.max(1, innerHeight), devicePixelRatio: readDevicePixelRatio(),
            pixelRatioCap: 2, maxRenderPixels: 8_294_400 });
            const signature = `${innerWidth}:${innerHeight}:${pixelWidth}:${pixelHeight}:${dpr}`;
            if (rasterSignature === signature) return;
            rasterSignature = signature;
            width = innerWidth;
            height = innerHeight;
            if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
            if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
            canvas.style.width = `${innerWidth}px`;
            canvas.style.height = `${innerHeight}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            columns = Math.floor(width / fontSize);
            drops = Array(columns).fill(1);
        };

        const stopDpr = observeDevicePixelRatio({ onChange: resize });
        window.addEventListener('resize', resize);
        resize();

        // 테마의 메인 녹색 변수를 가져옵니다.
        const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--terminal-primary').trim() || '#00ff41';

        const draw = () => {
            ctx.globalAlpha = 1.0;
            // Trail effect adjustment
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(0, 0, width, height);

            ctx.globalAlpha = 0.15; // Much dimmer for background feel
            ctx.fillStyle = themeColor;
            ctx.font = `${fontSize}px monospace`;

            for (let i = 0; i < drops.length; i++) {
                const text = chars.charAt(Math.floor(Math.random() * chars.length));
                ctx.fillText(text, i * fontSize, drops[i] * fontSize);

                // Randomly reset drop to top
                if (drops[i] * fontSize > height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        };

        const stopLoop = runRenderLoop({
            targetFps: 60,
            pauseWhenDocumentHidden: true,
            respectReducedMotion: true,
            onRender: draw,
        });

        return () => {
            stopLoop();
            window.removeEventListener('resize', resize);
            stopDpr();
        };
    }, []);

    return (
        <div className={className} style={style}>
            <canvas
                ref={canvasRef}
                className={canvasClassName}
                style={{ background: '#000', ...canvasStyle }}
            />
        </div>
    );
}

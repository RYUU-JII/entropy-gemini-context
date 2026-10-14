import { useId, useMemo } from 'react';
import { createWavePath } from '../artworkMath.js';

const compositions = [
    { centerX: 244, centerY: 227, phase: 0, turns: 3, color: '#cbe5ac' },
    { centerX: 716, centerY: 227, phase: 0.8, turns: 5, color: '#d5bbef' },
    { centerX: 244, centerY: 555, phase: 1.9, turns: 7, color: '#e9b49c' },
    { centerX: 716, centerY: 555, phase: 2.7, turns: 4, color: '#a7cbda' },
];

const galleryCompositions = {
    bloom: { centerX: 480, centerY: 390, phase: 0.1, turns: 5, color: '#e9b49c', name: 'CORAL / BLOOM', stretch: 1.08 },
    wave: { centerX: 480, centerY: 390, phase: 1.4, turns: 2, color: '#a7cbda', name: 'BLUE / WAVE', stretch: 1.42 },
    fold: { centerX: 480, centerY: 390, phase: 2.7, turns: 1, color: '#dfc38e', name: 'GOLD / FOLD', stretch: 0.75 },
};

export default function GenerativeArtwork({ variant }) {
    const id = useId().replaceAll(':', '');
    const single = variant !== undefined;
    if (single && !Object.hasOwn(galleryCompositions, variant)) {
        throw new Error(`Unsupported generative artwork variant: ${String(variant)}`);
    }
    const shapes = useMemo(() => {
        const isSingle = variant !== undefined;
        const selectedCompositions = isSingle ? [galleryCompositions[variant]] : compositions;
        return selectedCompositions.map(composition => ({
            ...composition,
            paths: Array.from({ length: isSingle ? 48 : 25 }, (_, index) => createWavePath({
                centerX: composition.centerX,
                centerY: composition.centerY,
                radius: (isSingle ? 28 : 22) + index * 4.8,
                turns: composition.turns,
                phase: composition.phase + index * 0.08,
                stretch: isSingle ? composition.stretch : 1.12,
            })),
        }));
    }, [variant]);

    return (
        <div className={`feed-art-generative feed-art-frame${single ? ' feed-art-generative--single' : ''}`} aria-hidden="true">
            <svg className="feed-art-svg" viewBox="0 0 960 780" focusable="false">
                <defs><radialGradient id={`${id}-paper`}><stop stopColor="#26252c" /><stop offset="1" stopColor="#191b20" /></radialGradient></defs>
                <rect width="960" height="780" fill={`url(#${id}-paper)`} />
                <path d={single ? 'M480 97 V700 M72 390 H888' : 'M480 97 V700 M36 390 H924'} fill="none" stroke="#8a8b86" strokeWidth="0.6" opacity={single ? '0.12' : '0.26'} />
                <g stroke="#70746c" strokeWidth="0.6" opacity="0.3"><path d="M36 97 H924 M36 700 H924" /><path d="M36 93 V101 M924 93 V101 M36 696 V704 M924 696 V704" /></g>
                {shapes.map((shape) => (
                    <g key={shape.turns}>
                        <circle cx={shape.centerX} cy={shape.centerY} r={single ? '286' : '152'} fill="none" stroke={shape.color} strokeWidth="0.4" strokeDasharray="1 6" opacity="0.25" />
                        <g fill="none" stroke={shape.color} strokeWidth={single ? '1' : '0.8'}>{shape.paths.map((path, pathIndex) => <path key={pathIndex} d={path} opacity={0.3 + pathIndex / (single ? 70 : 40)} />)}</g>
                        <circle cx={shape.centerX} cy={shape.centerY} r="2" fill={shape.color} />
                    </g>
                ))}
            </svg>
        </div>
    );
}

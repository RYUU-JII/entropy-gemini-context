import { useId, useMemo } from 'react';
import { createArtRandom } from '../artworkMath.js';

function Landscape({ id, variant }) {
    const moonlit = variant === 'moon';
    const terrain = useMemo(() => {
        const random = createArtRandom(633);
        return Array.from({ length: 32 }, (_, row) => {
            const path = [];
            for (let column = 0; column <= 100; column += 1) {
                const x = column * 9.6;
                const ridge = Math.sin(column * 0.055 + 0.9) * 77 + Math.sin(column * 0.14 - row * 0.075) * 29;
                const y = 315 + row * 8.3 + ridge * (1 - row * 0.012) + random() * 1.3;
                path.push(`${column === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
            }
            return `${path.join(' ')} L960 600 H0 Z`;
        });
    }, []);
    return (
        <>
            <svg className="feed-art-svg" viewBox="0 0 960 600" focusable="false">
                <defs>
                    <linearGradient id={`${id}-landscape`} x2="0" y2="1"><stop stopColor={moonlit ? '#192637' : '#443233'} /><stop offset="0.55" stopColor={moonlit ? '#5d7483' : '#bf8c70'} /><stop offset="1" stopColor="#252c29" /></linearGradient>
                    <radialGradient id={`${id}-sun`}><stop stopColor={moonlit ? '#d3e0d9' : '#ffdab0'} stopOpacity="0.2" /><stop offset="1" stopColor="#d2a77a" stopOpacity="0" /></radialGradient>
                    <linearGradient id={`${id}-terrain`} x2="0" y2="1"><stop stopColor={moonlit ? '#293b40' : '#3e3d31'} /><stop offset="1" stopColor="#182121" /></linearGradient>
                </defs>
                <rect width="960" height="600" fill={`url(#${id}-landscape)`} />
                <circle cx="540" cy="211" r="180" fill={`url(#${id}-sun)`} />
                <circle cx="540" cy="211" r="57" fill={moonlit ? '#d6ddd0' : '#f6cda6'} opacity="0.9" />
                <path d="M0 272 Q170 227 300 284 T640 271 T960 281" stroke="#edcbb3" strokeWidth="0.6" fill="none" opacity="0.25" />
                {terrain.map((path, index) => <path key={index} d={path} fill={`url(#${id}-terrain)`} stroke={moonlit ? '#8da5a2' : '#bfab83'} strokeWidth="0.65" strokeOpacity={0.18 + index / 100} />)}
                <path d="M540 268 V278 M535 273 H545" stroke="#ede3cd" strokeWidth="0.6" opacity="0.7" />
            </svg>
        </>
    );
}

function Typography({ id }) {
    return (
        <>
            <svg className="feed-art-svg" viewBox="0 0 960 600" focusable="false">
                <defs><radialGradient id={`${id}-type`}><stop stopColor="#e5e2d7" /><stop offset="1" stopColor="#c9c9bc" /></radialGradient></defs>
                <rect width="960" height="600" fill={`url(#${id}-type)`} />
                <path d="M48 99 H912 M48 500 H912" stroke="#676e5d" strokeWidth="0.5" opacity="0.5" />
                <text x="480" y="245" textAnchor="middle" fill="#343d32" fontSize="94" fontWeight="500" letterSpacing="-5">The next thing</text>
                <text x="480" y="354" textAnchor="middle" fill="#343d32" fontSize="94" fontWeight="500" letterSpacing="-5">can wait.</text>
                <circle cx="480" cy="430" r="16" fill="none" stroke="#53634c" strokeWidth="0.8" />
                <path d="M474 430 H486 M480 424 V436" stroke="#53634c" strokeWidth="0.8" />
            </svg>
        </>
    );
}

export default function AmbientArtwork({ type, variant }) {
    const id = useId().replaceAll(':', '');
    const renderers = { landscape: Landscape, typography: Typography };
    if (!Object.hasOwn(renderers, type)) throw new Error(`Unsupported ambient artwork: ${String(type)}`);
    const Artwork = renderers[type];
    return <div className={`feed-art-ambient feed-art-ambient--${type} feed-art-frame`} aria-hidden="true"><Artwork id={id} variant={variant} /></div>;
}

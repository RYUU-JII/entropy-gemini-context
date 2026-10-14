import { useId, useMemo } from 'react';
import { createArtRandom } from '../artworkMath.js';

// Every photo of the fictional account is taken from one window, so the same
// skyline and red roof recur at the lower right.
const SKIES = {
    'dusk-1842': ['#262b58', '#6f4c86', '#d96f6c', '#ffc27a'],
    'dusk-1907': ['#0d1330', '#272c5a', '#7a4a6e', '#d4806a'],
    roof: ['#4f5666', '#7c818f', '#a3a3a8', '#bdb4ac'],
    note: ['#2c3158', '#7b5585', '#df7f6e', '#f7c486'],
};

function createSkyline(seed) {
    const random = createArtRandom(seed);
    const points = ['M0 600 L0 488'];
    let x = 0;
    while (x < 960) {
        const width = 34 + random() * 70;
        const height = 470 + random() * 52;
        points.push(`L${x.toFixed(1)} ${height.toFixed(1)} L${(x + width).toFixed(1)} ${height.toFixed(1)}`);
        x += width;
    }
    points.push('L960 600 Z');
    return points.join(' ');
}

function SkyGradient({ id, colors }) {
    return (
        <linearGradient id={id} x2="0" y2="1">
            <stop stopColor={colors[0]} />
            <stop offset="0.42" stopColor={colors[1]} />
            <stop offset="0.74" stopColor={colors[2]} />
            <stop offset="1" stopColor={colors[3]} />
        </linearGradient>
    );
}

function Clouds({ seed, color, opacity }) {
    const clouds = useMemo(() => {
        const random = createArtRandom(seed);
        return Array.from({ length: 7 }, (_, index) => ({
            id: index,
            x: random() * 900 - 60,
            y: 90 + random() * 260,
            width: 140 + random() * 260,
            height: 6 + random() * 12,
        }));
    }, [seed]);
    return (
        <g fill={color} opacity={opacity}>
            {clouds.map((cloud) => <rect key={cloud.id} x={cloud.x} y={cloud.y} width={cloud.width} height={cloud.height} rx={cloud.height / 2} />)}
        </g>
    );
}

function RedRoof({ scale = 1 }) {
    return (
        <g transform={`translate(${812 - (scale - 1) * 90} ${480 - (scale - 1) * 40}) scale(${scale})`}>
            <path d="M0 40 L58 0 L116 40 Z" fill="#c4312c" />
            <path d="M58 0 L116 40 L110 40 L58 4 Z" fill="#8f211f" />
            <rect x="12" y="40" width="92" height="80" fill="#2a2228" />
            <rect x="30" y="56" width="16" height="14" fill="#f2c27f" opacity="0.8" />
        </g>
    );
}

function SkyPhoto({ id, variant }) {
    const colors = SKIES[variant];
    const skyline = useMemo(() => createSkyline(variant === 'dusk-1907' ? 91 : 57), [variant]);
    const roof = variant === 'roof';
    return (
        <svg className="feed-art-svg" viewBox="0 0 960 600" preserveAspectRatio="xMidYMid slice" focusable="false">
            <defs>
                <SkyGradient id={`${id}-sky`} colors={colors} />
                <radialGradient id={`${id}-glow`} cx="38%" cy="78%" r="55%">
                    <stop stopColor={colors[3]} stopOpacity={roof ? 0.25 : 0.75} />
                    <stop offset="1" stopColor={colors[3]} stopOpacity="0" />
                </radialGradient>
            </defs>
            <rect width="960" height="600" fill={`url(#${id}-sky)`} />
            <rect width="960" height="600" fill={`url(#${id}-glow)`} />
            {!roof && <circle cx="366" cy={variant === 'dusk-1907' ? 486 : 452} r="30" fill="#ffe2b0" opacity="0.92" />}
            <Clouds seed={variant === 'roof' ? 12 : variant === 'dusk-1907' ? 44 : 7} color={roof ? '#6b707d' : '#3c2f57'} opacity={roof ? 0.7 : 0.35} />
            {roof && <Clouds seed={29} color="#5d6270" opacity={0.6} />}
            <path d={skyline} fill="#1c1d27" />
            <RedRoof scale={roof ? 2.1 : 1} />
        </svg>
    );
}

function Archive({ id }) {
    const cells = useMemo(() => {
        const random = createArtRandom(3127);
        const palettes = Object.values(SKIES);
        return Array.from({ length: 40 }, (_, index) => {
            const column = index % 8;
            const row = Math.floor(index / 8);
            const palette = palettes[Math.floor(random() * palettes.length)];
            return { index, x: 48 + column * 110, y: 34 + row * 108, palette, horizon: 70 + random() * 14 };
        });
    }, []);
    return (
        <svg className="feed-art-svg" viewBox="0 0 960 600" preserveAspectRatio="xMidYMid slice" focusable="false">
            <defs>
                {cells.map((cell) => <SkyGradient key={cell.index} id={`${id}-cell-${cell.index}`} colors={cell.palette} />)}
            </defs>
            <rect width="960" height="600" fill="#141519" />
            {cells.map((cell) => (cell.index === cells.length - 1 ? (
                <g key={cell.index}>
                    <rect x={cell.x} y={cell.y} width="98" height="96" rx="3" fill="none" stroke="#6b6a72" strokeWidth="1.2" strokeDasharray="5 5" />
                    <text x={cell.x + 49} y={cell.y + 54} textAnchor="middle" fill="#8b8a92" fontSize="15">3,128</text>
                </g>
            ) : (
                <g key={cell.index}>
                    <rect x={cell.x} y={cell.y} width="98" height="96" rx="3" fill={`url(#${id}-cell-${cell.index})`} />
                    <rect x={cell.x} y={cell.y + cell.horizon} width="98" height={96 - cell.horizon} fill="#1c1d27" />
                    <path d={`M${cell.x + 80} ${cell.y + cell.horizon} l7 -5 l7 5 Z`} fill="#c4312c" />
                </g>
            )))}
        </svg>
    );
}

function WindowNote({ id }) {
    const skyline = useMemo(() => createSkyline(57), []);
    return (
        <svg className="feed-art-svg" viewBox="0 0 960 600" preserveAspectRatio="xMidYMid slice" focusable="false">
            <defs>
                <SkyGradient id={`${id}-sky`} colors={SKIES.note} />
                <linearGradient id={`${id}-wood`} x2="1" y2="1">
                    <stop stopColor="#4a3a30" />
                    <stop offset="1" stopColor="#2e241f" />
                </linearGradient>
            </defs>
            <rect width="960" height="600" fill={`url(#${id}-sky)`} />
            <circle cx="520" cy="450" r="30" fill="#ffe2b0" opacity="0.9" />
            <Clouds seed={7} color="#3c2f57" opacity={0.35} />
            <path d={skyline} fill="#1c1d27" />
            <RedRoof />
            <g fill={`url(#${id}-wood)`}>
                <rect width="960" height="34" />
                <rect y="556" width="960" height="44" />
                <rect width="40" height="600" />
                <rect x="920" width="40" height="600" />
                <rect x="464" width="30" height="600" />
            </g>
            <g transform="rotate(-4 120 470)">
                <rect x="66" y="420" width="112" height="104" fill="#f2d76b" />
                <rect x="66" y="420" width="112" height="14" fill="#e6c95a" />
                <text x="122" y="468" textAnchor="middle" fill="#3a3229" fontSize="22" fontWeight="600">18:40</text>
                <text x="122" y="500" textAnchor="middle" fill="#3a3229" fontSize="20">언덕</text>
            </g>
        </svg>
    );
}

export default function SkyArtwork({ variant }) {
    const id = useId().replaceAll(':', '');
    let artwork;
    if (variant === 'archive') artwork = <Archive id={id} />;
    else if (variant === 'note') artwork = <WindowNote id={id} />;
    else if (Object.hasOwn(SKIES, variant)) artwork = <SkyPhoto id={id} variant={variant} />;
    else throw new Error(`Unsupported sky artwork: ${String(variant)}`);
    return <div className="feed-art-sky feed-art-frame" aria-hidden="true">{artwork}</div>;
}

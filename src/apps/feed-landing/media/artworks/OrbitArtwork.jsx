import { useId, useMemo, useRef, useState } from 'react';
import { createWavePath } from '../artworkMath.js';

export default function OrbitArtwork({ reducedMotion }) {
    const id = useId().replaceAll(':', '');
    const surface = useRef(null);
    const [position, setPosition] = useState({ x: 480, y: 285 });
    const [iteration, setIteration] = useState(0);
    const wavePaths = useMemo(() => Array.from({ length: 37 }, (_, index) => createWavePath({
        centerX: 480 + (position.x - 480) * (index / 100),
        centerY: 298 + (position.y - 298) * (index / 120),
        radius: 100 + index * 3.8,
        phase: index * 0.11 + iteration * 1.3 + (position.x - 480) * 0.002,
        turns: 3 + iteration % 3,
        stretch: 1.15 + Math.abs(position.x - 480) * 0.0004,
    })), [position, iteration]);

    function moveFlow(event) {
        if (reducedMotion) return;
        const bounds = surface.current.getBoundingClientRect();
        setPosition({
            x: ((event.clientX - bounds.left) / bounds.width) * 960,
            y: ((event.clientY - bounds.top) / bounds.height) * 600,
        });
    }

    return (
        <div ref={surface} className="feed-art-orbit feed-art-frame" onPointerMove={moveFlow} onPointerDown={moveFlow}>
            <div className="feed-art-orbit-decoration" aria-hidden="true">
                <svg className="feed-art-svg" viewBox="0 0 960 600" focusable="false">
                    <defs>
                        <radialGradient id={`${id}-field`}><stop stopColor="#334a2c" /><stop offset="0.7" stopColor="#18251c" /><stop offset="1" stopColor="#111b16" /></radialGradient>
                        <radialGradient id={`${id}-sphere`} cx="28%" cy="25%"><stop stopColor="#3a4b2f" /><stop offset="0.5" stopColor="#192018" /><stop offset="1" stopColor="#070f0d" /></radialGradient>
                        <linearGradient id={`${id}-line`} x2="1" y2="1"><stop stopColor="#6a894e" /><stop offset="0.35" stopColor="#d9eda4" /><stop offset="0.62" stopColor="#b8d77d" /><stop offset="1" stopColor="#47664a" /></linearGradient>
                    </defs>
                    <rect width="960" height="600" fill={`url(#${id}-field)`} />
                    <g stroke="#aac689" strokeWidth="0.4" opacity="0.18">
                        <path d="M480 45 V555 M70 298 H890" />
                        <circle cx="480" cy="298" r="263" fill="none" strokeDasharray="2 8" />
                        <circle cx="480" cy="298" r="80" fill="none" />
                        <path d="M140 70 L820 526 M140 526 L820 70" strokeDasharray="1 9" />
                    </g>
                    <g fill="none" stroke={`url(#${id}-line)`} strokeWidth="0.9">
                        {wavePaths.map((path, index) => <path key={index} d={path} opacity={0.35 + index / 65} />)}
                    </g>
                    <circle cx="480" cy="298" r="74" fill={`url(#${id}-sphere)`} stroke="#a7c076" strokeWidth="0.7" />
                    <ellipse cx="465" cy="283" rx="44" ry="52" fill="none" stroke="#95b16e" strokeWidth="0.5" opacity="0.25" transform="rotate(-25 465 283)" />
                    <circle cx="480" cy="298" r="2" fill="#d9eda4" />
                    <g fill="#d9eda4"><circle cx="176" cy="298" r="2" /><circle cx="784" cy="298" r="2" /><circle cx="480" cy="35" r="2" /><circle cx="480" cy="561" r="2" /></g>
                    <path d="M30 30 h18 M30 30 v18 M930 30 h-18 M930 30 v18 M30 570 h18 M30 570 v-18 M930 570 h-18 M930 570 v-18" fill="none" stroke="#bed791" strokeWidth="0.7" opacity="0.4" />
                </svg>
            </div>
            <button className="feed-art-remix" type="button" onClick={() => setIteration(value => value + 1)} aria-label="Generate a different orbit">Remix <span aria-hidden="true">↗</span></button>
        </div>
    );
}

import { useId, useMemo } from 'react';
import { createArtRandom } from '../artworkMath.js';

function createBuildings(seed, nightVariant) {
    const random = createArtRandom(seed);
    const rows = [
        { y: 338, count: 24, width: 37, height: 50, spread: 35 },
        { y: 394, count: 18, width: 50, height: 85, spread: 64 },
        { y: 457, count: 13, width: 72, height: 110, spread: 86 },
        { y: 538, count: 10, width: 98, height: 105, spread: 85 },
    ];
    const buildings = [];
    rows.forEach((row, rowIndex) => {
        for (let index = 0; index < row.count; index += 1) {
            // Leave a narrow diagonal corridor through the buildings for the illuminated street.
            if (rowIndex > 0 && index === Math.floor(row.count * 0.55)) continue;
            const width = row.width * (0.58 + random() * 0.45);
            const height = row.height + random() * row.spread;
            const depth = width * (0.26 + random() * 0.2);
            const x = index * (960 / row.count) - 25 + random() * 12;
            const y = row.y + random() * 12;
            const color = nightVariant ? ['#202c3e', '#172636', '#1b2537'][index % 3] : ['#2d2438', '#282235', '#212a39'][index % 3];
            const windows = [];
            const cell = rowIndex === 0 ? 7 : 9;
            const columns = Math.max(2, Math.floor((width - 7) / cell));
            const levels = Math.floor((height - 10) / cell);
            for (let column = 0; column < columns; column += 1) {
                for (let level = 0; level < levels; level += 1) {
                    if (random() < 0.51) continue;
                    const light = random();
                    windows.push({
                        x: x + 5 + column * cell,
                        y: y - height + 8 + level * cell,
                        width: cell * (0.21 + random() * 0.17),
                        height: cell * 0.36,
                        color: light < 0.38 ? '#efabb9' : light < 0.72 ? '#e5c2aa' : '#86ccde',
                        opacity: 0.3 + random() * 0.6,
                    });
                }
            }
            buildings.push({ x, y, width, height, depth, color, windows, sign: rowIndex === 2 && index % 4 === 0 });
        }
    });
    return buildings;
}

function Building({ building }) {
    const { x, y, width, height, depth, color, windows, sign } = building;
    const top = y - height;
    const rise = depth * 0.45;
    return (
        <g>
            <path d={`M${x} ${top} L${x + depth} ${top - rise} L${x + width + depth} ${top - rise} L${x + width} ${top} Z`} fill="#4b3b52" stroke="#766073" strokeWidth="0.55" />
            <path d={`M${x + width} ${top} L${x + width + depth} ${top - rise} L${x + width + depth} ${y - rise} L${x + width} ${y} Z`} fill="#171c2b" stroke="#514053" strokeWidth="0.5" />
            <rect x={x} y={top} width={width} height={height} fill={color} stroke="#735366" strokeWidth="0.45" />
            <path d={`M${x + 1} ${top + 1} H${x + width - 1}`} stroke="#f5a8c9" strokeWidth="1.1" opacity="0.7" />
            {windows.map((window, index) => <rect key={index} {...window} fill={window.color} />)}
            <path d={`M${x + width + depth * 0.38} ${top - rise * 0.38 + 7} V${y - rise * 0.38 - 5}`} stroke="#a36e8c" strokeWidth="0.7" opacity="0.5" />
            {sign && (
                <g>
                    <rect x={x + width - 4} y={top + 26} width="8" height="38" rx="1" fill="#da6a90" />
                    <path d={`M${x + width - 1} ${top + 32} v5 m0 4 v5 m0 4 v5 m0 4 v4`} stroke="#ffe7de" strokeWidth="2" />
                </g>
            )}
        </g>
    );
}

export default function CityArtwork({ variant }) {
    const id = useId().replaceAll(':', '');
    const nightVariant = variant === 'night' || variant === 'midnight';
    const buildings = useMemo(() => createBuildings(nightVariant ? 863 : 417, nightVariant), [nightVariant]);
    const stars = useMemo(() => {
        const random = createArtRandom(980);
        return Array.from({ length: 62 }, (_, index) => ({ id: index, x: random() * 960, y: 40 + random() * 230, r: 0.3 + random() * 0.6, opacity: 0.1 + random() * 0.45 }));
    }, []);

    return (
        <div className="feed-art-city feed-art-frame" aria-hidden="true">
            <svg className="feed-art-svg" viewBox="0 0 960 600" preserveAspectRatio="xMidYMid slice" focusable="false">
                <defs>
                    <linearGradient id={`${id}-sky`} x2="0" y2="1">
                        <stop stopColor={nightVariant ? '#0a152b' : '#211b34'} />
                        <stop offset="0.46" stopColor={nightVariant ? '#42526d' : '#925d80'} />
                        <stop offset="0.75" stopColor={nightVariant ? '#a47784' : '#db8b93'} />
                        <stop offset="1" stopColor="#252336" />
                    </linearGradient>
                    <radialGradient id={`${id}-bloom`} cx="54%" cy="54%" r="53%">
                        <stop stopColor="#ffbbab" stopOpacity="0.58" />
                        <stop offset="0.55" stopColor="#e783b9" stopOpacity="0.15" />
                        <stop offset="1" stopColor="#c871bc" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id={`${id}-ground`} x2="0" y2="1">
                        <stop stopColor="#5b465c" />
                        <stop offset="1" stopColor="#151b28" />
                    </linearGradient>
                    <linearGradient id={`${id}-tower`} x2="1" y2="1">
                        <stop stopColor="#16243c" />
                        <stop offset="0.5" stopColor="#293951" />
                        <stop offset="1" stopColor="#1b2034" />
                    </linearGradient>
                    <linearGradient id={`${id}-haze`} x2="0" y2="1">
                        <stop stopColor="#e69aaf" stopOpacity="0" />
                        <stop offset="0.7" stopColor="#e69aaf" stopOpacity="0.12" />
                        <stop offset="1" stopColor="#e69aaf" stopOpacity="0" />
                    </linearGradient>
                    <radialGradient id={`${id}-vignette`}>
                        <stop offset="0.5" stopColor="#0d1020" stopOpacity="0" />
                        <stop offset="1" stopColor="#0d1020" stopOpacity="0.58" />
                    </radialGradient>
                    <filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.5" /></filter>
                </defs>
                <rect width="960" height="600" fill={`url(#${id}-sky)`} />
                <rect width="960" height="470" fill={`url(#${id}-bloom)`} />
                {stars.map(star => <circle key={star.id} cx={star.x} cy={star.y} r={star.r} fill="#fff2e3" opacity={star.opacity} />)}
                <circle cx="702" cy="145" r="38" fill="#f5bec2" opacity="0.08" />
                <circle cx="702" cy="145" r="26" fill="#f6c6c7" opacity="0.83" />
                <path d="M64 194 C210 165 290 191 405 176 S680 178 801 153" fill="none" stroke="#dca3c0" strokeWidth="0.6" opacity="0.3" />
                <path d="M192 243 C310 222 468 249 618 222 S833 216 960 208" fill="none" stroke="#eeb1bb" strokeWidth="1" opacity="0.26" />
                <g fill="#5b4c69" opacity="0.5">
                    {Array.from({ length: 37 }, (_, index) => <rect key={index} x={index * 27} y={295 - (index * 13 % 46)} width={14 + index * 7 % 15} height={90 + index * 13 % 46} />)}
                </g>
                <rect y="320" width="960" height="280" fill={`url(#${id}-ground)`} />
                <path d="M552 332 C588 383 545 455 506 600 L599 600 C592 484 630 387 568 332 Z" fill="#1c2030" />
                <path d="M562 334 C613 401 554 498 554 600" fill="none" stroke="#ffb6a1" strokeWidth="2" opacity="0.9" />
                <path d="M553 336 C601 409 529 496 526 600" fill="none" stroke="#ed6aa9" strokeWidth="2.3" opacity="0.7" />
                {buildings.filter(building => building.y < 420).map((building, index) => <Building key={index} building={building} />)}
                <g>
                    <path d="M419 373 V154 L467 129 L508 154 V373 Z" fill={`url(#${id}-tower)`} stroke="#a5759c" strokeWidth="0.7" />
                    <path d="M467 129 V373 H508 V154 Z" fill="#151e31" opacity="0.76" />
                    <path d="M419 154 L467 129 L508 154 M467 129 V95 M426 161 V358 M502 161 V358" stroke="#e691bc" strokeWidth="1.3" fill="none" />
                    <path d="M432 179 H493 M432 187 H493 M432 235 H493 M432 243 H493 M432 291 H493 M432 299 H493 M432 347 H493" stroke="#89c0d3" strokeWidth="2.2" opacity="0.65" />
                    {Array.from({ length: 15 }, (_, index) => <path key={index} d={`M435 ${166 + index * 13} H455 M477 ${171 + index * 13} H489`} stroke="#ecc6c1" strokeWidth="1.1" opacity={index % 3 === 0 ? '0.8' : '0.3'} />)}
                    <circle cx="467" cy="95" r="2" fill="#ffcada" />
                    <circle cx="467" cy="95" r="4" fill="#ff98c1" filter={`url(#${id}-glow)`} />
                </g>
                {buildings.filter(building => building.y >= 420).map((building, index) => <Building key={index} building={building} />)}
                <path d="M-40 546 C185 472 284 471 421 505 S680 579 1000 490" stroke="#111a27" strokeWidth="24" fill="none" />
                <path d="M-40 539 C185 465 284 464 421 498 S680 572 1000 483" stroke="#d5a89f" strokeWidth="2.5" fill="none" />
                <path d="M-40 546 C185 472 284 471 421 505 S680 579 1000 490" stroke="#e1799d" strokeWidth="1.4" fill="none" />
                <path d="M0 553 C185 489 291 489 427 522 S680 594 960 515" stroke="#718b9f" strokeWidth="0.75" fill="none" opacity="0.5" />
                <g fill="#ffe1d0">
                    <rect x="165" y="493" width="39" height="5" rx="2.5" transform="rotate(-13 165 493)" />
                    <rect x="744" y="552" width="32" height="4" rx="2" transform="rotate(-5 744 552)" />
                    <rect x="520" y="514" width="17" height="3" rx="1.5" transform="rotate(17 520 514)" />
                </g>
                <rect y="210" width="960" height="225" fill={`url(#${id}-haze)`} />
                <rect width="960" height="600" fill={`url(#${id}-vignette)`} />
                <path d="M30 30 h18 M30 30 v18 M930 30 h-18 M930 30 v18 M30 570 h18 M30 570 v-18 M930 570 h-18 M930 570 v-18" fill="none" stroke="#f0d4df" strokeWidth="0.7" opacity="0.5" />
            </svg>
        </div>
    );
}

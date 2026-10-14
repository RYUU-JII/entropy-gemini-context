import { useId, useMemo, useState } from 'react';
import { ALIGNMENT_STARS, projectAlignment } from '../alignmentGeometry.js';
import '../alignment.css';

export default function AlignmentArtwork({ interactive = true }) {
    const id = useId().replaceAll(':', '');
    const [viewpoint, setViewpoint] = useState(12);
    const value = interactive ? viewpoint : 100;
    const points = useMemo(() => projectAlignment(value), [value]);
    const aligned = value >= 96;
    const solidity = Math.max(0, (value - 80) / 20);
    const renderLayer = (layer) => points.filter((point) => point.layer === layer).map((point, index) => (
        <circle key={`${layer}-${index}`} cx={point.x} cy={point.y} r={point.radius} fill={point.color} opacity={point.opacity} />
    ));

    return (
        <div className="feed-art-alignment feed-art-frame">
            <svg className="feed-art-svg" viewBox="0 0 960 600" role="img" aria-label={aligned ? '점들이 고리가 있는 행성으로 맞춰진 모습' : '깊이가 다른 빛의 점들 사이에 숨겨진 행성'}>
                <defs>
                    <radialGradient id={`${id}-space`} cx="53%" cy="45%" r="70%"><stop stopColor="#243b42" /><stop offset="0.55" stopColor="#15232d" /><stop offset="1" stopColor="#10151e" /></radialGradient>
                    <radialGradient id={`${id}-halo`}><stop stopColor="#83b8b0" stopOpacity="0.13" /><stop offset="1" stopColor="#83b8b0" stopOpacity="0" /></radialGradient>
                    <radialGradient id={`${id}-planet`} cx="28%" cy="20%" r="80%"><stop stopColor="#e7d8b5" /><stop offset="0.45" stopColor="#ad9471" /><stop offset="1" stopColor="#302b2b" /></radialGradient>
                </defs>
                <rect width="960" height="600" fill={`url(#${id}-space)`} />
                <ellipse cx="480" cy="265" rx="360" ry="265" fill={`url(#${id}-halo)`} />
                <g fill="#e1eceb">{ALIGNMENT_STARS.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={star.radius} opacity={star.opacity} />)}</g>
                <g>{renderLayer('back')}</g>
                <circle cx="480" cy="265" r="136" fill={`url(#${id}-planet)`} opacity={solidity * 0.92} />
                <g>{renderLayer('sphere')}</g>
                <g>{renderLayer('front')}</g>
            </svg>
            {interactive && (
                <div className="feed-alignment-control">
                    <label htmlFor={`${id}-viewpoint`} className="feed-sr-only">행성의 시점 돌리기</label>
                    <input id={`${id}-viewpoint`} type="range" min="0" max="100" step="1" value={viewpoint}
                        aria-valuetext={aligned ? '고리가 있는 행성이 나타났습니다' : '손잡이를 오른쪽으로 움직여 형태 맞추기'}
                        onChange={(event) => setViewpoint(Number(event.target.value))} />
                    <span aria-hidden="true" className={aligned ? 'is-aligned' : ''}>{aligned ? '맞는 각도를 찾았습니다' : '옆으로 돌려보기 →'}</span>
                    <span className="feed-sr-only" role="status">{aligned ? '고리가 있는 행성이 나타났습니다.' : ''}</span>
                </div>
            )}
        </div>
    );
}

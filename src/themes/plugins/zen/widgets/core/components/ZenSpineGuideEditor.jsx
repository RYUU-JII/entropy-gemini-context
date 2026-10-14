import React, { useCallback, useMemo, useRef, useState } from 'react';

import {
    fitSakuraMacroSpineGuideC1V1,
} from '../../../model/sakura/sakuraMacroSpineGuide';

const ROOT_Y_RATIO = 0.76;
const GUIDE_SCALE_RATIO = 0.64;

const resolveFrame = (element) => {
    const rect = element.getBoundingClientRect();
    const scale = Math.max(120, rect.height * GUIDE_SCALE_RATIO);
    return {
        rect,
        rootX: rect.width * 0.5,
        rootY: rect.height * ROOT_Y_RATIO,
        scale,
    };
};

const pointerToGuidePoint = (event, element) => {
    const frame = resolveFrame(element);
    return {
        x: (event.clientX - frame.rect.left - frame.rootX) / frame.scale,
        y: (event.clientY - frame.rect.top - frame.rootY) / frame.scale,
    };
};

const guidePointToScreen = (point, frame) => ({
    x: frame.rootX + (point.x * frame.scale),
    y: frame.rootY + (point.y * frame.scale),
});

const shapeToPath = (shape, frame) => {
    if (!shape?.segments?.length) return '';
    const first = guidePointToScreen({
        x: shape.segments[0].startX,
        y: shape.segments[0].startY,
    }, frame);
    return shape.segments.reduce((path, segment) => {
        const cp1 = guidePointToScreen({ x: segment.cp1X, y: segment.cp1Y }, frame);
        const cp2 = guidePointToScreen({ x: segment.cp2X, y: segment.cp2Y }, frame);
        const end = guidePointToScreen({ x: segment.endX, y: segment.endY }, frame);
        return `${path} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
    }, `M ${first.x} ${first.y}`);
};

export function ZenSpineGuideEditor({
    width = 1,
    height = 1,
    guide = null,
    enabled = false,
    mode = 'sculpted',
    adherence = 0.78,
    likeness = 0.72,
    onCommitStroke = null,
    onMoveAnchor = null,
    onModeChange = null,
    onAdherenceChange = null,
    onLikenessChange = null,
    onDisable = null,
    onReset = null,
    onClose = null,
}) {
    const svgRef = useRef(null);
    const drawRef = useRef(null);
    const dragRef = useRef(null);
    const [stroke, setStroke] = useState([]);
    const [hint, setHint] = useState('Start at the root mark, then draw toward the apex.');
    const frame = useMemo(() => ({
        rootX: Math.max(1, width) * 0.5,
        rootY: Math.max(1, height) * ROOT_Y_RATIO,
        scale: Math.max(120, Math.max(1, height) * GUIDE_SCALE_RATIO),
    }), [height, width]);
    const shape = useMemo(() => (
        guide ? fitSakuraMacroSpineGuideC1V1(guide) : null
    ), [guide]);
    const guidePath = useMemo(() => shapeToPath(shape, frame), [frame, shape]);
    const strokePath = useMemo(() => {
        if (!stroke.length) return '';
        return stroke.map((point, index) => {
            const screen = guidePointToScreen(point, frame);
            return `${index === 0 ? 'M' : 'L'} ${screen.x} ${screen.y}`;
        }).join(' ');
    }, [frame, stroke]);

    const handleBackgroundPointerDown = useCallback((event) => {
        if (event.button !== 0 || event.target !== event.currentTarget) return;
        const svg = svgRef.current;
        if (!svg) return;
        const point = pointerToGuidePoint(event, svg);
        if (Math.hypot(point.x, point.y) > 0.1) {
            setHint('Begin closer to the root mark.');
            return;
        }
        event.currentTarget.setPointerCapture?.(event.pointerId);
        drawRef.current = { pointerId: event.pointerId, points: [{ x: 0, y: 0 }] };
        setStroke([{ x: 0, y: 0 }]);
        setHint('Drawing… release to fit 3–7 editable anchors.');
    }, []);

    const handleBackgroundPointerMove = useCallback((event) => {
        const active = drawRef.current;
        const svg = svgRef.current;
        if (!active || active.pointerId !== event.pointerId || !svg) return;
        const point = pointerToGuidePoint(event, svg);
        const previous = active.points.at(-1);
        if (Math.hypot(point.x - previous.x, point.y - previous.y) < 0.008) return;
        active.points.push(point);
        setStroke([...active.points]);
    }, []);

    const finishStroke = useCallback((event) => {
        const active = drawRef.current;
        if (!active || active.pointerId !== event.pointerId) return;
        drawRef.current = null;
        if (active.points.length >= 2 && typeof onCommitStroke === 'function') {
            try {
                onCommitStroke(active.points);
                setHint('Guide fitted. Drag any pale anchor to refine it.');
            } catch (error) {
                setHint(error?.message?.includes('TOO_SHORT')
                    ? 'The stroke is too short. Draw a longer root-to-apex path.'
                    : 'The guide could not be fitted. Try drawing it again.');
            }
        }
        setStroke([]);
    }, [onCommitStroke]);

    const startAnchorDrag = useCallback((event, anchorIndex) => {
        if (anchorIndex === 0 || typeof onMoveAnchor !== 'function') return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        dragRef.current = { pointerId: event.pointerId, anchorIndex };
    }, [onMoveAnchor]);

    const moveAnchor = useCallback((event) => {
        const active = dragRef.current;
        const svg = svgRef.current;
        if (!active || active.pointerId !== event.pointerId || !svg) return;
        event.stopPropagation();
        onMoveAnchor?.(active.anchorIndex, pointerToGuidePoint(event, svg));
    }, [onMoveAnchor]);

    const stopAnchorDrag = useCallback((event) => {
        if (dragRef.current?.pointerId === event.pointerId) {
            dragRef.current = null;
            event.stopPropagation();
        }
    }, []);

    const nudgeAnchor = useCallback((event, anchorIndex, anchor) => {
        const step = event.shiftKey ? 0.025 : 0.01;
        const delta = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
        }[event.key];
        if (!delta) return;
        event.preventDefault();
        onMoveAnchor?.(anchorIndex, {
            x: anchor.x + delta[0],
            y: anchor.y + delta[1],
        });
    }, [onMoveAnchor]);

    return (
        <div
            className="absolute inset-0 z-40"
            data-testid="zen-spine-guide-editor"
            data-guide-enabled={enabled ? 'true' : 'false'}
            data-guide-mode={mode}
        >
            <svg
                ref={svgRef}
                viewBox={`0 0 ${Math.max(1, width)} ${Math.max(1, height)}`}
                className="absolute inset-0 h-full w-full touch-none"
                aria-label="Bonsai spine guide editor"
                onPointerDown={handleBackgroundPointerDown}
                onPointerMove={handleBackgroundPointerMove}
                onPointerUp={finishStroke}
                onPointerCancel={finishStroke}
            >
                <rect
                    x="0"
                    y="0"
                    width={Math.max(1, width)}
                    height={Math.max(1, height)}
                    fill="rgba(245,244,238,0.24)"
                    pointerEvents="none"
                />
                {guidePath && (
                    <path
                        d={guidePath}
                        fill="none"
                        stroke="rgba(47,72,57,0.88)"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        pointerEvents="none"
                    />
                )}
                {strokePath && (
                    <path
                        d={strokePath}
                        fill="none"
                        stroke="rgba(151,103,55,0.78)"
                        strokeWidth="2"
                        strokeDasharray="5 4"
                        strokeLinecap="round"
                        pointerEvents="none"
                    />
                )}
                <circle
                    cx={frame.rootX}
                    cy={frame.rootY}
                    r="9"
                    fill="rgba(47,72,57,0.16)"
                    stroke="rgba(47,72,57,0.78)"
                    strokeWidth="1.4"
                    pointerEvents="none"
                />
                {(guide?.anchors || []).map((anchor, anchorIndex) => {
                    const point = guidePointToScreen(anchor, frame);
                    const locked = anchorIndex === 0;
                    return (
                        <circle
                            key={anchor.id || anchorIndex}
                            cx={point.x}
                            cy={point.y}
                            r={locked ? 5 : 7}
                            fill={locked ? '#344D3D' : '#F8F3E7'}
                            stroke="#4D6656"
                            strokeWidth="1.6"
                            role={locked ? undefined : 'slider'}
                            tabIndex={locked ? undefined : 0}
                            aria-label={locked ? undefined : `Spine anchor ${anchorIndex}`}
                            className={locked ? '' : 'cursor-grab focus:outline-hidden'}
                            onPointerDown={(event) => startAnchorDrag(event, anchorIndex)}
                            onPointerMove={moveAnchor}
                            onPointerUp={stopAnchorDrag}
                            onPointerCancel={stopAnchorDrag}
                            onKeyDown={(event) => nudgeAnchor(event, anchorIndex, anchor)}
                        />
                    );
                })}
            </svg>

            <div className="pointer-events-auto absolute right-3 top-3 w-[min(280px,calc(100%-24px))] rounded-xl border border-stone-900/12 bg-[#FAF9F4]/94 p-3 shadow-lg backdrop-blur-md">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#344D3D]">
                            Spine guide
                        </p>
                        <p className="mt-0.5 text-[9px] font-semibold text-stone-500">
                            {guide ? `${guide.anchors.length} anchors · C1 Bézier` : 'Draw root → apex'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close spine editor"
                        className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[9px] font-black text-stone-600"
                    >
                        Done
                    </button>
                </div>
                <p className="mt-2 text-[9px] leading-4 text-stone-600" role="status">
                    {hint}
                </p>
                <div
                    className="mt-2 grid grid-cols-2 rounded-lg border border-stone-200 bg-stone-100/70 p-0.5"
                    role="group"
                    aria-label="Spine generation mode"
                >
                    {[
                        { id: 'sculpted', label: 'Sculpted' },
                        { id: 'inspired', label: 'Inspired' },
                    ].map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => onModeChange?.(option.id)}
                            aria-pressed={mode === option.id}
                            className={`rounded-md px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] transition ${mode === option.id
                                ? 'bg-white text-[#344D3D] shadow-sm'
                                : 'text-stone-500 hover:text-stone-700'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <label className="mt-2 block text-[8px] font-black uppercase tracking-[0.1em] text-stone-500">
                    {mode === 'inspired'
                        ? `Likeness ${Math.round(likeness * 100)}%`
                        : `Guide adherence ${Math.round(adherence * 100)}%`}
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={mode === 'inspired' ? likeness : adherence}
                        disabled={!guide}
                        onChange={(event) => {
                            const value = Number(event.target.value);
                            if (mode === 'inspired') {
                                onLikenessChange?.(value);
                            } else {
                                onAdherenceChange?.(value);
                            }
                        }}
                        aria-label={mode === 'inspired' ? 'Likeness' : 'Guide adherence'}
                        className="mt-1 block w-full accent-[#536B46]"
                    />
                </label>
                <div className="mt-2 flex gap-1.5">
                    <button
                        type="button"
                        onClick={onDisable}
                        disabled={!guide || !enabled}
                        className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-stone-600 disabled:opacity-40"
                    >
                        Disable
                    </button>
                    <button
                        type="button"
                        onClick={onReset}
                        disabled={!guide}
                        className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-amber-700 disabled:opacity-40"
                    >
                        Reset
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ZenSpineGuideEditor;

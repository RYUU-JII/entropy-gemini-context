import { useCallback, useMemo, useState } from 'react';

import {
    createSakuraMacroSpineGuideV1,
    SAKURA_MACRO_SPINE_DEFAULT_ADHERENCE,
    SAKURA_MACRO_SPINE_MAX_ARC_NORM,
    simplifySakuraSpineStrokeToMacroGuideV1,
} from '../../model/sakura/sakuraMacroSpineGuide';
import {
    createSakuraSpineReferenceFamilyV1,
    SAKURA_SPINE_REFERENCE_DEFAULT_LIKENESS,
} from '../../model/sakura/sakuraSpineReferenceFamily.js';

const SPINE_GUIDE_MODES = Object.freeze(['sculpted', 'inspired']);

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

const clampEditableAnchor = (anchor) => ({
    x: clamp(anchor?.x, -0.72, 0.72),
    y: clamp(anchor?.y, -1.08, 0.36),
});

const resolveAnchorArc = (anchors) => anchors.slice(1).reduce((sum, anchor, index) => (
    sum + Math.hypot(
        anchor.x - anchors[index].x,
        anchor.y - anchors[index].y,
    )
), 0);

const clampAnchorToArcLimit = ({ anchors, anchorIndex, proposed }) => {
    const candidate = anchors.map((anchor) => ({ ...anchor }));
    candidate[anchorIndex] = proposed;
    if (resolveAnchorArc(candidate) <= SAKURA_MACRO_SPINE_MAX_ARC_NORM) {
        return proposed;
    }
    const origin = anchors[anchorIndex];
    let low = 0;
    let high = 1;
    let accepted = origin;
    for (let iteration = 0; iteration < 18; iteration += 1) {
        const ratio = (low + high) * 0.5;
        const point = {
            x: origin.x + ((proposed.x - origin.x) * ratio),
            y: origin.y + ((proposed.y - origin.y) * ratio),
        };
        candidate[anchorIndex] = point;
        if (resolveAnchorArc(candidate) <= SAKURA_MACRO_SPINE_MAX_ARC_NORM) {
            accepted = point;
            low = ratio;
        } else {
            high = ratio;
        }
    }
    return accepted;
};

export function useZenClassicSpineGuideDraft() {
    const [guideDraft, setGuideDraft] = useState(null);
    const [enabled, setEnabled] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const [mode, setMode] = useState('sculpted');
    const [adherence, setAdherenceState] = useState(SAKURA_MACRO_SPINE_DEFAULT_ADHERENCE);
    const [likeness, setLikenessState] = useState(SAKURA_SPINE_REFERENCE_DEFAULT_LIKENESS);

    const commitStroke = useCallback((points) => {
        const guide = simplifySakuraSpineStrokeToMacroGuideV1({
            points,
            adherence,
        });
        setGuideDraft(guide);
        setEnabled(true);
        setEditorOpen(true);
        return guide;
    }, [adherence]);

    const moveAnchor = useCallback((anchorIndex, point) => {
        if (!Number.isInteger(anchorIndex) || anchorIndex <= 0) {
            return false;
        }
        let updated = false;
        setGuideDraft((current) => {
            if (!current || anchorIndex >= current.anchors.length) return current;
            const anchors = current.anchors.map((anchor) => ({ x: anchor.x, y: anchor.y }));
            const next = clampAnchorToArcLimit({
                anchors,
                anchorIndex,
                proposed: clampEditableAnchor(point),
            });
            const previous = anchors[anchorIndex - 1];
            const following = anchors[anchorIndex + 1] || null;
            if (
                Math.hypot(next.x - previous.x, next.y - previous.y) < 0.025
                || (
                    following
                    && Math.hypot(next.x - following.x, next.y - following.y) < 0.025
                )
            ) {
                return current;
            }
            anchors[anchorIndex] = next;
            updated = true;
            return createSakuraMacroSpineGuideV1({
                anchors,
                adherence: current.adherence,
                source: 'authored',
            });
        });
        return updated;
    }, []);

    const setAdherence = useCallback((value) => {
        const next = clamp(value, 0, 1);
        setAdherenceState(next);
        setGuideDraft((current) => (
            current
                ? createSakuraMacroSpineGuideV1({
                    anchors: current.anchors,
                    adherence: next,
                    source: 'authored',
                })
                : current
        ));
    }, []);

    const setGuideMode = useCallback((value) => {
        if (!SPINE_GUIDE_MODES.includes(value)) {
            throw new Error(`ZEN_CLASSIC_SPINE_GUIDE_MODE_INVALID:${String(value)}`);
        }
        setMode(value);
    }, []);

    const setLikeness = useCallback((value) => {
        setLikenessState(clamp(value, 0, 1));
    }, []);

    const toggleEditor = useCallback(() => {
        setEditorOpen((current) => !current);
    }, []);

    const disable = useCallback(() => {
        setEnabled(false);
        setEditorOpen(false);
    }, []);

    const enable = useCallback(() => {
        if (!guideDraft) {
            setEditorOpen(true);
            return false;
        }
        setEnabled(true);
        setEditorOpen(true);
        return true;
    }, [guideDraft]);

    const reset = useCallback(() => {
        setGuideDraft(null);
        setEnabled(false);
        setEditorOpen(false);
        setMode('sculpted');
        setAdherenceState(SAKURA_MACRO_SPINE_DEFAULT_ADHERENCE);
        setLikenessState(SAKURA_SPINE_REFERENCE_DEFAULT_LIKENESS);
    }, []);

    const spineReferenceFamily = useMemo(() => (
        enabled && mode === 'inspired' && guideDraft
            ? createSakuraSpineReferenceFamilyV1({
                referenceGuide: guideDraft,
                likeness,
            })
            : null
    ), [enabled, guideDraft, likeness, mode]);

    return useMemo(() => Object.freeze({
        spineGuideDraft: guideDraft,
        spineGuide: enabled && mode === 'sculpted' ? guideDraft : null,
        spineReferenceFamily,
        spineGuideEnabled: enabled && Boolean(guideDraft),
        spineGuideEditorOpen: editorOpen,
        spineGuideMode: mode,
        spineGuideAdherence: adherence,
        spineReferenceLikeness: likeness,
        commitSpineGuideStroke: commitStroke,
        moveSpineGuideAnchor: moveAnchor,
        setSpineGuideMode: setGuideMode,
        setSpineGuideAdherence: setAdherence,
        setSpineReferenceLikeness: setLikeness,
        toggleSpineGuideEditor: toggleEditor,
        enableSpineGuide: enable,
        disableSpineGuide: disable,
        resetSpineGuide: reset,
    }), [
        adherence,
        commitStroke,
        disable,
        editorOpen,
        enable,
        enabled,
        guideDraft,
        likeness,
        mode,
        moveAnchor,
        reset,
        setAdherence,
        setGuideMode,
        setLikeness,
        spineReferenceFamily,
        toggleEditor,
    ]);
}

export default useZenClassicSpineGuideDraft;

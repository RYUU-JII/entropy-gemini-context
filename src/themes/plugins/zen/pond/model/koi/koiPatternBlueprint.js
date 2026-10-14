export const KOI_PATTERN_CANDIDATE_COUNT = 6;

const PATTERN_BLUEPRINT_VERSION = 'organic_breed_v1';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toFiniteNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const sampleRange = (rng, min, max) => min + (max - min) * rng();

const roundToken = (value, digits = 3) => (
    toFiniteNumber(value, 0).toFixed(digits)
);

const createOrganicEdge = (rng, scale = 1) => ({
    edgeAmpA: sampleRange(rng, 0.08, 0.17) * scale,
    edgeAmpB: sampleRange(rng, 0.035, 0.09) * scale,
    edgeLobesA: 2 + Math.floor(rng() * 3),
    edgeLobesB: 5 + Math.floor(rng() * 3),
    edgePhaseA: rng() * Math.PI * 2,
    edgePhaseB: rng() * Math.PI * 2,
    edgePoints: 16,
});

const createMark = ({
    rng,
    t,
    side,
    scale,
    color = 'pattern',
    kind = 'patch',
    role = 'primary',
    edgeScale = 1,
}) => {
    const longBias = kind === 'patch' ? sampleRange(rng, 1.08, 1.52) : sampleRange(rng, 0.86, 1.14);
    const wideBias = kind === 'patch' ? sampleRange(rng, 0.72, 1.04) : sampleRange(rng, 0.78, 1.05);
    return {
        t: clamp(t, 0.06, 0.92),
        side: clamp(side, -0.92, 0.92),
        scale: clamp(scale, 0.035, 0.96),
        scaleX: longBias,
        scaleY: wideBias,
        rotation: sampleRange(rng, -0.54, 0.54),
        color,
        kind,
        role,
        noiseOffset: rng() * 10,
        organic: kind === 'patch' || kind === 'circle',
        ...createOrganicEdge(rng, edgeScale),
    };
};

const resolveGrammar = ({ patternStyle, palette, colorSecondary }) => {
    const style = typeof patternStyle === 'string' ? patternStyle : 'patches';
    const group = typeof palette?.group === 'string' ? palette.group : '';
    const paletteName = typeof palette?.name === 'string' ? palette.name : '';
    const isTancho = style === 'tancho' || style === 'tancho-spots' || style === 'tancho-dual';
    const isSanke = style === 'patches-spots' || style === 'tancho-spots';
    const isShowa = style === 'patches-dual' || style === 'tancho-dual' || /showa/i.test(paletteName);
    const isUtsuri = group === 'utsurimono' || style === 'patches-bold';
    const isBekko = style === 'spots' || group === 'bekko';
    const staticPattern = style === 'solid' || style === 'checkered' || style === 'lateral-stripe';

    if (staticPattern) {
        return {
            style,
            family: style,
            generated: false,
            hasSecondary: Boolean(colorSecondary),
        };
    }

    if (isTancho) {
        return {
            style,
            family: 'tancho',
            generated: true,
            hasSecondary: Boolean(colorSecondary),
            secondaryAsSpots: style === 'tancho-spots',
            secondaryCountMin: style === 'tancho-spots' ? 4 : 2,
            secondaryCountMax: style === 'tancho-spots' ? 7 : 4,
            targetCoverage: colorSecondary ? 0.28 : 0.18,
            headAllowed: true,
            tailReserve: 0.82,
        };
    }

    if (isBekko) {
        return {
            style,
            family: 'bekko',
            generated: true,
            hasSecondary: false,
            primaryKind: 'spot',
            primaryCountMin: 5,
            primaryCountMax: 10,
            scaleMin: 0.08,
            scaleMax: 0.18,
            sideSpread: 0.72,
            targetCoverage: 0.18,
            headAllowed: false,
            tailReserve: 0.84,
        };
    }

    return {
        style,
        family: isUtsuri ? 'utsuri' : (isShowa ? 'showa' : (isSanke ? 'sanke' : 'kohaku')),
        generated: true,
        hasSecondary: Boolean(colorSecondary),
        secondaryAsSpots: isSanke,
        primaryKind: 'patch',
        primaryCountMin: isUtsuri ? 2 : 2,
        primaryCountMax: isUtsuri ? 4 : 5,
        secondaryCountMin: isSanke ? 5 : 2,
        secondaryCountMax: isSanke ? 9 : 5,
        scaleMin: isUtsuri ? 0.42 : 0.24,
        scaleMax: isUtsuri ? 0.88 : (isShowa ? 0.72 : 0.58),
        secondaryScaleMin: isSanke ? 0.07 : 0.22,
        secondaryScaleMax: isSanke ? 0.16 : (isShowa ? 0.5 : 0.36),
        sideSpread: isUtsuri || isShowa ? 0.82 : 0.62,
        targetCoverage: isUtsuri ? 0.48 : (isShowa ? 0.42 : 0.34),
        headAllowed: isUtsuri || isShowa,
        tailReserve: isUtsuri ? 0.88 : 0.82,
    };
};

const distributeT = (rng, index, count, minT, maxT, jitterScale = 0.08) => {
    const slot = (index + 0.5) / Math.max(1, count);
    const jitter = (rng() - 0.5) * jitterScale;
    return clamp(minT + (maxT - minT) * (slot + jitter), minT, maxT);
};

const buildTanchoMarks = (grammar, rng) => {
    const marks = [
        createMark({
            rng,
            t: sampleRange(rng, 0.135, 0.185),
            side: sampleRange(rng, -0.08, 0.08),
            scale: sampleRange(rng, 0.22, 0.32),
            color: 'pattern',
            kind: 'circle',
            role: 'tancho',
            edgeScale: 0.55,
        }),
    ];

    if (!grammar.hasSecondary) return marks;
    const count = grammar.secondaryCountMin + Math.floor(rng() * (grammar.secondaryCountMax - grammar.secondaryCountMin + 1));
    for (let i = 0; i < count; i += 1) {
        const isSpot = grammar.secondaryAsSpots;
        marks.push(createMark({
            rng,
            t: sampleRange(rng, 0.28, 0.78),
            side: sampleRange(rng, -0.76, 0.76),
            scale: isSpot ? sampleRange(rng, 0.07, 0.15) : sampleRange(rng, 0.22, 0.4),
            color: 'secondary',
            kind: isSpot ? 'spot' : 'patch',
            role: 'secondary',
            edgeScale: isSpot ? 0.35 : 0.75,
        }));
    }
    return marks;
};

const buildPatchMarks = (grammar, rng, candidateIndex) => {
    const marks = [];
    const primaryCount = grammar.primaryCountMin + Math.floor(rng() * (grammar.primaryCountMax - grammar.primaryCountMin + 1));
    const minT = grammar.headAllowed ? 0.11 : 0.17;
    const maxT = grammar.tailReserve;
    for (let i = 0; i < primaryCount; i += 1) {
        const wave = Math.sin((candidateIndex + 1) * 1.73 + i * 2.11) * 0.18;
        marks.push(createMark({
            rng,
            t: distributeT(rng, i, primaryCount, minT, maxT, 0.18),
            side: sampleRange(rng, -grammar.sideSpread, grammar.sideSpread) * 0.72 + wave,
            scale: sampleRange(rng, grammar.scaleMin, grammar.scaleMax),
            color: 'pattern',
            kind: grammar.primaryKind,
            role: 'primary',
            edgeScale: grammar.primaryKind === 'spot' ? 0.4 : 1,
        }));
    }

    if (!grammar.hasSecondary) return marks;
    const secondaryCount = grammar.secondaryCountMin + Math.floor(rng() * (grammar.secondaryCountMax - grammar.secondaryCountMin + 1));
    for (let i = 0; i < secondaryCount; i += 1) {
        const isSpot = grammar.secondaryAsSpots;
        marks.push(createMark({
            rng,
            t: sampleRange(rng, grammar.headAllowed ? 0.12 : 0.2, grammar.tailReserve),
            side: sampleRange(rng, -0.84, 0.84),
            scale: sampleRange(rng, grammar.secondaryScaleMin, grammar.secondaryScaleMax),
            color: 'secondary',
            kind: isSpot ? 'spot' : 'patch',
            role: 'secondary',
            edgeScale: isSpot ? 0.36 : 0.82,
        }));
    }
    return marks;
};

const estimateCoverage = (mark) => {
    const scale = clamp(toFiniteNumber(mark?.scale, 0), 0, 1);
    const scaleX = clamp(toFiniteNumber(mark?.scaleX, 1), 0.3, 2);
    const scaleY = clamp(toFiniteNumber(mark?.scaleY, 1), 0.3, 2);
    const kindFactor = mark?.kind === 'spot' ? 0.42 : (mark?.kind === 'circle' ? 0.68 : 1);
    return scale * scale * scaleX * scaleY * kindFactor;
};

const scoreCandidate = (marks, grammar) => {
    if (!Array.isArray(marks) || marks.length === 0) return grammar.generated ? -10 : 0;
    let coverage = 0;
    let sideWeighted = 0;
    let sideWeight = 0;
    let tailPenalty = 0;
    let headPenalty = 0;
    let tinyPenalty = 0;
    const primaryTs = [];

    for (let i = 0; i < marks.length; i += 1) {
        const mark = marks[i];
        const area = estimateCoverage(mark);
        coverage += area;
        sideWeighted += toFiniteNumber(mark.side, 0) * area;
        sideWeight += area;
        if (mark.role === 'primary') primaryTs.push(toFiniteNumber(mark.t, 0));
        if (toFiniteNumber(mark.t, 0) > grammar.tailReserve + 0.03) tailPenalty += 0.8;
        if (!grammar.headAllowed && mark.role !== 'tancho' && toFiniteNumber(mark.t, 0) < 0.14) headPenalty += 1.2;
        if (toFiniteNumber(mark.scale, 0) < 0.065) tinyPenalty += 0.25;
    }

    primaryTs.sort((a, b) => a - b);
    let spacingPenalty = 0;
    for (let i = 1; i < primaryTs.length; i += 1) {
        const gap = primaryTs[i] - primaryTs[i - 1];
        if (gap < 0.12) spacingPenalty += (0.12 - gap) * 4;
    }

    const coverageScore = 1 - Math.min(1, Math.abs(coverage - grammar.targetCoverage) / Math.max(0.12, grammar.targetCoverage));
    const sideBalance = sideWeight > 0 ? Math.abs(sideWeighted / sideWeight) : 0;
    const sideScore = 1 - Math.min(1, sideBalance * 1.35);
    const countScore = marks.length > 12 ? 0.55 : 1;
    return (
        coverageScore * 2.2
        + sideScore * 1.3
        + countScore * 0.8
        - tailPenalty
        - headPenalty
        - spacingPenalty
        - tinyPenalty
    );
};

const buildCandidateMarks = (grammar, rng, candidateIndex) => {
    if (!grammar.generated) return [];
    if (grammar.family === 'tancho') return buildTanchoMarks(grammar, rng);
    return buildPatchMarks(grammar, rng, candidateIndex);
};

const buildPatternSignature = ({ grammar, marks, selectedCandidateIndex, score }) => {
    const markTokens = marks.map((mark) => [
        mark.kind,
        mark.color,
        mark.role,
        roundToken(mark.t),
        roundToken(mark.side),
        roundToken(mark.scale),
        roundToken(mark.scaleX, 2),
        roundToken(mark.scaleY, 2),
        roundToken(mark.rotation, 2),
        roundToken(mark.edgeAmpA, 2),
        roundToken(mark.edgeAmpB, 2),
        mark.edgeLobesA,
        mark.edgeLobesB,
    ].join(':'));
    return [
        PATTERN_BLUEPRINT_VERSION,
        grammar.family,
        grammar.style,
        `c:${selectedCandidateIndex}`,
        `s:${roundToken(score, 3)}`,
        markTokens.join(';'),
    ].join('|');
};

export const createKoiPatternBlueprint = ({
    patternStyle = 'patches',
    colorSecondary = null,
    palette = null,
    rng = Math.random,
} = {}) => {
    const grammar = resolveGrammar({ patternStyle, palette, colorSecondary });
    const candidateCount = KOI_PATTERN_CANDIDATE_COUNT;
    if (!grammar.generated) {
        return {
            version: PATTERN_BLUEPRINT_VERSION,
            family: grammar.family,
            marks: [],
            score: 0,
            selectedCandidateIndex: 0,
            candidateCount,
            signature: `${PATTERN_BLUEPRINT_VERSION}|${grammar.family}|${grammar.style}|static`,
        };
    }

    let bestMarks = [];
    let bestScore = Number.NEGATIVE_INFINITY;
    let selectedCandidateIndex = 0;
    for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
        const marks = buildCandidateMarks(grammar, rng, candidateIndex);
        const score = scoreCandidate(marks, grammar);
        if (score > bestScore) {
            bestMarks = marks;
            bestScore = score;
            selectedCandidateIndex = candidateIndex;
        }
    }

    return {
        version: PATTERN_BLUEPRINT_VERSION,
        family: grammar.family,
        marks: bestMarks,
        score: bestScore,
        selectedCandidateIndex,
        candidateCount,
        signature: buildPatternSignature({
            grammar,
            marks: bestMarks,
            selectedCandidateIndex,
            score: bestScore,
        }),
    };
};

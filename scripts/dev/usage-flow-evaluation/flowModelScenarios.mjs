/**
 * Fictional, deterministic model-evaluation inputs. This file deliberately has
 * no product imports: neither model cutoffs nor its labels define the corpus.
 * Only `trace` is model input. Oracles describe limits of inference, not intent
 * ground truth. The public held-out split is a different recipe, not field data.
 */

const START_MS = 1_000;
const SEED = 0x31415926;
const COMMON_AMBIGUITIES = [
    'Movement does not establish attention, comprehension, preference, or unwanted use.',
    'Input events do not establish characters, submission, or the identity of a draft.',
    'Unavailable or hidden observation does not establish inactivity.',
];

function random(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let value = Math.imul(state ^ (state >>> 15), state | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    };
}

const linear = (low, high, count) => Array.from({ length: count }, (_, index) => (
    low + (high - low) * index / (count - 1)
));
const logarithmic = (low, high, count) => Array.from({ length: count }, (_, index) => (
    low * (high / low) ** (index / (count - 1))
));
const advance = (at, screenfuls = 1, itemTransitions = 1, extra = {}) => ({
    at, kind: 'advance', direction: 'forward', screenfuls, itemTransitions,
    quality: 1, source: 'user', ...extra,
});
const availability = (at, visible = true, available = true) => ({
    at, kind: 'availability', visible, available,
});
const trace = (surfaceMode, events, endMs) => ({
    version: 1, surfaceMode, startMs: START_MS, endMs,
    events: [availability(START_MS), ...events].sort((left, right) => left.at - right.at),
});

function regularMovement({ count = 32, gapMs = 1_200, screenfuls = 1, quality = 1 } = {}) {
    return Array.from({ length: count }, (_, index) => (
        advance(START_MS + 1_000 + gapMs * index, screenfuls, 1, { quality })
    ));
}

function partitionMovement(events, pieces) {
    let seeded = false;
    return events.flatMap((event) => {
        if (event.kind !== 'advance') return [{ ...event }];
        // Both representations establish the same first observation. Splitting
        // that seed would invent same-timestamp dwell after an unknown interval.
        if (!seeded) {
            seeded = true;
            return [{ ...event }];
        }
        return Array.from({ length: pieces }, (_, index) => ({
            ...event,
            screenfuls: event.screenfuls / pieces,
            itemTransitions: Math.floor(event.itemTransitions / pieces)
                + (index < event.itemTransitions % pieces ? 1 : 0),
        }));
    });
}

function addSupply(events, count, offsetMs = 0) {
    return events.flatMap((event) => event.kind === 'advance'
        ? [{ ...event }, { at: event.at + offsetMs, kind: 'supply', count }]
        : [{ ...event }]);
}

export function createFlowModelCorpus() {
    const scenarios = [];
    const relations = [];
    const probes = [];
    const rng = random(SEED);

    function add(id, family, split, inputTrace, oracle = {}) {
        scenarios.push({
            id, family, split, trace: inputTrace,
            oracle: {
                constraints: [
                    'Only the observable trace may enter the model.',
                    'No-advance and input-only traces do not identify a negative usage class; unsupported channels remain unrepresented.',
                ],
                ambiguities: [...COMMON_AMBIGUITIES],
                fictionalPurpose: null,
                policyAssumptions: [],
                ...oracle,
            },
        });
        return id;
    }

    function relate(id, dimension, left, right, options = {}) {
        relations.push({
            id,
            kind: dimension === 'unobserved_purpose' ? 'identifiability' : 'invariance',
            dimension, left, right, expectation: 'equal_model_output',
            claim: dimension === 'unobserved_purpose' ? 'invariant' : 'hypothesis',
            requiredChannels: [],
            ...options,
        });
    }

    // Broad pace examples have no binary correct/incorrect use label.
    for (const surfaceMode of ['continuous', 'paged']) {
        logarithmic(250, 18_000, 12).forEach((gapMs, index) => {
            const events = regularMovement({ gapMs, screenfuls: surfaceMode === 'paged' ? 1 : 0.8 });
            add(`steady_${surfaceMode}_${index}`, 'steady_range', 'development',
                trace(surfaceMode, events, events.at(-1).at + 2_000));
        });
    }

    // Same number of advances and same total pause budget, different placement.
    for (let index = 0; index < 6; index += 1) {
        const pauseBudget = 8_000 + index * 11_000;
        const gapMs = 700 + index * 230;
        for (const pattern of ['one_rest', 'distributed_rests']) {
            let at = START_MS + 1_000;
            const events = [];
            for (let step = 0; step < 32; step += 1) {
                if (step > 0) at += gapMs;
                if (pattern === 'one_rest' && step === 16) at += pauseBudget;
                if (pattern === 'distributed_rests' && step > 0 && step % 4 === 0) at += pauseBudget / 7;
                events.push(advance(at, 0.7 + index / 10));
            }
            add(`pause_${pattern}_${index}`, 'pause_distribution', 'development',
                trace('continuous', events, at + 2_000), {
                    constraints: ['Equal duration and displacement do not imply equal temporal distribution.'],
                    policyAssumptions: ['Pause placement may matter; the preferred pressure curve is not an oracle label.'],
                });
        }
    }

    for (let index = 0; index < 8; index += 1) {
        const events = regularMovement({ gapMs: 400 + index * 800, screenfuls: 0.25 + index * 0.4 });
        const endMs = events.at(-1).at + 2_000;
        const left = add(`packet_coalesced_${index}`, 'event_packetization', 'development',
            trace('continuous', events, endMs));
        const right = add(`packet_partitioned_${index}`, 'event_packetization', 'development',
            trace('continuous', partitionMovement(events, 2 + index % 4), endMs));
        relate(`packet_partition_${index}`, 'event_packetization', left, right, {
            basis: 'Every timestamp has equal physical displacement and transition totals; callback count differs.',
        });
    }

    for (let index = 0; index < 8; index += 1) {
        const events = index === 0 ? [] : regularMovement({ count: 20, gapMs: 900 + index * 500 });
        const endMs = events.length === 0 ? START_MS + 40_000 : events.at(-1).at + 2_000;
        const supplyEvents = events.length === 0
            ? Array.from({ length: 20 }, (_, step) => ({ at: START_MS + 1_000 + step * 1_500, kind: 'supply', count: 8 }))
            : addSupply(events, index * 3, 60);
        const left = add(`supply_base_${index}`, 'offscreen_supply', 'development', trace('continuous', events, endMs));
        const right = add(`supply_added_${index}`, 'offscreen_supply', 'development', trace('continuous', supplyEvents, endMs));
        relate(`supply_separation_${index}`, 'offscreen_supply', left, right, {
            requiredChannels: ['supply_to_full_runtime'],
            basis: 'Offscreen item arrival changes supply only; it establishes no additional user displacement.',
        });
    }

    for (let index = 0; index < 6; index += 1) {
        const events = index < 3 ? [] : regularMovement({ count: 8, gapMs: 1_500 });
        const endMs = START_MS + 600_000;
        const writing = Array.from({ length: 280 }, (_, step) => ({
            at: START_MS + 20_000 + step * (1_000 + index * 120), kind: 'input',
            mode: step % 19 === 0 ? 'paste' : step % 3 === 0 ? 'composition' : 'typing',
        }));
        const left = add(`writing_quiet_${index}`, 'long_writing', 'development', trace('continuous', events, endMs));
        const right = add(`writing_active_${index}`, 'long_writing', 'development',
            trace('continuous', [...events, ...writing], endMs), {
                constraints: [
                    'Input alone cannot be classified by a confirmed-feed-advance model; its absence of advances is not a negative intent label.',
                    'Unsupported input and draft-continuity channels must remain unrepresented.',
                ],
                fictionalPurpose: 'One long unfinished draft, with revisions and pauses, in the scenario narrative.',
                policyAssumptions: ['Writing alone should not add feed pressure; this does not erase prior feed movement.'],
            });
        relate(`writing_separation_${index}`, 'input_channel_separation', left, right, {
            requiredChannels: ['input_activity'],
            basis: 'Both traces contain the same feed movement; writing is a separate observed channel.',
        });
    }

    for (let index = 0; index < 4; index += 1) {
        const surfaceMode = index % 2 === 0 ? 'paged' : 'continuous';
        const events = regularMovement({ gapMs: 700 + index * 2_900 });
        const endMs = events.at(-1).at + 3_000;
        const left = add(`purpose_lookup_${index}`, 'intent_collision', 'development', trace(surfaceMode, events, endMs), {
            fictionalPurpose: 'The fictional person is looking for a specific previously seen item.',
        });
        const right = add(`purpose_unplanned_${index}`, 'intent_collision', 'development', trace(surfaceMode, events.map((event) => ({ ...event })), endMs), {
            fictionalPurpose: 'The fictional person continues browsing after their planned stopping point.',
        });
        relate(`purpose_collision_${index}`, 'unobserved_purpose', left, right, {
            basis: 'Different fictional purposes have identical observable inputs; the model cannot distinguish them.',
        });
    }

    // Clock origin is arbitrary. All elapsed times and event facts remain equal.
    for (let index = 0; index < 4; index += 1) {
        const surfaceMode = index % 2 === 0 ? 'continuous' : 'paged';
        const events = regularMovement({ gapMs: 610 + index * 1_370 });
        const baseTrace = trace(surfaceMode, events, events.at(-1).at + 2_000);
        const offsetMs = [37_123, 6_400_000, 83_900_000, 1_600_000_000_000][index];
        const shiftedTrace = {
            ...baseTrace,
            startMs: baseTrace.startMs + offsetMs,
            endMs: baseTrace.endMs + offsetMs,
            events: baseTrace.events.map((event) => ({ ...event, at: event.at + offsetMs })),
        };
        const left = add(`clock_base_${index}`, 'clock_origin', 'development', baseTrace);
        const right = add(`clock_shifted_${index}`, 'clock_origin', 'development', shiftedTrace);
        relate(`clock_origin_${index}`, 'clock_origin', left, right, {
            claim: 'invariant',
            basis: 'A common timestamp offset changes no elapsed duration or observed event fact.',
        });
    }

    function probe(id, parameter, values, spacing, surfaceMode, makeEvents) {
        const scenarioIds = values.map((value, index) => {
            const events = makeEvents(value);
            return add(`${id}_${index}`, `sweep_${parameter}`, 'development',
                trace(surfaceMode, events, Math.max(...events.map((event) => event.at)) + 2_000), {
                    constraints: ['An ordered parameter sweep is a continuity diagnostic, not a threshold calibration target.'],
                });
        });
        probes.push({ id, parameter, values, scenarioIds, spacing, purpose: 'continuity_diagnostic' });
    }

    for (const surfaceMode of ['continuous', 'paged']) {
        probe(`cadence_${surfaceMode}`, 'gapMs', logarithmic(120, 30_000, 23), 'logarithmic', surfaceMode,
            (gapMs) => regularMovement({ gapMs }));
    }
    probe('displacement_continuous', 'screenfuls', logarithmic(0.01, 5, 23), 'logarithmic', 'continuous',
        (screenfuls) => regularMovement({ screenfuls }));
    probe('quality_paged', 'quality', linear(0, 1, 23), 'linear', 'paged',
        (quality) => regularMovement({ quality }));
    probe('pause_continuous', 'pauseMs', logarithmic(100, 180_000, 23), 'logarithmic', 'continuous',
        (pauseMs) => regularMovement({ gapMs: 950 }).map((event, index) => ({
            ...event, at: event.at + (index >= 16 ? pauseMs : 0),
        })));

    // Held out by recipe: drift, irregular rests and reverse travel coexist with
    // observation loss, mixed provenance and writing, unlike isolated dev axes.
    for (let index = 0; index < 16; index += 1) {
        const surfaceMode = index % 2 === 0 ? 'continuous' : 'paged';
        const events = [];
        let at = START_MS + 1_000;
        for (let step = 0; step < 40; step += 1) {
            at += (280 + 110 * index) * (0.45 + rng()) * (1 + step / 50);
            if (step % 9 === 0 && step > 0) at += 2_000 + rng() * 18_000;
            const observationGap = step >= 13 && step < 19;
            if (step === 13) events.push(availability(at - 1, index % 2 === 0 ? false : true, index % 2 === 0));
            if (step === 19) events.push(availability(at - 1));
            events.push(advance(at, 0.1 + rng() * 1.8, surfaceMode === 'paged' || step % 4 !== 0 ? 1 : 0, {
                direction: step % 7 === 0 ? 'backward' : 'forward',
                quality: 0.35 + rng() * 0.65,
                source: observationGap ? 'programmatic' : step % 5 === 0 ? 'unknown' : 'user',
            }));
            if (step % 3 === 0) events.push({ at: at + 10, kind: 'supply', count: 2 + index % 7 });
            if (step % 4 === 0) events.push({ at: at + 20, kind: 'input', mode: step % 8 === 0 ? 'composition' : 'typing' });
        }
        add(`composite_${index}`, 'held_out_composite', 'held_out',
            trace(surfaceMode, events, at + 4_000), {
                constraints: ['Unavailable channels must be reported; missing coverage must not be treated as measured zero.'],
            });
    }

    // New irregular trajectories preserve event-wise physical equivalence under
    // packetization and supply addition; no random split of the steady recipe.
    for (let index = 0; index < 8; index += 1) {
        let at = START_MS + 1_000;
        const events = Array.from({ length: 36 }, (_, step) => {
            at += 300 + rng() * (1_500 + index * 900) + (step % 11 === 0 ? 9_000 : 0);
            return advance(at, 0.2 + rng() * 2.8, step % 3, { quality: 0.45 + rng() * 0.55 });
        });
        const endMs = at + 2_000;
        const base = add(`held_base_${index}`, 'held_out_transformations', 'held_out', trace('continuous', events, endMs));
        const partitioned = add(`held_partition_${index}`, 'held_out_transformations', 'held_out',
            trace('continuous', partitionMovement(events, 3 + index % 3), endMs));
        const supplied = add(`held_supply_${index}`, 'held_out_transformations', 'held_out',
            trace('continuous', addSupply(events, 7 + index, 17), endMs));
        relate(`held_packet_${index}`, 'event_packetization', base, partitioned, {
            basis: 'Irregular timed physical movement is conserved under event splitting.',
        });
        relate(`held_supply_${index}`, 'offscreen_supply', base, supplied, {
            requiredChannels: ['supply_to_full_runtime'],
            basis: 'New supply changes no displacement on an irregular held-out trajectory.',
        });
    }

    return {
        version: 1, scenarios, relations, probes,
        design: {
            seed: SEED,
            dataOrigin: 'Entirely fictional, generated locally; no collected user data.',
            heldOutMeaning: 'Public, frozen distinct composite recipes; not proof of generalization to people or arbitrary DOMs.',
            oracleBoundary: 'Only traces enter models. Scenario IDs, split, family, narratives and constraints are evaluator-only.',
            continuityInterpretation: 'Sweep deltas expose sensitivity. They do not supply a learned cutoff or prove discontinuity without local refinement.',
            policyAssumptions: ['Long writing alone should not add feed pressure.', 'Equal physical movement should be approximately independent of event packetization.'],
            prohibitedConclusions: [...COMMON_AMBIGUITIES, 'Passing synthetic constraints proves classification accuracy for real human intent.'],
            families: [...new Set(scenarios.map((scenario) => scenario.family))],
        },
    };
}

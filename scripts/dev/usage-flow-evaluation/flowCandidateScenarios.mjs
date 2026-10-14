/**
 * Independently authored fictional mechanisms for candidate-model evaluation.
 * No production, model, evaluator, or earlier-corpus imports are permitted here.
 * Narratives and constraints are evaluator-only. Public held-out mechanisms are
 * not unseen human data, and become development evidence after being inspected.
 */

const START_MS = 1_000;
const ORIGIN_MS = 2_000;
const SEED_SCREENFULS = 0.25;
const availability = (at, visible = true, available = true) => ({
    at, kind: 'availability', visible, available,
});
const advance = (at, screenfuls, itemTransitions = 0) => ({
    at, kind: 'advance', direction: 'forward', screenfuls, itemTransitions,
    quality: 1, source: 'user',
});
const makeTrace = (events, endMs) => ({
    version: 1, surfaceMode: 'continuous', startMs: START_MS, endMs,
    events: [availability(START_MS), ...events].sort((left, right) => left.at - right.at),
});

// Analytic monotone physical paths; their rate varies continuously and remains
// positive. Sampling differences therefore preserve a common underlying path.
function chirpPath(index, durationMs) {
    const base = 0.08 + index * 0.065;
    const lowFrequency = 0.006 + index * 0.002;
    const highFrequency = 0.065 + index * 0.009;
    const sweep = (highFrequency - lowFrequency) / (durationMs / 1_000);
    const amplitude = base * 0.62 / (2 * Math.PI * highFrequency);
    return (seconds) => base * seconds + amplitude * Math.sin(
        2 * Math.PI * (lowFrequency * seconds + 0.5 * sweep * seconds ** 2),
    );
}

function quasiPeriodicPath(index) {
    const base = 0.11 + index * 0.055;
    const w1 = 2 * Math.PI * (0.016 + index * 0.003);
    const w2 = w1 * Math.sqrt(2 + index / 10);
    return (seconds) => base * (seconds
        + 0.31 * (1 - Math.cos(w1 * seconds)) / w1
        + 0.19 * (1 - Math.cos(w2 * seconds)) / w2);
}

function samplePath(position, durationMs, intervalMs, timeScale = 1) {
    const events = [advance(ORIGIN_MS, SEED_SCREENFULS)];
    let previousPosition = 0;
    for (let at = intervalMs; at < durationMs + intervalMs; at += intervalMs) {
        const boundedAt = Math.min(at, durationMs);
        const currentPosition = position(boundedAt / 1_000);
        const itemTransitions = Math.floor(currentPosition * 1.7) - Math.floor(previousPosition * 1.7);
        events.push(advance(ORIGIN_MS + boundedAt * timeScale, currentPosition - previousPosition, itemTransitions));
        previousPosition = currentPosition;
        if (boundedAt === durationMs) break;
    }
    return makeTrace(events, ORIGIN_MS + (durationMs + 3_000) * timeScale);
}

function partitionAfterSeed(inputTrace, pieces) {
    let seeded = false;
    return {
        ...inputTrace,
        events: inputTrace.events.flatMap((event) => {
            if (event.kind !== 'advance') return [{ ...event }];
            if (!seeded) { seeded = true; return [{ ...event }]; }
            return Array.from({ length: pieces }, (_, index) => ({
                ...event,
                screenfuls: event.screenfuls / pieces,
                itemTransitions: Math.floor(event.itemTransitions / pieces)
                    + (index < event.itemTransitions % pieces ? 1 : 0),
            }));
        }),
    };
}

function withSupply(inputTrace, stride, count) {
    const events = inputTrace.events.flatMap((event, index) => (
        event.kind === 'advance' && index % stride === 0
            ? [{ ...event }, { at: event.at + 7, kind: 'supply', count }]
            : [{ ...event }]
    ));
    return { ...inputTrace, events: events.sort((left, right) => left.at - right.at) };
}

function shifted(inputTrace, offsetMs) {
    return {
        ...inputTrace, startMs: inputTrace.startMs + offsetMs, endMs: inputTrace.endMs + offsetMs,
        events: inputTrace.events.map((event) => ({ ...event, at: event.at + offsetMs })),
    };
}

export function createFlowCandidateCorpus() {
    const scenarios = [];
    const relations = [];
    const probes = [];

    function add(id, family, inputTrace, extraOracle = {}) {
        const scenarioId = `candidate_${id}`;
        scenarios.push({
            id: scenarioId, family: `candidate_${family}`, split: 'held_out', trace: inputTrace,
            oracle: {
                constraints: [
                    'Only the trace may enter the model; the recipe and narrative are not features.',
                    'Unsupported observation must remain unrepresented instead of becoming measured zero.',
                ],
                ambiguities: [
                    'Movement and its rate do not identify intention, comprehension, or unwanted use.',
                    'Available quiet does not establish reading; unavailable time does not establish quiet.',
                ],
                fictionalPurpose: null, policyAssumptions: [], ...extraOracle,
            },
        });
        return scenarioId;
    }

    function relate(id, dimension, left, right, extra = {}) {
        relations.push({
            id: `candidate_${id}`, dimension, left, right,
            kind: dimension === 'unobserved_purpose' ? 'identifiability' : 'invariance',
            claim: ['unobserved_purpose', 'clock_origin'].includes(dimension) ? 'invariant' : 'hypothesis',
            expectation: 'equal_model_output', requiredChannels: [], ...extra,
        });
    }

    for (const mechanism of ['chirp', 'quasi_periodic']) {
        for (let index = 0; index < 4; index += 1) {
            const durationMs = 95_000 + index * 31_000;
            const position = mechanism === 'chirp' ? chirpPath(index, durationMs) : quasiPeriodicPath(index);
            const inputTrace = samplePath(position, durationMs, 530 + index * 170);
            const base = add(`${mechanism}_base_${index}`, mechanism, inputTrace);
            const partition = add(`${mechanism}_partition_${index}`, mechanism, partitionAfterSeed(inputTrace, 2 + index));
            const supply = add(`${mechanism}_supply_${index}`, mechanism, withSupply(inputTrace, 3 + index, 2 + index * 3));
            relate(`${mechanism}_packet_${index}`, 'event_packetization', base, partition, {
                basis: 'The same first seed and same physical displacement at every later timestamp have different callback counts.',
            });
            relate(`${mechanism}_supply_${index}`, 'offscreen_supply', base, supply, {
                requiredChannels: ['supply_to_full_runtime'],
                basis: 'Offscreen supply is added along a varying physical path without any additional movement.',
            });
            if (mechanism === 'quasi_periodic') {
                const readEvents = [];
                const intervalMs = [977, 1_423, 2_017, 3_089][index];
                for (let at = ORIGIN_MS + 311, step = 0; at < inputTrace.endMs; at += intervalMs, step += 1) {
                    readEvents.push(step % 2 === 0
                        ? { at, kind: 'input', mode: 'typing' }
                        : { at, kind: 'supply', count: 3 });
                }
                const scheduled = add(`read_schedule_${index}`, 'reconciliation_clock_schedule', {
                    ...inputTrace,
                    events: [...inputTrace.events, ...readEvents].sort((left, right) => left.at - right.at),
                }, {
                    constraints: [
                        'This narrow comparison changes pressure reconciliation timestamps without introducing physical movement.',
                        'Passing it establishes clock-schedule independence only, not input attribution, supply confirmation or observer integration.',
                    ],
                });
                relate(`read_schedule_${index}`, 'reconciliation_schedule', base, scheduled, {
                    claim: 'invariant', scope: 'reconciliation_clock_only',
                    basis: 'Identical movement is reconciled at additional input/supply timestamps; pure pressure memory must not depend on read frequency.',
                });
            }
            if (mechanism === 'chirp') {
                const clock = add(`chirp_clock_${index}`, 'chirp_clock_origin', shifted(inputTrace, 17_000 + index * 29_000_000));
                relate(`chirp_clock_${index}`, 'clock_origin', base, clock, {
                    basis: 'A common timestamp offset leaves the continuously varying path and all elapsed durations unchanged.',
                });
            }
        }
    }

    for (let index = 0; index < 3; index += 1) {
        const values = [0.32, 0.8, 1.7, 4.6];
        const position = quasiPeriodicPath(index + 1);
        const scenarioIds = values.map((timeScale, variant) => add(`time_scale_${index}_${variant}`,
            'time_scaled_quasi_periodic', samplePath(position, 127_000 + index * 13_000, 790, timeScale), {
                constraints: ['Displacement is conserved while elapsed time changes; equal pressure is not assumed.'],
            }));
        probes.push({
            id: `candidate_time_scale_${index}`, parameter: 'timeScale', values, scenarioIds,
            spacing: 'explicit', purpose: 'continuity_diagnostic',
        });
    }

    // Preserve the amount and interval marginals while changing their coupling.
    // This is a sensitivity comparison, never an assertion of equal pressure.
    for (let index = 0; index < 4; index += 1) {
        const count = 48;
        const amounts = Array.from({ length: count }, (_, step) => 0.1 + (step % 8) ** 2 / 37);
        for (const order of ['aligned', 'opposed']) {
            let at = ORIGIN_MS;
            const events = [advance(at, SEED_SCREENFULS)];
            for (let step = 0; step < count; step += 1) {
                at += 320 + index * 160 + (step % 8) ** 2 * 70;
                const amount = amounts[order === 'aligned' ? step : count - 1 - step];
                events.push(advance(at, amount, step % 3));
            }
            add(`amount_order_${order}_${index}`, 'amount_interval_coupling', makeTrace(events, at + 4_000), {
                constraints: ['Equal marginal amounts and gaps can represent different timed physical paths.'],
                policyAssumptions: ['Sensitivity to actual temporal coupling is a design choice, not a binary intent label.'],
            });
        }
    }

    // These are differing measured auxiliary units, NOT missing units encoded
    // as zero. The v1 trace cannot express per-unit availability independently.
    for (let index = 0; index < 4; index += 1) {
        const inputTrace = samplePath(quasiPeriodicPath(index), 115_000, 870);
        const otherUnits = {
            ...inputTrace,
            events: inputTrace.events.map((event, step) => event.kind === 'advance'
                ? { ...event, itemTransitions: step % 5 === 0 ? 4 + index : 0 }
                : { ...event }),
        };
        const base = add(`auxiliary_base_${index}`, 'auxiliary_unit_variation', inputTrace);
        const changed = add(`auxiliary_changed_${index}`, 'auxiliary_unit_variation', otherUnits, {
            constraints: ['Auxiliary transition counts differ, but measured continuous screenful displacement is identical.'],
            ambiguities: ['Zero auxiliary transitions are measured zero; missing auxiliary transitions are not representable in v1.'],
        });
        relate(`auxiliary_units_${index}`, 'unused_unit_independence', base, changed, {
            basis: 'Primary continuous displacement stays fixed while auxiliary item transition counts vary.',
        });
    }

    for (let index = 0; index < 4; index += 1) {
        const gapStart = 37_000 + index * 11_000;
        const gapEnd = gapStart + 35_000 + index * 17_000;
        const before = Array.from({ length: 11 }, (_, step) => advance(ORIGIN_MS + step * 2_000, 0.8));
        const after = Array.from({ length: 14 }, (_, step) => advance(gapEnd + 2_000 + step * 1_700, 0.45));
        for (const coverage of ['available_quiet', 'unavailable', 'hidden']) {
            const gapEvents = coverage === 'available_quiet' ? [] : [
                availability(gapStart, coverage !== 'hidden', coverage === 'hidden'),
                availability(gapEnd),
            ];
            add(`gap_${coverage}_${index}`, 'coverage_loss_between_paths',
                makeTrace([...before, ...gapEvents, ...after], gapEnd + 30_000), {
                    constraints: [
                        coverage === 'available_quiet'
                            ? 'There are no observed advances in a supported visible interval; this establishes neither reading nor inattention.'
                            : 'Missing or hidden middle time must not be treated as observed quiet, and continuity across it is uncertain.',
                    ],
                });
        }
    }

    for (let index = 0; index < 6; index += 1) {
        const prefix = index < 3 ? [] : Array.from({ length: 9 }, (_, step) => advance(ORIGIN_MS + step * 2_300, 0.7));
        const inputTrace = makeTrace(prefix, 330_000 + index * 17_000);
        const reading = add(`quiet_reading_${index}`, 'quiet_narrative_collision', inputTrace, {
            fictionalPurpose: 'The fictional person reads a long passage after the last recorded movement.',
        });
        const away = add(`quiet_away_${index}`, 'quiet_narrative_collision', {
            ...inputTrace, events: inputTrace.events.map((event) => ({ ...event })),
        }, { fictionalPurpose: 'The fictional person leaves the visible page while thinking about something unrelated.' });
        const writingTrace = {
            ...inputTrace,
            events: [...inputTrace.events, ...Array.from({ length: 160 }, (_, step) => ({
                at: 32_000 + step * (1_350 + index * 100), kind: 'input',
                mode: step % 23 === 0 ? 'paste' : step % 4 === 0 ? 'composition' : 'typing',
            }))].sort((left, right) => left.at - right.at),
        };
        const writing = add(`quiet_writing_${index}`, 'quiet_input_channel', writingTrace, {
            fictionalPurpose: 'The fictional person revises one draft; neither submission nor draft identity is observed.',
            policyAssumptions: ['Writing activity alone should not add feed movement pressure.'],
            constraints: ['Input-only traces are unsupported by a feed-only model, not a negative intent class.'],
        });
        relate(`quiet_purpose_${index}`, 'unobserved_purpose', reading, away, {
            basis: 'Reading and leaving the page are intentionally indistinguishable in the model-visible facts.',
        });
        relate(`quiet_input_${index}`, 'input_channel_separation', reading, writing, {
            requiredChannels: ['input_activity'],
            basis: 'Input activity changes neither the feed displacement nor observation interval.',
        });
    }

    for (let index = 0; index < 3; index += 1) {
        const values = [190, 570, 1_710, 5_130];
        const durationMs = 153_900;
        const position = quasiPeriodicPath(index + 1);
        const scenarioIds = values.map((intervalMs, variant) => add(`rebin_${index}_${variant}`,
            'physical_path_temporal_rebinning', samplePath(position, durationMs, intervalMs), {
                constraints: ['One monotone analytic physical path is integrated into differently sized observation intervals.'],
                policyAssumptions: ['For adequate coverage, merely changing callbacks should cause bounded approximation error.'],
            }));
        for (let variant = 1; variant < scenarioIds.length; variant += 1) {
            relate(`rebin_${index}_${variant}`, 'temporal_rebinning', scenarioIds[0], scenarioIds[variant], {
                expectation: 'diagnostic_only',
                basis: 'Same unsplit seed, analytic path, total displacement and duration; observation intervals differ.',
            });
        }
        probes.push({
            id: `candidate_rebin_${index}`, parameter: 'sampleIntervalMs', values, scenarioIds,
            spacing: 'logarithmic', purpose: 'continuity_diagnostic',
        });
    }

    return {
        version: 1, scenarios, relations, probes,
        design: {
            dataOrigin: 'Entirely fictional analytic physical paths and explicit event recipes, generated locally.',
            generation: 'Deterministic closed-form chirp and incommensurate-frequency paths; no fitted coefficients or product imports.',
            heldOutMeaning: 'New public mechanism recipes beyond the earlier corpus; after inspection they are development evidence, not a reusable unseen test.',
            oracleBoundary: 'Only trace is model input; narratives, constraints, IDs and recipe families are never features.',
            continuityInterpretation: 'Smooth physical inputs and multiple sampling scales expose sensitivity; four-scale probes do not prove mathematical continuity.',
            representabilityLimits: ['Per-unit missingness is absent from v1; zero transitions are never used to stand for missing transitions.'],
            policyAssumptions: [
                'Writing or offscreen supply alone should not increase feed movement pressure.',
                'Equivalent timed physical movement should be independent of callback packetization.',
                'Rebinning the same path should have bounded approximation error under adequate observation coverage.',
            ],
            prohibitedConclusions: [
                'Synthetic constraints establish human intent classification accuracy.',
                'A quiet visible trace proves reading or attention.',
                'Unavailable time establishes rest or absence of movement.',
            ],
            families: [...new Set(scenarios.map(({ family }) => family))],
        },
    };
}

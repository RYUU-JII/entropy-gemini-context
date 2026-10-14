/**
 * Independent fictional DOM timelines, containing platform inputs only.
 * No production, candidate, evaluator, or earlier-corpus imports. Oracles use
 * physical displacement and explicit measurement scope, never intent or score.
 */

function fixture(id = 'feed-a', { comments = false, initialScrollTop = 0, itemCount = 20 } = {}) {
    return {
        id,
        viewport: { width: 960, height: 600 },
        feed: {
            clientHeight: 600, scrollHeight: itemCount * 300,
            itemCount, itemHeight: 300, initialScrollTop,
        },
        ...(comments ? { comments: { clientHeight: 180, scrollHeight: 1_200, initialScrollTop: 0 } } : {}),
    };
}

const lifecycle = (atMs, command) => ({ atMs, kind: 'lifecycle', command });
const sample = (atMs) => ({ atMs, kind: 'sample' });
const scroll = (atMs, to, target = 'feed') => ({ atMs, kind: 'scroll', target, to });
const supply = (atMs, count) => ({ atMs, kind: 'supply', count, placement: 'offscreen' });
const visibility = (atMs, visible) => ({ atMs, kind: 'visibility', visible });
const input = (atMs, mode, count) => ({ atMs, kind: 'input', mode, count });
const replaceRegion = (atMs, nextFixture) => ({ atMs, kind: 'replace_region', fixture: nextFixture });

function checkpoint(afterStep, unknownForwardScreenfuls, unknownBackwardScreenfuls = 0, status = 'sampled') {
    return {
        afterStep,
        observed: {
            unknownForwardScreenfuls, unknownBackwardScreenfuls,
            ...(status === null ? {} : { status }),
            capabilities: { userAttribution: 'unavailable', consumptionTransitions: 'unsupported' },
        },
    };
}

function story(id, initialFixture, steps, checkpoints, constraints, unknown = []) {
    return {
        id: `dom_integration_${id}`, fixture: initialFixture, steps,
        oracle: {
            checkpoints,
            constraints,
            unknown: [
                'Native scroll events do not prove user causation, attention, comprehension, or intent.',
                'Screenful displacement is not a count of consumed items.',
                ...unknown,
            ],
        },
    };
}

export function createFlowDomIntegrationCorpus() {
    const scenarios = [
        story('measured_displacement', fixture(), [
            lifecycle(1_000, 'start'), sample(1_000),
            scroll(1_100, 300), sample(1_200), scroll(1_300, 900), scroll(1_400, 600),
        ], [
            checkpoint(1, 0), checkpoint(2, 0.5), checkpoint(4, 1.5), checkpoint(5, 1.5, 0.5),
        ], [
            'The 600px viewport is the displacement denominator.',
            'Forward travel is 300px + 600px = 1.5 screenfuls; backward travel is 300px = 0.5 screenfuls.',
            'Geometry sampling alone adds no native displacement.',
        ]),

        story('nested_comments', fixture('feed-a', { comments: true }), [
            lifecycle(1_000, 'start'), sample(1_000),
            scroll(1_100, 180, 'comments'), scroll(1_200, 300),
            scroll(1_300, 540, 'comments'), sample(1_400), scroll(1_500, 600),
        ], [
            checkpoint(2, 0), checkpoint(3, 0.5), checkpoint(4, 0.5), checkpoint(6, 1),
        ], [
            'The nested comment container is a different scroll owner.',
            'Its 540px travel adds no feed displacement; the feed itself travels 600px.',
        ]),

        story('offscreen_supply', fixture(), [
            lifecycle(1_000, 'start'), sample(1_000),
            supply(1_100, 10), sample(1_200), supply(1_300, 6), sample(1_400),
        ], [checkpoint(1, 0), checkpoint(3, 0), checkpoint(5, 0)], [
            'Sixteen new 300px items extend the feed below existing offscreen items.',
            'No native feed movement is scripted, so fresh supply adds no measured displacement.',
            'After structural mutation, a fresh sample re-establishes measurable geometry.',
        ]),

        story('scripted_origin_unknown', fixture(), [
            lifecycle(1_000, 'start'), sample(1_000),
            scroll(1_100, 600), sample(1_200), scroll(1_300, 1_200),
        ], [checkpoint(2, 1), checkpoint(4, 2)], [
            'The harness scripts 1,200px of real scroll-position change.',
            'The platform event does not carry the fixture author\'s knowledge of its cause into the model.',
            'All 2 screenfuls remain in unknown provenance; user attribution stays unavailable.',
        ]),

        story('hidden_resume', fixture(), [
            lifecycle(1_000, 'start'), sample(1_000), scroll(1_100, 300),
            visibility(1_200, false), scroll(2_000, 3_000),
            visibility(5_000, true), sample(5_100), scroll(5_200, 3_300),
        ], [
            checkpoint(2, 0.5), checkpoint(4, 0.5, 0, 'hidden'),
            checkpoint(6, 0.5), checkpoint(7, 1),
        ], [
            'The 2,700px change during hidden time lies outside measured visible displacement.',
            'The first fresh visible sample seeds position 3,000px without a catch-up jump.',
            'Measured travel is 300px before hiding plus 300px after the new baseline.',
        ], ['Activity during the hidden interval is unknown, not measured inactivity.']),

        story('stalled_sample_recovery', fixture(), [
            lifecycle(1_000, 'start'), sample(1_000), scroll(1_100, 300),
            scroll(6_000, 2_400), sample(6_100), scroll(6_200, 2_700),
        ], [
            checkpoint(2, 0.5), checkpoint(3, 0.5, 0, 'stale'),
            checkpoint(4, 0.5), checkpoint(5, 1),
        ], [
            'A multi-second stall intentionally exceeds a short-lived geometry observation.',
            'A stale sample cannot authorize the intervening 2,100px jump as measured displacement.',
            'Recovery seeds the current 2,400px position; the later 300px movement is measured.',
        ], ['The shape and timing of physical movement during the stalled interval are not observed.']),

        story('producer_restart', fixture(), [
            lifecycle(1_000, 'start'), sample(1_000), scroll(1_100, 600),
            lifecycle(1_200, 'stop'), scroll(2_000, 3_000),
            lifecycle(5_000, 'start'), sample(5_100), scroll(5_200, 3_300),
        ], [
            checkpoint(2, 1), checkpoint(4, 1, 0, 'stopped'),
            checkpoint(6, 0), checkpoint(7, 0.5),
        ], [
            'Stopped producers do not measure native movement.',
            'A new producer start owns a fresh measurement epoch and resets its totals.',
            'The restarted sample seeds 3,000px; only the subsequent 300px belongs to the new totals.',
        ], ['No continuity or activity total is inferred across the stopped interval.']),

        story('long_input_without_movement', fixture(), [
            lifecycle(1_000, 'start'), sample(1_000),
            input(1_100, 'typing', 80), sample(1_200),
            input(61_000, 'composition', 60), sample(61_100),
            input(121_000, 'paste', 1), sample(121_100),
            input(181_000, 'typing', 120), sample(181_100),
            input(301_000, 'composition', 90), sample(301_100),
        ], [checkpoint(3, 0), checkpoint(5, 0), checkpoint(7, 0), checkpoint(9, 0), checkpoint(11, 0)], [
            'Input batches span five minutes and contain no feed scroll-position changes.',
            'Typing, composition and paste do not add feed displacement.',
            'Sparse geometry samples do not establish continuously observed quiet between them.',
        ], [
            'Counts are dispatched input events, not characters, words, submissions, or writing duration.',
            'One long draft is not identifiable from these platform inputs.',
        ]),

        story('region_replacement', fixture(), [
            lifecycle(1_000, 'start'), sample(1_000), scroll(1_100, 600),
            replaceRegion(2_000, fixture('feed-b', { initialScrollTop: 1_800, itemCount: 30 })),
            sample(2_100), scroll(2_200, 2_100),
            replaceRegion(3_000, fixture('feed-c')), sample(3_100), scroll(3_200, 300),
        ], [
            checkpoint(2, 1), checkpoint(3, 1, 0, null),
            checkpoint(4, 1), checkpoint(5, 1.5), checkpoint(7, 1.5), checkpoint(8, 2),
        ], [
            'Replacing the region invalidates its DOM and position continuity.',
            'Mutation delivery is asynchronous; the immediate replacement checkpoint asserts no status before its queued invalidation.',
            'Replacing the DOM region in the same running producer retains its measured totals.',
            'The document URL does not change; this story does not exercise navigation or semantic surface transitions.',
            'Neither 600px→1,800px nor 2,100px→0px across region replacement is physical feed travel.',
            'Measured travel is 600px + 300px + 300px across three separately seeded regions.',
        ], ['Content identity across replaced regions is not proven by fixture names.']),
    ];

    return {
        version: 1, scenarios,
        design: {
            dataOrigin: 'Entirely fictional DOM geometry and platform input timelines; no collected browser data.',
            oracleBoundary: 'Only fixture construction and platform actions reach the runtime; expected snapshots never drive it.',
            units: 'Native feed displacement in screenfuls, using the explicitly authored 600px viewport.',
            measurementScope: 'Arithmetic applies only within live, visible, fresh, continuously owned sensor intervals.',
            statuses: ['sampled', 'hidden', 'stale', 'stopped', 'unavailable'],
            excludedBoundaries: ['Permission ownership and actual intervention exposure are exercised separately through their real owners.'],
            prohibitedConclusions: [
                'Passing these synthetic stories establishes real-site coverage or human intent accuracy.',
                'Measured geometry establishes reading, consumption, user causation, or desired intervention.',
            ],
        },
    };
}

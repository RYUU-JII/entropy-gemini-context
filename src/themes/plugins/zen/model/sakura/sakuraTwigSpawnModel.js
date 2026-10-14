import { clamp, lerp } from './sakuraMath';
import { smoothstep } from './sakuraAngleUtils';
import { nextRandom } from './sakuraRandomUtils';
import { resolveSakuraCanopyNegativeSpace } from './sakuraTwigSilhouettePolicy';

export const createTwigAttachSiteRegistry = () => {
    const twigAttachSitesByRoot = new Map();
    return {
        resolveRootAttachSites: (rootId) => {
            const key = String(rootId ?? 'root_unknown');
            if (!twigAttachSitesByRoot.has(key)) {
                twigAttachSitesByRoot.set(key, []);
            }
            return twigAttachSitesByRoot.get(key);
        },
    };
};

export const resolveScaffoldTwigSpawnContext = ({
    record,
    recordIndex = 0,
    scaffoldMaxDepth = 1,
    tierModels,
    scaffoldNodeTwigProb = 0.72,
    twigSpawnMinWidthBase = 0.14,
    vigorSignal = 0.55,
    scaffoldUpperCoverage = 0.58,
    rootAttachSites = [],
    scaffoldTangentAngle = 0,
}) => {
    const scaffoldDepthNorm = clamp(
        (record.scaffoldDepth - 1) / Math.max(1, (record.scaffoldDepthLimit || scaffoldMaxDepth) - 1),
        0,
        1,
    );
    const nearestSiteDistance = rootAttachSites.length
        ? rootAttachSites.reduce(
            (nearest, siteNorm) => Math.min(nearest, Math.abs(scaffoldDepthNorm - siteNorm)),
            1,
        )
        : 1;
    const localCrowding = rootAttachSites.length
        ? Math.exp(-nearestSiteDistance / 0.14)
        : 0;
    const widthNorm = clamp((record.node.width - 0.18) / 1.2, 0, 1);
    const twigBranchingProb = tierModels.twig.branching.branchingProb;
    const vigor = vigorSignal;
    const upwardAlignment = clamp(
        (Math.cos(scaffoldTangentAngle + (Math.PI / 2)) + 1) * 0.5,
        0,
        1,
    );
    const tipExposure = Math.pow(scaffoldDepthNorm, 0.78);
    const lightAvailability = clamp(
        0.18
        + tipExposure * 0.44
        + upwardAlignment * 0.26
        - localCrowding * 0.34,
        0,
        1,
    );
    const energyAvailability = clamp(
        0.2
        + widthNorm * 0.44
        + (1 - scaffoldDepthNorm) * 0.08
        + vigor * 0.22
        - localCrowding * 0.28,
        0,
        1,
    );
    const resourceAvailability = clamp(
        lightAvailability * 0.54 + energyAvailability * 0.46,
        0,
        1,
    );
    const resourceState = resourceAvailability < 0.26
        ? 'dead'
        : (resourceAvailability < 0.58 ? 'weak' : 'bloom');
    const apicalDrive = smoothstep(0.24, 0.96, scaffoldDepthNorm);
    const backBudDrive = Math.pow(1 - scaffoldDepthNorm, 1.32);
    const {
        crownRelease,
    } = resolveSakuraCanopyNegativeSpace(scaffoldDepthNorm);
    const upperFillBoost = smoothstep(0.62, 1, scaffoldDepthNorm)
        * clamp(scaffoldUpperCoverage, 0, 1)
        * 0.08;
    const occupancyPenalty = record.node.branches.length > 1 ? 0.08 : 0;
    const nodeTwigProb = scaffoldNodeTwigProb;
    const nodeTwigProbNorm = clamp((nodeTwigProb - 0.08) / 0.9, 0, 1);
    const twigSpawnChance = clamp(
        0.09
        + (nodeTwigProbNorm * 0.47)
        + (resourceAvailability * 0.21)
        + (apicalDrive * 0.2)
        + (backBudDrive * 0.06)
        + upperFillBoost
        + (twigBranchingProb * 0.1)
        - occupancyPenalty
        - (localCrowding * 0.14)
        - ((1 - scaffoldDepthNorm) * 0.14)
        - (crownRelease * 0.17),
        0.06,
        0.98,
    );
    const twigSpawnMinWidth = clamp(
        twigSpawnMinWidthBase
        * lerp(1.14, 0.72, apicalDrive)
        * lerp(1.08, 0.86, resourceAvailability),
        0.06,
        0.6,
    );
    const primarySpawnGate = nextRandom(record.nodeRandom, `scaffold_${recordIndex}_twig_spawn_gate`) < twigSpawnChance;
    const canSpawnTwig = record.node.width >= twigSpawnMinWidth
        && primarySpawnGate;
    return {
        scaffoldDepthNorm,
        widthNorm,
        resourceAvailability,
        resourceState,
        apicalDrive,
        twigSpawnChance,
        canSpawnTwig,
    };
};

export const resolveTwigChildBudgetCap = ({
    twigNodeBudgetCapBase = 20,
    resourceState = 'weak',
    resourceAvailability = 0.5,
    scaffoldDepthNorm = 0.5,
}) => {
    const baseTwigChildBudgetCap = twigNodeBudgetCapBase;
    const resourceBudgetScale = resourceState === 'dead'
        ? 0.58
        : (resourceState === 'weak' ? 0.94 : 1.16);
    const {
        crownRelease,
        midCanopySupport,
    } = resolveSakuraCanopyNegativeSpace(scaffoldDepthNorm);
    const depthScale = lerp(0.3, 1.05, midCanopySupport)
        * lerp(1, 0.82, crownRelease);

    return clamp(
        Math.round(
            baseTwigChildBudgetCap
            * resourceBudgetScale
            * lerp(0.9, 1.16, resourceAvailability)
            * depthScale
        ),
        2,
        Math.min(40, Math.max(2, Math.round(baseTwigChildBudgetCap * 1.16))),
    );
};

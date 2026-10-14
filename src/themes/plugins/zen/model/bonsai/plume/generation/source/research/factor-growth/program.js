import {zenG15OrganSample} from '../../engine/ZenBonsaiG15OrganDevelopment.js';

export const FACTORS=Object.freeze([
    {id:'continuity',label:'주축 유지',low:'자주 넘겨줌',high:'길게 이어감'},
    {id:'sharing',label:'자식 간 힘의 분배',low:'한쪽이 우세',high:'고르게 나눔'},
    {id:'aperture',label:'분화각',low:'좁게 갈라짐',high:'넓게 갈라짐'},
    {id:'attenuation',label:'말단 길이 감쇠',low:'길이를 이어감',high:'점차 짧아짐'},
    {id:'bendMemory',label:'굽힘의 지속',low:'방향을 자주 바꿈',high:'굽힘을 오래 이어감'},
    {id:'relayFrequency',label:'승계 때 꺾임',low:'드물게',high:'자주'},
    {id:'relayMagnitude',label:'꺾임의 크기',low:'완만하게',high:'과감하게'},
    {id:'gravity',label:'처짐과 회복',low:'위로 회복',high:'하중에 따라 처짐'},
    {id:'cadence',label:'분화 속도',low:'길게 뻗은 뒤',high:'일찍 갈라짐'},
]);
export const FACTOR_IDS=Object.freeze(FACTORS.map(f=>f.id));
export const PROGRAM_SEMANTICS='independent_developmental_regimes_v1';
const mix=(a,b,t)=>a+(b-a)*t;

export function validateFactors(factors){
    if(!factors||Object.keys(factors).sort().join(',')!==[...FACTOR_IDS].sort().join(',')
        ||FACTOR_IDS.some(id=>!Number.isFinite(factors[id])||factors[id]<0||factors[id]>1))throw Error('G15_FACTOR_VALUES');
    return factors;
}
export function sampleFactors(seed){
    if(!Number.isInteger(seed)||seed<1||seed>0xffffffff)throw Error('G15_FACTOR_PROGRAM_SEED');
    // Each behaviour chooses its own low / middle / high regime. There is no
    // whole-tree style lottery and no shared scalar selecting all behaviours.
    const bands=[[.04,.28],[.38,.62],[.72,.96]];
    return Object.freeze(Object.fromEntries(FACTOR_IDS.map(id=>{
        const regime=Math.min(2,Math.floor(zenG15OrganSample(seed,'factor-growth-1',id+':regime')*3));
        const v=mix(...bands[regime],zenG15OrganSample(seed,'factor-growth-1',id+':within'));
        return[id,Math.round(v*1000)/1000];
    })));
}

// Behavioural inputs to the existing phenotype/temperament owners. No camera,
// target crown height/width, final coordinates, or floral capacity is changed.
export function phenotypeTargets(f){
    validateFactors(f);
    return {
        dominantAxisPersistence:mix(.12,.9,f.continuity),
        apicalDominance:mix(.24,.86,f.continuity),
        identityPermeability:mix(.86,.14,f.continuity),
        balancedForkFrequency:mix(.12,.92,f.sharing),
        resourceContrast:mix(.86,.08,f.sharing),
        eccentricityExponent:mix(2.12,1.18,f.sharing),
        releaseAngle:mix(.72,1.34,f.aperture),
        tierApertureBias:[mix(.76,1.14,f.aperture),mix(.78,1.24,f.aperture),mix(.7,1.16,f.aperture)],
        distalAttenuation:mix(.24,.76,f.attenuation),
        secondaryAxisPersistence:mix(.88,.24,f.attenuation),
        curvaturePersistence:mix(.56,1.34,f.bendMemory),
        turnSignPersistence:mix(.16,.76,f.bendMemory),
        episodeRecommitment:mix(.82,.22,f.bendMemory),
        successionKinkPropensity:mix(.06,.78,f.relayFrequency),
        successionKinkBias:mix(.06,.42,f.relayFrequency),
        successionKinkMagnitude:mix(.46,1.1,f.relayMagnitude),
        gravityResponse:mix(.08,.94,f.gravity),
        sagResponse:mix(.08,.94,f.gravity),
        recoveryTendency:mix(.86,.18,f.gravity),
        verticalIntent:mix(.62,.2,f.gravity),
        ramificationTempo:mix(.16,.92,f.cadence),
        lateralTimingBias:mix(-.4,.4,f.cadence),
    };
}
export function projectPhenotype(original,factors,amount){
    const targets=phenotypeTargets(factors),changes={};
    for(const [key,target]of Object.entries(targets)){
        if(Array.isArray(target)){
            if(!Array.isArray(original[key])||original[key].length!==target.length)throw Error('G15_FACTOR_PHENOTYPE_ARRAY');
            changes[key]=Object.freeze(target.map((v,i)=>mix(original[key][i],v,amount)));
        }else{
            if(!Number.isFinite(original[key]))throw Error('G15_FACTOR_PHENOTYPE_FIELD: '+key);
            changes[key]=mix(original[key],target,amount);
        }
    }
    return Object.freeze({...original,...changes});
}

export function supportFor(original,factors,amount){
    // A behaviour-dependent admissible turn range; it never supplies a heading.
    // The same declared limits are used by generation and graph inspection.
    const turn=factors.relayMagnitude;
    return {...original,softLeanDegrees:mix(original.softLeanDegrees,32+turn*10,amount),
        maximumLeanDegrees:mix(original.maximumLeanDegrees,52+turn*24,amount),
        continuationTurnDegrees:mix(original.continuationTurnDegrees,24+turn*20,amount),
        codominantTurnDegrees:mix(original.codominantTurnDegrees,36+turn*18,amount)};
}

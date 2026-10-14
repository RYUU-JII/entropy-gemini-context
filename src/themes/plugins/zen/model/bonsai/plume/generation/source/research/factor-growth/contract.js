import {sampleFactors,validateFactors} from './program.js';
export const CONTRACT='zen_g15_factor_growth_v1';
export const DEFAULT_REQUEST=Object.freeze({seed:2451989979,programSeed:2451989979,
    factors:sampleFactors(2451989979),strength:1,growth:1,view:'full'});
export function validateRequest(r){
    if(!r||Object.keys(r).sort().join(',')!=='factors,growth,programSeed,seed,strength,view'
        ||[r.seed,r.programSeed].some(v=>!Number.isInteger(v)||v<1||v>0xffffffff)
        ||[r.growth,r.strength].some(v=>!Number.isFinite(v)||v<0||v>1)
        ||!['wood','partial','full'].includes(r.view))throw Error('G15_FACTOR_REQUEST');
    validateFactors(r.factors);return r;
}

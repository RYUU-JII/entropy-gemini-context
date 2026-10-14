import {validateRequest as validatePrevious} from '../factor-growth-3/contract.js';
import {sampleFactors} from './program.js';
export const TREATMENTS=Object.freeze(['combined','release','base']);
export const DEFAULT_REQUEST=Object.freeze({seed:3761432482,programSeed:2267459016,factors:sampleFactors(2267459016),strength:1,growth:1,view:'full',mode:'funding',treatment:'combined'});
export function validateRequest(request){
    if(!request||!TREATMENTS.includes(request.treatment))throw Error('G15_RELEASE_REQUEST_TREATMENT');
    const {treatment,...base}=request;validatePrevious(base);return request;
}
export const CONTRACT='zen_g15_factor_growth_v4';

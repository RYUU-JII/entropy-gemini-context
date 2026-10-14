import {DEFAULT_REQUEST as previous,validateRequest as validatePrevious} from '../factor-growth/contract.js';
export const DEFAULT_REQUEST=Object.freeze({...previous,mode:'combined'});
export function validateRequest(request){
    if(!request||!['combined','opportunity','funding'].includes(request.mode))throw Error('G15_LATERAL_REQUEST_MODE');
    const {mode,...base}=request;validatePrevious(base);return request;
}
export const CONTRACT='zen_g15_factor_growth_v3';

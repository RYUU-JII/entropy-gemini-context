import {generateJointFrame} from '../joint-frame/candidate-entry.js';
import {withBranchSpace} from './ZenG15BranchSpace.js';
export function generateBranchSpace(options,foundation,mode){
if(!['baseline','joint'].includes(foundation))throw Error('G15_BRANCH_SPACE_FOUNDATION');
const result=withBranchSpace(mode,()=>generateJointFrame(options,foundation,.7));
return {...result.value,branchObservation:result.observation};
}

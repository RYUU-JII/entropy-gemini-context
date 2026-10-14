import {zenPlumeKernelRealm} from "../../../kernelRealm.js";
import {generateBranchSpace} from '../branch-space/candidate-entry.js';
import {generationOptions} from './settings.js';
import {withFactorGrowth} from './ZenG15ReleaseGrowth.js';
export {sampleFactors} from './program.js';
export const validateGeneratedGraph=graph=>zenPlumeKernelRealm.ZenBonsaiTypedDevelopmentalSchedulerGraphInspector.validateGraph(graph);
export function generateArm(request,refine,growth=request.growth,bloom=request.view==='partial'?.35:.92){
return withFactorGrowth(request,refine,()=>generateBranchSpace(generationOptions(request.seed,growth,bloom),'joint','boundary'));
}

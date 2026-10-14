import {generateG15Topology} from '../../engine/generate.js';
import {withJointFrame} from './ZenG15FlowJointFrame.js';

export function generateJointFrame(options,mode='curve',strength=.7){
    return withJointFrame(mode,strength,()=>generateG15Topology(options));
}

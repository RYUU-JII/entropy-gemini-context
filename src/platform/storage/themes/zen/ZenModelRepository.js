import ModelStateRepository from '../../model/ModelStateRepository.js';
import ZenModelRepositoryCore from './ZenModelRepositoryCore.js';
import {
    createZenThemeLifecycleProfileGenerationLease,
} from './ZenThemeLifecycleProfileGenerationLease.js';

export class ZenModelRepository extends ZenModelRepositoryCore {
    constructor({
        modelStateRepository = ModelStateRepository.getInstance(),
        zenThemeModelState = null,
        profileLifecycleRepository = undefined,
    } = {}) {
        super({
            modelStateRepository,
            zenThemeModelState,
            createProfileGenerationLease: ({ profileGeneration }) => (
                createZenThemeLifecycleProfileGenerationLease({
                    profileLifecycleRepository,
                    profileGeneration,
                })
            ),
        });
    }

    static getInstance() {
        if (!ZenModelRepository.instance) {
            ZenModelRepository.instance = new ZenModelRepository();
        }
        return ZenModelRepository.instance;
    }
}

export {
    ZenThemeModelState,
} from './ZenThemeModelState.js';
export default ZenModelRepository;

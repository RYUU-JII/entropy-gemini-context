import ModelStateRepository from '../../model/ModelStateRepository.js';
import ZenModelRepositoryCore from './ZenModelRepositoryCore.js';
import {
    createPinnedZenThemeProfileGenerationLease,
    requireZenThemeProfileGeneration,
} from './ZenThemeProfileGenerationLease.js';

export class ZenWorkerModelRepository extends ZenModelRepositoryCore {
    constructor({
        modelStateRepository = ModelStateRepository.getInstance(),
        profileGeneration,
    } = {}) {
        const pinnedProfileGeneration = requireZenThemeProfileGeneration(profileGeneration);
        super({
            modelStateRepository,
            profileGeneration: pinnedProfileGeneration,
            createProfileGenerationLease: ({ profileGeneration: requestedGeneration }) => (
                createPinnedZenThemeProfileGenerationLease({
                    profileGeneration: requestedGeneration,
                })
            ),
        });
    }
}

export default ZenWorkerModelRepository;

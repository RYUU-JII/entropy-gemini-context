import ZenModelRepository from '../../state/ZenModelRepository.js';
import {
    ZEN_THEME_MODEL_STATE_KEYS,
} from '../../state/ZenThemeModelState.js';
import {
    normalizeZenBonsaiCultivationLedger,
} from '../../model/ZenBonsaiCultivationLedger.js';

export class ZenBonsaiCultivationRepository {
    constructor({
        modelRepository = ZenModelRepository.getInstance(),
    } = {}) {
        if (!modelRepository || typeof modelRepository.getValueForBootstrap !== 'function' || typeof modelRepository.setValue !== 'function') {
            throw new Error('ZEN_BONSAI_CULTIVATION_REPOSITORY_MODEL_STORE_REQUIRED');
        }
        this.modelRepository = modelRepository;
    }

    static getInstance() {
        if (!ZenBonsaiCultivationRepository.instance) {
            ZenBonsaiCultivationRepository.instance = new ZenBonsaiCultivationRepository();
        }
        return ZenBonsaiCultivationRepository.instance;
    }

    async getCultivationLedger({
        nowMs = 0,
    } = {}) {
        const value = await this.modelRepository.getValueForBootstrap(
            ZEN_THEME_MODEL_STATE_KEYS.BONSAI_CULTIVATION_LEDGER,
        );
        if (value === undefined || value === null) {
            return null;
        }
        return normalizeZenBonsaiCultivationLedger(value, { nowMs });
    }

    async setCultivationLedger(value, {
        nowMs = 0,
    } = {}) {
        const normalized = normalizeZenBonsaiCultivationLedger(value, { nowMs });
        await this.modelRepository.setValue(
            ZEN_THEME_MODEL_STATE_KEYS.BONSAI_CULTIVATION_LEDGER,
            normalized,
        );
        return normalized;
    }
}

export default ZenBonsaiCultivationRepository;

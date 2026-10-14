import {
  MODEL_STATE_PROFILE_DEVELOPMENT_BASELINE,
} from '../../model/ProfileCompatibilityContract.js';
import {
  MODEL_STATE_PROFILE_EPOCH_CONTRACT,
} from '../../model/ProfileEpochContract.js';
import {
  ZEN_BONSAI_CLASSIC2_ACTIVE_IDENTITY_CONTRACT,
} from '../../../../themes/plugins/zen/contracts/ZenBonsaiClassic2IdentityContract.js';
import {
  ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
} from '../../../../themes/plugins/zen/contracts/ZenBonsaiClassic2CandidateGraphContract.js';
import {
  SAKURA_MACRO_SPINE_GUIDE_CONDITION_ID_NAMESPACE,
  SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_ID_NAMESPACE,
} from '../../../../themes/plugins/zen/contracts/SakuraSpineGenerationConditionContract.js';
import {
  ZEN_BONSAI_PROFILE_AGGREGATE_CONTRACT,
} from './ZenBonsaiProfileAggregateStorageContract.js';

export const ZEN_PROFILE_PERSISTENCE_DESCRIPTOR_CONTRACT = (
  'zen_profile_persistence_descriptor_v1'
);

export const ZEN_PROFILE_PERSISTENCE_DESCRIPTOR = Object.freeze({
  contract: ZEN_PROFILE_PERSISTENCE_DESCRIPTOR_CONTRACT,
  developmentBaseline: MODEL_STATE_PROFILE_DEVELOPMENT_BASELINE,
  profileEpochContract: MODEL_STATE_PROFILE_EPOCH_CONTRACT,
  bonsaiProfileAggregateContract: ZEN_BONSAI_PROFILE_AGGREGATE_CONTRACT,
  bonsaiActiveIdentityContract: ZEN_BONSAI_CLASSIC2_ACTIVE_IDENTITY_CONTRACT,
  bonsaiCandidateGraphContract: ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
  spineConditionNamespaces: Object.freeze([
    SAKURA_MACRO_SPINE_GUIDE_CONDITION_ID_NAMESPACE,
    SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_ID_NAMESPACE,
  ]),
});

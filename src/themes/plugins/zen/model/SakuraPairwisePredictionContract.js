export const SAKURA_PAIRWISE_MODEL_VERSION = 5;
export const SAKURA_PAIRWISE_INPUT_BASIS = 'canonical_learning_latent_rff';

// Bump this identity whenever a reset/replay changes the meaning of a
// pre-feedback probability. History with another identity remains readable,
// but cannot certify the current model's predictive reliability.
export const SAKURA_PAIRWISE_PREDICTION_CONTRACT_ID =
    'sakura_pairwise_gp_v5_canonical_learning_latent_rff_generation_semantics_v5';

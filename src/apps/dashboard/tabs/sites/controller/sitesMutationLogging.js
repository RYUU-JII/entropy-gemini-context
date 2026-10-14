export function logRuleMutationFailure(stage, details = {}, result = null) {
    const payload = {
        ...details,
        changedKeys: Array.isArray(result?.changedKeys) ? result.changedKeys : [],
        version: result?.version ?? null,
        applied: result?.applied && typeof result.applied === 'object'
            ? { ...result.applied }
            : null,
        error: {
            code: typeof result?.error?.code === 'string' && result.error.code.trim()
                ? result.error.code.trim()
                : null,
            message: typeof result?.error?.message === 'string' && result.error.message.trim()
                ? result.error.message.trim()
                : String(result?.error || 'UNKNOWN_ERROR'),
            name: typeof result?.error?.name === 'string' && result.error.name.trim()
                ? result.error.name.trim()
                : null,
        },
    };
    let serializedPayload;
    try {
        serializedPayload = JSON.stringify(payload);
    } catch {
        serializedPayload = '{"error":"RULE_MUTATION_LOG_UNSERIALIZABLE"}';
    }
    console.error(`[SETTINGS_FLOW][sites][${stage}_failed] ${serializedPayload}`);
}

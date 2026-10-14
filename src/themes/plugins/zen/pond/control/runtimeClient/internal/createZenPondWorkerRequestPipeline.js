export const createZenPondWorkerRequestPipeline = ({
    messageType,
    requestClient,
    executionController,
    taskQueue,
    createControlChannelCoalescer,
    sessionId,
    nextSequence,
    isObject: isObjectValue,
    defaultRequestTimeoutMs,
    getStarted,
    getDisposed,
    getLastVisibilityRequest,
    setLastVisibilityRequest,
    visibilityCancelKey,
    runtimeTaskType,
    runtimePriority,
    onTaskError,
} = {}) => {
    const runRequest = async ({
        type,
        payload = {},
        taskType = runtimeTaskType.ZEN_POND_RENDER_CONTROL,
        priority = runtimePriority.USER_VISIBLE,
        timeoutMs = defaultRequestTimeoutMs,
        minTimeoutMs = null,
        useExecutionController = true,
    } = {}) => {
        const nextPayload = {
            ...(isObjectValue(payload) ? payload : {}),
            __session: {
                id: sessionId,
                seq: nextSequence(),
                ts: Date.now(),
                type,
            },
        };
        const requestOptions = {
            taskType,
            priority,
            timeoutMs,
        };
        if (Number.isFinite(Number(minTimeoutMs)) && Number(minTimeoutMs) > 0) {
            requestOptions.minTimeoutMs = Math.floor(Number(minTimeoutMs));
        }
        const runWorkerRequest = () => requestClient.request(type, nextPayload, requestOptions);
        if (useExecutionController === false) {
            return runWorkerRequest();
        }
        const execution = await executionController.execute({
            runWorker: runWorkerRequest,
            meta: {
                requestType: type,
                taskType,
            },
        });
        if (!execution?.ok) {
            throw execution?.error || new Error('ZEN_POND_RENDERER_REQUEST_FAILED');
        }
        return execution?.result;
    };

    const controlCoalescer = createControlChannelCoalescer({
        enqueueTask: (taskMeta = {}, runTask = null) => (
            taskQueue.enqueue({
                id: typeof taskMeta?.id === 'string' ? taskMeta.id : null,
                priority: taskMeta?.priority,
            }, runTask)
        ),
        isActive: () => getStarted() && !getDisposed(),
        onTaskError,
    });

    const runLatest = ({
        type,
        payload = {},
        cancelKey = null,
        taskType = runtimeTaskType.ZEN_POND_RENDER_CONTROL,
        priority = runtimePriority.USER_VISIBLE,
        onSuccess = null,
        onError = null,
        validateResult = null,
    } = {}) => {
        if (!getStarted() || getDisposed()) return;
        const channelKey = (typeof cancelKey === 'string' && cancelKey.trim()) || type;
        controlCoalescer.pushLatest({
            channelKey,
            priority,
            label: type,
            run: async () => {
                try {
                    const result = await runRequest({
                        type,
                        payload,
                        taskType,
                        priority,
                        useExecutionController: false,
                    });
                    if (typeof validateResult === 'function') {
                        const validationError = validateResult(result);
                        if (validationError) {
                            throw (
                                validationError instanceof Error
                                    ? validationError
                                    : new Error(String(validationError))
                            );
                        }
                    }
                    if (typeof onSuccess === 'function') {
                        onSuccess(result);
                    }
                    return result;
                } catch (error) {
                    if (typeof onError === 'function') {
                        onError(error);
                    }
                    throw error;
                }
            },
        });
    };

    const createControlAckValidator = ({
        requestType = 'unknown',
        expectedActive = null,
    } = {}) => (result = null) => {
        if (!isObjectValue(result)) {
            return new Error(`ZEN_POND_CONTROL_ACK_INVALID:${requestType}`);
        }
        const ack = isObjectValue(result?.ack) ? result.ack : null;
        if (result.ignored === true || ack?.stale === true || ack?.applied === false) {
            const reason = typeof result?.reason === 'string'
                ? result.reason
                : (typeof ack?.reason === 'string' ? ack.reason : 'unknown');
            return new Error(`ZEN_POND_CONTROL_NACK_STALE:${requestType}:${reason}`);
        }
        if (ack && typeof ack.channel === 'string' && ack.channel && ack.channel !== requestType) {
            return new Error(`ZEN_POND_CONTROL_ACK_CHANNEL_MISMATCH:${requestType}:${ack.channel}`);
        }
        if (typeof expectedActive === 'boolean') {
            const resolvedActive = result.active === true;
            if (resolvedActive !== expectedActive) {
                return new Error(
                    `ZEN_POND_CONTROL_ACK_ACTIVE_MISMATCH:${requestType}:expected=${expectedActive ? 1 : 0}:actual=${resolvedActive ? 1 : 0}`,
                );
            }
        }
        return null;
    };

    const syncVisibilityState = (nextActive = true) => {
        if (!getStarted() || getDisposed()) return;
        const targetVisibility = nextActive === true;
        if (getLastVisibilityRequest() === targetVisibility) return;
        setLastVisibilityRequest(targetVisibility);
        runLatest({
            type: messageType.SET_VISIBILITY,
            payload: { active: targetVisibility },
            cancelKey: visibilityCancelKey,
            validateResult: createControlAckValidator({
                requestType: messageType.SET_VISIBILITY,
                expectedActive: targetVisibility,
            }),
        });
    };

    return {
        runRequest,
        runLatest,
        createControlAckValidator,
        syncVisibilityState,
        clearControlCoalescer: () => controlCoalescer.clear(),
    };
};

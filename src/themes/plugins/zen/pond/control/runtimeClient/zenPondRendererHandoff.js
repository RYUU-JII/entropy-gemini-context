// Serialize replacements of the one logical pond channel, including mounts
// disposed while they are still waiting for an older channel to release.
export const createZenPondRendererHandoff = () => {
    let pendingDisposal = null;
    return {
        acquire() {
            const predecessor = pendingDisposal;
            let disposed = false;
            let disposal = null;
            return {
                start(startRuntime) {
                    const start = () => disposed ? undefined : startRuntime();
                    return Promise.resolve(predecessor).then(start);
                },
                dispose(disposeRuntime) {
                    if (disposed) return disposal;
                    disposed = true;
                    disposal = Promise.all([predecessor, Promise.resolve().then(disposeRuntime)]).then(() => undefined);
                    pendingDisposal = disposal;
                    return disposal;
                },
            };
        },
    };
};

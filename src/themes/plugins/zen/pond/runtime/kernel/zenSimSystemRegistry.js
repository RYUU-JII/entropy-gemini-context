const isSystem = (candidate) => (
    Boolean(candidate && typeof candidate.step === 'function')
);

export const createZenSimSystemRegistry = () => {
    const systems = [];

    const register = (system) => {
        if (!isSystem(system)) return null;
        systems.push(system);
        return system;
    };

    const unregister = (system) => {
        const index = systems.indexOf(system);
        if (index < 0) return false;
        systems.splice(index, 1);
        return true;
    };

    const stepAll = (payload = {}) => {
        for (let i = 0; i < systems.length; i += 1) {
            systems[i].step(payload);
        }
    };

    const dispose = () => {
        for (let i = 0; i < systems.length; i += 1) {
            const system = systems[i];
            if (typeof system?.dispose === 'function') {
                system.dispose();
            }
        }
        systems.length = 0;
    };

    return {
        register,
        unregister,
        stepAll,
        dispose,
    };
};

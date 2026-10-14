export function createBuildCapabilityMessageRoutes() {
  return {
    actions: Object.create(null),
    browserEvents: Object.freeze({
      handleActionClicked: null,
    }),
  };
}

export default createBuildCapabilityMessageRoutes;

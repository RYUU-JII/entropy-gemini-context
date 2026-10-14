export const ENTROPY_RUNTIME_BUILD_INFO = Object.freeze({
    buildId: typeof __ENTROPY_BUILD_ID__ !== 'undefined'
        ? __ENTROPY_BUILD_ID__
        : 'unbundled',
    createdAt: typeof __ENTROPY_BUILD_CREATED_AT__ !== 'undefined'
        ? __ENTROPY_BUILD_CREATED_AT__
        : '',
    releaseProfile: typeof __ENTROPY_RELEASE_PROFILE__ !== 'undefined'
        ? __ENTROPY_RELEASE_PROFILE__
        : '',
    extensionTarget: typeof __ENTROPY_EXTENSION_TARGET__ !== 'undefined'
        ? __ENTROPY_EXTENSION_TARGET__
        : '',
});

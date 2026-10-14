// A bake owns its display tree, filters, and textures separately. Pixi does
// not destroy filters when destroying a Container, and detaching children
// does not dispose their mask geometry.
export const destroyZenBonsaiG15Bake = ({ sceneContainer, filters, textures }) => {
    const errors = [];
    const attempt = (dispose) => {
        try {
            dispose();
        } catch (error) {
            errors.push(error);
        }
    };
    attempt(() => sceneContainer.parent?.removeChild(sceneContainer));
    attempt(() => {
        sceneContainer.filters = null;
        sceneContainer.destroy({ children: true, texture: false, baseTexture: false });
    });
    for (const filter of filters) attempt(() => filter.destroy());
    for (const texture of textures) attempt(() => texture.destroy(true));
    if (errors.length > 0) {
        throw new AggregateError(errors, 'ZEN_BONSAI_G15_PIXI_BAKE_DISPOSAL_FAILED');
    }
};

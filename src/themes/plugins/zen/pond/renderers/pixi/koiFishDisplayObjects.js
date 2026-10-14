import { ZenKoiMaterialRope, ZenKoiShadowRope, ZenKoiShadowTail } from './ZenKoiMaterialMesh.js';
import { requireZenKoiMaterialWebGLVersion } from './zenKoiMaterialShaderDialect.js';
import { ZenKoiFinShadowMesh } from './ZenKoiFinShadowMesh.js';
import {
    BLEND_MODES,
    Container,
    Point,
    Sprite,
    Texture,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';

export const createPixiKoiRopePoints = (fishInfo) => {
    const points = [];
    const numPoints = fishInfo.historyLength || 20;
    for (let i = 0; i < numPoints; i += 1) {
        points.push(new Point(0, 0));
    }
    return points;
};

export const createPixiKoiDisplayObjects = ({
    fishInfo,
    textures,
    glowTexture = null,
    webGLVersion,
}) => {
    requireZenKoiMaterialWebGLVersion(webGLVersion);
    const container = new Container();

    const shadowPoints = createPixiKoiRopePoints(fishInfo);
    const shadowRope = new ZenKoiShadowRope(textures.body, shadowPoints, webGLVersion);
    shadowRope.visible = false;
    shadowRope.alpha = 0;
    container.addChild(shadowRope);

    const shadowTail = new ZenKoiShadowTail(Texture.EMPTY, webGLVersion);
    shadowTail.anchor.set(0.5, 0.5);
    shadowTail.visible = false;
    shadowTail.alpha = 0;
    container.addChild(shadowTail);

    const shadowFins = new ZenKoiFinShadowMesh(webGLVersion);
    container.addChild(shadowFins);

    // Focus halo — sits above the shadow but below the fins/body so the fish
    // rests in the light and only the soft outer ring spills onto the water.
    let glowSprite = null;
    if (glowTexture) {
        glowSprite = new Sprite(glowTexture);
        glowSprite.anchor.set(0.5, 0.5);
        glowSprite.blendMode = BLEND_MODES.SCREEN;
        glowSprite.visible = false;
        glowSprite.alpha = 0;
        container.addChild(glowSprite);
    }

    const tail = new Sprite(textures.tail);
    tail.anchor.set(
        textures.tailAnchor?.x ?? 0.5,
        textures.tailAnchor?.y ?? 0.5,
    );
    container.addChild(tail);

    const ropePoints = createPixiKoiRopePoints(fishInfo);
    const bodyRope = new ZenKoiMaterialRope(textures.body, ropePoints, textures.bodyForm, webGLVersion);
    container.addChild(bodyRope);

    const finMainL = new Sprite(textures.finMain);
    finMainL.anchor.set(0.5, 0.5);
    container.addChild(finMainL);

    const finMainR = new Sprite(textures.finMain);
    finMainR.anchor.set(0.5, 0.5);
    container.addChild(finMainR);

    const finSubL = new Sprite(textures.finSub);
    finSubL.anchor.set(0.5, 0.5);
    container.addChild(finSubL);

    const finSubR = new Sprite(textures.finSub);
    finSubR.anchor.set(0.5, 0.5);
    container.addChild(finSubR);

    return {
        container,
        shadowPoints,
        shadowRope,
        shadowTail,
        shadowFins,
        glowSprite,
        finMainL,
        finMainR,
        finSubL,
        finSubR,
        tail,
        ropePoints,
        bodyRope,
    };
};

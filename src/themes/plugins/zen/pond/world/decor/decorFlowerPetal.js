import {
    drawZenPetal,
} from '../../../runtime/petals/zenPetalMaterial.js';
import { requireZenPetalLandingDescriptor } from '../../contracts/zenPondPetalLanding.js';
import { requireZenWorldBotanicalMaterialLighting } from '../../../runtime/environment/zenWorldBotanicalMaterialLighting.js';

const findLandingPad = (landing, lilyPads) => lilyPads.find((pad) => (
    pad.containsWorldPoint(landing.x, landing.y, landing.size * 0.14)
));

// This entity has no emitter or reset path. Its visual identity comes from the
// app field and it lives once, on water or on a lily pad, before fading away.
class ZenLandedFlowerPetal {
    constructor(landing, lilyPads) {
        requireZenPetalLandingDescriptor(landing);
        Object.assign(this, landing);
        this.active = true;
        this.baseOpacity = landing.opacity;
        this.life = 0;
        this.maxLife = 18 + landing.shapeType * 1.2;
        this.driftPhase = landing.rotation;
        this.restingPad = findLandingPad(landing, lilyPads);
        this.state = this.restingPad ? 'resting' : 'floating';
        this.padOffsetX = this.restingPad ? this.x - this.restingPad.x : 0;
        this.padOffsetY = this.restingPad ? this.y - this.restingPad.y : 0;
    }

    update(width, height, dtSec = 1 / 60, _tuning = null, surfaces = null) {
        if (!this.active) return;
        this.life += dtSec;
        this.driftPhase += dtSec * 0.5;
        if (this.state === 'resting') {
            this.x = this.restingPad.x + this.padOffsetX;
            this.y = this.restingPad.y + this.padOffsetY;
        } else {
            const field = surfaces.petalField;
            // Retain landing velocity, then damp it over the first second.
            const momentum = Math.exp(-this.life * 5);
            this.x += (this.velocityX * momentum
                + field.surfaceFlowX * 3.4
                + field.windX * field.windIntensity * 0.72
                + Math.sin(this.driftPhase) * 1.5) * dtSec;
            this.y += (this.velocityY * momentum
                + field.surfaceFlowY * 2.1
                + Math.cos(this.driftPhase * 0.73) * 0.65) * dtSec;
        }
        const progress = this.life / this.maxLife;
        this.opacity = this.baseOpacity * Math.max(0, Math.min(1, (1 - progress) / 0.28));
        if (progress >= 1 || this.x < -28 || this.x > width + 28 || this.y < -28 || this.y > height + 28) {
            this.active = false;
        }
    }

    draw(ctx, materialLighting) {
        if (!this.active || this.opacity <= 0) return;
        requireZenWorldBotanicalMaterialLighting(materialLighting);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.opacity;
        drawZenPetal(ctx, this.size, this.shapeType, this.color, materialLighting);
        ctx.restore();
    }
}

export const createZenLandedFlowerPetal = ({ landing, lilyPads }) => (
    new ZenLandedFlowerPetal(landing, lilyPads)
);

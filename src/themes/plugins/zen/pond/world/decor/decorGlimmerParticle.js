class GlimmerParticle {
    buildSparkField() {
        const count = 10 + Math.floor(Math.random() * 6);
        this.sparks = Array.from({ length: count }, (_, index) => {
            const angle = Math.random() * Math.PI * 2;
            return {
                angle,
                orbit: 0.24 + Math.random() * 0.66,
                length: 0.24 + Math.random() * 0.44,
                width: 0.16 + Math.random() * 0.18,
                phase: angle + index * 0.38,
                flicker: 0.35 + Math.random() * 0.55,
            };
        });
    }

    constructor(width, height) {
        this.reset(width, height);
    }
    reset(width, height) {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.rotation = Math.random() * Math.PI * 2;
        this.buildSparkField();
        this.size = 0;
        this.maxSize = 0.45 + Math.random() * 0.9;
        this.life = 0;
        this.maxLife = 8 + Math.random() * 16;
        this.active = false;
        // Spawn faster for denser and livelier glimmer cadence.
        this.spawnDelay = Math.random() * 60;
    }
    update(width, height, dtSec = 1 / 60) {
        const frameScale = Math.max(0, dtSec) * 60;
        if (this.spawnDelay > 0) {
            this.spawnDelay -= frameScale;
            if (this.spawnDelay <= 0) {
                this.active = true;
                this.life = 0;
                this.size = 0;
            }
            return;
        }

        if (this.active) {
            this.life += frameScale;
            // Grow then shrink
            const progress = this.life / this.maxLife;
            this.size = Math.sin(progress * Math.PI) * this.maxSize;
            this.rotation += frameScale * 0.03;

            if (this.life >= this.maxLife) {
                this.rotation = Math.random() * Math.PI * 2;
                this.reset(width, height);
            }
        }
    }
    draw(ctx) {
        if (!this.active || this.size < 0.1) return;
        const progress = Math.max(0, Math.sin((this.life / this.maxLife) * Math.PI));
        const jitter = Math.sin((this.life * 0.17) + this.phase) * 0.22;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = clampValue(0.3 + progress * 0.58, 0, 1);
        ctx.globalCompositeOperation = 'lighter';

        const softRadius = this.size * 0.58;
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, softRadius);
        gradient.addColorStop(0, 'rgba(255,253,231,0.95)');
        gradient.addColorStop(1, 'rgba(255,253,231,0)');
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(0, 0, softRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,253,231,0.72)';
        for (let i = 0; i < this.sparks.length; i += 1) {
            const spark = this.sparks[i];
            const orbit = this.size * spark.orbit * (0.8 + spark.flicker * progress);
            const length = this.size * spark.length;
            const width = Math.max(0.1, this.size * spark.width);
            const jitterAmount = Math.sin((this.life + spark.phase + jitter) * 0.2) * (width * 0.6);

            const angle = spark.angle + this.rotation * 0.6 + jitterAmount;
            const baseX = Math.cos(angle) * orbit;
            const baseY = Math.sin(angle) * orbit;
            const endX = Math.cos(angle) * (orbit + length) + Math.cos(angle + 1.1) * (width * 1.8);
            const endY = Math.sin(angle) * (orbit + length) + Math.sin(angle + 1.1) * (width * 1.8);

            ctx.fillStyle = 'rgba(255,253,231,0.2)';
            ctx.beginPath();
            ctx.arc(baseX, baseY, width * 0.66, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(endX, endY, width * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,253,231,0.34)';
            ctx.lineWidth = Math.max(0.11, width * 0.72);
            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        ctx.restore();
    }
}

export { GlimmerParticle };

class WaterParticle {
    constructor(width, height) {
        this.reset(width, height);
    }
    reset(width, height) {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = 0.4 + Math.random() * 1.4;
        this.speedX = (Math.random() - 0.5) * 0.05;
        this.speedY = (Math.random() - 0.5) * 0.04;
        this.opacity = 0.05 + Math.random() * 0.14;
        this.maxLife = 260 + Math.random() * 320;
        // Randomize lifecycle phase so particles are visible immediately
        // instead of synchronizing near alpha=0 at startup.
        this.life = Math.random() * this.maxLife;
        // Neutral submerged specks to avoid top-edge yellow/brown artifact look.
        this.color = Math.random() > 0.5 ? '197, 214, 222' : '165, 186, 198';
    }
    update(width, height, dtSec = 1 / 60) {
        const frameScale = Math.max(0, dtSec) * 60;
        this.x += this.speedX * frameScale;
        this.y += this.speedY * frameScale;
        this.life += frameScale;

        const outOfBounds = this.x < -12 || this.x > width + 12 || this.y < -12 || this.y > height + 12;
        if (this.life > this.maxLife || outOfBounds) {
            this.reset(width, height);
        }
        return true;
    }
    draw(ctx) {
        const fade = Math.sin((this.life / this.maxLife) * Math.PI);
        ctx.fillStyle = `rgba(${this.color}, ${this.opacity * fade})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

export { WaterParticle };

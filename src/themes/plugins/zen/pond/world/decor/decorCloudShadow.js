class TreeCanopy {
    constructor(width, height) {
        // Defines a large cluster of leaves
        this.leaves = [];
        this.centerX = Math.random() > 0.5 ? -150 : width + 150; // Further out to project long shadows
        this.centerY = Math.random() * height;
        this.swayPhase = Math.random() * Math.PI * 2;
        this.swaySpeed = 0.002 + Math.random() * 0.003; // Slower, heavier sway

        // Generate hundreds of small leaves for porous shadow
        const count = 120 + Math.floor(Math.random() * 80);
        const clusterRadius = 250 + Math.random() * 200;

        for (let i = 0; i < count; i++) {
            // Random point in circle (archery target distribution)
            const r = Math.sqrt(Math.random()) * clusterRadius;
            const theta = Math.random() * Math.PI * 2;

            this.leaves.push({
                x: Math.cos(theta) * r,
                y: Math.sin(theta) * r,
                size: 15 + Math.random() * 35, // Individual leaf size
                rotation: Math.random() * Math.PI * 2,
                opacity: 0.2 + Math.random() * 0.4 // Varied opacity for depth
            });
        }
    }

    reset() { } // Static

    update(dtSec = 1 / 60) {
        const frameScale = Math.max(0, dtSec) * 60;
        this.swayPhase += this.swaySpeed * frameScale;
    }

    draw(ctx) {
        ctx.save();
        // Sway movement
        const swayX = Math.sin(this.swayPhase) * 20;
        const swayY = Math.cos(this.swayPhase * 0.7) * 10;

        ctx.translate(this.centerX + swayX, this.centerY + swayY);

        // Dark, soft shadow color. 
        // We use 'multiply' to darken the water naturally
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#1A2318'; // Very dark eco-green/black

        this.leaves.forEach(leaf => {
            ctx.globalAlpha = leaf.opacity * 0.3; // Low alpha for subtle layering
            ctx.beginPath();
            // Leaf Shape: Two overlapping curves (Lens shape)
            ctx.ellipse(leaf.x, leaf.y, leaf.size, leaf.size * 0.5, leaf.rotation, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
    }
}

export { TreeCanopy as CloudShadow };

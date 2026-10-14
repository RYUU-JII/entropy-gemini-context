import { BLEND_MODES, Container, Graphics, Sprite } from '../../../runtime/worker/zenPixiWorkerRuntime.js';
import { createZenRaster } from './zenMaterialRaster.js';
import { createZenSeededRandom } from '../../../shared/zenSeededRandom.js';
import { zenEaseInOut } from './zenArtifactTiming.js';

const STONE = ['#78716c', '#57534e', '#44403c', '#292524', '#1c1917'];
function stoneRect(ctx, x, y, w, h, top, bottom, radius = 0) {
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, top); fill.addColorStop(1, bottom);
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}
function shadow(ctx, resolution, blur, y, opacity, paint) {
  ctx.save(); ctx.filter = `blur(${blur * resolution}px)`;
  ctx.translate(0, y); ctx.globalAlpha = opacity; paint(); ctx.restore();
}

// Fixed orthographic stone construction. CSS pixels, dimensions, gradients and
// stacking order follow Ishidouro.jsx; all soft edges compile once.
export function paintZenIshidouroStone(ctx, resolution) {
  const box = (x, y, w, h, a, b, r = 0) => stoneRect(ctx, x, y, w, h, a, b, r);
  shadow(ctx, resolution, 8, 5, 0.85, () => box(-104, 96, 208, 24, '#000', '#000', 2));
  shadow(ctx, resolution, 8, 5, 0.8, () => box(-80, 417, 160, 32, '#000', '#000', 2));
  const jewel = new Path2D('M0 0 C-16 0 -16 20 -10 27 C-5 34 5 34 10 27 C16 20 16 0 0 0Z');
  const jewelFill = ctx.createRadialGradient(-4, 8, 0, 0, 16, 23);
  jewelFill.addColorStop(0, '#a8a29e'); jewelFill.addColorStop(0.4, STONE[1]); jewelFill.addColorStop(1, STONE[3]);
  ctx.fillStyle = jewelFill; ctx.fill(jewel);
  box(-16, 30, 32, 8, STONE[1], STONE[3], 4);
  box(-28, 34, 56, 16, STONE[0], STONE[2]);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; for (const x of [-14, 0, 14]) ctx.fillRect(x, 34, 1, 16);
  ctx.save(); ctx.clip(new Path2D('M-21.12 48 H21.12 L88 96 H-88Z'));
  box(-88, 48, 176, 48, STONE[1], STONE[3]);
  ctx.strokeStyle = 'rgba(0,0,0,.03)'; ctx.lineWidth = 1;
  for (let x = -140; x < 140; x += 14) { ctx.beginPath(); ctx.moveTo(x, 48); ctx.lineTo(x + 48, 96); ctx.stroke(); }
  ctx.restore();
  box(-104, 96, 208, 24, STONE[2], STONE[4], 2);
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(-104, 96, 208, 1);
  box(-64, 226, 128, 12, STONE[1], STONE[2], [2, 2, 0, 0]);
  const flare = new Path2D('M-64 238 H64 L56 256 Q51 262 36 262 H-36 Q-51 262 -56 256Z');
  const flareFill = ctx.createLinearGradient(0, 238, 0, 262); flareFill.addColorStop(0, STONE[2]); flareFill.addColorStop(1, STONE[4]);
  ctx.fillStyle = flareFill; ctx.fill(flare);
  box(-40, 257, 80, 144, STONE[2], STONE[2]);
  const pillar = ctx.createLinearGradient(-40, 0, 40, 0);
  pillar.addColorStop(0, 'rgba(0,0,0,.5)'); pillar.addColorStop(.15, 'transparent'); pillar.addColorStop(.85, 'transparent'); pillar.addColorStop(1, 'rgba(255,255,255,.1)');
  ctx.fillStyle = pillar; ctx.fillRect(-40, 257, 80, 144);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let x = -36; x < 40; x += 6) ctx.fillRect(x, 257, 2, 144);
  box(-16, 281, 32, 56, '#25221f', '#25221f');
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(-16, 281, 2, 56); ctx.fillRect(14, 281, 2, 56);
  for (const [y, w] of [[298, 16], [308, 8], [318, 16]]) {
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-w / 2, y + 1, w, 2);
    ctx.fillStyle = '#000'; ctx.fillRect(-w / 2, y, w, 2);
  }
  box(-56, 401, 112, 16, STONE[1], STONE[3], [8, 8, 0, 0]);
  box(-80, 417, 160, 32, STONE[2], STONE[4], 2);
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(-80, 417, 160, 1);
  shadow(ctx, resolution, 1, 0, 0.8, () => box(-88, 449, 176, 16, '#000', '#000', [0, 0, 12, 12]));
}

export function createZenIshidouroScene({ color, nightDepth, isActive, assets, resolution }) {
  const root = new Container();
  const stage = new Container(); root.addChild(stage); stage.y = -289.5;
  const coreColor = ['#17191c', '#050505', '#000000'].includes(color.toLowerCase()) ? '#f8fafc' : color;
  const sprite = (w, h, paint) => new Sprite(assets.texture(createZenRaster(w, h, resolution, paint)));
  const rear = sprite(192, 192, (ctx) => {
    shadow(ctx, resolution, 10, 10, .6, () => { ctx.fillStyle = '#000'; ctx.fillRect(40, 40, 112, 112); });
    ctx.fillStyle = '#0b0a09'; ctx.fillRect(40, 40, 112, 112);
  });
  rear.position.set(-96, 74); stage.addChild(rear);
  const core = new Container();
  const halo = sprite(256, 256, (ctx) => {
    ctx.translate(128, 128);
    for (const [blur, alpha] of [[40, .4], [20, 1]]) {
      shadow(ctx, resolution, blur, 0, alpha, () => { ctx.fillStyle = coreColor; ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill(); });
    }
  });
  halo.anchor.set(.5); core.addChild(halo);
  const disk = new Graphics();
  const tint = Number.parseInt(coreColor.slice(1), 16);
  // Analytic soft edge avoids both a live blur and a texture-quad seam.
  for (let i = 0; i < 12; i += 1) {
    disk.beginFill(tint, i === 11 ? 1 : .12 + i * .045).drawCircle(0, 0, 30 - i * .35).endFill();
  }
  core.addChild(disk); core.position.set(0, 170); stage.addChild(core);
  const rays = sprite(560, 560, (ctx) => {
    const gradient = ctx.createConicGradient(-Math.PI / 2, 280, 280);
    for (const [deg, c] of [[0,'transparent'],[15,coreColor],[45,'transparent'],[90,coreColor],[135,'transparent'],[180,coreColor],[225,'transparent'],[270,coreColor],[315,'transparent'],[360,'transparent']]) gradient.addColorStop(deg / 360, c);
    ctx.filter = `blur(${20 * resolution}px)`; ctx.fillStyle = gradient; ctx.fillRect(60, 60, 440, 440);
  });
  rays.anchor.set(.5); rays.position.set(0, 170); rays.blendMode = BLEND_MODES.SCREEN;
  rays.alpha = isActive ? nightDepth * .25 : 0; stage.addChild(rays);
  const stone = sprite(448, 560, (ctx) => { ctx.translate(224, 35); paintZenIshidouroStone(ctx, resolution); });
  stone.position.set(-224, -35); stage.addChild(stone);
  const frame = sprite(112, 112, (ctx) => {
    ctx.strokeStyle = STONE[3]; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 106, 106);
    ctx.fillStyle = 'rgba(28,25,23,.5)'; ctx.fillRect(0, 0, 112, 8); ctx.fillRect(0, 104, 112, 8);
    for (const [x,y,w,h] of [[12,12,88,6],[12,94,88,6],[12,12,6,88],[94,12,6,88]]) {
      stoneRect(ctx,x,y,w,h,STONE[4],STONE[4]); ctx.strokeStyle = 'rgba(68,64,60,.2)'; ctx.lineWidth = 1; ctx.strokeRect(x+.5,y+.5,w-1,h-1);
    }
  });
  frame.position.set(-56,114); stage.addChild(frame);
  const random = createZenSeededRandom('zen:ishidouro:engine-review:v1');
  const dot = assets.texture(createZenRaster(12,12,resolution,(ctx)=>{
    ctx.filter=`blur(${resolution * .5}px)`;ctx.fillStyle='rgba(255,255,255,.4)';ctx.beginPath();ctx.arc(6,6,1,0,Math.PI*2);ctx.fill();
  }));
  const particles = Array.from({length:isActive ? 12:0},(_,i)=>{
    const node=new Sprite(dot);node.anchor.set(.5);stage.addChild(node);
    return {node, x:(random()-.5)*166.4, y:489*(.6+random()*.4), dx:(random()-.5)*30, dy:80+random()*50, duration:3000+random()*4000, delay:i*500, size:1+random()*2};
  });
  return {
    root, geometry:{sprites:5+particles.length,vectorShapes:1,liveFilters:0,randomSeed:'zen:ishidouro:engine-review:v1'},
    update(atMs){
      const phase=(atMs%6000)/1500;const i=Math.floor(phase);const t=zenEaseInOut(phase-i);
      const ys=[0,-4,2,-2,0],scales=[1,1.05,.98,1.02,1];
      core.y=170+(isActive?ys[i]+(ys[i+1]-ys[i])*t:0);
      core.scale.set(isActive?scales[i]+(scales[i+1]-scales[i])*t:1);core.alpha=isActive?1:.3;
      rays.rotation=atMs/40000*Math.PI*2;
      particles.forEach(p=>{const t=Math.max(0,atMs-p.delay)%p.duration/p.duration;const e=1-(1-t)**2;
        p.node.position.set(p.x+p.dx*e,p.y-20-p.dy*e);p.node.alpha=.6*Math.sin(t*Math.PI);p.node.scale.set(p.size*Math.sin(t*Math.PI));
      });
    },
  };
}

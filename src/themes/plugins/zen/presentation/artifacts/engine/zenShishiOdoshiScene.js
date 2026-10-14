import { Container, Geometry, Mesh, Shader, Sprite } from '../../../runtime/worker/zenPixiWorkerRuntime.js';
import { DEFAULT_SHISHI_ODOSHI_TUNING } from '../../../widgets/tools/recipes/zenShishiOdoshiTuning.js';
import { SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X as IMPACT_X, SHISHI_ODOSHI_GROUND_SPLASH_WORLD_Y as IMPACT_Y,
  SHISHI_ODOSHI_STAGE_WIDTH, SHISHI_ODOSHI_STAGE_HEIGHT, SHISHI_ODOSHI_SCENE_OFFSET_Y,
  SHISHI_ODOSHI_TUBE_LEFT, SHISHI_ODOSHI_TUBE_TOP,
  SHISHI_ODOSHI_GROUND_VIEW,
  SHISHI_ODOSHI_ROCK_GEOMETRY as ROCK,
  SHISHI_ODOSHI_LIP_SPLASH_LEFT, SHISHI_ODOSHI_STREAM_SOURCE_Y, SHISHI_ODOSHI_FREE_FALL_STREAM_HEIGHT,
  SHISHI_ODOSHI_TUBE_PIVOT_X, SHISHI_ODOSHI_TUBE_PIVOT_Y } from '../../../widgets/tools/recipes/zenShishiOdoshiGeometry.js';
import { createShishiOdoshiPhysicsState, createShishiOdoshiFrameState, stepShishiOdoshiPhysics,
  SHISHI_ODOSHI_LIP_SPLASH_PARTICLES, resolveRippleOpacity, resolveRippleScaleX, resolveRippleScaleY, smoothstep } from '../../../widgets/tools/recipes/zenShishiOdoshiRuntimeRecipe.js';
import { createZenRaster } from './zenMaterialRaster.js';
import { createZenLiveSimulationClock } from './zenLiveSimulationClock.js';
import { createZenSimulationClock } from './zenSimulationClock.js';
import { ZEN_SHISHI_WATER_MATERIAL as WATER, ZEN_SHISHI_GROUND_BEADS, resolveZenShishiDropletPose,
  resolveZenShishiGroundSplashPose, resolveZenShishiGroundDropletPose } from '../../../widgets/tools/recipes/zenShishiOdoshiWaterMaterial.js';
import { resolveZenPixiOwnedShaderSources } from '../../../runtime/pixi/zenPixiOwnedShaderDialect.js';

export function createZenShishiClock(isActive) {
  return createZenSimulationClock({
    createState: () => ({ state: createShishiOdoshiPhysicsState(), frame: createShishiOdoshiFrameState() }),
    step: (value, stepMs) => stepShishiOdoshiPhysics({ activityWeight: 1, residualVisualWeight: 1,
      isSimulationLive: isActive, simulationMode: isActive ? 'live' : 'halt',
      physics: DEFAULT_SHISHI_ODOSHI_TUNING, state: value.state, frame: value.frame, dt: stepMs / 1000 }),
  });
}

const VERTEX = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
varying vec2 vUv;
void main(){ vUv=aTextureCoord; gl_Position=vec4((projectionMatrix*translationMatrix*vec3(aVertexPosition,1.)).xy,0.,1.); }
`;
const FRAGMENT = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uSampler;
uniform float uTime;
uniform float uHeight;
uniform float uOpacity;
void main(){
  float y=vUv.y*730.;
  // Sub-pixel refraction of one canonical transparent water material.
  float shift=sin(y*.035-uTime*4.)*.004;
  vec2 uv=vec2(clamp(vUv.x+shift,0.,1.),vUv.y);
  vec4 water=texture2D(uSampler,uv);
  water *= .9 + .1 * sin(y*.025-uTime*7.);
  float clip=1.-smoothstep(uHeight-1.,uHeight+1.,y);
  gl_FragColor=water*(uOpacity*clip);
}
`;

export async function createZenShishiOdoshiScene({ color, isActive, assets, resolution, webGLVersion }) {
  const shaderSources = resolveZenPixiOwnedShaderSources({ programId: 'shishi_water', webGLVersion, vertexSrc: VERTEX, fragmentSrc: FRAGMENT });
  const root = new Container(); const stage = new Container(); root.addChild(stage);
  stage.position.set(-SHISHI_ODOSHI_STAGE_WIDTH / 2, -SHISHI_ODOSHI_STAGE_HEIGHT / 2 + SHISHI_ODOSHI_SCENE_OFFSET_Y);
  const shaders = [];
  const clock = createZenShishiClock(isActive);
  let runtime = null, liveClock = null;
  try {
    const bake = name => assets.sprite(name);
    const glow = new Sprite(assets.texture(createZenRaster(400, 120, resolution, (ctx) => {
      ctx.filter = `blur(${20 * resolution}px)`;
      const g=ctx.createRadialGradient(200,60,0,200,60,100);g.addColorStop(0,`${color}0f`);g.addColorStop(1,'transparent');
      ctx.fillStyle=g;ctx.fillRect(0,0,400,120);
      ctx.filter=`blur(${6*resolution}px)`;ctx.fillStyle='rgba(28,25,23,.3)';ctx.beginPath();ctx.ellipse(ROCK.contactX+34,ROCK.contactY-224,35,6,0,0,Math.PI*2);ctx.fill();
    })));
    glow.position.set(-34,224);stage.addChild(glow);
    stage.addChild(bake('backdrop'));
    const ringTexture = assets.material('water-ripple');
    const rings=Array.from({length:3},()=>{const s=new Sprite(ringTexture);s.anchor.set(.5);s.position.set(IMPACT_X,IMPACT_Y);s.angle=SHISHI_ODOSHI_GROUND_VIEW.tiltDeg;stage.addChild(s);return s;});
    const splashRoot = new Container(); splashRoot.position.set(IMPACT_X,IMPACT_Y); stage.addChild(splashRoot);
    const contact = new Container(); contact.addChild(bake('water-contact'));
    contact.angle = SHISHI_ODOSHI_GROUND_VIEW.tiltDeg;
    contact.scale.y = SHISHI_ODOSHI_GROUND_VIEW.ellipseAspect;
    splashRoot.addChild(contact);
    const crown = new Container(); crown.addChild(bake('water-crown')); splashRoot.addChild(crown);
    const dropletTexture = assets.material('water-droplet');
    const groundBeads = ZEN_SHISHI_GROUND_BEADS.map(() => {
      const node = new Sprite(dropletTexture); node.anchor.set(.5); splashRoot.addChild(node);
      return node;
    });
    stage.addChild(bake('rock'));
    const tubeParts=[];
    const makeTube = name => {
      const part = new Container();
      part.position.set(SHISHI_ODOSHI_TUBE_LEFT + SHISHI_ODOSHI_TUBE_PIVOT_X, SHISHI_ODOSHI_TUBE_TOP + SHISHI_ODOSHI_TUBE_PIVOT_Y);
      part.pivot.set(SHISHI_ODOSHI_TUBE_PIVOT_X, SHISHI_ODOSHI_TUBE_PIVOT_Y);
      part.addChild(bake(name + '-far'), bake(name + '-near'));
      stage.addChild(part); tubeParts.push(part); return part;
    };
    makeTube('tube-back');
    const waterTexture = assets.material('water');
    const makeWater=()=>{
      const geometry=new Geometry().addAttribute('aVertexPosition',new Float32Array([28,-390,62,-390,62,340,28,340]),2)
        .addAttribute('aTextureCoord',new Float32Array([0,0,1,0,1,1,0,1]),2).addIndex([0,1,2,0,2,3]);
      const shader=Shader.from(shaderSources.vertex,shaderSources.fragment,{uSampler:waterTexture,uTime:0,uHeight:730,uOpacity:0});
      shaders.push(shader);const mesh=new Mesh(geometry,shader);stage.addChild(mesh);return mesh;
    };
    const captured=makeWater(),freeFall=makeWater();
    const tail=new Sprite(assets.texture(createZenRaster(16,32,resolution,ctx=>{
      const g=ctx.createLinearGradient(0,0,0,32);g.addColorStop(0,WATER.reflection);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(4.8,0,6.4,32,3.2);ctx.fill();
    })));tail.pivot.set(8,0);stage.addChild(tail);
    makeTube('tube-front');
    const drops=SHISHI_ODOSHI_LIP_SPLASH_PARTICLES.map(()=>{const s=new Sprite(dropletTexture);s.anchor.set(.5);stage.addChild(s);return s;});
    stage.addChild(bake('foreground'));
    return {
      root, geometry:{sprites:26,meshes:2,triangles:4,liveFilters:0,water:'shared refracted ribbon, floor contact, curved sheets and ballistic droplets',simulation:'canonical 60 Hz fill/tip/strike'},
      configure(presentation, continuity) {
        runtime = presentation;
        if (!runtime) return;
        liveClock = continuity || createZenLiveSimulationClock(() => ({ state: createShishiOdoshiPhysicsState(), frame: createShishiOdoshiFrameState() }));
        if (runtime.simulationMode === 'halt') liveClock.reset();
        rings.forEach(ring => { ring.angle = runtime.ground.groundTiltDeg; });
        contact.angle = runtime.ground.groundTiltDeg;
        contact.scale.y = runtime.ground.rippleAspect;
      },
      continuity: () => liveClock,
      inspect: () => ({ angle: tubeParts[0].angle, waterHeight: captured.shader.uniforms.uHeight,
        waterOpacity: captured.shader.uniforms.uOpacity, freeFallOpacity: freeFall.shader.uniforms.uOpacity }),
      dispose(){shaders.forEach(shader=>shader.destroy());},
      update(atMs){
        const {frame} = runtime ? liveClock.at(atMs, (value, dt) => stepShishiOdoshiPhysics({
          ...runtime, residualVisualWeight: runtime.visualWeight, physics: DEFAULT_SHISHI_ODOSHI_TUNING,
          state: value.state, frame: value.frame, dt: dt / 1000,
        }), runtime.shouldRunSimulation) : clock.at(isActive?atMs:0);
        const nearGround = smoothstep((-frame.angle - 4) / 32);
        tubeParts.forEach(part => { part.angle = frame.angle; part.children[0].alpha = 1 - nearGround; part.children[1].alpha = nearGround; });
        captured.shader.uniforms.uTime=atMs/1000;captured.shader.uniforms.uHeight=frame.captureStemHeight;captured.shader.uniforms.uOpacity=frame.streamBaseOpacity;
        const spread=frame.streamSpread;captured.scale.x=spread;captured.x=IMPACT_X*(1-spread);
        freeFall.shader.uniforms.uTime=atMs/1000+.6;freeFall.shader.uniforms.uHeight=SHISHI_ODOSHI_FREE_FALL_STREAM_HEIGHT;freeFall.shader.uniforms.uOpacity=frame.freeFallBaseOpacity;
        freeFall.scale.x=.75;freeFall.x=IMPACT_X*.25;
        tail.position.set(IMPACT_X,SHISHI_ODOSHI_STREAM_SOURCE_Y+frame.captureStemHeight);tail.height=Math.max(.01,frame.captureTailLength);tail.angle=frame.captureTailRotate;tail.alpha=frame.captureTailOpacity;
        rings.forEach((ring,i)=>{
          ring.scale.set(resolveRippleScaleX(frame.groundRippleTravel,i*.6),resolveRippleScaleY(frame.groundRippleTravel,i*.6,runtime ? runtime.ground.rippleYAspectGain : 1));
          ring.alpha=resolveRippleOpacity(frame.groundRippleEnergy,frame.groundRippleTravel,i*.6,[1.05,.88,.68][i]);
        });
        const splash = resolveZenShishiGroundSplashPose(frame.groundImpactPulse,frame.groundRippleEnergy,frame.phase);
        contact.alpha = splash.opacity;
        crown.alpha = splash.opacity;
        crown.scale.set(splash.scaleX,splash.scaleY);
        groundBeads.forEach((node,i) => {
          const p = ZEN_SHISHI_GROUND_BEADS[i];
          const t = Math.max(0,atMs/1000-p.delay)%p.dur/p.dur;
          const pose = resolveZenShishiGroundDropletPose(p,t);
          node.position.set(pose.x,pose.y);node.scale.set(pose.scaleX,pose.scaleY);node.angle=pose.rotate;
          node.alpha=splash.dropletOpacity*pose.opacity;
        });
        drops.forEach((drop,i)=>{const p=SHISHI_ODOSHI_LIP_SPLASH_PARTICLES[i];const t=Math.max(0,atMs/1000-p.delay)%p.dur/p.dur;
          const pose = resolveZenShishiDropletPose(p,t);
          drop.position.set(SHISHI_ODOSHI_LIP_SPLASH_LEFT+10+pose.x,SHISHI_ODOSHI_STREAM_SOURCE_Y+frame.streamHeight+3+pose.y);
          drop.alpha=frame.lipPulse*.95*pose.opacity;drop.scale.set(pose.scaleX,pose.scaleY);drop.angle=pose.rotate;
        });
      },
    };
  }catch(failure){root.destroy({children:true});shaders.forEach(shader=>shader.destroy());throw failure;}
}

export function zenShishiReferencePose(frame) {
  const nearGround=smoothstep((-frame.angle-4)/32);
  const splash=resolveZenShishiGroundSplashPose(frame.groundImpactPulse,frame.groundRippleEnergy,frame.phase);
  const pose={tubeRotate:frame.angle,tubeFilter:`drop-shadow(0 ${15-nearGround*10}px ${10-nearGround*3.5}px rgba(0,0,0,${.3+nearGround*.28}))`,
    captureStemHeight:frame.captureStemHeight,captureTailLength:frame.captureTailLength,captureTailRotate:frame.captureTailRotate,captureTailOpacity:frame.captureTailOpacity,
    streamSpread:frame.streamSpread,streamBaseOpacity:frame.streamBaseOpacity,streamCoreOpacity:frame.streamCoreOpacity,
    freeFallBaseOpacity:frame.freeFallBaseOpacity,freeFallCoreOpacity:frame.freeFallCoreOpacity,lipY:frame.streamHeight-2,lipOpacity:Math.min(1,frame.lipPulse*.95),
    rippleSplashOpacity:splash.opacity,rippleSplashScaleX:splash.scaleX,rippleSplashScaleY:splash.scaleY,
    rippleDropletOpacity:splash.dropletOpacity};
  for(let i=0;i<3;i+=1){const prefix=`ripple${i+1}`;pose[`${prefix}Opacity`]=resolveRippleOpacity(frame.groundRippleEnergy,frame.groundRippleTravel,i*.6,[1.05,.88,.68][i]);
    pose[`${prefix}ScaleX`]=resolveRippleScaleX(frame.groundRippleTravel,i*.6);pose[`${prefix}ScaleY`]=resolveRippleScaleY(frame.groundRippleTravel,i*.6,1);}
  return pose;
}

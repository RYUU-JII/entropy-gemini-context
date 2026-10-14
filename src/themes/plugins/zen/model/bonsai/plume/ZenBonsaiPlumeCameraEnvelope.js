import { ZEN_PLUME_FLOWER_RADIUS_GAIN, ZEN_PLUME_SCAFFOLD_RADIUS_GAIN } from './ZenBonsaiPlumeCrownAppearance.js';

// The renderer and Home reading plane share this immutable history envelope.
// Visible growth, seasonal alpha and current quality never narrow it.
export function resolveZenBonsaiPlumeCameraEnvelope(snapshots, { includePot = true } = {}) {
  if (!Array.isArray(snapshots) || !snapshots.length) throw Error('ZEN_PLUME_PRODUCT_CAMERA_INPUT');
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,structuralX=0,structuralCount=0,scaffoldRadius=0;
  let matureFlowers=[];
  const include=(p,radius=0)=>{if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw Error('ZEN_CHERRY_RENDER_POINT');minX=Math.min(minX,p[0]-radius);maxX=Math.max(maxX,p[0]+radius);minY=Math.min(minY,p[1]-radius);maxY=Math.max(maxY,p[1]+radius);};
  for(const snapshot of snapshots){
    for(const node of snapshot.nodes){
      if(!Number.isFinite(node.radius)||node.radius<0)throw Error('ZEN_PLUME_PRODUCT_CAMERA_WOOD');
      include(node.p,node.radius*ZEN_PLUME_SCAFFOLD_RADIUS_GAIN);
      if(node.owner==='f4-scaffold'){structuralX+=node.p[0];structuralCount++;scaffoldRadius=Math.max(scaffoldRadius,node.radius);}
    }
    if(snapshot.flowers.length)matureFlowers=snapshot.flowers;
    for(const flower of snapshot.flowers){
      if(!(flower.radius>0))throw Error('ZEN_PLUME_PRODUCT_CAMERA_FLOWER');
      include(flower.position,flower.radius*(1+(flower.cup??0))*ZEN_PLUME_FLOWER_RADIUS_GAIN.max);
      if(flower.pedicel){include(flower.pedicel.start);include(flower.pedicel.end);}
    }
    for(const tip of snapshot.livingTips)include(tip.p,tip.radius*4);
    if(includePot){
      const root=snapshot.nodes.find(node=>node.id==='origin'),scaffold=snapshot.nodes.filter(node=>node.owner==='f4-scaffold');
      if(!root||!scaffold.length)throw Error('ZEN_PLUME_PRODUCT_CAMERA_ROOT');
      const span=Math.max(...scaffold.map(node=>node.p[1]))-Math.min(...scaffold.map(node=>node.p[1]));
      minX=Math.min(minX,root.p[0]-span*.36*.69);maxX=Math.max(maxX,root.p[0]+span*.36*.69);
      minY=Math.min(minY,root.p[1]-span*.36*.16*1.83);maxY=Math.max(maxY,root.p[1]+span*.01);
    }
  }
  if(!Number.isFinite(minX))throw Error('ZEN_PLUME_PRODUCT_CAMERA_EMPTY');
  return { bounds:{minX:minX-9,maxX:maxX+9,minY:minY-9,maxY:maxY+9,structuralX,structuralCount}, scaffoldRadius, matureFlowers };
}

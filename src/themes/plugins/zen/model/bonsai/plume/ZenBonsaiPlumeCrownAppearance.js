// Product paint policy over immutable Plume anatomy: no recruitment, relocation
// or organ edits, and no current-growth/activity input to the mature fitting.
export const ZEN_PLUME_CROWN_APPEARANCE = 'zen-plume-crown-appearance-v6';
export const ZEN_PLUME_FLOWER_RADIUS_GAIN = Object.freeze({ min: 1.35, max: 2.28, viewportRatio: .0158 });
export const ZEN_PLUME_SCAFFOLD_RADIUS_GAIN = 1.38;
// Two protected neighbors inside the raw petal-radius sum already occupy this
// pocket, even before the larger product paint gain. Keep their flow ends and
// release the redundant interior instead of thinning the whole crown uniformly.
const NEIGHBOR_CLEARANCE = 1;
const smooth = value => { const t=Math.max(0,Math.min(1,value)); return t*t*(3-2*t); };

export function resolveZenBonsaiPlumeScaffoldRadius(radius, scaffoldRadius) {
    if(!(radius>0&&Number.isFinite(radius)&&scaffoldRadius>0&&Number.isFinite(scaffoldRadius)))throw Error('ZEN_PLUME_CROWN_WOOD_RADIUS');
    // Continuous in supplied girth: no birth threshold or terminal width floor.
    // Thin wood <= 13% of the mature scaffold stock is exactly unchanged.
    return radius * (1 + (ZEN_PLUME_SCAFFOLD_RADIUS_GAIN-1)*smooth((radius/scaffoldRadius-.13)/.32));
}

export function selectZenBonsaiPlumeCrownFlowers(flowers) {
    const groups=new Map(),retained=new Set();
    for(const flower of flowers) {
        if(typeof flower.id!=='string'||retained.has(flower.id)||typeof flower.clusterId!=='string'
            ||!['core','fringe'].includes(flower.plume?.role)||!Number.isFinite(flower.plume.station)
            ||!Array.isArray(flower.position)||flower.position.length!==3||!flower.position.every(Number.isFinite)
            ||!(flower.radius>0&&Number.isFinite(flower.radius)))throw Error('ZEN_PLUME_CROWN_FLOWER');
        retained.add(flower.id);
        if(!groups.has(flower.clusterId))groups.set(flower.clusterId,[]);
        groups.get(flower.clusterId).push(flower);
    }
    const protectedFlowers=[],interiorCandidates=[];
    for(const group of groups.values()) {
        // First open gaps within each cluster, without a global removal quota.
        // Current bloom, camera angle and activation cannot rerank organ IDs.
        const ordered=[...group].sort((a,b)=>a.plume.station-b.plume.station||a.id.localeCompare(b.id));
        const protectedIds=new Set([ordered[0].id,ordered.at(-1).id,...group.filter(f=>f.plume.role==='fringe').map(f=>f.id)]);
        protectedFlowers.push(...group.filter(f=>protectedIds.has(f.id)));
        const remaining=new Set(group.map(f=>f.id));
        // At most two interiors leave a five-flower bundle; sparse triples and
        // its station ends/fringe stay intact. Rest-space separation is measured
        // in blossom radii, against the existing maximum product paint gain.
        for(let removed=0;removed<Math.min(2,group.length-3);removed++) {
            const candidates=group.filter(f=>remaining.has(f.id)&&!protectedIds.has(f.id)).map(f=>{
                const distances=group.filter(other=>other!==f&&remaining.has(other.id)).map(other=>
                    Math.hypot(...f.position.map((v,i)=>v-other.position[i]))/(f.radius+other.radius));
                return{flower:f,clearance:Math.min(...distances),
                    crowding:distances.reduce((sum,distance)=>sum+Math.max(0,1-distance/ZEN_PLUME_FLOWER_RADIUS_GAIN.max)**2,0)};
            }).filter(candidate=>candidate.clearance<ZEN_PLUME_FLOWER_RADIUS_GAIN.max);
            candidates.sort((a,b)=>b.crowding-a.crowding||a.clearance-b.clearance||a.flower.id.localeCompare(b.flower.id));
            if(!candidates.length)break;
            retained.delete(candidates[0].flower.id);remaining.delete(candidates[0].flower.id);
        }
        const interiors=group.filter(f=>remaining.has(f.id)&&!protectedIds.has(f.id));
        if(remaining.size===3&&interiors.length===1)interiorCandidates.push(interiors[0]);
    }
    // Exception for a truly crowded pocket: the last interior of a triple can
    // yield to two nearby protected flowers on other clusters. Those witnesses
    // can never be removed, so neither input order nor cascading deletions can
    // change this decision. Two flow-end/fringe flowers always remain.
    if(interiorCandidates.length){
        const cellSize=2*NEIGHBOR_CLEARANCE*Math.max(...flowers.filter(f=>retained.has(f.id)).map(f=>f.radius));
        const cells=new Map(),cellOf=f=>f.position.map(value=>Math.floor(value/cellSize));
        for(const flower of protectedFlowers){
            const key=cellOf(flower).join(',');
            if(!cells.has(key))cells.set(key,[]);
            cells.get(key).push(flower);
        }
        for(const flower of interiorCandidates){
            const cell=cellOf(flower);let witnesses=0;
            // clearance*(r1+r2) <= cellSize: all witnesses are in these
            // 27 cells. This index runs only when compiling a scene/supply.
            search:for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
                const neighbors=cells.get(`${cell[0]+x},${cell[1]+y},${cell[2]+z}`);
                if(!neighbors)continue;
                for(const other of neighbors){
                    if(other.clusterId===flower.clusterId)continue;
                    const clearance=NEIGHBOR_CLEARANCE*(flower.radius+other.radius);
                    const distanceSquared=flower.position.reduce((sum,value,i)=>sum+(value-other.position[i])**2,0);
                    if(distanceSquared<clearance**2&&++witnesses===2){retained.delete(flower.id);break search;}
                }
            }
        }
    }
    return retained;
}

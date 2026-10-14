// Research-only replacement of non-trunk composition steering. No random draws.
export const BRANCH_SPACE_MODES = Object.freeze(['baseline', 'free', 'boundary']);
const yaw = .24, cos = Math.cos(yaw), sin = Math.sin(yaw);
const project = p => ({x:p.x*cos-p.z*sin, y:p.y, z:p.x*sin+p.z*cos});
const world = p => ({x:p.x*cos+p.z*sin, y:p.y, z:-p.x*sin+p.z*cos});
const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
const unit = v => {
    const length = Math.hypot(v.x,v.y,v.z);
    if (!Number.isFinite(length) || length === 0) throw Error('G15_BRANCH_SPACE_DIRECTION');
    return {x:v.x/length,y:v.y/length,z:v.z/length};
};
const point = p => p && ['x','y','z'].every(k=>Number.isFinite(p[k]));
let active = null;

export function withBranchSpace(mode, run) {
    if (!BRANCH_SPACE_MODES.includes(mode) || active) throw Error('G15_BRANCH_SPACE_SCOPE');
    const observation = {calls:0,inside:0,returning:0,braked:0,maxTurn:0,totalTurn:0};
    active = {mode,observation};
    try { return {value:run(),observation}; } finally { active = null; }
}

export function branchBoundary(plan, position, direction, region) {
    if (!point(position) || !point(direction) || !point(region?.origin)
        || !Number.isFinite(plan?.strength) || plan.strength<0 || plan.strength>1
        || !Number.isFinite(region.verticalRadius) || region.verticalRadius<=0
        || !Number.isFinite(region.tilt) || ![-1,1].includes(region.side)
        || !Number.isFinite(region.apical) || region.apical<0 || region.apical>1) {
        throw Error('G15_BRANCH_SPACE_GEOMETRY');
    }
    const p=project(position), origin=project(region.origin), d=unit(direction);
    // The family shares an oriented strip, not a direction to pursue. The strip
    // passes through its socket; apical families retain their ascending frame.
    const tangent=unit({x:region.side*(1-region.apical*.8),
        y:region.tilt*(1-region.apical)+region.apical*1.25,z:0});
    const normal={x:-tangent.y,y:tangent.x,z:0};
    const transverse=(p.x-origin.x)*normal.x+(p.y-origin.y)*normal.y;
    const excess=Math.max(0,Math.abs(transverse)/region.verticalRadius-1);
    if (excess===0 || plan.strength===0) return {direction,state:'inside',turn:0};
    const outward=world({x:normal.x*Math.sign(transverse),y:normal.y*Math.sign(transverse),z:0});
    const velocity=dot(d,outward);
    if (velocity<=0) return {direction,state:'returning',turn:0};
    // Smooth resistance only to outward velocity. It never points an axis back
    // at the layer center, imposes no hard boundary and preserves tangential flow.
    const pressure=excess*excess/(1+excess*excess);
    const removed=velocity*(1-Math.exp(-4*plan.strength*pressure));
    const next=unit({x:d.x-outward.x*removed,y:d.y-outward.y*removed,z:d.z-outward.z*removed});
    return {direction:next,state:'braked',turn:Math.acos(Math.max(-1,Math.min(1,dot(d,next))))};
}

export function steerBranchSpace(original,plan,position,direction,tier,region) {
    if (!active) throw Error('G15_BRANCH_SPACE_OWNER_REQUIRED');
    if (active.mode==='baseline' || !plan || tier===0) return original(plan,position,direction,tier,region);
    const o=active.observation;o.calls++;
    if (active.mode==='free') return direction;
    const result=branchBoundary(plan,position,direction,region);
    o[result.state]++;o.totalTurn+=result.turn;o.maxTurn=Math.max(o.maxTurn,result.turn);
    return result.direction;
}

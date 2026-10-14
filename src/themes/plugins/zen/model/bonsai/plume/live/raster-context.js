// The comparison canvas is repeatedly read back for parity; the product retains
// shared flower and ordered wood atlas canvases across bakes. Give their raster
// contexts the same explicit hint so
// Chrome's readback heuristic cannot switch only the long-lived comparison arm.
// Pixi still composites the resulting atlas textures through its required WebGL.
export function createZenCherryPlumeLiveRasterContext(canvas){
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)throw Error('ZEN_PLUME_LIVE_RASTER_CONTEXT');
  return context;
}

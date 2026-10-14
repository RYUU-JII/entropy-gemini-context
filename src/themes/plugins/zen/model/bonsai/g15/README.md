# G15.4 product engine boundary

This directory is the product-owned G15.4 bonsai engine. The files were promoted from
the detached morphology workbench, but product code must never import that workbench at
runtime. After promotion, changes in either tree do not implicitly update the other.

- `ZenBonsaiG15Species.js` is the generation adapter used by Home and Experiment.
- `ZenBonsaiG15RenderSpecies.js` and `render-runtime.js` form the renderer-worker
  graph-to-scene boundary. They must not import scheduling, graph mutation, or graph
  inspection owners.
- `ZenBonsaiG15Math.js` shares exact numeric foundations between generation and
  ontogeny. Rendering must not import the full developmental program namespace for
  those foundations.
- `ZenBonsaiG15TerminalMorphology.js` is the named product contract for canonical
  terminal plans, poses, templates and projected blossom paint. Standalone study
  fixtures/drawing APIs stay in the canonical Sakura study owner; rendering must
  not install the full generated study namespace to obtain product bindings.
- `index.js` owns the temporary ordered installation of the promoted engine modules.
  Those modules still expose their internal contracts on the current JavaScript realm;
  new product consumers must use the adapter rather than read those globals directly.
- `ZenBonsaiG15TerminalStudyRuntime.js` preserves the full 14-entry study global API
  for that entrypoint using the same canonical ESM implementation as rendering.
  The duplicated product IIFE has been removed. Detached research keeps its own
  IIFE producer and archived copies; the unchanged research IIFE is a test-only
  parity reference and must never enter product runtime imports.
- Browser lab controllers, workbench hosts, capture scripts, and research-only tests do
  not belong in this directory.
- A future native-ES-module migration should replace the ordered global installation in
  small dependency slices without changing the adapter contract in the same step.

Release tests protect the product adapter and this source boundary. Detailed morphology
fingerprints remain in the detached research lane and do not define the shipping model's
public contract.

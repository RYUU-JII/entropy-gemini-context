# platform

Canonical home for low-level browser adapters, storage surfaces, messaging infrastructure, worker and rendering runtime, and security primitives.

## Ownership

- browser API wrappers
- browser-safe favicon fetch, same-host policy, timeout, and Blob-to-data-URL conversion through `browser/faviconFetch.js`
- low-level audio primitives and extension asset URL resolution
- storage public surfaces and internal backends
- runtime messaging infrastructure
- worker runtime and worker clients
- theme-neutral render-loop scheduling and render-budget contracts
- main-thread cooperative continuation and slice-budget contracts through `scheduling/mainThreadCooperativeScheduler.js`
- low-level security primitives

## Read next

1. `src/platform/storage`
2. `src/platform/messaging`
3. `src/platform/workers`
4. `src/platform/rendering`
5. `src/platform/scheduling`
6. `src/platform/audio`
7. `src/platform/browser/faviconFetch.js`
8. `docs/system-architecture/02-runtime-storage-boundaries.md`

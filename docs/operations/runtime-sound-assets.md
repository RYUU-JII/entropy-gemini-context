# Runtime Sound Assets

- Status: Active
- Owner: release operations / app sound runtime owners
- Last validated against code: 2026-07-21
- Path policy: current-only
- Canonical for: bundled runtime sound placement and release provenance registration

Canonical bundled sound assets live under `public/assets/sounds/`.

Runtime code should not hard-code these paths in feature code. Add the file to
that public asset directory, then map it through the app sound catalog and the
owning theme sound pack.

Promotion from a local intake folder establishes runtime ownership, not legal
redistribution rights. Every bundled binary sound must also appear with its
exact SHA-256 and verified rights basis in
`release-asset-provenance.json`. The strict release check is
`npm run check:release:asset-provenance`; an unverified entry blocks
`npm run release:rc`.

There are currently no bundled runtime sound binaries. The former Zen
site-Furin and Shishi-odoshi MP3s were removed because their redistribution
rights could not be verified for release. The Zen sound pack now owns the
release-safe materialization explicitly via procedural WebAudio synths:

- site-Furin prelude, koi-accept, submerge-in, surface-out, and settle-complete cues use project-owned WebAudio synths;
- Shishi-odoshi clack and water-loop/overflow-loop surfaces use project-owned WebAudio synths;
- site-Furin outdoor soundscape and underwater ambient scenes use project-owned WebAudio synths;
- Room 4-7-8 breathing swell/drone/release/bell cues and Global Sentinel rift cues use project-owned WebAudio synths.

This is not a missing-asset fallback. Every declared cue and scene is fully
materialized as code-generated procedural audio. A binary sound may return
only after its exact bytes and redistribution rights are registered in the
release provenance ledger.

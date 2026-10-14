# sound domain

Canonical home for app-owned sound cue and scene orchestration.

Feature code should emit declared cue or scene ids through this domain. It should
not hard-code bundled sound asset paths or own AudioContext helpers.

Read next:

- `docs/architecture/repository/app-sound-runtime-boundary-map.md`
- `src/domains/sound/catalog/soundCueIds.js`
- `src/domains/sound/runtime/appSoundRuntime.js`

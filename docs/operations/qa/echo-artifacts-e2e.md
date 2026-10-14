# Echo Artifact E2E

- Status: Active
- Owner: runtime QA / protection and tracking artifact owners
- Last validated against code: 2026-10-04
- Path policy: current-only
- Canonical for: disposable real-Chromium Echo specimen removal, suppression and worker continuity

`artifacts/echo` uses one run-owned `ephemeral` browser and the current
`dev_extension` artifact through the normal QA compiler, immutable artifact
lease and `ExtensionChromiumHarness`. It cannot attach to an existing profile.
The fixture requires the verified owned browser and extension/profile paths
inside its temporary root before every browser fixture API invocation.
The target has no native OS focus grant and supports hidden agent execution.

```powershell
npm.cmd run qa -- describe artifacts/echo
npm.cmd run qa -- run artifacts/echo --presentation=hidden
npm.cmd run qa -- report <exact-run-id>
```

The run normally takes about eight to ten minutes because it uses the real
one-minute tracking alarm and real five-minute tab inactivity threshold.
No product deadline, Chrome clock, session checkpoint or alarm is accelerated,
seeded or replaced. The protocol emits bounded wait events every thirty seconds.

## Fixture and authorization

The temporary extension manifest promotes `history`, `bookmarks`, `scripting`
and only `http://echo-artifact.localhost/*`. The checked-in manifest and published
artifact stay unchanged. The run-owned loopback server also serves the unprotected
`echo-safe.localhost` control. YouTube and X alias history/bookmark specimens are
created with browser APIs; no public site is visited or granted host access.

The disposable profile has no operator passcode or user data. The protocol uses
the actual trusted extension page and canonical `SET_SETTINGS` / `UPSERT_SITE_RULE`
commands, requiring terminal propagation receipts. It does not bypass product
security, modify canonical settings documents directly, or write session state.
The finite fixture browser API creates history entries and bookmarks, and reads
exact visits, the bookmark tree, tabs, granted permissions, the ordinary alarm,
and canonical operational session checkpoints. It exposes no delete API,
permission setter, storage writer, alarm replacement or direct runtime executor.
The product's existing owners perform every measured removal.

## Ordered proof

| Stage | Required evidence |
| --- | --- |
| Owned fixture | Exact live build, temporary permission coverage and ordinary minute alarm; positive Chrome visits/bookmarks for the protected loopback host and `youtu.be` / `twitter.com` aliases; two exact owned inactive tabs; retained unprotected control history/bookmark |
| Consent OFF | All three child consents OFF; specimens and controls survive a completed real alarm tick |
| Echo family pause | Child consents ON, timeout five, family suspension ON; create another real Chrome visit after the ACK and require all specimens to survive a completed real alarm tick |
| Global pause | Family suspension OFF, global pause ON; canonical ACK/readback, another real Chrome visit and retained specimens across a completed alarm tick |
| Paused worker revival | Stop only the harness-owned Entropy worker; a different worker returns the exact paused policy; specimens survive another completed real alarm tick |
| Resume removal | Global pause OFF preserves all raw child settings; product settings executors remove every exact protected/alias history visit and bookmark; safe controls and the under-deadline inactive tab survive |
| Inactive worker revival | Read the real product-created inactivity checkpoint, stop/wake the exact worker, and require unchanged settings, policy key, tab identity, last access and inactivity start |
| Real tab evaporation | First observe absence of the exact inactive protected tab at or beyond 300,000 ms from its real checkpoint; safe tab/history/bookmark remain; the removed tab leaves the checkpoint |

Evidence is `attachments/echo-artifacts.json`, stage and bounded-wait events,
the exact run/build identity and the canonical cleanup envelope. A navigation
or changed URL on a known tab fails identity admission; absence is not inferred
from a URL mismatch. Failures retain completed and `NOT_RUN` stages and still
release the exact owned browser, temporary profile/extension root and server.
Fixture history and bookmarks disappear with that profile; no separate cleanup
delete can masquerade as product success. Cleanup failure fails the run.

Preservation requires a fresh browser specimen read after the completed-alarm
counter has been admitted; a pre-completion inventory cannot satisfy the stage.
Tab deadline evidence is the first absence poll with a two-second interval,
recorded separately from checkpoint settlement. It does not timestamp the native
`tabs.onRemoved` event and cannot exclude a sub-poll-interval early removal.

This target verifies backend artifact execution. It does not certify Dashboard
confirmation UI, ceremony feedback, native optional-permission prompts, an
in-flight native deletion race, suppression at an already-mature tab deadline,
or disable/re-enable extension activation. Focused mutation-admission tests
cover the final-await races. The public clean-checkout `lifecycle/mv3` target
retains ownership of the separate disable/re-enable history activation scenario.

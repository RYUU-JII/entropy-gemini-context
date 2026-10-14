# Entropy CX Workspace

This directory is Entropy's local Patchbay for `CX — Context × Execution`.
CX core owns orchestration; this workspace owns the paths, checks, resource
claims, and harness targets that describe Entropy.

The active CX runtime is supplied by the installed standalone CX project.
These declarations intentionally remain in Entropy and are read through the
workspace boundary.

The deterministic load path is:

```text
cx.workspace.json
  -> domains/*.json
  -> harnesses/*.json
  -> scripts/harness/entropyHarness.mjs
  -> project-owned plan and one-run result
  -> CX job dossier and verification plan
```

- Add or change a domain in one `domains/*.json` file.
- Add a reusable heavy/runtime harness in `harnesses/*.json`, then reference its
  id from a domain. A schema-v2 harness binds one declarative recipe to the
  project-owned `scripts/harness/entropyHarness.mjs` process seam.
- Keep ordinary focused checks on the domain. Harnesses are reserved for
  runtime, browser, visual, or otherwise expensive evidence.
- Treat each recipe as one named coverage unit. It plans without side effects,
  runs once without automatic retry, and publishes a structured result file;
  CX never reconstructs the QA command from a prompt or parses stdout for
  success.
- Keep ambiguous or inconclusive results terminal. They may recommend an
  operator-requested review, but do not start a model or another run.
- Bump `catalogRevision` in `cx.workspace.json` for a reviewed contract change.
- Restart the workspace CX daemon after changing these declarations.

The bonsai declarations are intentionally split. `zen-bonsai` remains the
schema-v1 agent-reported visual/runtime lane with the renderer claim.
`zen-bonsai-structural` is the schema-v2 CPU-only deterministic smoke recipe
owned by the separate `zen-bonsai-structural-research` domain.
`zen-bonsai-developmental` is a second schema-v2 CPU-only recipe for one
complete proposal in the active V10 successor lane. The broad bonsai domain
does not claim `successor/developmental` or its tests, so automatic routing
does not mix the schema-v1 visual lane with either deterministic recipe.
Neither structural recipe substitutes its diagnostics for browser/visual or
production-cutover evidence.

Missing manifests, duplicate ids, paths outside this repository, and unknown
harness references are fatal configuration errors. CX does not infer an
Entropy default.

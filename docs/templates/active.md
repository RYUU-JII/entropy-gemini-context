# Title

- Status: Active
- Owner: team or owner name
- Last validated against code: YYYY-MM-DD
- Path policy: current-only
- Canonical for: what question this document answers

## Purpose

One short paragraph that explains what this document is the canonical source for.

## Scope

- In scope:
- Out of scope:

## Current baseline

Describe the current implementation, structure, or policy.

## Source of truth

- Code anchors:
- Related docs:

## Investigation routing

Use this section for boundary maps or agent-facing docs. Delete it when it does
not apply.

- When to read this:
- First code entrypoints:
- Confirm owner by:
- Common false starts:

## Rules or contracts

Use the following subsections where useful; omit sections that do not apply.
These explain individual rules and do not add required document metadata.

### Invariants

State the product, security, correctness, or ownership properties that an
implementation change must preserve.

### Current implementation policy

Describe the current paths, composition, or operational choices that implement
those properties. These remain mandatory, including existing CI enforcement,
until code, the owning Active document, and affected guards/tests change together.

### Rationale and evidence

Briefly explain why the rule exists and point to the evidence or check that
protects it. Keep detail with its existing owner.

## Change guidance

Identify the preserved invariants, changed policy, and affected owner/checks.
An invariant change needs an explicit rationale and decision in the existing
owning process. Existing fallback and persistence-evolution contracts still apply.
Local refactors that preserve documented contracts do not require extra doc work.

# Theme Copy Operational Boundary

- Status: Active
- Owner: i18n architecture
- Last validated against code: 2026-04-12
- Path policy: planning-allowed
- Canonical for: ambient vs operational theme-copy boundary

## Status
- Active guidance document
- Scope: repository-wide
- Audience: feature authors, theme authors, i18n reviewers

## Goal
Theme flavor should make each world feel distinct without making operational UX harder to understand.

This document defines how to classify theme-owned copy as either:
- `ambient`: atmosphere, presentation, or worldbuilding
- `operational`: action, state, validation, consequence, or recovery guidance

## Decision rule
If a string helps the user decide what will happen next, it is `operational`.

If a string can become more poetic without changing the user’s next decision, it is usually `ambient`.

## Classification table

| Question | If yes | Classification |
| --- | --- | --- |
| Does this label trigger or confirm an action? | `Save`, `Block`, `Allow`, `Move`, `Reset`, `Continue` | `operational` |
| Does this string describe system status or enforcement state? | `Blocked`, `Ready`, `Active`, `Cleanup complete` | `operational` |
| Does this string explain a conflict, validation error, permission, or warning? | overlap, alias conflict, permission denied, reset warning | `operational` |
| Does this string describe what the user should do next? | retry guidance, review target, open dashboard | `operational` |
| Is this primarily header, atmosphere, lore, or decorative framing? | section eyebrow, flavor subtitle, world framing copy | `ambient` |
| Is this a theme-only metaphor that can change without changing product behavior? | koi, monolith, lantern, ritual flavor text | `ambient` |

## Operational copy rules
- Use standard product tone.
- Prefer direct verbs and plain outcomes.
- Avoid lore, metaphor, and roleplay language.
- Keep action labels short.
- Keep status labels stable across themes.

Examples:
- Preferred: `Move site rule`
- Preferred: `Blocked`
- Preferred: `History cleanup failed`
- Avoid for shared UX: `Release Oath`
- Avoid for shared UX: `Catch the shadow koi to restore synchronization`

## Ambient copy rules
- Theme language is allowed.
- Ambient copy must not hide the meaning of the surrounding feature.
- Ambient copy must not replace the only visible action or status text.

Examples:
- Allowed: decorative section subtitles
- Allowed: theme-owned empty-state flavor text
- Allowed: theme-specific world framing in non-critical panels

## Namespace guidance
- `common`, `sites`, `settings`, `filter`, `tools.status`, `tools.confirm`, and shared modal copy should default to `operational`.
- Theme-owned widget headings, atmosphere copy, and decorative descriptions can be `ambient`.
- If a theme namespace contains operational text, keep the namespace but rewrite the string into standard product tone.
- Do not duplicate the same operational copy across multiple theme variants unless a governed exception is documented.

## Review checklist
- Can a new user understand the consequence without knowing the theme?
- Would the action still be clear if the visual theme were removed?
- Is this string describing state or consequence rather than atmosphere?
- If translated literally, would the behavior remain obvious?

If the answer to any of the first three questions is `yes`, prefer `operational`.

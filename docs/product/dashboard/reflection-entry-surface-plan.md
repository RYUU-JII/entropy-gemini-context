# Reflection Entry Surface Plan

- Status: Draft
- Date: 2026-04-11
- Scope: release-shape definition for reflection purpose, user job, landing surface, and implementation seam
- Related:
  - `docs/product/dashboard/notifications-opt-in-runtime-plan.md`
  - `docs/product/dashboard/notifications-release-hardening-plan.md`
  - `docs/decisions/security/selective-host-permission-security-decision.md`
  - `docs/system-architecture/05-background-runtime-owners.md`
- Owner: dashboard product / dashboard main / notifications seam
- Last validated against code: 2026-04-11
- Path policy: planning-allowed
- Canonical for: future reflection meaning and future notification click-through landing shape after the initial release scope

## 1) One-line decision

Reflection is not part of the initial release scope.

When it returns in a later pass, it should not be a journaling feature.

It is a short transition ritual that appears after a meaningful protected period so the user can:

- notice that the block ended
- quickly classify how it went
- choose the next step intentionally instead of snapping back into drift

## 2) Why reflection exists

Entropy’s core job is not just to interrupt instant gratification inside pages.

It also needs to help the user close the loop after a protected period.

Without that closing moment, a schedule block can end like this:

- the user exits protection
- context dissolves immediately
- the next action is chosen by momentum rather than intention

Reflection exists to make that transition visible and slightly deliberate.

Its purpose is:

- transition awareness
- lightweight self-assessment
- intentional next-step selection

Its purpose is not:

- long-form journaling
- therapy-style prompting
- moral judgment
- productivity scoring
- deep historical analytics in the first release

## 3) User promise

The product promise for reflection should be:

"You just finished a meaningful protected block. Before you drift, take one quick beat to name what happened and choose what comes next."

This is deliberately smaller than "analyze your life" and more useful than "show a generic congratulations card."

## 4) What the user actually does

Reflection V1 should ask the user to do exactly two things:

1. answer a one-tap check-in about the block
2. choose the next action

### 4.1 One-tap check-in

The first prompt should answer:

"How did that block go?"

Recommended answer set:

- `On track`
- `Mixed`
- `Pulled away`

Why this set:

- fast enough for notification click-through
- not falsely precise
- useful as a future signal if a richer reflection owner is added later
- emotionally lighter than success/failure framing

### 4.2 Next action

The second prompt should answer:

"What do you want to do next?"

V1 should keep this extremely small:

- `Open Routine`
- `Close`

Optional later additions:

- `Start another block`
- `Open summary`
- `Log a note`

But those should not be in the release candidate unless the underlying owner seams also exist.

## 5) Minimal release UI

The release-safe reflection surface should be:

- a compact entry card inside `Main`
- shown only when dashboard launch intent is reflection-oriented
- dismissible without adding durable dismiss state

Recommended shape:

- header: block just ended / short reflection ready
- one line of context: scheduled block finished a moment ago
- one-tap check-in row: `On track` / `Mixed` / `Pulled away`
- next action row: `Open Routine` / `Close`

This should feel like a landing strip, not a new workflow.

The card should:

- appear above normal Main content
- absorb the initial attention after notification click
- collapse back into normal Main state after action or dismiss

## 6) Entry conditions

Reflection entry should become visible only when all of the following are true:

- a valid reflection-capable route intent reached the dashboard
- the user is on `Main`
- the reflection surface has not already been dismissed during the current open session

For the release candidate, the main entry path is:

- schedule window ends
- notification policy allows reflection suggestion
- user clicks the notification
- background opens dashboard with reflection route intent
- `Main` renders the reflection entry card

Future entry paths may include:

- in-app reminders
- direct dashboard CTA
- summary surfaces

But they should reuse the same conceptual seam.

## 7) State and ownership

### 7.1 What notifications own

Notifications own:

- delivery policy
- delayed scheduling
- click routing intent

Notifications do not own:

- reflection UI
- reflection answer handling
- historical reflection semantics

### 7.2 What Main owns

`Main` owns:

- rendering the reflection entry card
- temporary per-open dismiss state
- translating launch params into visible UI state

### 7.3 What should not be added in V1

Do not add a durable reflection store just to ship the first landing surface.

For the release candidate:

- no IndexedDB reflection journal
- no new `settings.core` reflection preference seam
- no permanent "already dismissed forever" state
- no background-owned reflection UI state

If the user’s one-tap answer later needs to be stored, that should be introduced as a dedicated reflection owner, not smuggled into the notification runtime ledger.

## 8) Recommended implementation shape

If we implement this next, the smallest clean cut is:

1. let `MainTab` accept reflection launch params
2. add a focused `ReflectionEntryCard` inside the Main tab tree
3. keep card visibility ephemeral to the current dashboard open
4. route `Open Routine` through the existing dashboard tab change seam

Recommended files:

- `src/apps/dashboard/tabs/main/MainTab.jsx`
- `src/apps/dashboard/tabs/main/components/ReflectionEntryCard.jsx`
- `src/apps/dashboard/tabs/main/reflection/reflectionEntryIntent.js`
- `src/apps/dashboard/bootstrap/dashboardLaunchContext.js`
- existing notification route contract under `src/domains/notifications/contracts/notificationRoutes.js`

Recommended seam split:

- launch param normalization stays in dashboard bootstrap
- reflection-entry intent parsing stays near Main
- UI rendering stays inside the Main tab component tree

This avoids putting reflection-specific presentation logic back into background or notification service code.

## 9) Expected result after implementation

If this lands, the user-visible result should be:

- clicking a reflection notification no longer drops the user onto a generic Main tab
- the dashboard opens into a short, explicit reflection landing state
- the user can acknowledge the block outcome in one tap
- the user can immediately jump to Routine if they want to adjust the next block
- after action or dismiss, Main returns to its normal surface without leftover mode state

Architecturally, the result should be:

- notification routing stays typed and extensible
- reflection meaning becomes product-defined rather than implied
- richer future reflection work can extend a clear V1 seam instead of replacing an ambiguous one

## 10) Explicit non-goals

This pass should not try to ship:

- a full reflection tab
- note-taking or journaling
- trend charts based on reflection answers
- mood tracking
- habit scoring
- commands or side-panel reflection surfaces
- automatic prompting from every session end without policy gates

## 11) Acceptance criteria

The reflection entry surface is ready for release-candidate use only when:

1. reflection click-through opens `Main` with a clearly visible entry card
2. the card explains why it appeared
3. the user can complete or dismiss it in under a few seconds
4. the card does not require a new durable storage owner
5. dismissing or acting returns the dashboard to normal Main behavior
6. no notification code needs to know how reflection UI is rendered

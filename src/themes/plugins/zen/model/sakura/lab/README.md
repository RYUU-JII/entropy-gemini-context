# Sakura Terminal Morphology Lab

Status: independent research lane. This directory studies terminal twigs,
short spurs, pedicels, blossom pose, cluster admission, and retained growth
from a supplied `TerminalSocket`. It does not generate or evaluate a whole-tree
skeleton and does not feed the production Sakura render plan.

## Ownership

- `ZenSakuraTwigPedicelStudy.js` owns terminal morphology generation and the
  fixture-only study wrapper.
- `ZenSakuraRetainedTerminalGraph.js` owns stable terminal entity IDs and
  growth-window projection.
- `ZenSakuraProjectedBlossom.js` owns the projected blossom atlas contract.
- `ZenSakuraTerminalCompactionScheduler.js` owns optional preview compaction.
- `ZenSakuraVisualRefinementLab.jsx` is the user-facing research surface.

## Input contracts

Branching controls are intentionally independent:

- `forkFrequency` owns lateral-child admission.
- `forkSpread` owns lateral departure angle.
- `lateralVigor` owns lateral length, width, and descendant vigor.

`clusterCoverage` owns reproductive-cluster admission. A terminal tip may
remain vegetative even when its tip spur exists. Non-flowering spurs remain
retained morphology and may carry leaves; they are not discarded as orphans.

Every stochastic choice uses
`zen_sakura_terminal_keyed_random_v1`, keyed by the socket seed and semantic
entity path. Changing cluster coverage therefore cannot regenerate upstream
axes or spurs.

Pedicel geometry and blossom presentation are separate. The pedicel records
its emergence and attachment angles, while
`zen_sakura_terminal_organ_pose_v1` records blossom yaw, pitch, and screen
roll. Blossom roll is bounded around the pedicel's end tangent rather than
sampled from an unrelated carrier angle.

## Dependency direction

```text
developmental skeleton ──┐
                         ├──> future composite adapter
Sakura Terminal Lab ─────┘
```

The Lab must not import `successor/autonomous`, `successor/developmental`, or
`successor/composite`. A downstream composite harness may import the terminal
compiler for contract smoke, but its current preview still uses the historical
autonomous skeleton and is not a visual-quality baseline for either upstream
lane.

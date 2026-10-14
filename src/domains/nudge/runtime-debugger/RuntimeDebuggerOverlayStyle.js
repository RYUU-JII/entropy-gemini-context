export const RUNTIME_DEBUGGER_OVERLAY_STYLE = `
  :host {
    all: initial;
    color-scheme: light;
    --erd-paper: var(--entropy-runtime-debugger-paper, #fdfbf7);
    --erd-surface: var(--entropy-runtime-debugger-surface, #ffffff);
    --erd-surface-muted: var(--entropy-runtime-debugger-surface-muted, #f8f6f0);
    --erd-surface-accent: var(--entropy-runtime-debugger-surface-accent, #eef1e9);
    --erd-ink: var(--entropy-runtime-debugger-ink, #4a4a4a);
    --erd-ink-strong: var(--entropy-runtime-debugger-ink-strong, #3c332d);
    --erd-muted: var(--entropy-runtime-debugger-muted, #817b74);
    --erd-faint: var(--entropy-runtime-debugger-faint, #a29b93);
    --erd-earth: var(--entropy-runtime-debugger-earth, #5d4037);
    --erd-sage: var(--entropy-runtime-debugger-accent, #7d8e67);
    --erd-sage-strong: var(--entropy-runtime-debugger-accent-strong, #68775c);
    --erd-sage-soft: var(--entropy-runtime-debugger-accent-soft, rgba(125, 142, 103, 0.12));
    --erd-border: var(--entropy-runtime-debugger-border, #e8e6e1);
    --erd-border-strong: var(--entropy-runtime-debugger-border-strong, #d7ccc8);
    --erd-danger: var(--entropy-runtime-debugger-danger, #b85f5f);
    --erd-danger-soft: var(--entropy-runtime-debugger-danger-soft, #fff0ef);
    --erd-warning: var(--entropy-runtime-debugger-warning, #8d6f2f);
    --erd-warning-soft: var(--entropy-runtime-debugger-warning-soft, #fff8e5);
    --erd-shadow: var(--entropy-runtime-debugger-shadow, rgba(71, 55, 44, 0.18));
    --erd-ui-font: var(
      --entropy-runtime-debugger-ui-font,
      Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    );
    --erd-mono-font: var(
      --entropy-runtime-debugger-mono-font,
      "SFMono-Regular", Consolas, "Liberation Mono", monospace
    );
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  .launcher,
  .panel {
    position: fixed;
    z-index: 2147483647;
    color: var(--erd-ink);
    font-family: var(--erd-ui-font);
    font-size: 11.5px;
    line-height: 1.48;
    letter-spacing: 0.005em;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  button {
    appearance: none;
    margin: 0;
    border: 1px solid var(--erd-border);
    border-radius: 7px;
    padding: 5px 8px;
    color: var(--erd-ink);
    background: var(--erd-surface);
    font: inherit;
    line-height: 1.2;
    text-align: center;
    cursor: pointer;
    user-select: none;
    transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
  }

  button:hover {
    color: var(--erd-ink-strong);
    border-color: var(--erd-border-strong);
    background: var(--erd-surface-muted);
  }

  button:focus-visible {
    outline: 2px solid var(--erd-sage);
    outline-offset: 2px;
  }

  button[data-active="true"],
  button[data-kind="primary"] {
    color: var(--erd-sage-strong);
    border-color: rgba(125, 142, 103, 0.42);
    background: var(--erd-sage-soft);
  }

  button[data-kind="primary"]:hover,
  button[data-active="true"]:hover {
    border-color: var(--erd-sage);
    background: rgba(125, 142, 103, 0.18);
  }

  .launcher {
    right: 14px;
    bottom: 14px;
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 34px;
    border-color: var(--erd-border-strong);
    border-radius: 999px;
    padding: 7px 12px 7px 10px;
    color: var(--erd-earth);
    background: var(--erd-paper);
    box-shadow: 0 7px 22px var(--erd-shadow);
    font-weight: 650;
  }

  .launcher:hover {
    border-color: var(--erd-sage);
    background: var(--erd-surface);
  }

  .launcher[data-open="true"] {
    color: var(--erd-sage-strong);
    border-color: var(--erd-sage);
    background: var(--erd-surface-accent);
  }

  .dot {
    width: 7px;
    height: 7px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--erd-faint);
  }

  .launcher[data-open="true"] .dot {
    background: var(--erd-sage);
    box-shadow: 0 0 0 3px var(--erd-sage-soft);
  }

  .readiness-badge {
    display: inline-flex;
    align-items: center;
    min-height: 19px;
    border: 1px solid var(--erd-border);
    border-radius: 999px;
    padding: 2px 7px;
    color: var(--erd-muted);
    background: var(--erd-surface-muted);
    font-size: 9px;
    font-weight: 650;
    letter-spacing: 0.015em;
    white-space: nowrap;
  }

  .readiness-badge[data-tone="ready"] {
    color: var(--erd-sage-strong);
    border-color: rgba(125, 142, 103, 0.42);
    background: var(--erd-sage-soft);
  }

  .readiness-badge[data-tone="warning"] {
    color: var(--erd-warning);
    border-color: rgba(141, 111, 47, 0.34);
    background: var(--erd-warning-soft);
  }

  .panel {
    right: 14px;
    bottom: 58px;
    width: min(600px, calc(100vw - 28px));
    max-height: min(720px, calc(100vh - 86px));
    pointer-events: auto;
    display: none;
    overflow: hidden;
    border: 1px solid var(--erd-border-strong);
    border-radius: 12px;
    background: var(--erd-paper);
    box-shadow: 0 18px 46px var(--erd-shadow), 0 1px 0 rgba(255, 255, 255, 0.9) inset;
  }

  .panel[data-open="true"] {
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    padding: 12px 13px 10px;
    border-bottom: 1px solid var(--erd-border);
    background: var(--erd-surface);
  }

  .title-block {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .title {
    color: var(--erd-earth);
    font-size: 12.5px;
    font-weight: 720;
    letter-spacing: 0.035em;
  }

  .session-label {
    overflow: hidden;
    color: var(--erd-muted);
    font-family: var(--erd-mono-font);
    font-size: 9.5px;
    letter-spacing: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: inline-flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 5px;
  }

  .actions button {
    padding: 5px 7px;
    color: var(--erd-muted);
    background: var(--erd-surface-muted);
  }

  .capture-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-bottom: 1px solid var(--erd-border);
    background: var(--erd-surface-muted);
  }

  .capture-cell {
    min-width: 0;
    padding: 7px 10px;
    border-right: 1px solid var(--erd-border);
  }

  .capture-cell:last-child {
    border-right: 0;
  }

  .capture-cell span,
  .capture-cell b {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .capture-cell span {
    color: var(--erd-faint);
    font-size: 8.5px;
    font-weight: 650;
    letter-spacing: 0.06em;
  }

  .capture-cell b {
    margin-top: 2px;
    color: var(--erd-ink-strong);
    font-family: var(--erd-mono-font);
    font-size: 10px;
    font-weight: 600;
  }

  .tabs {
    display: flex;
    gap: 2px;
    overflow-x: auto;
    padding: 7px 8px 5px;
    border-bottom: 1px solid var(--erd-border);
    background: var(--erd-paper);
    scrollbar-color: rgba(125, 142, 103, 0.46) transparent;
    scrollbar-width: thin;
    scroll-snap-type: x proximity;
  }

  .tabs button {
    flex: 0 0 auto;
    min-width: 52px;
    scroll-snap-align: start;
    border-color: transparent;
    border-radius: 6px;
    padding: 6px 8px;
    color: var(--erd-muted);
    background: transparent;
    white-space: nowrap;
  }

  .tabs button:hover {
    color: var(--erd-earth);
    border-color: transparent;
    background: var(--erd-surface-muted);
  }

  .tabs button[data-active="true"] {
    color: var(--erd-sage-strong);
    border-color: rgba(125, 142, 103, 0.2);
    background: var(--erd-surface-accent);
    box-shadow: inset 0 -2px 0 var(--erd-sage);
    font-weight: 680;
  }

  .export-bar {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 9px;
    border-bottom: 1px solid var(--erd-border);
    background: var(--erd-surface);
  }

  .export-bar .spacer {
    flex: 1;
  }

  .export-bar .label {
    overflow: hidden;
    max-width: 112px;
    color: var(--erd-earth);
    font-size: 10px;
    font-weight: 680;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .export-bar button {
    padding: 5px 7px;
    font-size: 10px;
  }

  .guide-panel {
    flex: 0 1 auto;
    max-height: min(320px, 42vh);
    overflow: auto;
    padding: 10px 11px 11px;
    border-bottom: 1px solid var(--erd-border);
    color: var(--erd-ink);
    background: var(--erd-surface-accent);
    scrollbar-color: rgba(125, 142, 103, 0.5) transparent;
    scrollbar-width: thin;
  }

  .guide-panel[hidden] {
    display: none;
  }

  .guide-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .guide-title {
    color: var(--erd-earth);
    font-size: 11.5px;
    font-weight: 720;
  }

  .guide-purpose,
  .guide-current {
    margin-top: 2px;
    color: var(--erd-muted);
    font-size: 9.5px;
  }

  .guide-current {
    padding: 5px 7px;
    border-left: 2px solid var(--erd-border-strong);
    background: rgba(255, 255, 255, 0.46);
  }

  .guide-state {
    flex: 0 0 auto;
    border: 1px solid var(--erd-border-strong);
    border-radius: 999px;
    padding: 2px 7px;
    color: var(--erd-muted);
    background: var(--erd-surface-muted);
    font-size: 9px;
    font-weight: 680;
    white-space: nowrap;
  }

  .guide-state[data-state="measured"] {
    color: var(--erd-sage-strong);
    border-color: rgba(125, 142, 103, 0.42);
    background: var(--erd-sage-soft);
  }

  .guide-state[data-state="broken"] {
    color: var(--erd-danger);
    border-color: rgba(184, 95, 95, 0.46);
    background: var(--erd-danger-soft);
  }

  .guide-state[data-state="insufficient"] {
    color: var(--erd-warning);
    border-color: rgba(141, 111, 47, 0.42);
    background: var(--erd-warning-soft);
  }

  .guide-steps {
    display: grid;
    gap: 4px;
    margin: 9px 0 0;
    padding: 0;
    list-style: none;
  }

  .guide-steps li {
    display: grid;
    grid-template-columns: 66px minmax(0, 1fr);
    gap: 9px;
    padding: 6px 7px;
    border: 1px solid rgba(215, 204, 200, 0.72);
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.72);
  }

  .guide-steps b,
  .guide-validity > b,
  .guide-caution > b {
    color: var(--erd-earth);
    font-size: 9.5px;
  }

  .guide-steps span,
  .guide-validity li,
  .guide-caution span {
    color: var(--erd-ink);
    font-size: 9.5px;
  }

  .guide-validity,
  .guide-caution {
    margin-top: 6px;
    padding: 6px 7px;
    border: 1px solid rgba(125, 142, 103, 0.28);
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.58);
  }

  .guide-validity ul {
    display: grid;
    gap: 2px;
    margin: 3px 0 0;
    padding-left: 16px;
  }

  .guide-caution {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 8px;
    border-color: rgba(141, 111, 47, 0.26);
    background: var(--erd-warning-soft);
  }

  .body {
    flex: 1 1 auto;
    min-height: 0;
    max-height: min(480px, calc(100vh - 292px));
    overflow: auto;
    padding: 10px 11px 12px;
    background: var(--erd-paper);
    scrollbar-color: rgba(125, 142, 103, 0.5) transparent;
    scrollbar-width: thin;
  }

  .body:focus-visible {
    outline: 2px solid var(--erd-sage);
    outline-offset: -3px;
  }

  .grid {
    display: grid;
    grid-template-columns: minmax(108px, max-content) minmax(0, 1fr);
    align-items: baseline;
    gap: 5px 14px;
    padding: 8px 10px;
    border: 1px solid var(--erd-border);
    border-radius: 8px;
    background: var(--erd-surface);
  }

  .k {
    color: var(--erd-muted);
    font-size: 10.5px;
  }

  .v {
    overflow: hidden;
    color: var(--erd-ink-strong);
    font-family: var(--erd-mono-font);
    font-size: 10px;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    margin: 11px 1px 5px;
    padding-top: 8px;
    border-top: 1px solid var(--erd-border);
    color: var(--erd-earth);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.035em;
  }

  .list,
  .state-list {
    display: grid;
    gap: 4px;
  }

  .item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) max-content;
    gap: 10px;
    align-items: baseline;
    min-width: 0;
    padding: 6px 8px;
    border: 1px solid var(--erd-border);
    border-radius: 7px;
    color: var(--erd-ink);
    background: var(--erd-surface);
  }

  .item span:first-child {
    overflow: hidden;
    color: var(--erd-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item b {
    color: var(--erd-ink-strong);
    font-family: var(--erd-mono-font);
    font-size: 9.5px;
    font-weight: 600;
  }

  .detail {
    margin-top: -2px;
    padding: 5px 8px 6px;
    border: 1px solid var(--erd-border);
    border-top: 0;
    border-radius: 0 0 7px 7px;
    color: var(--erd-muted);
    background: var(--erd-surface-muted);
    font-family: var(--erd-mono-font);
    font-size: 9px;
    overflow-wrap: anywhere;
  }

  .empty {
    padding: 8px 9px;
    border: 1px dashed var(--erd-border-strong);
    border-radius: 7px;
    color: var(--erd-faint);
    background: var(--erd-surface-muted);
  }

  .status {
    min-height: 27px;
    padding: 6px 11px 7px;
    border-top: 1px solid var(--erd-border);
    color: var(--erd-sage-strong);
    background: var(--erd-surface);
    font-size: 10px;
  }

  .status:empty {
    display: none;
  }

  .inline-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin: 0 0 9px;
  }

  .scope-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin: 0 0 9px;
    padding: 0 1px 8px;
    border-bottom: 1px solid var(--erd-border);
  }

  .scope-title {
    color: var(--erd-earth);
    font-size: 11.5px;
    font-weight: 720;
  }

  .scope-action-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chip {
    border: 1px solid var(--erd-border-strong);
    border-radius: 999px;
    padding: 2px 7px;
    color: var(--erd-muted);
    background: var(--erd-surface-muted);
    font-family: var(--erd-mono-font);
    font-size: 9px;
  }

  .chip[data-ok="true"] {
    color: var(--erd-sage-strong);
    border-color: rgba(125, 142, 103, 0.42);
    background: var(--erd-sage-soft);
  }

  .state-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    width: 100%;
    padding: 8px 9px;
    border-color: var(--erd-border);
    border-radius: 8px;
    color: var(--erd-ink);
    background: var(--erd-surface);
    text-align: left;
  }

  .state-card:hover {
    border-color: var(--erd-border-strong);
    background: var(--erd-surface-muted);
  }

  .state-card[data-state="measured"] {
    border-color: rgba(125, 142, 103, 0.48);
    background: var(--erd-surface-accent);
  }

  .state-card[data-state="broken"] {
    border-color: rgba(184, 95, 95, 0.46);
    background: var(--erd-danger-soft);
  }

  .state-card[data-state="insufficient"] {
    border-color: rgba(141, 111, 47, 0.42);
    background: var(--erd-warning-soft);
  }

  .state-card[data-state="inactive"],
  .state-card[data-state="unavailable"] {
    color: var(--erd-muted);
    background: var(--erd-surface-muted);
  }

  .state-card .name {
    color: var(--erd-ink-strong);
    font-weight: 700;
  }

  .state-card .reason {
    margin-top: 2px;
    color: var(--erd-muted);
    font-size: 9.5px;
  }

  .state-card .metric {
    align-self: center;
    color: var(--erd-sage-strong);
    font-family: var(--erd-mono-font);
    font-size: 9.5px;
    text-align: right;
    white-space: nowrap;
  }

  .state-card[data-state="broken"] .metric {
    color: var(--erd-danger);
  }

  .state-card[data-state="insufficient"] .metric {
    color: var(--erd-warning);
  }

  .tabs::-webkit-scrollbar,
  .guide-panel::-webkit-scrollbar,
  .body::-webkit-scrollbar,
  .export-bar::-webkit-scrollbar {
    width: 7px;
    height: 7px;
  }

  .tabs::-webkit-scrollbar-thumb,
  .guide-panel::-webkit-scrollbar-thumb,
  .body::-webkit-scrollbar-thumb,
  .export-bar::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 999px;
    background: rgba(125, 142, 103, 0.48);
    background-clip: padding-box;
  }

  @media (max-width: 620px) {
    .panel {
      right: 8px;
      bottom: 54px;
      width: calc(100vw - 16px);
      max-height: calc(100vh - 66px);
    }

    .launcher {
      right: 8px;
      bottom: 8px;
    }

    .header {
      display: grid;
      gap: 8px;
    }

    .actions {
      justify-content: flex-start;
    }

    .capture-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .capture-cell:nth-child(2) {
      border-right: 0;
    }

    .capture-cell:nth-child(-n + 2) {
      border-bottom: 1px solid var(--erd-border);
    }

    .export-bar {
      overflow-x: auto;
    }

    .export-bar .spacer {
      min-width: 6px;
    }

    .body {
      max-height: calc(100vh - 330px);
    }

    .guide-panel {
      max-height: 44vh;
    }
  }

  @media (max-width: 390px) {
    .grid {
      grid-template-columns: minmax(92px, max-content) minmax(0, 1fr);
      gap: 5px 9px;
      padding-inline: 8px;
    }

    .export-bar .label {
      display: none;
    }

    .state-card {
      grid-template-columns: minmax(0, 1fr);
    }

    .state-card .metric {
      text-align: left;
    }

    .guide-heading,
    .guide-caution,
    .guide-steps li {
      grid-template-columns: minmax(0, 1fr);
    }

    .guide-heading {
      display: grid;
      gap: 6px;
    }

    .guide-state {
      justify-self: start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .launcher,
    .panel,
    button,
    .grid,
    .item,
    .empty,
    .chip,
    .guide-panel,
    .guide-steps li,
    .guide-validity,
    .guide-caution {
      border-color: CanvasText;
    }

    button:focus-visible {
      outline-color: Highlight;
    }
  }
`;

export default RUNTIME_DEBUGGER_OVERLAY_STYLE;

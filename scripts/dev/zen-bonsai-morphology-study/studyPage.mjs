export const createZenBonsaiMorphologyStudyHtml = ({ bundleFileName }) => `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Entropy Zen Bonsai Morphology Study</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #e9e4da;
      color: #292721;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 760px; background: #e9e4da; }
    .study-shell { width: min(1500px, 100%); margin: 0 auto; padding: 32px; }
    .study-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 22px;
      padding: 0 4px;
    }
    .study-header__eyebrow {
      margin: 0 0 8px;
      color: #756d5e;
      font-size: 11px;
      font-weight: 720;
      letter-spacing: .16em;
      text-transform: uppercase;
    }
    h1 { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 29px; font-weight: 500; }
    #study-status { margin: 0; color: #6e675a; font-size: 12px; text-align: right; }
    .study-current {
      position: absolute;
      left: -10000px;
      width: 640px;
      height: 360px;
      overflow: hidden;
    }
    .study-gallery { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .study-pair {
      overflow: hidden;
      border: 1px solid rgba(68, 60, 49, .15);
      border-radius: 16px;
      background: rgba(249, 247, 240, .94);
      box-shadow: 0 10px 30px rgba(62, 51, 37, .08);
    }
    .study-pair__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      min-height: 46px;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(68, 60, 49, .11);
    }
    .study-pair__header h2 { margin: 0; font-size: 12px; letter-spacing: .05em; }
    .study-pair__header p { margin: 0; color: #756d5e; font-size: 10px; text-align: right; }
    .study-pair__cases { display: grid; grid-template-columns: 1fr 1fr; }
    .study-case { min-width: 0; padding: 12px; }
    .study-case + .study-case { border-left: 1px solid rgba(68, 60, 49, .11); }
    .study-case h3 { min-height: 30px; margin: 0 0 7px; font-size: 11px; font-weight: 730; }
    .study-canvas-wrap {
      display: grid;
      place-items: center;
      overflow: hidden;
      border-radius: 11px;
      background:
        radial-gradient(circle at 50% 86%, rgba(139, 127, 104, .11), transparent 36%),
        linear-gradient(180deg, #f8f5ec, #eee9dd);
    }
    canvas { display: block; max-width: 100%; height: auto !important; }
    .study-case__metrics {
      min-height: 30px;
      margin: 8px 2px 0;
      color: #776f61;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 8px;
      line-height: 1.45;
    }
    @media (max-width: 1120px) {
      .study-gallery { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="study-shell">
    <header class="study-header">
      <div>
        <p class="study-header__eyebrow">Shadow diagnostic · not learning evidence</p>
        <h1>Classic2 Morphology Study</h1>
      </div>
      <p id="study-status">booting</p>
    </header>
    <section class="study-current" aria-hidden="true">
      <canvas id="study-left-canvas"></canvas>
      <canvas id="study-right-canvas"></canvas>
    </section>
    <section id="study-gallery" class="study-gallery" aria-label="Morphology comparison atlas"></section>
  </main>
  <template id="study-pair-template">
    <article class="study-pair" data-study-pair>
      <header class="study-pair__header">
        <h2 data-study-pair-title></h2>
        <p data-study-pair-distance></p>
      </header>
      <div class="study-pair__cases">
        <section class="study-case" data-study-side="left">
          <h3 data-study-case-title></h3>
          <div class="study-canvas-wrap"><canvas></canvas></div>
          <p class="study-case__metrics" data-study-case-metrics></p>
        </section>
        <section class="study-case" data-study-side="right">
          <h3 data-study-case-title></h3>
          <div class="study-canvas-wrap"><canvas></canvas></div>
          <p class="study-case__metrics" data-study-case-metrics></p>
        </section>
      </div>
    </article>
  </template>
  <script src="./${bundleFileName}"></script>
</body>
</html>
`;

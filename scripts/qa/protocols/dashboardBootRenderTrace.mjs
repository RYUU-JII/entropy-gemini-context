import fs from 'node:fs/promises';

const REVEAL_MARK = 'entropy-qa:boot-shell-dismissed';
const LATE_TRACE_MARK = 'entropy-qa:gpu-startup-trace-anchor';
const CATEGORIES = ['devtools.timeline', 'blink.user_timing', 'toplevel', 'cc', 'viz', 'gpu', 'gpu.angle',
  'disabled-by-default-devtools.timeline.frame', 'disabled-by-default-gpu.service'];
const TRACE_PROFILES = Object.freeze({
  rendering: CATEGORIES,
  'gpu-startup': Object.freeze(['gpu', 'startup', 'latency', 'blink.user_timing']),
});
const COLLECTOR_NAMES = new Set(['GetGpuSupportedDirectXVersion', 'gpu_info_collector::CollectDawnInfo']);
const COLLECTOR_SPAN_CAPACITY = 64;

export function requireDashboardRenderTraceProfile(profile) {
  if (typeof profile !== 'string' || !Object.hasOwn(TRACE_PROFILES, profile)) {
    throw new Error('QA_BOOT_RENDER_TRACE_PROFILE_INVALID');
  }
  return profile;
}

function projectCollectorSpans(events, start, end, threadNames, processNames) {
  const relevantThreads = new Set(events.filter(e => COLLECTOR_NAMES.has(e.name)
    && (e.ph === 'B' || e.ph === 'E'))
    .map(e => `${e.pid}:${e.tid}`));
  const threadEvents = new Map();
  const spans = [];
  let count = 0;
  const isCollector = event => COLLECTOR_NAMES.has(event.name);
  const failSpan = () => { throw new Error('QA_BOOT_GPU_COLLECTOR_SPAN_INVALID'); };
  const append = (event, endTimestampUs, phase) => {
    if (!Number.isFinite(event.ts) || !Number.isFinite(endTimestampUs) || endTimestampUs < event.ts
      || !Number.isInteger(event.pid) || !Number.isInteger(event.tid)
      || typeof event.cat !== 'string' || !event.cat.split(',').includes('gpu')) failSpan();
    count++;
    if (spans.length < COLLECTOR_SPAN_CAPACITY) spans.push({
      name: event.name, category: event.cat, pid: event.pid, tid: event.tid,
      process: processNames.get(event.pid) ?? null,
      thread: threadNames.get(`${event.pid}:${event.tid}`) ?? null,
      phase, startTimestampUs: event.ts, endTimestampUs,
      relativeStartMs: (event.ts - start) / 1000,
      durationMs: (endTimestampUs - event.ts) / 1000,
      overlapMs: Math.max(0, Math.min(end, endTimestampUs) - Math.max(start, event.ts)) / 1000,
    });
  };
  for (const event of events) {
    if (isCollector(event) && event.ph === 'X') {
      if (!Number.isFinite(event.dur) || event.dur < 0) failSpan();
      append(event, event.ts + event.dur, 'X');
    }
    if ((event.ph === 'B' || event.ph === 'E') && relevantThreads.has(`${event.pid}:${event.tid}`)) {
      if (!Number.isFinite(event.ts)) failSpan();
      const key = `${event.pid}:${event.tid}`;
      if (!threadEvents.has(key)) threadEvents.set(key, []);
      threadEvents.get(key).push(event);
    }
  }
  // Match the actual synchronous thread stack, including intervening nested
  // work. A collector's begin must never pair with an unrelated nested end.
  for (const rows of threadEvents.values()) {
    rows.sort((a, b) => a.ts - b.ts);
    const stack = [];
    for (const event of rows) {
      if (event.ph === 'B') { stack.push(event); continue; }
      const begun = stack.pop();
      if (!begun) {
        if (isCollector(event)) throw new Error('QA_BOOT_GPU_COLLECTOR_SPAN_INCOMPLETE');
        continue;
      }
      if (isCollector(begun)) {
        if (event.name && event.name !== begun.name) failSpan();
        append(begun, event.ts, 'B/E');
      } else if (isCollector(event)) failSpan();
    }
    if (stack.some(isCollector)) throw new Error('QA_BOOT_GPU_COLLECTOR_SPAN_INCOMPLETE');
  }
  if (count > COLLECTOR_SPAN_CAPACITY) {
    const error = new Error('QA_BOOT_GPU_COLLECTOR_PROJECTION_OVERFLOW');
    error.diagnostic = { capacity: COLLECTOR_SPAN_CAPACITY, spanCount: count,
      droppedCount: count - COLLECTOR_SPAN_CAPACITY };
    throw error;
  }
  return spans.sort((a, b) => a.startTimestampUs - b.startTimestampUs);
}

function resolveTraceAlignment(events, postReveal, profile, alignment) {
  if (alignment === undefined) {
    const mark = events.find(e => e.name === REVEAL_MARK && Number.isFinite(e.ts));
    if (!mark || !postReveal) throw new Error('QA_BOOT_RENDER_TRACE_REVEAL_MARK_MISSING');
    return { mark, start: mark.ts, receipt: { mode: 'native-reveal-mark', markName: REVEAL_MARK,
      derivedRevealTimestampUs: mark.ts, nativeOriginErrorUs: null, nativeOriginErrorStatus: 'unknown' } };
  }
  if (profile !== 'gpu-startup') throw new Error('QA_BOOT_RENDER_TRACE_LATE_ALIGNMENT_PROFILE_INVALID');
  if (!alignment || typeof alignment !== 'object' || alignment.markName !== LATE_TRACE_MARK
    || !Number.isFinite(alignment.markStartTimeMs) || alignment.markStartTimeMs < 0
    || !Number.isFinite(alignment.postRevealStartTimeMs) || alignment.postRevealStartTimeMs < 0
    || alignment.markStartTimeMs < alignment.postRevealStartTimeMs
    || !Number.isFinite(postReveal?.windowMs) || postReveal.windowMs <= 0
    || alignment.markStartTimeMs - alignment.postRevealStartTimeMs > postReveal.windowMs) {
    throw new Error('QA_BOOT_RENDER_TRACE_LATE_ALIGNMENT_INVALID');
  }
  const marks = events.filter(e => e.name === LATE_TRACE_MARK && Number.isFinite(e.ts));
  if (!marks.length) throw new Error('QA_BOOT_RENDER_TRACE_ANCHOR_MARK_MISSING');
  if (marks.length !== 1 || !Number.isInteger(marks[0].pid) || !Number.isInteger(marks[0].tid)) {
    throw new Error('QA_BOOT_RENDER_TRACE_ANCHOR_MARK_INVALID');
  }
  const mark = marks[0];
  const offsetMs = alignment.markStartTimeMs - alignment.postRevealStartTimeMs;
  const start = mark.ts - offsetMs * 1000;
  if (!Number.isFinite(start) || start < 0) throw new Error('QA_BOOT_RENDER_TRACE_LATE_ALIGNMENT_INVALID');
  return { mark, start, receipt: { mode: 'page-mark-offset', markName: LATE_TRACE_MARK,
    anchorTraceTimestampUs: mark.ts, anchorPageStartMs: alignment.markStartTimeMs,
    postRevealPageStartMs: alignment.postRevealStartTimeMs, offsetMs,
    derivedRevealTimestampUs: start, nativeOriginErrorUs: null, nativeOriginErrorStatus: 'unknown' } };
}

// Browser-wide tracing is used only on an ephemeral owned dashboard browser.
// Keep the raw evidence local; never equate rAF or GPU command submission with presentation.
// gpu.angle includes native compiler tasks and GLSL/HLSL source arguments in
// this bounded local raw artifact. Summaries do not project those arguments.
export function summarizeDashboardRenderTrace(trace, postReveal, { profile = 'rendering', alignment } = {}) {
  requireDashboardRenderTraceProfile(profile);
  const events = trace.traceEvents;
  if (!Array.isArray(events)) throw new Error('QA_BOOT_RENDER_TRACE_EVENTS_MISSING');
  const { mark, start, receipt: alignmentReceipt } = resolveTraceAlignment(events, postReveal, profile, alignment);
  const end = start + postReveal.windowMs * 1000;
  const threadNames = new Map(events.filter(e => e.name === 'thread_name' && typeof e.args?.name === 'string')
    .map(e => [`${e.pid}:${e.tid}`, e.args?.name]));
  const processNames = new Map(events.filter(e => e.name === 'process_name' && typeof e.args?.name === 'string')
    .map(e => [e.pid, e.args?.name]));
  const collectorSpans = projectCollectorSpans(events, start, end, threadNames, processNames);
  const presentationTimestamps = [...new Set(events.filter(e => (
    e.name === 'AnimationFrame::Presentation' && e.pid === mark.pid && e.tid === mark.tid
      && e.ts >= start && e.ts <= end
  )).map(e => e.ts))].sort((a, b) => a - b);
  const presentationGaps = presentationTimestamps.slice(1)
    .map((ts, index) => (ts - presentationTimestamps[index]) / 1000);
  const spans = events.filter(e => e.ph === 'X' && e.ts < end && e.ts + e.dur > start)
    .map(e => ({ name: e.name, category: e.cat, pid: e.pid, tid: e.tid,
      thread: threadNames.get(`${e.pid}:${e.tid}`) ?? null,
      source: e.args?.src_func ?? null,
      relativeStartMs: (e.ts - start) / 1000, durationMs: e.dur / 1000,
      overlapMs: (Math.min(end, e.ts + e.dur) - Math.max(start, e.ts)) / 1000 }));
  return { profile, revealTimestampUs: start, alignment: alignmentReceipt, pagePid: mark.pid, pageTid: mark.tid,
    eventCount: events.length, windowMs: postReveal.windowMs,
    collectorSpans, collectorSpanCapacity: COLLECTOR_SPAN_CAPACITY, collectorSpansDropped: 0,
    presentation: { source: 'Chrome AnimationFrame::Presentation feedback',
      status: presentationTimestamps.length > 1 ? 'available' : 'unavailable',
      uniqueTimestampCount: presentationTimestamps.length,
      relativeTimestampsMs: presentationTimestamps.map(ts => (ts - start) / 1000),
      gapsMs: presentationGaps,
      maxGapMs: presentationGaps.length ? Math.max(...presentationGaps) : null },
    // Nested durations overlap; this list is attribution evidence, not an additive cost budget.
    longestSpans: spans.sort((a, b) => b.overlapMs - a.overlapMs).slice(0, 80),
    eventNames: [...new Set(events.filter(e => e.ts >= start && e.ts < end).map(e => e.name))].sort(),
  };
}

export async function startDashboardRenderTraceCapture(cdp, outputPath, { profile = 'rendering' } = {}) {
  requireDashboardRenderTraceProfile(profile);
  let completed = null;
  const unsubscribe = cdp.subscribe('Tracing.tracingComplete', event => { completed = event.params; });
  const captureStartMs = performance.now();
  try {
    await cdp.send('Tracing.start', { transferMode: 'ReturnAsStream', streamFormat: 'json',
      traceConfig: { recordMode: 'recordUntilFull', includedCategories: TRACE_PROFILES[profile],
        excludedCategories: ['*'], traceBufferSizeInKb: 65536 } }, undefined, { timeoutMs: 10_000 });
  } catch (error) { unsubscribe(); throw error; }
  return async () => {
    let stream = null;
    const traceWindowMs = performance.now() - captureStartMs;
    try {
      await cdp.send('Tracing.end', {}, undefined, { timeoutMs: 10_000 });
      const deadline = Date.now() + 20_000;
      while (!completed && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
      if (!completed?.stream) throw new Error('QA_BOOT_RENDER_TRACE_STREAM_MISSING');
      stream = completed.stream;
      const chunks = []; let bytes = 0;
      for (;;) {
        const chunk = await cdp.send('IO.read', { handle: stream, size: 1024 * 1024 }, undefined, { timeoutMs: 10_000 });
        const buffer = Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8');
        bytes += buffer.length;
        if (bytes > 128 * 1024 * 1024) throw new Error('QA_BOOT_RENDER_TRACE_SIZE_LIMIT');
        chunks.push(buffer);
        if (chunk.eof) break;
        if (Date.now() > deadline) throw new Error('QA_BOOT_RENDER_TRACE_READ_TIMEOUT');
      }
      const buffer = Buffer.concat(chunks);
      await fs.writeFile(outputPath, buffer);
      if (completed.dataLossOccurred) throw new Error('QA_BOOT_RENDER_TRACE_DATA_LOSS');
      return { profile, path: outputPath, bytes, dataLossOccurred: false,
        traceWindowMs, traceWindowSource: 'Node monotonic Tracing.start dispatch to Tracing.end dispatch',
        trace: JSON.parse(buffer.toString('utf8')) };
    } finally {
      unsubscribe();
      if (stream) await cdp.send('IO.close', { handle: stream }, undefined, { timeoutMs: 5000 });
    }
  };
}

export async function startDashboardBootRenderTrace(cdp, outputPath, { profile = 'rendering' } = {}) {
  const stop = await startDashboardRenderTraceCapture(cdp, outputPath, { profile });
  return async (postReveal, alignment) => {
    const { trace, ...capture } = await stop();
    return { ...capture, ...summarizeDashboardRenderTrace(trace, postReveal, { profile, alignment }) };
  };
}

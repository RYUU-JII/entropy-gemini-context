import { StringDecoder } from 'node:string_decoder';

export const CHROMIUM_STARTUP_STDERR_MAX_BYTES = 32 * 1024;
const MAX_LINE_BYTES = 4096;

// Only complete, bounded lines enter evidence. A split or oversized command
// line must never expose a fragment of the private process ownership token.
export function captureChromiumStartupStderr(stream, { ownerToken }) {
  const decoder = new StringDecoder('utf8');
  let lines = [];
  let retainedBytes = 0;
  let receivedBytes = 0;
  let omittedLines = 0;
  let pending = '';
  let oversized = false;
  let stopped = false;
  let streamErrorCode = null;
  const onData = (chunk) => {
    if (stopped) return;
    receivedBytes += Buffer.byteLength(chunk);
    const parts = decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)).split('\n');
    for (let index = 0; index < parts.length; index += 1) {
      if (!oversized) {
        pending += parts[index];
        if (Buffer.byteLength(pending) > MAX_LINE_BYTES) {
          oversized = true;
          pending = '';
        }
      }
      if (index === parts.length - 1) break;
      if (oversized) {
        omittedLines += 1;
      } else {
        const line = pending.replaceAll(ownerToken, '[redacted]')
          .replace(/--browser-qa-owner-token=[^\s"']*/gu, '--browser-qa-owner-token=[redacted]')
          .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/gu, '') + '\n';
        lines.push(line);
        retainedBytes += Buffer.byteLength(line);
        while (retainedBytes > CHROMIUM_STARTUP_STDERR_MAX_BYTES) {
          retainedBytes -= Buffer.byteLength(lines.shift());
          omittedLines += 1;
        }
      }
      pending = '';
      oversized = false;
    }
  };
  const onError = (error) => {
    streamErrorCode = typeof error?.code === 'string' && /^[A-Z0-9_]{1,64}$/u.test(error.code)
      ? error.code : 'STDERR_STREAM_ERROR';
  };
  stream?.on('data', onData);
  stream?.on('error', onError);
  return Object.freeze({
    read() {
      return Object.freeze({
        status: stream ? (stopped ? 'stopped' : 'capturing') : 'unavailable',
        maxBytes: CHROMIUM_STARTUP_STDERR_MAX_BYTES,
        receivedBytes,
        retainedBytes,
        omittedLines,
        incompleteLineOmitted: oversized || pending.length > 0,
        streamErrorCode,
        text: lines.join(''),
      });
    },
    stop() {
      if (stopped) return;
      stopped = true;
      stream?.off('data', onData);
      // Keep draining without retaining data while this launcher is alive.
      // Neither this stream nor the handed-off child may keep it alive.
      stream?.resume();
      stream?.unref?.();
      lines = [];
      retainedBytes = 0;
      pending = '';
    },
  });
}

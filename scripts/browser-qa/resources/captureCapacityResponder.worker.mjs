import net from 'node:net';
import { parentPort, workerData } from 'node:worker_threads';

// The Node process owns this thread. A busy source transform must not prevent
// another run from proving which mode owns the live capacity endpoint.
const { endpoint, snapshot } = workerData;
const server = net.createServer((socket) => {
  socket.on('error', () => {});
  socket.end(`${JSON.stringify(snapshot)}\n`);
});
server.maxConnections = 16;
server.once('error', (error) => {
  parentPort.postMessage({ type: 'listen_error', code: error.code, message: error.message });
  parentPort.close();
});
server.listen(endpoint.port, endpoint.host, () => parentPort.postMessage({ type: 'ready' }));
parentPort.on('message', (message) => {
  if (message !== 'close') throw new Error('QA_CAPTURE_CAPACITY_MESSAGE_INVALID');
  server.close((error) => {
    parentPort.postMessage(error
      ? { type: 'close_error', message: error.message }
      : { type: 'closed' });
    parentPort.close();
  });
});

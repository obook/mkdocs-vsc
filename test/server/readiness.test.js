/*
 * readiness.test.js
 * Unit tests for the pure server readiness module.
 *
 * Run with the built-in Node test runner (no dependency): `npm test` or
 * `node --test test/`.
 *
 * Author: O. Booklage
 * Date: June 2026
 * Licence: MIT
 */

const { test } = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const {
  isPortOpen,
  resolveReadyTimeoutMs,
  waitForReady
} = require('../../src/server/readiness');

/**
 * Starts a throwaway TCP server on a free port (port 0 lets the OS pick one).
 *
 * @returns {Promise<net.Server>} The listening server.
 */
function startServer() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/**
 * Closes a server started by startServer.
 *
 * @param {net.Server} server - The server to close.
 * @returns {Promise<void>} Resolves once the server is closed.
 */
function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

test('isPortOpen returns true when a server is listening', async () => {
  const server = await startServer();
  const port = server.address().port;
  try {
    assert.strictEqual(await isPortOpen('127.0.0.1', port), true);
  } finally {
    await stopServer(server);
  }
});

test('isPortOpen returns false on a closed port', async () => {
  const server = await startServer();
  const port = server.address().port;
  /* Free the port again, then probe it: nothing should answer. */
  await stopServer(server);
  assert.strictEqual(await isPortOpen('127.0.0.1', port, 300), false);
});

test('resolveReadyTimeoutMs converts seconds to milliseconds', () => {
  assert.strictEqual(resolveReadyTimeoutMs(30), 30000);
});

test('resolveReadyTimeoutMs clamps a low value to the 5s floor', () => {
  assert.strictEqual(resolveReadyTimeoutMs(1), 5000);
});

test('resolveReadyTimeoutMs falls back to the 120s default on invalid input', () => {
  assert.strictEqual(resolveReadyTimeoutMs(0), 120000);
  assert.strictEqual(resolveReadyTimeoutMs('abc'), 120000);
});

test('waitForReady resolves true once the port answers', async () => {
  const server = await startServer();
  const port = server.address().port;
  try {
    const ready = await waitForReady({
      host: '127.0.0.1',
      port,
      timeoutMs: 2000
    });
    assert.strictEqual(ready, true);
  } finally {
    await stopServer(server);
  }
});

test('waitForReady returns false when aborted before polling', async () => {
  const ready = await waitForReady({
    host: '127.0.0.1',
    port: 1,
    timeoutMs: 2000,
    isAborted: () => true
  });
  assert.strictEqual(ready, false);
});

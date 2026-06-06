/*
 * readiness.js
 * Server readiness probing for MkDocs Live Preview (no VS Code dependency).
 *
 * Answers the network-level question "is the server answering yet?": a short
 * TCP probe, the ready-timeout resolution, and the polling loop that waits for
 * the initial build to finish. Kept free of the VS Code API so it can be
 * unit-tested; server.js supplies the configured host, port and timeout, plus
 * the abort condition tied to its running process.
 *
 * Author: O. Booklage
 * Date: June 2026
 * Licence: MIT
 */

const net = require('net');
const { clampReadyTimeoutMs, pollUntilReady } = require('../util/timeout');

/** Default time (ms) to wait for the server to answer after a start. */
const DEFAULT_READY_TIMEOUT_MS = 120000;
/** Hard floor (ms) for the configured ready timeout. */
const MIN_READY_TIMEOUT_MS = 5000;
/** Probe timeout (ms) for a single readiness check during the wait loop. */
const PROBE_TIMEOUT_MS = 500;

/**
 * Tells whether a server already listens on host:port (short TCP probe).
 * Pure: depends only on `net`.
 *
 * @param {string} host - Host to probe.
 * @param {number} port - Port to probe.
 * @param {number} [timeout] - Probe timeout (ms).
 * @returns {Promise<boolean>} True if a connection succeeded.
 */
function isPortOpen(host, port, timeout = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    function finish(open) {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(open);
    }
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

/**
 * Resolves the configured ready timeout (in seconds) into a millisecond
 * duration, applying this extension's default and floor. Thin wrapper around
 * the pure `clampReadyTimeoutMs`.
 *
 * @param {unknown} configuredSeconds - The raw `readyTimeout` setting value.
 * @returns {number} Ready timeout in milliseconds.
 */
function resolveReadyTimeoutMs(configuredSeconds) {
  return clampReadyTimeoutMs(
    configuredSeconds,
    DEFAULT_READY_TIMEOUT_MS,
    MIN_READY_TIMEOUT_MS
  );
}

/**
 * Waits for the server to answer on host:port. The initial build can take from
 * a few seconds (small sites) to over a minute (large sites with heavy themes
 * such as pyodide-mkdocs-theme), hence the caller-supplied timeout. Stops early
 * when `isAborted` reports the server process has exited, so the preview can
 * surface the failure immediately instead of waiting out the full timeout.
 *
 * @param {object} options
 * @param {string} options.host - Host to probe.
 * @param {number} options.port - Port to probe.
 * @param {number} options.timeoutMs - Maximum time to wait (ms).
 * @param {() => boolean} [options.isAborted] - Returns true to stop waiting
 *        early. Defaults to never aborting.
 * @returns {Promise<boolean>} True once the port answers, false on abort or
 *          timeout.
 */
function waitForReady(options) {
  const { host, port, timeoutMs, isAborted } = options;
  return pollUntilReady({
    isReady: () => isPortOpen(host, port, PROBE_TIMEOUT_MS),
    isAborted: isAborted || (() => false),
    timeoutMs
  });
}

module.exports = { isPortOpen, resolveReadyTimeoutMs, waitForReady };

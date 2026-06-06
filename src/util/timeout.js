/*
 * timeout.js
 * Pure helpers for the server ready-timeout setting.
 *
 * Kept in its own module (no VS Code dependency) so it can be unit-tested
 * with the built-in Node test runner.
 *
 * Author: O. Booklage
 * Date: May 2026
 * Licence: MIT
 */

/**
 * Validates the configured ready timeout (in seconds) and returns it as a
 * millisecond duration. Falls back to `defaultMs` for non-numeric, zero or
 * negative inputs, and clamps to `minMs` so a misconfigured low value cannot
 * shorten the wait below what an immediate first probe needs.
 *
 * @param {unknown} rawSeconds - The raw value from the user settings.
 * @param {number} defaultMs - Fallback duration (ms) for invalid inputs.
 * @param {number} minMs - Hard floor (ms) for the returned duration.
 * @returns {number} Ready timeout in milliseconds.
 */
function clampReadyTimeoutMs(rawSeconds, defaultMs, minMs) {
  const raw = Number(rawSeconds);
  if (!Number.isFinite(raw) || raw <= 0) {
    return defaultMs;
  }
  return Math.max(minMs, Math.round(raw * 1000));
}

/**
 * Polls `isReady` until it returns true, the optional `isAborted` predicate
 * returns true, or `timeoutMs` elapses. Pure helper (no VS Code dependency)
 * so the readiness logic can be unit-tested.
 *
 * @param {object} opts
 * @param {() => Promise<boolean>} opts.isReady - Predicate called every poll;
 *        resolving to true ends the wait with success.
 * @param {() => boolean} [opts.isAborted] - Optional synchronous predicate
 *        checked before each poll; returning true ends the wait with failure
 *        (e.g. the spawned server has already exited).
 * @param {number} opts.timeoutMs - Maximum wait duration.
 * @param {number} [opts.intervalMs] - Delay between polls. Defaults to 400 ms.
 * @returns {Promise<boolean>} True if `isReady` resolved to true within the
 *          budget, false on abort or timeout.
 */
async function pollUntilReady(opts) {
  const { isReady, timeoutMs } = opts;
  const isAborted = opts.isAborted || (() => false);
  const intervalMs = opts.intervalMs || 400;
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (isAborted()) {
      return false;
    }
    if (await isReady()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

module.exports = { clampReadyTimeoutMs, pollUntilReady };

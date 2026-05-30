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

module.exports = { clampReadyTimeoutMs };

/*
 * timeout.test.js
 * Unit tests for the pure ready-timeout helper.
 *
 * Run with the built-in Node test runner (no dependency): `npm test` or
 * `node --test test/`.
 *
 * Author: O. Booklage
 * Date: May 2026
 * Licence: MIT
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { clampReadyTimeoutMs, pollUntilReady } = require('../src/timeout');

const DEFAULT_MS = 120000;
const MIN_MS = 5000;

test('valid seconds value is converted to milliseconds', () => {
  assert.strictEqual(clampReadyTimeoutMs(120, DEFAULT_MS, MIN_MS), 120000);
});

test('numeric string is accepted', () => {
  assert.strictEqual(clampReadyTimeoutMs('60', DEFAULT_MS, MIN_MS), 60000);
});

test('value below the minimum is clamped to the minimum', () => {
  assert.strictEqual(clampReadyTimeoutMs(2, DEFAULT_MS, MIN_MS), MIN_MS);
});

test('value exactly at the minimum is preserved', () => {
  assert.strictEqual(clampReadyTimeoutMs(5, DEFAULT_MS, MIN_MS), MIN_MS);
});

test('fractional seconds are rounded to the nearest millisecond', () => {
  assert.strictEqual(clampReadyTimeoutMs(12.5, DEFAULT_MS, MIN_MS), 12500);
});

test('zero falls back to the default', () => {
  assert.strictEqual(clampReadyTimeoutMs(0, DEFAULT_MS, MIN_MS), DEFAULT_MS);
});

test('negative values fall back to the default', () => {
  assert.strictEqual(clampReadyTimeoutMs(-5, DEFAULT_MS, MIN_MS), DEFAULT_MS);
});

test('non-numeric strings fall back to the default', () => {
  assert.strictEqual(clampReadyTimeoutMs('abc', DEFAULT_MS, MIN_MS), DEFAULT_MS);
});

test('null, undefined and NaN fall back to the default', () => {
  assert.strictEqual(clampReadyTimeoutMs(null, DEFAULT_MS, MIN_MS), DEFAULT_MS);
  assert.strictEqual(clampReadyTimeoutMs(undefined, DEFAULT_MS, MIN_MS), DEFAULT_MS);
  assert.strictEqual(clampReadyTimeoutMs(NaN, DEFAULT_MS, MIN_MS), DEFAULT_MS);
});

test('pollUntilReady resolves true once isReady returns true', async () => {
  let calls = 0;
  const ready = await pollUntilReady({
    isReady: async () => ++calls >= 3,
    timeoutMs: 1000,
    intervalMs: 5
  });
  assert.strictEqual(ready, true);
  assert.ok(calls >= 3, `expected at least 3 calls, got ${calls}`);
});

test('pollUntilReady returns false when aborted', async () => {
  let calls = 0;
  const ready = await pollUntilReady({
    isReady: async () => false,
    isAborted: () => ++calls >= 2,
    timeoutMs: 1000,
    intervalMs: 5
  });
  assert.strictEqual(ready, false);
});

test('pollUntilReady returns false on timeout', async () => {
  const start = Date.now();
  const ready = await pollUntilReady({
    isReady: async () => false,
    timeoutMs: 80,
    intervalMs: 10
  });
  assert.strictEqual(ready, false);
  assert.ok(Date.now() - start >= 80);
});

test('pollUntilReady checks abort before polling', async () => {
  let pollCalls = 0;
  const ready = await pollUntilReady({
    isReady: async () => {
      pollCalls++;
      return false;
    },
    isAborted: () => true,
    timeoutMs: 1000,
    intervalMs: 5
  });
  assert.strictEqual(ready, false);
  assert.strictEqual(pollCalls, 0);
});

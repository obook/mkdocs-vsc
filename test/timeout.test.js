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
const { clampReadyTimeoutMs } = require('../src/timeout');

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

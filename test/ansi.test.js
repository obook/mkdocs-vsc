/*
 * ansi.test.js
 * Unit tests for the pure ANSI-stripping helper.
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
const { stripAnsi } = require('../src/ansi');

/* ESC built at runtime so this source file stays plain ASCII. */
const ESC = String.fromCharCode(27);

test('strips a single SGR colour code pair', () => {
  assert.strictEqual(
    stripAnsi(`${ESC}[36mpyodide-mkdocs-theme${ESC}[0m`),
    'pyodide-mkdocs-theme'
  );
});

test('strips a multi-parameter SGR code', () => {
  assert.strictEqual(
    stripAnsi(`${ESC}[3;33m[on_post_build]${ESC}[0m`),
    '[on_post_build]'
  );
});

test('strips a full coloured mkdocs INFO line', () => {
  const raw = `INFO    -  ${ESC}[36mpyodide-mkdocs-theme${ESC}[0m: ${ESC}[3;33m[on_env done]${ESC}[0m`;
  assert.strictEqual(
    stripAnsi(raw),
    'INFO    -  pyodide-mkdocs-theme: [on_env done]'
  );
});

test('leaves plain text untouched', () => {
  assert.strictEqual(stripAnsi('INFO - Building documentation...'), 'INFO - Building documentation...');
});

test('does not touch bracketed text without an escape', () => {
  assert.strictEqual(stripAnsi('[on_post_build] not an escape'), '[on_post_build] not an escape');
});

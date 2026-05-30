/*
 * spawn.test.js
 * Unit tests for the pure shell-mode decision helper.
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
const { shouldUseShell } = require('../src/spawn');

test('Windows: a bare command name requires shell mode', () => {
  assert.strictEqual(shouldUseShell('mkdocs', 'win32'), true);
});

test('Windows: a Windows-style absolute path skips shell mode', () => {
  assert.strictEqual(
    shouldUseShell('C:\\Users\\me\\.venv\\Scripts\\mkdocs.exe', 'win32'),
    false
  );
});

test('Windows: a forward-slash path skips shell mode', () => {
  assert.strictEqual(
    shouldUseShell('C:/Users/me/.venv/Scripts/mkdocs.exe', 'win32'),
    false
  );
});

test('Windows: a relative path also skips shell mode', () => {
  assert.strictEqual(shouldUseShell('.venv\\Scripts\\mkdocs.exe', 'win32'), false);
});

test('Linux: a bare command never needs shell mode', () => {
  assert.strictEqual(shouldUseShell('mkdocs', 'linux'), false);
});

test('Linux: a path also skips shell mode', () => {
  assert.strictEqual(shouldUseShell('/usr/local/bin/mkdocs', 'linux'), false);
});

test('macOS: a bare command never needs shell mode', () => {
  assert.strictEqual(shouldUseShell('mkdocs', 'darwin'), false);
});

test('macOS: a path also skips shell mode', () => {
  assert.strictEqual(shouldUseShell('/opt/homebrew/bin/mkdocs', 'darwin'), false);
});

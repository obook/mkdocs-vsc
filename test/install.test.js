/*
 * install.test.js
 * Unit tests for the pure install-command builder.
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
const { buildInstallCommand } = require('../src/install');

test('Linux: installs mkdocs in a venv', () => {
  assert.strictEqual(
    buildInstallCommand(false, 'python3', false),
    'python3 -m venv .venv && .venv/bin/pip install mkdocs'
  );
});

test('Linux: installs from requirements.txt when present', () => {
  assert.strictEqual(
    buildInstallCommand(false, 'python3', true),
    'python3 -m venv .venv && .venv/bin/pip install -r requirements.txt'
  );
});

test('Windows: uses the Scripts path and a semicolon', () => {
  assert.strictEqual(
    buildInstallCommand(true, 'py', false),
    'py -m venv .venv; .venv\\Scripts\\python -m pip install mkdocs'
  );
});

test('falls back to a default Python launcher', () => {
  assert.strictEqual(
    buildInstallCommand(false, null, false),
    'python3 -m venv .venv && .venv/bin/pip install mkdocs'
  );
});

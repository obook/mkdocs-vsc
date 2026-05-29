/*
 * mapping.test.js
 * Unit tests for the pure file-to-page mapping.
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
const { computePagePath } = require('../src/mapping');

test('use_directory_urls false: .md maps to .html', () => {
  assert.strictEqual(
    computePagePath('/proj', 'docs', false, '/proj/docs/section/page.md'),
    'section/page.html'
  );
});

test('use_directory_urls false: index.md maps to index.html', () => {
  assert.strictEqual(
    computePagePath('/proj', 'docs', false, '/proj/docs/index.md'),
    'index.html'
  );
});

test('use_directory_urls true: home index.md maps to the root', () => {
  assert.strictEqual(
    computePagePath('/proj', 'docs', true, '/proj/docs/index.md'),
    ''
  );
});

test('use_directory_urls true: foo.md maps to foo/', () => {
  assert.strictEqual(
    computePagePath('/proj', 'docs', true, '/proj/docs/foo.md'),
    'foo/'
  );
});

test('use_directory_urls true: sub/index.md maps to sub/', () => {
  assert.strictEqual(
    computePagePath('/proj', 'docs', true, '/proj/docs/sub/index.md'),
    'sub/'
  );
});

test('custom docs_dir is honored', () => {
  assert.strictEqual(
    computePagePath('/proj', 'site-src', false, '/proj/site-src/a.md'),
    'a.html'
  );
});

test('non-Markdown file returns null', () => {
  assert.strictEqual(
    computePagePath('/proj', 'docs', false, '/proj/docs/image.png'),
    null
  );
});

test('file outside docs_dir returns null', () => {
  assert.strictEqual(
    computePagePath('/proj', 'docs', false, '/proj/elsewhere/note.md'),
    null
  );
});

/*
 * mkdocsConfig.test.js
 * Unit tests for the pure mkdocs.yml settings parser.
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
const { parseMkdocsConfig } = require('../../src/domain/mkdocsConfig');

test('empty content falls back to the MkDocs defaults', () => {
  assert.deepStrictEqual(parseMkdocsConfig(''), {
    docsDir: 'docs',
    useDirUrls: true
  });
});

test('plain docs_dir is read', () => {
  assert.strictEqual(parseMkdocsConfig('docs_dir: documentation').docsDir,
    'documentation');
});

test('double-quoted docs_dir is unquoted', () => {
  assert.strictEqual(parseMkdocsConfig('docs_dir: "my docs"').docsDir,
    'my docs');
});

test('single-quoted docs_dir is unquoted', () => {
  assert.strictEqual(parseMkdocsConfig("docs_dir: 'src'").docsDir, 'src');
});

test('use_directory_urls false is read', () => {
  assert.strictEqual(parseMkdocsConfig('use_directory_urls: false').useDirUrls,
    false);
});

test('use_directory_urls true is read', () => {
  assert.strictEqual(parseMkdocsConfig('use_directory_urls: true').useDirUrls,
    true);
});

test('a commented docs_dir line is ignored', () => {
  assert.strictEqual(parseMkdocsConfig('# docs_dir: ignored').docsDir, 'docs');
});

test('a lookalike key does not match docs_dir', () => {
  assert.strictEqual(parseMkdocsConfig('extra_docs_dir: nope').docsDir, 'docs');
});

test('a non-boolean use_directory_urls keeps the default', () => {
  assert.strictEqual(parseMkdocsConfig('use_directory_urls: yes').useDirUrls,
    true);
});

test('both settings are read from a realistic file', () => {
  const yaml = [
    'site_name: My Project',
    'docs_dir: content',
    'use_directory_urls: false',
    'theme:',
    '  name: material'
  ].join('\n');
  assert.deepStrictEqual(parseMkdocsConfig(yaml), {
    docsDir: 'content',
    useDirUrls: false
  });
});

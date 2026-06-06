/*
 * webview.test.js
 * Unit tests for the pure webview HTML builder.
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
const { webviewHtml } = require('../../src/ui/webview');

test('CSP frame-src names the given origin', () => {
  const html = webviewHtml('http://127.0.0.1:8989', 'Starting');
  assert.match(html, /frame-src http:\/\/127\.0\.0\.1:8989;/);
});

test('CSP keeps default-src none (nothing loads by default)', () => {
  const html = webviewHtml('http://127.0.0.1:9999', 'Starting');
  assert.match(html, /default-src 'none'/);
});

test('overlay shows the starting text', () => {
  const html = webviewHtml('http://127.0.0.1:9999', 'Demarrage du serveur');
  assert.match(html, /<div id="overlay-text">Demarrage du serveur<\/div>/);
});

test('no src attribute when no initial URL is given', () => {
  const html = webviewHtml('http://127.0.0.1:9999', 'Starting');
  assert.match(html, /<iframe id="frame" title="MkDocs preview">/);
  assert.doesNotMatch(html, /<iframe id="frame" src=/);
});

test('initial URL is baked into the iframe src', () => {
  const html = webviewHtml('http://127.0.0.1:8989', 'Starting', 'http://127.0.0.1:8989/section/page/');
  assert.match(html, /<iframe id="frame" src="http:\/\/127\.0\.0\.1:8989\/section\/page\/" title="MkDocs preview">/);
});

test('double quotes in the URL are percent-encoded so they cannot break the attribute', () => {
  const html = webviewHtml('http://127.0.0.1:8989', 'Starting', 'http://127.0.0.1:8989/a"b/');
  assert.match(html, /src="http:\/\/127\.0\.0\.1:8989\/a%22b\/"/);
  /* A raw closing quote followed by an injected attribute must not appear. */
  assert.doesNotMatch(html, /src="http:\/\/127\.0\.0\.1:8989\/a"b/);
});

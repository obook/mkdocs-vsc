/*
 * preview.js
 * The live preview webview panel.
 *
 * Embeds the local mkdocs server in an iframe (CSP limited to that origin),
 * shows an animated "starting" overlay while the server builds, and keeps the
 * iframe in sync with the active Markdown file. Drives the server module so
 * that the right project is being served.
 *
 * Author: O. Booklage
 * Date: May 2026
 * Licence: MIT
 */

const vscode = require('vscode');
const { getConfig } = require('./config');
const { pagePathForFile } = require('./project');
const server = require('./server');

/** The single reusable preview panel, or null when closed. @type {vscode.WebviewPanel | null} */
let panel = null;
/** External origin of the server (e.g. http://127.0.0.1:9999). */
let externalBase = null;

/**
 * Resolves the external origin of the local server, handling port forwarding
 * on remote setups (Codespaces, SSH).
 *
 * @returns {Promise<string>} The "scheme://authority" origin.
 */
async function ensureExternalBase() {
  const cfg = getConfig();
  const ext = await vscode.env.asExternalUri(
    vscode.Uri.parse(`http://${cfg.get('host')}:${cfg.get('port')}`)
  );
  externalBase = `${ext.scheme}://${ext.authority}`;
  return externalBase;
}

/**
 * Builds the webview HTML: an iframe plus a status overlay with a spinner.
 * The status text uses role="status" so screen readers announce it, and the
 * spinner is marked decorative.
 *
 * @param {string} origin - The server origin allowed by the iframe CSP.
 * @param {string} startingText - Initial overlay message.
 * @returns {string} The HTML document.
 */
function webviewHtml(origin, startingText) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; frame-src ${origin}; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #fff; }
  iframe { width: 100%; height: 100vh; border: 0; background: #fff; }
  #overlay {
    position: fixed; inset: 0; display: flex; flex-direction: column; gap: 14px;
    align-items: center; justify-content: center; padding: 1rem; text-align: center;
    font-family: sans-serif; font-size: 13px; color: #888; background: #fff;
  }
  #overlay .spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid currentColor; border-top-color: transparent;
    opacity: 0.55; animation: mk-spin 0.9s linear infinite;
  }
  @keyframes mk-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    #overlay .spinner { animation-duration: 2.4s; }
  }
</style>
</head>
<body>
<div id="overlay" role="status" aria-live="polite"><div class="spinner" aria-hidden="true"></div><div id="overlay-text">${startingText}</div></div>
<iframe id="frame" title="MkDocs preview"></iframe>
<script>
  const frame = document.getElementById('frame')
  const overlay = document.getElementById('overlay')
  const overlayText = document.getElementById('overlay-text')
  const spinner = overlay.querySelector('.spinner')
  frame.addEventListener('load', () => { if (frame.src) overlay.style.display = 'none' })
  window.addEventListener('message', (event) => {
    const msg = event.data
    if (!msg) return
    if (msg.type === 'navigate' && typeof msg.url === 'string') {
      overlay.style.display = 'none'
      frame.src = msg.url
    } else if (msg.type === 'status' && typeof msg.text === 'string') {
      overlayText.textContent = msg.text
      spinner.style.display = ''
      overlay.style.display = 'flex'
    } else if (msg.type === 'error' && typeof msg.text === 'string') {
      overlayText.textContent = msg.text
      spinner.style.display = 'none'
      overlay.style.display = 'flex'
    }
  })
</script>
</body>
</html>`;
}

/**
 * Navigates the preview to the page of a given Markdown file.
 *
 * @param {string | null} filePath - Absolute path of the source file, or null.
 * @param {boolean} force - When true (initial open), navigate to the site root
 *        even if the file is not a page; otherwise leave the preview as is for
 *        files outside the site.
 */
function navigateTo(filePath, force = false) {
  if (!panel || !externalBase) {
    return;
  }
  const page = filePath ? pagePathForFile(filePath) : null;
  if (page === null && !force) {
    return;
  }
  panel.webview.postMessage({ type: 'navigate', url: `${externalBase}/${page || ''}` });
}

/**
 * Navigates the preview to the page of the active Markdown file.
 *
 * @param {boolean} force - When true (initial open), navigate to the site root
 *        even if the active file is not a page; otherwise leave the preview as
 *        is for files outside the site.
 */
function navigateToActive(force = false) {
  const editor = vscode.window.activeTextEditor;
  navigateTo(editor ? editor.document.uri.fsPath : null, force);
}

/**
 * Opens (or reveals) the preview panel and points it at the active file.
 *
 * @param {boolean} toSide - Open beside the editor rather than in place.
 */
async function openPreview(toSide) {
  /* Capture the source file now: creating the panel below moves the focus to
     the webview, after which `activeTextEditor` no longer points at the open
     Markdown file by the time the (possibly multi-second) server wait ends. */
  const editor = vscode.window.activeTextEditor;
  const sourcePath = editor ? editor.document.uri.fsPath : null;

  if (!(await server.ensure())) {
    return;
  }
  const origin = await ensureExternalBase();

  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      'mkdocsPreview',
      vscode.l10n.t('MkDocs Preview'),
      toSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    panel.onDidDispose(() => {
      panel = null;
    });
    panel.webview.html = webviewHtml(origin, vscode.l10n.t('Starting the MkDocs server…'));
  } else {
    panel.reveal(toSide ? vscode.ViewColumn.Beside : undefined, true);
  }

  /* The initial build takes a few seconds: wait for the server to answer
     before loading the page, otherwise the iframe shows a blank page
     (connection refused) without retrying. */
  panel.webview.postMessage({
    type: 'status',
    text: vscode.l10n.t('Starting the MkDocs server…')
  });
  const ready = await server.waitForReady();
  if (!ready) {
    panel.webview.postMessage({
      type: 'error',
      text: vscode.l10n.t('The MkDocs server is not responding. See the "MkDocs Live Preview" output.')
    });
    return;
  }
  navigateTo(sourcePath, true);
}

/** @returns {boolean} Whether the preview panel is currently open. */
function isOpen() {
  return !!panel;
}

module.exports = { openPreview, navigateToActive, isOpen };

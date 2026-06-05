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
const { pagePathForFile, findProjectRoot } = require('./project');
const server = require('./server');

/** The single reusable preview panel, or null when closed. @type {vscode.WebviewPanel | null} */
let panel = null;
/** External origin of the server (e.g. http://127.0.0.1:9999). */
let externalBase = null;
/** Last source file the preview navigated to (for re-navigation after a restart). */
let lastSourcePath = null;
/* Monotonic counter that lets an async sync detect it has been superseded by a
   later one: each entry into syncToActive/onOriginConfigChanged bumps it, and a
   slow path bails after its awaits when the value has moved on. This prevents a
   stale restart from navigating against a server a newer switch has replaced. */
let syncSeq = 0;

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
 * Posts a "starting" status to the overlay (spinner shown).
 *
 * @param {string} text - The message to display.
 */
function postStatus(text) {
  if (panel) {
    panel.webview.postMessage({ type: 'status', text });
  }
}

/**
 * Posts an error to the overlay (spinner hidden).
 *
 * @param {string} text - The message to display.
 */
function postError(text) {
  if (panel) {
    panel.webview.postMessage({ type: 'error', text });
  }
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
  /* Remember the source so a later origin change can re-show the same page. */
  if (filePath) {
    lastSourcePath = filePath;
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
 * Keeps the preview in sync with the active editor. When the active file
 * belongs to a different MkDocs project than the one currently being served
 * (multi-project workspace), restarts the server for that project before
 * navigating; otherwise just navigates to the active file's page.
 *
 * Without the restart, the iframe would load the new project's URL against the
 * old project's server, yielding a 404 or the wrong page. Files that belong to
 * no project (or to the project already served) take the cheap navigate path,
 * so switching to a scratch file or a sibling page never restarts the server.
 *
 * @returns {Promise<void>}
 */
async function syncToActive() {
  if (!panel) {
    return;
  }
  /* Claim this sync: any later one bumps syncSeq and supersedes us. */
  const seq = ++syncSeq;
  const editor = vscode.window.activeTextEditor;
  const filePath =
    editor && editor.document.uri.scheme === 'file'
      ? editor.document.uri.fsPath
      : null;
  const root = filePath ? findProjectRoot(filePath) : undefined;

  /* Same project (or no project): the running server still applies. */
  if (!root || root === server.currentRoot()) {
    navigateToActive();
    return;
  }

  /* Different project: re-serve that exact root before navigating. We pass the
     computed root to ensure() rather than letting it re-read the active editor,
     which may have moved on across the awaits below. */
  postStatus(vscode.l10n.t('Starting the MkDocs server…'));
  if (!(await server.ensure(root)) || !(await server.waitForReady())) {
    /* ensure()/waitForReady() already surfaced the failure (warning dialog or
       the output channel); leave the overlay showing the last status. */
    return;
  }
  /* A newer switch started while we were waiting: it owns the navigation now. */
  if (seq !== syncSeq) {
    return;
  }
  navigateTo(filePath, true);
}

/**
 * Reacts to a change of the `host`/`port` settings: restarts the running
 * server so it rebinds to the new address, then re-points the open preview at
 * the recomputed origin. `externalBase` is cached when the preview opens, so
 * without this the preview keeps navigating to the old origin (and the server
 * keeps listening on the old port) until it is reopened.
 *
 * @returns {Promise<void>}
 */
async function onOriginConfigChanged() {
  /* Claim this restart so a concurrent project switch can supersede it. */
  const seq = ++syncSeq;
  /* Keep serving the same project across the rebind: the active editor may be
     the Settings UI rather than a project file when this fires, so pin the
     root captured before the restart instead of re-reading the editor. */
  if (server.isRunning()) {
    const root = server.currentRoot();
    await server.restart(root);
    if (seq !== syncSeq) {
      return;
    }
  }
  if (!panel) {
    return;
  }
  /* Rebuild the webview with the new origin BEFORE navigating: the CSP
     frame-src baked into the existing HTML still names the old origin, so
     navigating the current iframe to the new host/port is blocked by the
     browser. Resetting the HTML (as on a fresh open) also clears the dead
     old-origin page and its failing livereload poll. */
  const origin = await ensureExternalBase();
  panel.webview.html = webviewHtml(origin, vscode.l10n.t('Starting the MkDocs server…'));
  if (server.isRunning()) {
    if (!(await server.waitForReady())) {
      /* Only surface the failure for the live restart; a superseded one stays
         silent so a later, successful switch owns the overlay. */
      if (seq === syncSeq) {
        postError(vscode.l10n.t('The MkDocs server is not responding. See the "MkDocs Live Preview" output.'));
      }
      return;
    }
    if (seq !== syncSeq) {
      return;
    }
  }
  /* Re-show the page the user was on, not the active editor (likely the
     Settings UI), which would force a jump to the site root. */
  navigateTo(lastSourcePath, true);
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
  postStatus(vscode.l10n.t('Starting the MkDocs server…'));
  const ready = await server.waitForReady();
  if (!ready) {
    postError(vscode.l10n.t('The MkDocs server is not responding. See the "MkDocs Live Preview" output.'));
    return;
  }
  navigateTo(sourcePath, true);
}

/** @returns {boolean} Whether the preview panel is currently open. */
function isOpen() {
  return !!panel;
}

module.exports = { openPreview, navigateToActive, syncToActive, onOriginConfigChanged, isOpen };

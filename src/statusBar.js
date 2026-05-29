/*
 * statusBar.js
 * Status bar item reflecting the server state.
 *
 * Shows whether the MkDocs server is running and opens the preview when
 * clicked. Reads the running state from the server module; the server module
 * calls update() through a state-change listener.
 *
 * Author: O. Booklage
 * Date: May 2026
 * Licence: MIT
 */

const vscode = require('vscode');
const server = require('./server');

/** The status bar item, or null before init. @type {vscode.StatusBarItem} */
let item = null;

/**
 * Creates the status bar item and registers it on the context.
 *
 * @param {vscode.ExtensionContext} context - The extension context.
 */
function init(context) {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = 'mkdocsLivePreview.openPreviewToSide';
  context.subscriptions.push(item);
  update();
}

/** Refreshes the label and tooltip from the current server state. */
function update() {
  if (!item) {
    return;
  }
  const running = server.isRunning();
  item.text = `$(book) ${running ? vscode.l10n.t('MkDocs: running') : vscode.l10n.t('MkDocs: stopped')}`;
  item.tooltip = running
    ? vscode.l10n.t('MkDocs server running - click to open the preview')
    : vscode.l10n.t('MkDocs server stopped - click to start it and open the preview');
  item.show();
}

module.exports = { init, update };

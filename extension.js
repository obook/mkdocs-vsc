/*
 * extension.js
 * Entry point of the MkDocs Live Preview extension.
 *
 * Pure-JavaScript VS Code extension (no build, no runtime dependencies). This
 * file only wires things together: it initializes the server, status bar and
 * preview modules, registers the commands, and listens for editor and
 * workspace changes. All logic lives under ./src.
 *
 *   extension.js
 *     |- src/config.js     settings access
 *     |- src/project.js    mkdocs.yml discovery, file-to-page mapping
 *     |- src/preflight.js  Python / MkDocs checks
 *     |- src/server.js     `mkdocs serve` lifecycle
 *     |- src/statusBar.js  status bar item
 *     |- src/preview.js    webview preview panel
 *
 * Author: O. Booklage
 * Date: May 2026
 * Licence: MIT
 */

const vscode = require('vscode');
const server = require('./src/server');
const statusBar = require('./src/statusBar');
const preview = require('./src/preview');
const { getConfig } = require('./src/config');

/**
 * Activates the extension: initializes modules, registers commands and
 * listeners.
 *
 * @param {vscode.ExtensionContext} context - The extension context.
 */
function activate(context) {
  server.init(context);
  statusBar.init(context);
  server.setStateListener(statusBar.update);

  context.subscriptions.push(
    vscode.commands.registerCommand('mkdocsLivePreview.openPreviewToSide', () => preview.openPreview(true)),
    vscode.commands.registerCommand('mkdocsLivePreview.openPreview', () => preview.openPreview(false)),
    vscode.commands.registerCommand('mkdocsLivePreview.startServer', () => server.start()),
    vscode.commands.registerCommand('mkdocsLivePreview.stopServer', () => server.stop()),
    vscode.commands.registerCommand('mkdocsLivePreview.restartServer', () => server.restart()),
    vscode.window.onDidChangeActiveTextEditor(() => {
      if (getConfig().get('autoSync')) {
        preview.navigateToActive();
      }
    }),
    /* Project change (folder added or removed): re-serve the right project for
       the open preview, if any. */
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      if (preview.isOpen() && (await server.ensure()) && (await server.waitForReady())) {
        preview.navigateToActive(true);
      }
    })
  );
}

/** Deactivates the extension: stops the server. */
function deactivate() {
  server.stop();
}

module.exports = { activate, deactivate };

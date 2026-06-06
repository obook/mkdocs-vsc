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
const server = require('./src/server/server');
const statusBar = require('./src/ui/statusBar');
const preview = require('./src/ui/preview');
const { getConfig, SECTION } = require('./src/config/config');

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
        /* syncToActive re-serves the right project first when the active file
           belongs to a different one than the server is currently serving.
           Fire-and-forget: swallow its promise so a failed sync never raises
           an unhandled rejection in the extension host. */
        preview.syncToActive().catch(() => {});
      }
    }),
    /* Project change (folder added or removed): re-serve the right project for
       the open preview, if any. */
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      if (preview.isOpen() && (await server.ensure()) && (await server.waitForReady())) {
        preview.navigateToActive(true);
      }
    }),
    /* Host/port change: the cached origin and the running server's bound port
       both go stale, so restart the server and re-point the preview. */
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration(`${SECTION}.host`) ||
        event.affectsConfiguration(`${SECTION}.port`)
      ) {
        preview.onOriginConfigChanged().catch(() => {});
      }
    })
  );
}

/** Deactivates the extension: stops the server. */
function deactivate() {
  server.stop();
}

module.exports = { activate, deactivate };

/*
 * config.js
 * Access to the extension's configuration section.
 *
 * Thin wrapper around the VS Code settings namespace, so every module reads
 * the "mkdocsLivePreview.*" settings through a single helper.
 *
 * Author: O. Booklage
 * Date: May 2026
 * Licence: MIT
 */

const vscode = require('vscode');

/** Configuration section that holds every setting of this extension. */
const SECTION = 'mkdocsLivePreview';

/**
 * Returns the extension's configuration object.
 *
 * @returns {vscode.WorkspaceConfiguration} The "mkdocsLivePreview" settings.
 */
function getConfig() {
  return vscode.workspace.getConfiguration(SECTION);
}

module.exports = { getConfig, SECTION };

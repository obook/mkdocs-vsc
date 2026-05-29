/*
 * project.js
 * MkDocs project discovery and file-to-page mapping.
 *
 * Locates the mkdocs.yml that governs the active file, resolves the mkdocs
 * executable to run, and maps a Markdown file to the URL path of its built
 * page. Pure helpers with no process or UI side effects; consumed by the
 * server and preview modules.
 *
 * Author: O. Booklage
 * Date: May 2026
 * Licence: MIT
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { getConfig } = require('./config');
const { computePagePath } = require('./mapping');

/** Maximum number of parent folders to climb when looking for mkdocs.yml. */
const MAX_CLIMB = 12;

/**
 * Finds the MkDocs project root: the nearest folder containing the config
 * file, searched first by climbing from the active file, then from each
 * workspace folder. Handles opening a parent folder or a sub-folder.
 *
 * @returns {string | undefined} The project root, or undefined if none found.
 */
function findProjectRoot() {
  const configFile = getConfig().get('configFile');

  /* Climb from `start` up to MAX_CLIMB parents looking for the config file. */
  function climb(start) {
    let dir = start;
    for (let i = 0; i < MAX_CLIMB && dir; i++) {
      if (fs.existsSync(path.join(dir, configFile))) {
        return dir;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
    return undefined;
  }

  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.uri.scheme === 'file') {
    const fromFile = climb(path.dirname(editor.document.uri.fsPath));
    if (fromFile) {
      return fromFile;
    }
  }
  for (const folder of vscode.workspace.workspaceFolders || []) {
    const fromFolder = climb(folder.uri.fsPath);
    if (fromFolder) {
      return fromFolder;
    }
  }
  return undefined;
}

/**
 * Resolves the mkdocs executable: explicit setting, then the project .venv,
 * then "mkdocs" on the PATH.
 *
 * @param {string} root - The project root.
 * @returns {string} The command or path used to run mkdocs.
 */
function resolveMkdocsCmd(root) {
  const explicit = getConfig().get('mkdocsPath');
  if (explicit) {
    return explicit;
  }
  const isWin = process.platform === 'win32';
  const venvBin = isWin
    ? path.join(root, '.venv', 'Scripts', 'mkdocs.exe')
    : path.join(root, '.venv', 'bin', 'mkdocs');
  return fs.existsSync(venvBin) ? venvBin : 'mkdocs';
}

/**
 * Reads docs_dir and use_directory_urls from mkdocs.yml with light parsing.
 *
 * @param {string} root - The project root.
 * @returns {{ docsDir: string, useDirUrls: boolean }} The two settings, with
 *          the MkDocs defaults when the file cannot be read.
 */
/** Cache of the parsed mkdocs.yml, keyed by file path and modification time. */
let configCache = { file: null, mtimeMs: 0, value: null };

function readMkdocsConfig(root) {
  const file = path.join(root, getConfig().get('configFile'));
  let docsDir = 'docs';
  let useDirUrls = true; /* MkDocs default. */
  try {
    /* This runs on every editor change, so re-parse only when the file
       actually changed. */
    const mtimeMs = fs.statSync(file).mtimeMs;
    if (configCache.file === file && configCache.mtimeMs === mtimeMs) {
      return configCache.value;
    }
    const text = fs.readFileSync(file, 'utf8');
    const docsMatch = text.match(/^\s*docs_dir\s*:\s*(.+?)\s*$/m);
    if (docsMatch) {
      docsDir = docsMatch[1].replace(/['"]/g, '').trim();
    }
    const urlsMatch = text.match(/^\s*use_directory_urls\s*:\s*(true|false)\s*$/m);
    if (urlsMatch) {
      useDirUrls = urlsMatch[1] === 'true';
    }
    configCache = { file, mtimeMs, value: { docsDir, useDirUrls } };
    return configCache.value;
  } catch {
    /* No readable mkdocs.yml: keep the defaults. */
    return { docsDir, useDirUrls };
  }
}

/**
 * Maps a Markdown file to the URL path of its built page (relative to the
 * site root).
 *
 * @param {string} filePath - Absolute path of the file.
 * @returns {string | null} The page path, "" for the home page, or null when
 *          the file is not Markdown under docs_dir.
 */
function pagePathForFile(filePath) {
  const root = findProjectRoot();
  if (!root) {
    return null;
  }
  const { docsDir, useDirUrls } = readMkdocsConfig(root);
  return computePagePath(root, docsDir, useDirUrls, filePath);
}

module.exports = {
  findProjectRoot,
  resolveMkdocsCmd,
  readMkdocsConfig,
  pagePathForFile
};

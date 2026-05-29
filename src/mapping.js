/*
 * mapping.js
 * Pure file-to-page mapping for MkDocs (no VS Code dependency).
 *
 * Isolates the URL-path computation so it can be unit-tested without the VS
 * Code API. Consumed by project.js, which supplies the project root and the
 * mkdocs.yml settings.
 *
 * Author: O. Booklage
 * Date: May 2026
 * Licence: MIT
 */

const path = require('path');

/** Markdown file extensions recognized by MkDocs. */
const MD_EXT = /\.(md|markdown)$/i;

/**
 * Maps a Markdown file to the URL path of its built page, relative to the
 * site root. Pure: depends only on `path`.
 *
 * @param {string} root - The project root.
 * @param {string} docsDir - The docs directory (from mkdocs.yml).
 * @param {boolean} useDirUrls - The use_directory_urls setting.
 * @param {string} filePath - Absolute path of the file.
 * @returns {string | null} The page path, "" for the home page, or null when
 *          the file is not Markdown under docs_dir.
 */
function computePagePath(root, docsDir, useDirUrls, filePath) {
  if (!MD_EXT.test(filePath)) {
    return null;
  }
  const docsAbs = path.resolve(root, docsDir);
  const rel = path.relative(docsAbs, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null; /* Outside docs/. */
  }

  const posix = rel.split(path.sep).join('/');
  if (!useDirUrls) {
    return posix.replace(MD_EXT, '.html');
  }
  /* use_directory_urls: true -> index.md is the folder root, foo.md -> foo/. */
  const noExt = posix.replace(MD_EXT, '');
  if (noExt === 'index') {
    return '';
  }
  if (noExt.endsWith('/index')) {
    return noExt.slice(0, -'/index'.length) + '/';
  }
  return noExt + '/';
}

module.exports = { computePagePath };

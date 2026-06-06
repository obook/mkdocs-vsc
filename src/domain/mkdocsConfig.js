/*
 * mkdocsConfig.js
 * Pure parsing of mkdocs.yml settings (no VS Code, no file system).
 *
 * Isolates the light YAML parsing so it can be unit-tested without reading a
 * file or loading the VS Code API. Consumed by project.js, which reads the
 * file and passes its text here.
 *
 * Author: O. Booklage
 * Date: June 2026
 * Licence: MIT
 */

/**
 * Extracts docs_dir and use_directory_urls from mkdocs.yml content with light,
 * bounded regular expressions. Pure: depends only on the input string. Falls
 * back to the MkDocs defaults for any setting that is absent or malformed.
 *
 * @param {string} text - The raw mkdocs.yml content.
 * @returns {{ docsDir: string, useDirUrls: boolean }} The two settings.
 */
function parseMkdocsConfig(text) {
  let docsDir = 'docs';
  let useDirUrls = true; /* MkDocs default. */

  const docsMatch = text.match(/^\s*docs_dir\s*:\s*(.+?)\s*$/m);
  if (docsMatch) {
    docsDir = docsMatch[1].replace(/['"]/g, '').trim();
  }
  const urlsMatch = text.match(/^\s*use_directory_urls\s*:\s*(true|false)\s*$/m);
  if (urlsMatch) {
    useDirUrls = urlsMatch[1] === 'true';
  }
  return { docsDir, useDirUrls };
}

module.exports = { parseMkdocsConfig };

/*
 * ansi.js
 * Strip ANSI escape sequences from text.
 *
 * The output channel is a plain OutputChannel, which renders text verbatim and
 * does not interpret ANSI colour codes. Some MkDocs plugins (e.g.
 * pyodide-mkdocs-theme) emit coloured log lines even when stdout is not a TTY,
 * so their CSI sequences would show up as literal "[36m...[0m" noise. This pure
 * helper removes them before the server module appends mkdocs output. No VS
 * Code dependency, so it is unit-tested with the built-in Node test runner.
 *
 * Author: O. Booklage
 * Date: May 2026
 * Licence: MIT
 */

/* Matches a CSI escape sequence: ESC '[', optional parameter bytes (0x30-0x3F),
   optional intermediate bytes (0x20-0x2F), then a final byte (0x40-0x7E). This
   covers the SGR colour codes mkdocs plugins emit ("ESC[36m", "ESC[0m",
   "ESC[3;33m") and cursor-movement sequences. The ESC (char code 27) is built
   with String.fromCharCode so the source file stays plain ASCII. */
const CSI_PATTERN = new RegExp(String.fromCharCode(27) + '\\[[0-?]*[ -/]*[@-~]', 'g');

/**
 * Removes ANSI/CSI escape sequences from a string.
 *
 * @param {string} text - The raw text, possibly containing escape sequences.
 * @returns {string} The text with every CSI sequence removed.
 */
function stripAnsi(text) {
  return text.replace(CSI_PATTERN, '');
}

module.exports = { stripAnsi };

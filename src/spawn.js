/*
 * spawn.js
 * Pure helpers for spawning child processes.
 *
 * Kept in its own module (no VS Code dependency) so it can be unit-tested
 * with the built-in Node test runner.
 *
 * Author: O. Booklage
 * Date: May 2026
 * Licence: MIT
 */

/**
 * Decides whether `cp.spawn` should run a command through a shell.
 *
 * On Windows, a bare command name (e.g. `mkdocs`, `py`) is resolved against
 * the `PATH` only when run through a shell, because Node will not apply
 * `PATHEXT` (.cmd, .exe, .bat) when spawning directly. A command that already
 * includes a path separator points at a precise file and is spawned without a
 * shell. On Linux and macOS, the kernel resolves bare names against `PATH`
 * natively, so a shell is never needed.
 *
 * @param {string} cmd - The command or path used to run the binary.
 * @param {string} platform - The value of `process.platform`.
 * @returns {boolean} True when shell mode is required.
 */
function shouldUseShell(cmd, platform) {
  if (platform !== 'win32') {
    return false;
  }
  const hasSeparator = cmd.includes('/') || cmd.includes('\\');
  return !hasSeparator;
}

module.exports = { shouldUseShell };

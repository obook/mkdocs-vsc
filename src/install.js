/*
 * install.js
 * Pure builder for the MkDocs install command (no VS Code dependency).
 *
 * Isolates the OS-specific shell command suggested by the preflight checks so
 * it can be unit-tested without the VS Code API or the filesystem. Consumed by
 * preflight.js.
 *
 * Author: O. Booklage
 * Date: May 2026
 * Licence: MIT
 */

/**
 * Builds a ready-to-paste command that creates a venv and installs MkDocs.
 *
 * @param {boolean} isWin - Whether the platform is Windows.
 * @param {string} python - The Python launcher (e.g. "python3", "py").
 * @param {boolean} hasRequirements - Whether a requirements.txt exists.
 * @returns {string} The shell command.
 */
function buildInstallCommand(isWin, python, hasRequirements) {
  const py = python || (isWin ? 'py' : 'python3');
  const pkg = hasRequirements ? '-r requirements.txt' : 'mkdocs';
  return isWin
    ? `${py} -m venv .venv; .venv\\Scripts\\python -m pip install ${pkg}`
    : `${py} -m venv .venv && .venv/bin/pip install ${pkg}`;
}

module.exports = { buildInstallCommand };

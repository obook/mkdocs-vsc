/*
 * preflight.js
 * Environment checks for Python and MkDocs (Windows, Linux, macOS).
 *
 * Before the server starts, verifies that the mkdocs executable - or, failing
 * that, Python - can run, and shows clear, OS-aware guidance when something is
 * missing. Consumed by the server module.
 *
 * Author: O. Booklage
 * Date: May 2026
 * Licence: MIT
 */

const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const { resolveMkdocsCmd } = require('./project');
const { buildInstallCommand } = require('./install');
const { shouldUseShell } = require('./spawn');

/** Time (ms) after which a probe command is assumed to have started. */
const PROBE_TIMEOUT_MS = 4000;

/**
 * Tells whether a command can be executed (false on ENOENT / not found).
 *
 * Picks shell mode through `shouldUseShell` so the probe and the real spawn
 * agree on whether to invoke the shell. A mismatch here is what made an
 * earlier version of the extension pass the preflight on Windows and then
 * fail with ENOENT at the real spawn when no `.venv` was available.
 *
 * @param {string} cmd - The command or path to run.
 * @param {string[]} args - Arguments passed to the command.
 * @returns {Promise<boolean>} True if the command could be spawned.
 */
function canRun(cmd, args) {
  return new Promise((resolve) => {
    let done = false;
    function finish(value) {
      if (!done) {
        done = true;
        resolve(value);
      }
    }
    try {
      const child = cp.spawn(cmd, args, {
        stdio: 'ignore',
        shell: shouldUseShell(cmd, process.platform)
      });
      child.on('error', () => finish(false)); /* Binary not found. */
      /* Under `shell: true` on Windows, cmd.exe always spawns successfully
         even when the requested command is missing; only the exit code (1)
         signals that. We therefore consider the probe successful only when
         the process exits with code 0. */
      child.on('exit', (code) => finish(code === 0));
      setTimeout(() => {
        try {
          child.kill();
        } catch {
          /* Ignore: the child may already be gone. */
        }
        /* Probe hit the timeout: the binary is long-running but does exist
           (we successfully spawned it). Treat as found. */
        finish(true);
      }, PROBE_TIMEOUT_MS);
    } catch {
      finish(false);
    }
  });
}

/**
 * Builds a ready-to-paste command that creates the venv and installs MkDocs,
 * tailored to the operating system.
 *
 * @param {string} root - The project root.
 * @param {string} python - The Python launcher to use (e.g. "python3", "py").
 * @returns {string} The shell command.
 */
function suggestedInstallCommand(root, python) {
  const isWin = process.platform === 'win32';
  const hasRequirements = fs.existsSync(path.join(root, 'requirements.txt'));
  return buildInstallCommand(isWin, python, hasRequirements);
}

/**
 * Checks that MkDocs (and, failing that, Python) is available before starting
 * the server. Shows an actionable, OS-aware message and returns ok: false when
 * something is missing.
 *
 * @param {string} root - The project root.
 * @returns {Promise<{ ok: boolean }>} Whether the environment is ready.
 */
async function preflight(root) {
  const isWin = process.platform === 'win32';
  const cmd = resolveMkdocsCmd(root);
  if (await canRun(cmd, ['--version'])) {
    return { ok: true };
  }

  /* MkDocs not found: is Python available? */
  const pythonCandidates = isWin ? ['py', 'python', 'python3'] : ['python3', 'python'];
  let python = null;
  for (const candidate of pythonCandidates) {
    if (await canRun(candidate, ['--version'])) {
      python = candidate;
      break;
    }
  }

  if (!python) {
    let hint;
    if (isWin) {
      hint = vscode.l10n.t('Install Python from https://www.python.org/downloads/ (or run "winget install Python.Python.3").');
    } else if (process.platform === 'darwin') {
      hint = vscode.l10n.t('Install Python with "brew install python", or from https://www.python.org/downloads/.');
    } else {
      hint = vscode.l10n.t('Install Python with your package manager, e.g. "sudo apt install python3 python3-venv".');
    }
    const guide = vscode.l10n.t('Installation guide');
    const choice = await vscode.window.showErrorMessage(
      vscode.l10n.t('Python 3 was not found, but MkDocs needs it. {0}', hint),
      guide
    );
    if (choice === guide) {
      vscode.env.openExternal(vscode.Uri.parse('https://www.python.org/downloads/'));
    }
    return { ok: false };
  }

  /* Python present but MkDocs missing: offer an install command. */
  const installCmd = suggestedInstallCommand(root, python);
  const copy = vscode.l10n.t('Copy install command');
  const guide = vscode.l10n.t('Installation guide');
  const choice = await vscode.window.showErrorMessage(
    vscode.l10n.t('MkDocs was not found. Install it in a virtual environment, then try again.'),
    copy,
    guide
  );
  if (choice === copy) {
    await vscode.env.clipboard.writeText(installCmd);
    vscode.window.showInformationMessage(vscode.l10n.t('Install command copied to the clipboard.'));
  } else if (choice === guide) {
    vscode.env.openExternal(vscode.Uri.parse('https://www.mkdocs.org/user-guide/installation/'));
  }
  return { ok: false };
}

module.exports = { preflight };

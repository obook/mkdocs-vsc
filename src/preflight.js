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

/** Time (ms) after which a probe command is assumed to have started. */
const PROBE_TIMEOUT_MS = 4000;

/**
 * Tells whether a command can be executed (false on ENOENT / not found).
 *
 * @param {string} cmd - The command or path to run.
 * @param {string[]} args - Arguments passed to the command.
 * @param {boolean} useShell - Run through a shell (needed for PATH lookups of
 *        .cmd/.bat on Windows).
 * @returns {Promise<boolean>} True if the command could be spawned.
 */
function canRun(cmd, args, useShell) {
  return new Promise((resolve) => {
    let done = false;
    function finish(value) {
      if (!done) {
        done = true;
        resolve(value);
      }
    }
    try {
      const child = cp.spawn(cmd, args, { stdio: 'ignore', shell: !!useShell });
      child.on('error', () => finish(false)); /* Binary not found. */
      child.on('exit', () => finish(true)); /* Ran, whatever the exit code. */
      setTimeout(() => {
        try {
          child.kill();
        } catch {
          /* Ignore: the child may already be gone. */
        }
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
  /* A path (venv or explicit setting) is probed without a shell; a PATH
     command sometimes needs the shell on Windows (.cmd/.bat). */
  const cmdIsPath = cmd.includes('/') || cmd.includes('\\');
  if (await canRun(cmd, ['--version'], cmdIsPath ? false : isWin)) {
    return { ok: true };
  }

  /* MkDocs not found: is Python available? */
  const pythonCandidates = isWin ? ['py', 'python', 'python3'] : ['python3', 'python'];
  let python = null;
  for (const candidate of pythonCandidates) {
    if (await canRun(candidate, ['--version'], isWin)) {
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

/*
 * server.js
 * Lifecycle of the `mkdocs serve` development server.
 *
 * Owns the child process and the project it was started for, restarts it when
 * the active project changes, and refuses to silently reuse a foreign server
 * already on the port. Logs to a dedicated output channel. Consumed by the
 * preview module and by the command handlers in extension.js.
 *
 * Author: O. Booklage
 * Date: May 2026
 * Licence: MIT
 */

const vscode = require('vscode');
const cp = require('child_process');
const { getConfig } = require('../config/config');
const { findProjectRoot, resolveMkdocsCmd } = require('../domain/project');
const { preflight } = require('./preflight');
const { shouldUseShell } = require('../util/spawn');
const { stripAnsi } = require('../util/ansi');
const readiness = require('./readiness');

/** Running server process, or null when stopped. @type {import('child_process').ChildProcess | null} */
let serverProc = null;
/** Project root the running server was started for, or null. */
let serverRoot = null;
/** Output channel for the server logs. @type {vscode.OutputChannel} */
let output = null;
/** Listener invoked whenever the running state changes. */
let onStateChange = () => {};

/** How long (ms) to wait for a killed process to report its exit. */
const STOP_TIMEOUT_MS = 3000;

/**
 * Initializes the module by creating the output channel.
 *
 * @param {vscode.ExtensionContext} context - The extension context.
 */
function init(context) {
  output = vscode.window.createOutputChannel('MkDocs Live Preview');
  context.subscriptions.push(output);
}

/**
 * Registers a callback invoked whenever the server starts or stops.
 *
 * @param {() => void} listener - The state-change listener.
 */
function setStateListener(listener) {
  onStateChange = listener;
}

/** @returns {boolean} Whether a server is currently running. */
function isRunning() {
  return !!serverProc;
}

/** @returns {string | null} The project root the running server serves, or null. */
function currentRoot() {
  return serverRoot;
}

/**
 * Starts `mkdocs serve` for a project, if not already running.
 *
 * @param {string} [rootOverride] - Project root to serve. Defaults to the
 *        project of the active file. Pass it explicitly when the active editor
 *        cannot be trusted (e.g. a settings-change restart, where the focus is
 *        on the Settings UI rather than on a project file).
 */
function start(rootOverride) {
  const root = rootOverride || findProjectRoot();
  if (!root) {
    vscode.window.showErrorMessage(
      vscode.l10n.t(
        'MkDocs Live Preview: no {0} found (neither in the open folder nor above the active file).',
        getConfig().get('configFile')
      )
    );
    return;
  }
  if (serverProc) {
    output.appendLine('Server already running.');
    return;
  }
  const cfg = getConfig();
  const host = cfg.get('host');
  const port = cfg.get('port');
  const configFile = cfg.get('configFile');
  const extraArgs = cfg.get('serveArgs') || [];
  const cmd = resolveMkdocsCmd(root);
  const args = ['serve', '-a', `${host}:${port}`, '-f', configFile, ...extraArgs];

  output.show(true);
  output.appendLine(`$ ${cmd} ${args.join(' ')}   (cwd=${root})`);
  /* PYTHONUNBUFFERED=1 disables Python's stdout buffering so MkDocs' INFO lines
     reach our output channel in real time, instead of arriving in a single
     burst at the end of a slow build (very visible on Windows).
     `shell: true` on Windows for bare command names lets the shell resolve
     `mkdocs` against PATHEXT (mkdocs.cmd / mkdocs.exe); without it, Node
     spawns the literal name and fails with ENOENT when no `.venv` exists. */
  const proc = cp.spawn(cmd, args, {
    cwd: root,
    env: { ...process.env, NO_MKDOCS_2_WARNING: '1', PYTHONUNBUFFERED: '1' },
    shell: shouldUseShell(cmd, process.platform)
  });
  serverProc = proc;
  serverRoot = root;
  /* mkdocs (and some plugins) colour their logs with ANSI escapes even off a
     TTY; strip them so the plain OutputChannel does not show "[36m..." noise. */
  proc.stdout.on('data', (data) => output.append(stripAnsi(data.toString())));
  proc.stderr.on('data', (data) => {
    const text = stripAnsi(data.toString());
    output.append(text);
    if (/address already in use|errno 98/i.test(text)) {
      vscode.window.showErrorMessage(
        vscode.l10n.t(
          'MkDocs: port {0} is already in use. Stop the other server or change "mkdocsLivePreview.port".',
          port
        )
      );
    }
  });
  proc.on('exit', (code) => {
    output.appendLine(`\n[mkdocs serve exited: code ${code}]`);
    /* Ignore the exit of a process we have already replaced. */
    if (serverProc === proc) {
      serverProc = null;
      serverRoot = null;
      onStateChange();
    }
  });
  proc.on('error', (err) => {
    /* ENOENT here means the spawn itself failed (e.g. mkdocs disappeared
       between the preflight probe and the start, or the .venv binary is no
       longer executable). The preflight has already filtered out the simple
       "not installed" case, so we keep the message short and point to the
       output channel where the raw stderr is visible. */
    const detail = err.code === 'ENOENT'
      ? vscode.l10n.t('Could not start mkdocs in this folder. Check that it is installed in the project .venv or available on the PATH, then try again.')
      : vscode.l10n.t('Could not start mkdocs: {0}.', err.message);
    const openOutput = vscode.l10n.t('Open output');
    vscode.window.showErrorMessage(detail, openOutput).then((choice) => {
      if (choice === openOutput) {
        output.show(true);
      }
    });
    if (serverProc === proc) {
      serverProc = null;
      serverRoot = null;
      onStateChange();
    }
  });
  onStateChange();
}

/**
 * Stops the running server and waits for it to exit, so the port is freed
 * before any restart. Resolves immediately when nothing is running.
 *
 * @returns {Promise<void>}
 */
function stop() {
  const proc = serverProc;
  if (!proc) {
    return Promise.resolve();
  }
  serverProc = null;
  serverRoot = null;
  onStateChange();
  return new Promise((resolve) => {
    let settled = false;
    function done() {
      if (!settled) {
        settled = true;
        resolve();
      }
    }
    proc.once('exit', done);
    proc.kill();
    /* Fallback: never hang if the process does not report its exit. */
    setTimeout(done, STOP_TIMEOUT_MS);
  });
}

/**
 * Restarts the server after waiting for the previous one to exit.
 *
 * @param {string} [rootOverride] - Project root to serve after the restart.
 *        Defaults to the project of the active file. Capture
 *        {@link currentRoot} before calling when the restart must keep serving
 *        the same project regardless of the active editor.
 */
async function restart(rootOverride) {
  await stop();
  start(rootOverride);
}

/**
 * Waits for the running server to answer, aborting early if it exits. The
 * network probing and the polling loop live in the readiness module; this
 * wrapper supplies the configured host, port and timeout, and ties the abort
 * condition to our running process.
 *
 * @param {number} [timeoutMs] - Maximum time to wait (ms). Defaults to the
 *        configured `readyTimeout`.
 * @returns {Promise<boolean>} True once the port answers, false on abort or
 *          timeout.
 */
function waitForReady(timeoutMs) {
  const cfg = getConfig();
  const limit = typeof timeoutMs === 'number'
    ? timeoutMs
    : readiness.resolveReadyTimeoutMs(cfg.get('readyTimeout'));
  return readiness.waitForReady({
    host: cfg.get('host'),
    port: cfg.get('port'),
    timeoutMs: limit,
    isAborted: () => !serverProc
  });
}

/**
 * Ensures a server is serving a project: restarts on a project change (waiting
 * for the old one to exit), warns on a foreign server already on the port, and
 * runs the preflight checks before starting.
 *
 * @param {string} [rootOverride] - Project root to ensure. Defaults to the
 *        project of the active file. Pass it explicitly when the caller has
 *        already resolved the target project and the active editor may move on
 *        across the awaits (e.g. an active-editor-change driven switch).
 * @returns {Promise<boolean>} False if the folder is not an MkDocs project;
 *          true otherwise.
 */
async function ensure(rootOverride) {
  const root = rootOverride || findProjectRoot();
  if (!root) {
    await stop();
    vscode.window.showWarningMessage(
      vscode.l10n.t(
        'MkDocs Live Preview: no {0} found (neither in the open folder nor above the active file).',
        getConfig().get('configFile')
      )
    );
    return false;
  }
  /* Already serving this project: nothing to do. */
  if (serverProc && serverRoot === root) {
    return true;
  }
  /* Serving another project: stop it and wait for the port to free up. */
  let stoppedOurs = false;
  if (serverProc && serverRoot !== root) {
    await stop();
    stoppedOurs = true;
  }
  /* A busy port means a foreign server only when we did not just stop our own
     one (whose port might still be releasing). */
  const cfg = getConfig();
  if (!stoppedOurs && (await readiness.isPortOpen(cfg.get('host'), cfg.get('port')))) {
    vscode.window.showWarningMessage(
      vscode.l10n.t(
        'Port {0} is already in use. The preview may show another project. Stop that server or change "mkdocsLivePreview.port".',
        cfg.get('port')
      )
    );
    return true;
  }
  /* Check that MkDocs/Python are installed before trying to start. */
  if (!(await preflight(root)).ok) {
    return false;
  }
  start(root);
  return true;
}

module.exports = {
  init,
  setStateListener,
  isRunning,
  currentRoot,
  start,
  stop,
  restart,
  waitForReady,
  ensure
};

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
const net = require('net');
const { getConfig } = require('./config');
const { findProjectRoot, resolveMkdocsCmd } = require('./project');
const { preflight } = require('./preflight');
const { clampReadyTimeoutMs, pollUntilReady } = require('./timeout');
const { shouldUseShell } = require('./spawn');

/** Running server process, or null when stopped. @type {import('child_process').ChildProcess | null} */
let serverProc = null;
/** Project root the running server was started for, or null. */
let serverRoot = null;
/** Output channel for the server logs. @type {vscode.OutputChannel} */
let output = null;
/** Listener invoked whenever the running state changes. */
let onStateChange = () => {};

/** Default time (ms) to wait for the server to answer after a start. */
const DEFAULT_READY_TIMEOUT_MS = 120000;
/** Hard floor (ms) for the configured ready timeout. */
const MIN_READY_TIMEOUT_MS = 5000;
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

/** Starts `mkdocs serve` for the current project, if not already running. */
function start() {
  const root = findProjectRoot();
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
  proc.stdout.on('data', (data) => output.append(data.toString()));
  proc.stderr.on('data', (data) => {
    const text = data.toString();
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

/** Restarts the server after waiting for the previous one to exit. */
async function restart() {
  await stop();
  start();
}

/**
 * Tells whether a server already listens on host:port (short TCP probe).
 *
 * @param {string} host - Host to probe.
 * @param {number} port - Port to probe.
 * @param {number} timeout - Probe timeout (ms).
 * @returns {Promise<boolean>} True if a connection succeeded.
 */
function isPortOpen(host, port, timeout = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    function finish(open) {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(open);
    }
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

/**
 * Reads the configured ready timeout (in seconds) and returns it as a
 * millisecond duration. Thin wrapper around the pure `clampReadyTimeoutMs`
 * so the VS Code dependency stays on this side of the boundary.
 *
 * @returns {number} Ready timeout in milliseconds.
 */
function getReadyTimeoutMs() {
  return clampReadyTimeoutMs(
    getConfig().get('readyTimeout'),
    DEFAULT_READY_TIMEOUT_MS,
    MIN_READY_TIMEOUT_MS
  );
}

/**
 * Waits for the server to answer. The initial build can take from a few
 * seconds (small sites) to over a minute (large sites with heavy themes such
 * as pyodide-mkdocs-theme), hence the configurable timeout. Returns early if
 * the server process exits in the meantime, so the preview can surface the
 * failure immediately instead of waiting out the full ready timeout.
 *
 * @param {number} [timeoutMs] - Maximum time to wait (ms). Defaults to the
 *        configured `readyTimeout`.
 * @returns {Promise<boolean>} True once the port answers, false on abort or
 *          timeout.
 */
async function waitForReady(timeoutMs) {
  const limit = typeof timeoutMs === 'number' ? timeoutMs : getReadyTimeoutMs();
  const cfg = getConfig();
  const host = cfg.get('host');
  const port = cfg.get('port');
  return pollUntilReady({
    isReady: () => isPortOpen(host, port, 500),
    isAborted: () => !serverProc,
    timeoutMs: limit
  });
}

/**
 * Ensures a server is serving the current project: restarts on a project
 * change (waiting for the old one to exit), warns on a foreign server already
 * on the port, and runs the preflight checks before starting.
 *
 * @returns {Promise<boolean>} False if the current folder is not an MkDocs
 *          project; true otherwise.
 */
async function ensure() {
  const root = findProjectRoot();
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
  if (!stoppedOurs && (await isPortOpen(cfg.get('host'), cfg.get('port')))) {
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
  start();
  return true;
}

module.exports = {
  init,
  setStateListener,
  isRunning,
  start,
  stop,
  restart,
  waitForReady,
  ensure
};

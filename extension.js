// MkDocs Live Preview - extension VS Code en JavaScript pur (aucune dépendance
// npm, aucun build). Elle pilote un serveur `mkdocs serve` et affiche son rendu
// dans un panneau webview synchronisé sur le fichier Markdown actif.

const vscode = require('vscode')
const cp = require('child_process')
const net = require('net')
const fs = require('fs')
const path = require('path')

/** Processus du serveur mkdocs (null si arrêté). @type {import('child_process').ChildProcess | null} */
let serverProc = null
/** Racine du projet pour lequel le serveur courant a été démarré. */
let serverRoot = null
/** Panneau d'aperçu (null si fermé). @type {vscode.WebviewPanel | null} */
let previewPanel = null
/** Origine externe du serveur (ex. http://127.0.0.1:9999), résolue via asExternalUri. */
let externalBase = null
let output
let statusItem

function config() {
  return vscode.workspace.getConfiguration('mkdocsLivePreview')
}

/**
 * Racine du projet MkDocs : premier dossier contenant le fichier de config,
 * en remontant depuis le fichier actif puis depuis les dossiers de l'espace
 * de travail. Gère le cas où l'on a ouvert un dossier parent ou un sous-dossier
 * du projet. Renvoie undefined si aucun mkdocs.yml n'est trouvé.
 */
function findProjectRoot() {
  const configFile = config().get('configFile')
  const climb = (start) => {
    let dir = start
    for (let i = 0; i < 12 && dir; i++) {
      if (fs.existsSync(path.join(dir, configFile))) return dir
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return undefined
  }
  const editor = vscode.window.activeTextEditor
  if (editor && editor.document.uri.scheme === 'file') {
    const fromFile = climb(path.dirname(editor.document.uri.fsPath))
    if (fromFile) return fromFile
  }
  for (const folder of vscode.workspace.workspaceFolders || []) {
    const fromFolder = climb(folder.uri.fsPath)
    if (fromFolder) return fromFolder
  }
  return undefined
}

/** Résout l'exécutable mkdocs : réglage explicite, sinon .venv du projet, sinon PATH. */
function resolveMkdocsCmd(root) {
  const explicit = config().get('mkdocsPath')
  if (explicit) return explicit
  const isWin = process.platform === 'win32'
  const venvBin = isWin
    ? path.join(root, '.venv', 'Scripts', 'mkdocs.exe')
    : path.join(root, '.venv', 'bin', 'mkdocs')
  return fs.existsSync(venvBin) ? venvBin : 'mkdocs'
}

/** Lecture légère de docs_dir et use_directory_urls dans le mkdocs.yml. */
function readMkdocsConfig(root) {
  let docsDir = 'docs'
  let useDirUrls = true // valeur par défaut de MkDocs
  try {
    const text = fs.readFileSync(path.join(root, config().get('configFile')), 'utf8')
    const mDocs = text.match(/^\s*docs_dir\s*:\s*(.+?)\s*$/m)
    if (mDocs) docsDir = mDocs[1].replace(/['"]/g, '').trim()
    const mUrls = text.match(/^\s*use_directory_urls\s*:\s*(true|false)\s*$/m)
    if (mUrls) useDirUrls = mUrls[1] === 'true'
  } catch {
    // pas de mkdocs.yml lisible : on garde les valeurs par défaut
  }
  return { docsDir, useDirUrls }
}

/**
 * Chemin de page (relatif à la racine du site) pour un fichier .md donné.
 * Renvoie null si le fichier n'est pas un Markdown situé sous docs_dir.
 */
function pagePathForFile(filePath) {
  const root = findProjectRoot()
  if (!root) return null
  if (!/\.(md|markdown)$/i.test(filePath)) return null

  const { docsDir, useDirUrls } = readMkdocsConfig(root)
  const docsAbs = path.resolve(root, docsDir)
  const rel = path.relative(docsAbs, filePath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null // hors de docs/

  const posix = rel.split(path.sep).join('/')
  if (!useDirUrls) {
    return posix.replace(/\.(md|markdown)$/i, '.html')
  }
  // use_directory_urls: true -> index.md = racine du dossier, foo.md -> foo/
  const noExt = posix.replace(/\.(md|markdown)$/i, '')
  if (noExt === 'index') return ''
  if (noExt.endsWith('/index')) return noExt.slice(0, -'/index'.length) + '/'
  return noExt + '/'
}

function updateStatus() {
  if (!statusItem) return
  const running = !!serverProc
  statusItem.text = `$(book) ${running ? vscode.l10n.t('MkDocs: running') : vscode.l10n.t('MkDocs: stopped')}`
  statusItem.tooltip = running
    ? vscode.l10n.t('MkDocs server running - click to open the preview')
    : vscode.l10n.t('MkDocs server stopped - click to start it and open the preview')
  statusItem.show()
}

function startServer() {
  const root = findProjectRoot()
  if (!root) {
    vscode.window.showErrorMessage(
      vscode.l10n.t(
        'MkDocs Live Preview: no {0} found (neither in the open folder nor above the active file).',
        config().get('configFile')
      )
    )
    return
  }
  if (serverProc) {
    output.appendLine('Server already running.')
    return
  }
  const cfg = config()
  const host = cfg.get('host')
  const port = cfg.get('port')
  const configFile = cfg.get('configFile')
  const extraArgs = cfg.get('serveArgs') || []
  const cmd = resolveMkdocsCmd(root)
  const args = ['serve', '-a', `${host}:${port}`, '-f', configFile, ...extraArgs]

  output.show(true)
  output.appendLine(`$ ${cmd} ${args.join(' ')}   (cwd=${root})`)
  serverRoot = root
  serverProc = cp.spawn(cmd, args, {
    cwd: root,
    env: { ...process.env, NO_MKDOCS_2_WARNING: '1' }
  })
  serverProc.stdout.on('data', (d) => output.append(d.toString()))
  serverProc.stderr.on('data', (d) => {
    const text = d.toString()
    output.append(text)
    if (/address already in use|errno 98/i.test(text)) {
      vscode.window.showErrorMessage(
        vscode.l10n.t(
          'MkDocs: port {0} is already in use. Stop the other server or change "mkdocsLivePreview.port".',
          port
        )
      )
    }
  })
  serverProc.on('exit', (code) => {
    output.appendLine(`\n[mkdocs serve exited: code ${code}]`)
    serverProc = null
    serverRoot = null
    updateStatus()
  })
  serverProc.on('error', (err) => {
    vscode.window.showErrorMessage(vscode.l10n.t('MkDocs: {0}', err.message))
    serverProc = null
    updateStatus()
  })
  updateStatus()
}

function stopServer() {
  if (serverProc) {
    serverProc.kill()
    serverProc = null
    serverRoot = null
    updateStatus()
  }
}

async function restartServer() {
  stopServer()
  // petit délai pour libérer le port avant de relancer
  await new Promise((r) => setTimeout(r, 400))
  startServer()
}

/** Teste si un serveur écoute déjà sur host:port (connexion TCP brève). */
function isPortOpen(host, port, timeout = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false
    const finish = (open) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(timeout)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
    socket.connect(port, host)
  })
}

/** Attend que le serveur réponde sur host:port (le build initial prend du temps). */
async function waitForServer(timeoutMs = 20000) {
  const cfg = config()
  const host = cfg.get('host')
  const port = cfg.get('port')
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(host, port, 500)) return true
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

/** Une commande peut-elle être exécutée ? (false si ENOENT / introuvable). */
function canRun(cmd, args, useShell) {
  return new Promise((resolve) => {
    let done = false
    const finish = (v) => {
      if (!done) {
        done = true
        resolve(v)
      }
    }
    try {
      const child = cp.spawn(cmd, args, { stdio: 'ignore', shell: !!useShell })
      child.on('error', () => finish(false)) // binaire introuvable
      child.on('exit', () => finish(true)) // a pu s'exécuter (code quelconque)
      setTimeout(() => {
        try {
          child.kill()
        } catch {
          // ignore
        }
        finish(true)
      }, 4000)
    } catch {
      finish(false)
    }
  })
}

/** Commande prête à coller pour créer le venv et installer MkDocs (selon l'OS). */
function suggestedInstallCommand(root, python) {
  const isWin = process.platform === 'win32'
  const py = python || (isWin ? 'py' : 'python3')
  const pkg = fs.existsSync(path.join(root, 'requirements.txt')) ? '-r requirements.txt' : 'mkdocs'
  return isWin
    ? `${py} -m venv .venv; .venv\\Scripts\\python -m pip install ${pkg}`
    : `${py} -m venv .venv && .venv/bin/pip install ${pkg}`
}

/**
 * Vérifie que MkDocs (et, à défaut, Python) est disponible avant de démarrer le
 * serveur. Affiche un message clair et actionnable, adapté à Windows/Linux/Mac,
 * et renvoie { ok: false } si quelque chose manque.
 */
async function preflight(root) {
  const isWin = process.platform === 'win32'
  const cmd = resolveMkdocsCmd(root)
  // Un chemin (venv ou réglage explicite) se teste sans shell ; une commande du
  // PATH a parfois besoin du shell sous Windows (.cmd/.bat).
  const cmdIsPath = cmd.includes('/') || cmd.includes('\\')
  if (await canRun(cmd, ['--version'], cmdIsPath ? false : isWin)) return { ok: true }

  // MkDocs introuvable : Python est-il présent ?
  const pyCandidates = isWin ? ['py', 'python', 'python3'] : ['python3', 'python']
  let python = null
  for (const p of pyCandidates) {
    if (await canRun(p, ['--version'], isWin)) {
      python = p
      break
    }
  }

  if (!python) {
    const hint = isWin
      ? vscode.l10n.t('Install Python from https://www.python.org/downloads/ (or run "winget install Python.Python.3").')
      : process.platform === 'darwin'
        ? vscode.l10n.t('Install Python with "brew install python", or from https://www.python.org/downloads/.')
        : vscode.l10n.t('Install Python with your package manager, e.g. "sudo apt install python3 python3-venv".')
    const guide = vscode.l10n.t('Installation guide')
    const choice = await vscode.window.showErrorMessage(
      vscode.l10n.t('Python 3 was not found, but MkDocs needs it. {0}', hint),
      guide
    )
    if (choice === guide) {
      vscode.env.openExternal(vscode.Uri.parse('https://www.python.org/downloads/'))
    }
    return { ok: false }
  }

  // Python présent mais MkDocs absent : proposer une commande d'installation.
  const installCmd = suggestedInstallCommand(root, python)
  const copy = vscode.l10n.t('Copy install command')
  const guide = vscode.l10n.t('Installation guide')
  const choice = await vscode.window.showErrorMessage(
    vscode.l10n.t('MkDocs was not found. Install it in a virtual environment, then try again.'),
    copy,
    guide
  )
  if (choice === copy) {
    await vscode.env.clipboard.writeText(installCmd)
    vscode.window.showInformationMessage(vscode.l10n.t('Install command copied to the clipboard.'))
  } else if (choice === guide) {
    vscode.env.openExternal(vscode.Uri.parse('https://www.mkdocs.org/user-guide/installation/'))
  }
  return { ok: false }
}

/**
 * Garantit qu'un serveur sert bien le projet du dossier courant.
 * Redémarre si on a changé de projet, démarre si aucun n'est géré, et avertit
 * si le port est occupé par un serveur étranger (pour éviter d'afficher un
 * autre projet). Renvoie false si le dossier courant n'est pas un projet MkDocs.
 */
async function ensureServer() {
  const root = findProjectRoot()
  if (!root) {
    stopServer()
    vscode.window.showWarningMessage(
      vscode.l10n.t(
        'MkDocs Live Preview: no {0} found (neither in the open folder nor above the active file).',
        config().get('configFile')
      )
    )
    return false
  }
  // Serveur déjà en cours pour CE projet : rien à faire.
  if (serverProc && serverRoot === root) return true
  // Serveur en cours pour un AUTRE projet : on le remplace.
  if (serverProc && serverRoot !== root) {
    stopServer()
    await new Promise((r) => setTimeout(r, 400))
  }
  // Port occupé par un serveur qu'on ne gère pas : on prévient plutôt que de
  // réutiliser aveuglément (il pourrait servir un autre projet).
  const cfg = config()
  if (await isPortOpen(cfg.get('host'), cfg.get('port'))) {
    vscode.window.showWarningMessage(
      vscode.l10n.t(
        'Port {0} is already in use. The preview may show another project. Stop that server or change "mkdocsLivePreview.port".',
        cfg.get('port')
      )
    )
    return true
  }
  // Vérifie que MkDocs/Python sont installés avant de tenter le démarrage.
  if (!(await preflight(root)).ok) return false
  startServer()
  return true
}

/** Résout l'origine externe (gère le forwarding de port en remote/Codespaces). */
async function ensureExternalBase() {
  const cfg = config()
  const ext = await vscode.env.asExternalUri(
    vscode.Uri.parse(`http://${cfg.get('host')}:${cfg.get('port')}`)
  )
  externalBase = `${ext.scheme}://${ext.authority}`
  return externalBase
}

function webviewHtml(origin, startingText) {
  // CSP stricte : on n'autorise que l'iframe vers l'origine du serveur mkdocs.
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; frame-src ${origin}; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #fff; }
  iframe { width: 100%; height: 100vh; border: 0; background: #fff; }
  #overlay {
    position: fixed; inset: 0; display: flex; flex-direction: column; gap: 14px;
    align-items: center; justify-content: center; padding: 1rem; text-align: center;
    font-family: sans-serif; font-size: 13px; color: #888; background: #fff;
  }
  #overlay .spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid currentColor; border-top-color: transparent;
    opacity: 0.55; animation: mk-spin 0.9s linear infinite;
  }
  @keyframes mk-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    #overlay .spinner { animation-duration: 2.4s; }
  }
</style>
</head>
<body>
<div id="overlay"><div class="spinner"></div><div id="overlay-text">${startingText}</div></div>
<iframe id="frame"></iframe>
<script>
  const frame = document.getElementById('frame')
  const overlay = document.getElementById('overlay')
  const overlayText = document.getElementById('overlay-text')
  frame.addEventListener('load', () => { if (frame.src) overlay.style.display = 'none' })
  window.addEventListener('message', (event) => {
    const msg = event.data
    if (!msg) return
    if (msg.type === 'navigate' && typeof msg.url === 'string') {
      overlay.style.display = 'none'
      frame.src = msg.url
    } else if (msg.type === 'status' && typeof msg.text === 'string') {
      overlayText.textContent = msg.text
      overlay.style.display = 'flex'
    }
  })
</script>
</body>
</html>`
}

/** Navigue l'aperçu vers la page du fichier Markdown actif. */
function navigateToActive(force = false) {
  if (!previewPanel || !externalBase) return
  const editor = vscode.window.activeTextEditor
  const page = editor ? pagePathForFile(editor.document.uri.fsPath) : null
  // En suivi auto, on ne touche pas l'aperçu pour un fichier hors site ; en
  // mode forcé (ouverture initiale), on va au moins à la racine du site.
  if (page === null && !force) return
  previewPanel.webview.postMessage({ type: 'navigate', url: `${externalBase}/${page || ''}` })
}

async function openPreview(toSide) {
  if (!(await ensureServer())) return
  const origin = await ensureExternalBase()

  if (!previewPanel) {
    previewPanel = vscode.window.createWebviewPanel(
      'mkdocsPreview',
      'Aperçu MkDocs',
      toSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    )
    previewPanel.onDidDispose(() => {
      previewPanel = null
    })
    previewPanel.webview.html = webviewHtml(origin, vscode.l10n.t('Starting the MkDocs server…'))
  } else {
    previewPanel.reveal(toSide ? vscode.ViewColumn.Beside : undefined, true)
  }
  // Le build initial de mkdocs prend quelques secondes : on attend que le
  // serveur réponde avant de charger la page, sinon l'iframe affiche une page
  // blanche (connexion refusée) sans réessayer.
  previewPanel.webview.postMessage({
    type: 'status',
    text: vscode.l10n.t('Starting the MkDocs server…')
  })
  const ready = await waitForServer()
  if (!ready) {
    previewPanel.webview.postMessage({
      type: 'status',
      text: vscode.l10n.t('The MkDocs server is not responding. See the "MkDocs Live Preview" output.')
    })
    return
  }
  navigateToActive(true)
}

function activate(context) {
  output = vscode.window.createOutputChannel('MkDocs Live Preview')
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusItem.command = 'mkdocsLivePreview.openPreviewToSide'
  updateStatus()

  context.subscriptions.push(
    output,
    statusItem,
    vscode.commands.registerCommand('mkdocsLivePreview.openPreviewToSide', () => openPreview(true)),
    vscode.commands.registerCommand('mkdocsLivePreview.openPreview', () => openPreview(false)),
    vscode.commands.registerCommand('mkdocsLivePreview.startServer', startServer),
    vscode.commands.registerCommand('mkdocsLivePreview.stopServer', stopServer),
    vscode.commands.registerCommand('mkdocsLivePreview.restartServer', restartServer),
    vscode.window.onDidChangeActiveTextEditor(() => {
      if (config().get('autoSync')) navigateToActive()
    }),
    // Changement de projet (ajout/retrait de dossier) : on resservira le bon
    // projet au prochain rendu si un aperçu est ouvert.
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      if (previewPanel && (await ensureServer()) && (await waitForServer())) {
        navigateToActive(true)
      }
    })
  )
}

function deactivate() {
  stopServer()
}

module.exports = { activate, deactivate }

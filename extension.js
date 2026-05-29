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

/** Racine du premier dossier de l'espace de travail, ou undefined. */
function workspaceRoot() {
  const folders = vscode.workspace.workspaceFolders
  return folders && folders.length ? folders[0].uri.fsPath : undefined
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
  const root = workspaceRoot()
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
  statusItem.text = running ? '$(book) MkDocs: actif' : '$(book) MkDocs: arrêté'
  statusItem.tooltip = running
    ? 'Serveur mkdocs en cours - cliquer pour ouvrir l\'aperçu'
    : 'Serveur mkdocs arrêté - cliquer pour démarrer et ouvrir l\'aperçu'
  statusItem.show()
}

function startServer() {
  const root = workspaceRoot()
  if (!root) {
    vscode.window.showErrorMessage('MkDocs Live Preview : ouvrez d\'abord le dossier du projet.')
    return
  }
  if (serverProc) {
    output.appendLine('Le serveur tourne déjà.')
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
        `MkDocs : le port ${port} est déjà occupé. Arrêtez l'autre serveur ou changez "mkdocsLivePreview.port".`
      )
    }
  })
  serverProc.on('exit', (code) => {
    output.appendLine(`\n[mkdocs serve terminé : code ${code}]`)
    serverProc = null
    updateStatus()
  })
  serverProc.on('error', (err) => {
    vscode.window.showErrorMessage(`MkDocs : ${err.message}`)
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

/** Le dossier contient-il le fichier de config MkDocs ? */
function hasMkdocsConfig(root) {
  return fs.existsSync(path.join(root, config().get('configFile')))
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

/**
 * Garantit qu'un serveur sert bien le projet du dossier courant.
 * Redémarre si on a changé de projet, démarre si aucun n'est géré, et avertit
 * si le port est occupé par un serveur étranger (pour éviter d'afficher un
 * autre projet). Renvoie false si le dossier courant n'est pas un projet MkDocs.
 */
async function ensureServer() {
  const root = workspaceRoot()
  if (!root) {
    vscode.window.showErrorMessage('MkDocs Live Preview : ouvrez d\'abord le dossier du projet.')
    return false
  }
  if (!hasMkdocsConfig(root)) {
    stopServer()
    vscode.window.showWarningMessage(
      `MkDocs Live Preview : aucun ${config().get('configFile')} dans ce dossier.`
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
      `Le port ${cfg.get('port')} est déjà utilisé. L'aperçu pourrait afficher un autre projet. ` +
        `Arrêtez ce serveur ou changez "mkdocsLivePreview.port".`
    )
    return true
  }
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

function webviewHtml(origin) {
  // CSP stricte : on n'autorise que l'iframe vers l'origine du serveur mkdocs.
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; frame-src ${origin}; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  html, body { margin: 0; padding: 0; height: 100%; }
  iframe { width: 100%; height: 100vh; border: 0; background: #fff; }
</style>
</head>
<body>
<iframe id="frame" src="${origin}"></iframe>
<script>
  const frame = document.getElementById('frame')
  window.addEventListener('message', (event) => {
    const msg = event.data
    if (msg && msg.type === 'navigate' && typeof msg.url === 'string') {
      frame.src = msg.url
    }
  })
</script>
</body>
</html>`
}

/** Navigue l'aperçu vers la page du fichier Markdown actif. */
function navigateToActive() {
  if (!previewPanel || !externalBase) return
  const editor = vscode.window.activeTextEditor
  if (!editor) return
  const page = pagePathForFile(editor.document.uri.fsPath)
  if (page === null) return // fichier hors site : on laisse l'aperçu en l'état
  previewPanel.webview.postMessage({ type: 'navigate', url: `${externalBase}/${page}` })
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
    previewPanel.webview.html = webviewHtml(origin)
  } else {
    previewPanel.reveal(toSide ? vscode.ViewColumn.Beside : undefined, true)
  }
  // Laisse l'iframe se créer avant de poster la première navigation.
  setTimeout(navigateToActive, 150)
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
      if (previewPanel && (await ensureServer())) {
        setTimeout(navigateToActive, 300)
      }
    })
  )
}

function deactivate() {
  stopServer()
}

module.exports = { activate, deactivate }

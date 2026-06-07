# Architecture - MkDocs Live Preview

## Overview

A VS Code extension written in plain JavaScript, with **no build step and no
runtime dependencies**: it uses only the VS Code API and Node.js built-in
modules (`child_process`, `net`, `fs`, `path`). It can run directly from source
via the Extension Development Host (F5) or be packaged into a `.vsix` with
`build.sh`.

`extension.js` is a thin wiring file (about 80 lines): it registers the commands
and listeners, then delegates to small modules under `src/`. Each module has a
single responsibility, and the modules are grouped into layers (see below).

The extension does not render Markdown itself. It drives a real `mkdocs serve`
process and embeds its output in a webview, so the preview is identical to the
production site (admonitions, tabs, math, pyodide blocks), with MkDocs
livereload handling refresh on save.

## Source layout

The modules under `src/` are organized into layers. Each folder is one layer,
and dependencies flow in a single direction: from `ui` down to `util`. A module
never depends on a layer above it, so there are no dependency cycles.

```
extension.js              wiring: activation, commands, listeners
src/
  ui/                     everything the user sees
    preview.js            the reusable webview panel and its iframe
    webview.js            builds the panel HTML (iframe + CSP + overlay)
    statusBar.js          the status bar item showing the server state
  server/                 the mkdocs serve process and its preconditions
    server.js             start / stop / restart, project tracking
    readiness.js          TCP probe and wait-until-the-server-answers loop
    preflight.js          checks that mkdocs and Python can run
    install.js            OS-aware install suggestions on failure
  domain/                 the MkDocs project and its pages
    project.js            find mkdocs.yml, read its config, resolve mkdocs
    mkdocsConfig.js       parse docs_dir and use_directory_urls from the file
    mapping.js            map a Markdown file to its built page URL
  config/                 the extension settings
    config.js             read mkdocsLivePreview.* settings
  util/                   pure helpers, no internal dependencies
    ansi.js               strip ANSI escape codes from server output
    spawn.js              decide whether a command needs a shell
    timeout.js            clamp the ready timeout, poll until ready
```

The test suite mirrors this layout under `test/` (for example,
`test/util/timeout.test.js` covers `src/util/timeout.js`). Run it with
`npm test`; it uses the built-in Node test runner and discovers the nested
folders automatically.

## Layers, from the bottom up

### `util` - pure helpers

No dependency on any other module, and no VS Code API. These are the easiest
units to read and test in isolation.

- `ansi.js` exports `stripAnsi`, which removes the color escape codes MkDocs
  writes to its output.
- `spawn.js` exports `shouldUseShell`, which decides whether a command must be
  run through a shell (used for PATH lookups on Windows).
- `timeout.js` exports `clampReadyTimeoutMs` (bounds the configured timeout) and
  `pollUntilReady` (polls a condition until it succeeds, aborts, or times out).

### `config` - settings

`config.js` exports `getConfig` and the `SECTION` constant. It is the single
place that reads the `mkdocsLivePreview.*` settings, so the rest of the code
never touches the VS Code configuration API directly.

### `domain` - the MkDocs project

- `project.js` exports `findProjectRoot` (walks up from the active file, then the
  workspace folders, to locate `mkdocs.yml`), `resolveMkdocsCmd` (picks the
  executable: explicit setting, then the workspace `.venv`, then `mkdocs` on
  `PATH`) and `pagePathForFile` (maps the active file to its built page URL). It
  reads `docs_dir` and `use_directory_urls` from `mkdocs.yml` with bounded
  regular expressions.
- `mkdocsConfig.js` exports `parseMkdocsConfig`, the pure function that reads
  `docs_dir` and `use_directory_urls` from the `mkdocs.yml` text. It is split
  out from `project.js` so the parsing rules can be tested without any file
  system, while `project.js` keeps the file reading and the cache.
- `mapping.js` exports `computePagePath`, the pure function that turns a file
  path into a page URL given the project settings. It is split out from
  `project.js` so the mapping rules can be tested without any file system.

### `server` - the mkdocs serve process

- `server.js` exports the lifecycle: start, stop and restart the `mkdocs serve`
  child process. It records the project the server was started for, restarts it
  when the active project changes, and refuses to silently reuse a foreign
  server already bound to the port. It binds the VS Code settings to the pure
  `readiness` module and ties the abort condition to its running process.
- `readiness.js` exports `isPortOpen` (a short TCP probe), `resolveReadyTimeoutMs`
  (the configured timeout, clamped) and `waitForReady` (the polling loop that
  waits for the initial build). It carries no VS Code API, so the network
  behavior can be unit-tested; `server.js` supplies the host, port and timeout.
- `preflight.js` exports `preflight`, which runs before the server starts: it
  checks that `mkdocs` (then Python) can execute and, on failure, shows OS-aware
  guidance.
- `install.js` exports `buildInstallCommand`, the suggested install command for
  Windows, Linux and macOS shown when the preflight check fails.

### `ui` - what the user sees

- `preview.js` exports `openPreview`, which creates a single reusable webview
  panel whose iframe points at the local server (resolved through
  `vscode.env.asExternalUri` for remote compatibility). It polls the port so the
  panel shows an animated "starting" overlay instead of a blank page during the
  initial build, then navigates the iframe to the active page.
- `webview.js` exports `webviewHtml`, which builds the panel HTML: the iframe,
  the loading overlay, and a strict Content-Security-Policy that limits framing
  to the configured local origin.
- `statusBar.js` builds the status bar item that reflects the server state and
  opens the preview when clicked.

### `extension.js` - wiring

`activate()` registers the commands, the status bar item, an active-editor
change listener (auto-sync), a workspace-folders change listener and a
configuration change listener. The active-editor listener re-serves the right
project before navigating when the new file belongs to a different project than
the one being served; the configuration listener restarts the server and
recomputes the preview origin when `host` or `port` changes. Activation is
triggered on Markdown files (`onLanguage:markdown`).

## Other files

| Path | Role |
|---|---|
| `package.json` | Manifest: commands, menus, keybinding, settings, `%nls%` keys, `l10n` folder |
| `package.nls.json` / `package.nls.fr.json` | Manifest string localization (English / French) |
| `l10n/bundle.l10n*.json` | Runtime string localization (`vscode.l10n.t`) |
| `snippets/mkdocs.json` | Markdown snippets (admonitions, tabs, math, captions) |
| `media/` | Editor-title icon (light/dark) and source favicon |
| `build.sh` | Packages the `.vsix` via `@vscode/vsce` |

## Internationalization

Manifest strings use `%key%` placeholders resolved by `package.nls*.json`.
Runtime strings use `vscode.l10n.t()` resolved by `l10n/bundle.l10n*.json`.
English is the default; French is provided.

## Data flow

```
active editor  --> findProjectRoot --> pagePathForFile --> page URL
                                                              |
ensureServer --> mkdocs serve (port)                         v
                     |                             webview iframe (CSP)
   file saved --> livereload --> iframe refresh
```

## Design choices

- **Embed the real server** rather than re-rendering Markdown, for full fidelity
  (notably pyodide interactive blocks, which a JavaScript renderer cannot
  reproduce).
- **Zero dependencies** to minimize supply-chain risk and avoid a build step.
- **Layered modules** with a one-way dependency flow (`ui` -> `server` ->
  `domain` -> `config` -> `util`). Each module is small and single-purpose, the
  pure helpers in `util` carry no VS Code API, and the test suite mirrors the
  layout. The aim is a codebase that is easy to read, test, and learn from.
- **Own webview** rather than the built-in Simple Browser, to control file-to-page
  synchronization and the loading overlay smoothly.
- **Fixed port** (configurable): simple, at the cost of one previewed project at a
  time per port.

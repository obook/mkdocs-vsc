# Architecture - MkDocs Live Preview

## Overview

A single-file VS Code extension written in plain JavaScript, with **no build
step and no runtime dependencies**: it uses only the VS Code API and Node.js
built-in modules (`child_process`, `net`, `fs`, `path`). It can run directly
from source via the Extension Development Host (F5) or be packaged into a
`.vsix` with `build.sh`.

The extension does not render Markdown itself. It drives a real `mkdocs serve`
process and embeds its output in a webview, so the preview is identical to the
production site (admonitions, tabs, math, pyodide blocks), with MkDocs
livereload handling refresh on save.

## Files

| Path | Role |
|---|---|
| `extension.js` | All logic: activation, commands, server lifecycle, webview, mapping, preflight |
| `package.json` | Manifest: commands, menus, keybinding, settings, `%nls%` keys, `l10n` folder |
| `package.nls.json` / `package.nls.fr.json` | Manifest string localization (English / French) |
| `l10n/bundle.l10n*.json` | Runtime string localization (`vscode.l10n.t`) |
| `snippets/mkdocs.json` | Markdown snippets (admonitions, tabs, math, captions) |
| `media/` | Editor-title icon (light/dark) and source favicon |
| `build.sh` | Packages the `.vsix` via `@vscode/vsce` |

## Components (in `extension.js`)

### Activation and UI

`activate()` registers the commands, a status bar item, an active-editor change
listener (auto-sync) and a workspace-folders change listener. Activation is
triggered on Markdown files (`onLanguage:markdown`).

### Server lifecycle

`startServer` / `stopServer` / `restartServer` manage the `mkdocs serve` child
process. `resolveMkdocsCmd` picks the executable: explicit setting, then the
workspace `.venv`, then `mkdocs` on `PATH`. `serverRoot` records the project the
server was started for; `ensureServer` restarts it when the active project
changes and refuses to silently reuse a foreign server already on the port.

### Project and page resolution

`findProjectRoot` walks up from the active file (then the workspace folders) to
locate `mkdocs.yml`. `readMkdocsConfig` reads `docs_dir` and
`use_directory_urls` with bounded regular expressions. `pagePathForFile` maps
the active Markdown file to its built page URL accordingly.

### Preview webview

`openPreview` creates a single reusable webview panel whose HTML embeds an
`<iframe>` pointing at the local server (resolved through
`vscode.env.asExternalUri` for remote compatibility). A strict CSP limits
framing to that origin. `waitForServer` polls the port so the panel shows an
animated "starting" overlay instead of a blank page during the initial build;
`navigateToActive` then posts the page URL to the iframe.

### Preflight

`preflight` runs before starting the server: `canRun` checks whether `mkdocs`
(then Python) can execute, and on failure shows OS-aware guidance
(`suggestedInstallCommand`) for Windows, Linux and macOS.

### Internationalization

Manifest strings use `%key%` placeholders resolved by `package.nls*.json`.
Runtime strings use `vscode.l10n.t()` resolved by `l10n/bundle.l10n*.json`.
English is the default; French is provided.

## Data flow

```
active editor  ──▶ findProjectRoot ──▶ pagePathForFile ──▶ page URL
                                                              │
ensureServer ──▶ mkdocs serve (port)                          ▼
                     │                              webview iframe (CSP)
   file saved ──▶ livereload ──▶ iframe refresh
```

## Design choices

- **Embed the real server** rather than re-rendering Markdown, for full fidelity
  (notably pyodide interactive blocks, which a JavaScript renderer cannot
  reproduce).
- **Zero dependencies** to minimize supply-chain risk and avoid a build step.
- **Own webview** rather than the built-in Simple Browser, to control file-to-page
  synchronization and the loading overlay smoothly.
- **Fixed port** (configurable): simple, at the cost of one previewed project at a
  time per port.

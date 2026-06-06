# Roadmap

Planned improvements for MkDocs Live Preview. Checked items are done.

## Distribution and CI

- [x] Continuous integration (GitHub Actions): run `npm test` and `vsce package` on push and on tags.
- [ ] Publish to the VS Code Marketplace and Open VSX (publisher account, `vscode:prepublish` script). The 128x128 Marketplace icon is ready (`media/icon.png`).
- [x] Compress `media/screen.png` to shrink the packaged `.vsix`.
- [ ] Update the GitHub Actions in `.github/workflows/ci.yml` (`actions/checkout`,
  `actions/setup-node`, `actions/upload-artifact`, `softprops/action-gh-release`)
  to versions that support Node.js 24. Node.js 20 is forced off on 2026-06-16 and
  removed from the runner on 2026-09-16. (see #3)

## Features and UX

- [ ] "Open in browser" command, and show the server URL/port in the status bar.
- [ ] Optional `autoStart` setting to launch `mkdocs serve` on activation.
- [ ] Investigate scroll synchronization between the editor and the preview (limited by the cross-origin iframe).

## Robustness

- [x] Short-circuit `waitForReady` if the server process exits during the wait.
- [ ] Reveal the output channel automatically when the server fails to start.
- [ ] More tolerant `mkdocs.yml` parsing (e.g. `docs_dir: !ENV [...]`, `exclude_docs`).
- [x] Fix preview staleness on project switch and on host/port change (see #1).
- [ ] Restore the preview after a window reload (e.g. "Open Recent" opens
  another folder): register a `WebviewPanelSerializer` so the remembered webview
  re-attaches and re-navigates to the current project instead of showing a blank
  pane.
- [ ] Post-#1 hardening (see #2): handle a foreign server on the port during a
  project switch, pin the remaining restart entry points to the served root,
  and refresh the "single-file" wording in `ARCHITECTURE.md`.

## Testing

Automated `node:test` suites cover the pure helpers (`mapping`, `timeout`,
`spawn`, `install`, `ansi`, `webview`). The VS Code glue still relies on manual
checks in the Extension Development Host; the following are pending:

- [ ] Host change (not only port): changing `mkdocsLivePreview.host` mid-session
  rebinds the server and reloads the preview on the new origin.
- [ ] Two rapid successive host/port changes never leave a spurious "not
  responding" message (supersede guard).
- [ ] Rapid active-editor switches between projects always end on the last
  selected file's project (sync-generation guard).
- [ ] The "port already in use" warning still fires after ANSI stripping (a
  foreign `mkdocs serve` already on the port).
- [ ] Switching to a project with no mkdocs / no `.venv` shows the preflight
  error, not an endless "Starting..." overlay or a blank page.
- [ ] Large/slow site (e.g. pyodide-mkdocs-theme): the "Starting..." overlay
  holds during the build, then the page loads.
- [ ] Regression: livereload still refreshes the iframe on save, and a
  single-folder workspace behaves as before.

## Done (0.1.0)

- [x] Live preview embedding a running `mkdocs serve`, with file-to-page sync.
- [x] Server lifecycle management and cross-platform Python/MkDocs preflight checks.
- [x] Modular code under `src/`, `node:test` unit tests, English/French localization.
- [x] Documentation and compliance notes (ANSSI, GDPR, RGAA).

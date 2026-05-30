# Roadmap

Planned improvements for MkDocs Live Preview. Checked items are done.

## Distribution and CI

- [x] Continuous integration (GitHub Actions): run `npm test` and `vsce package` on push and on tags.
- [ ] Publish to the VS Code Marketplace and Open VSX (publisher account, `vscode:prepublish` script). The 128x128 Marketplace icon is ready (`media/icon.png`).
- [x] Compress `media/screen.png` to shrink the packaged `.vsix`.

## Features and UX

- [ ] "Open in browser" command, and show the server URL/port in the status bar.
- [ ] Optional `autoStart` setting to launch `mkdocs serve` on activation.
- [ ] Investigate scroll synchronization between the editor and the preview (limited by the cross-origin iframe).

## Robustness

- [ ] Short-circuit `waitForReady` if the server process exits during the wait.
- [ ] Reveal the output channel automatically when the server fails to start.
- [ ] More tolerant `mkdocs.yml` parsing (e.g. `docs_dir: !ENV [...]`, `exclude_docs`).
- [ ] Fix preview staleness on project switch and on host/port change (see #1).

## Done (0.1.0)

- [x] Live preview embedding a running `mkdocs serve`, with file-to-page sync.
- [x] Server lifecycle management and cross-platform Python/MkDocs preflight checks.
- [x] Modular code under `src/`, `node:test` unit tests, English/French localization.
- [x] Documentation and compliance notes (ANSSI, GDPR, RGAA).

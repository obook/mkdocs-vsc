# Changelog

All notable changes to this extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Preview no longer goes stale when switching the active editor to a file of
  another project in a multi-project workspace. Previously the iframe
  navigated to the new project's URL against the old project's running server,
  yielding a 404 or the wrong page. On an active-editor change, the active
  file's project is now compared to the one being served; when it differs, the
  server is restarted for the new project before navigating. Files that belong
  to no project (or to the project already served) keep the cheap navigate
  path, so switching to a scratch file never restarts the server. (#1)
- Preview no longer points at a stale origin after a `host`/`port` setting
  change mid-session. `externalBase` was cached when the preview opened, so
  changing `mkdocsLivePreview.port` (or `host`) left navigation pointing at the
  old origin until the preview was reopened, and the server kept listening on
  the old port. A `workspace.onDidChangeConfiguration` listener now restarts
  the server (rebinding to the new address) and recomputes the origin when
  `host` or `port` changes. The webview HTML is rebuilt with the new origin so
  the iframe Content-Security-Policy (`frame-src`), which is fixed at open
  time, no longer blocks the new port; without this the iframe loaded the new
  origin only to be refused by the stale CSP. A restart that a later switch
  supersedes no longer surfaces a spurious "not responding" message. (#1)

## [0.1.6] - 2026-05-30

### Fixed

- Preflight no longer reports MkDocs as installed when it is not. On Windows
  under `shell: true`, `cmd.exe` spawns successfully even when the requested
  command does not exist (the missing binary only shows up as a non-zero
  exit code), so the previous probe returned a false positive. The probe now
  considers a non-zero exit as failure. Users with neither a `.venv` nor a
  globally installed `mkdocs` see the actionable "MkDocs was not found"
  dialog (with the ready-to-copy install command) instead of an infinite
  "Starting the MkDocs server..." overlay.
- Preview no longer stays on "Starting the MkDocs server..." for the full
  ready timeout (120 s) when the server process exits early. `waitForReady`
  now aborts as soon as the spawned process is gone, so the failure message
  surfaces immediately.

### Changed

- Internal: extract the ready-polling loop into a pure `pollUntilReady`
  helper in `src/timeout.js`, covered by unit tests (success, abort, timeout,
  abort before first poll).

## [0.1.5] - 2026-05-30

### Fixed

- Launch `mkdocs` through the shell on Windows when the resolved command is a
  bare name (no `.venv` detected). Without this, Node spawned the literal
  string `mkdocs` and failed with `ENOENT`, even when the preflight had just
  confirmed that `mkdocs` was reachable via `PATHEXT`. Projects that rely on a
  globally installed `mkdocs` now start correctly.

### Changed

- Make the spawn error message more actionable: when `mkdocs` cannot be
  started, the error explains what to check (`.venv` or `PATH`) and offers an
  `Open output` button that reveals the log channel.
- Internal: factor the shell-mode decision into a pure `shouldUseShell`
  helper, shared by `server.start` and `preflight.canRun`, and covered by
  unit tests.

## [0.1.4] - 2026-05-30

### Fixed

- Raise the default wait time for the MkDocs server to become ready from 20 s
  to 120 s, so large sites or heavy themes (e.g. `pyodide-mkdocs-theme`) no
  longer trigger a spurious "server is not responding" message when the first
  build takes longer than 20 s.

### Added

- New setting `mkdocsLivePreview.readyTimeout` (in seconds, default 120) to
  fine-tune the ready timeout for very large sites.
- Set `PYTHONUNBUFFERED=1` for the `mkdocs serve` process so its log lines
  appear in the output channel in real time on Windows, instead of arriving
  in a single burst at the end of the build.

## [0.1.3] - 2026-05-30

### Added

- An extension icon and a gallery banner, in preparation for publishing to the
  VS Code Marketplace.

## [0.1.2] - 2026-05-30

### Fixed

- Open the preview on the active Markdown file's page instead of the site home
  page. The webview panel takes the focus when it opens, so the active editor
  was no longer available by the time the server became ready. The source file
  is now captured up front and used to resolve both the project root and the
  target page.

## [0.1.1] - 2026-05-30

### Changed

- Harden `build.sh`: detect a usable Node (>= 18) from `PATH` or the most recent
  nvm install, instead of relying on `nvm use`, so local packaging no longer
  fails on machines where `node` is not on the default `PATH`.

### Fixed

- Exclude hidden tooling directories from the packaged `.vsix`, so editor and
  agent configuration is never shipped with the extension.

## [0.1.0] - 2026-05-29

### Added

- Live preview panel that embeds a running `mkdocs serve` instance in a webview,
  so admonitions, tabs, math and pyodide blocks render exactly as in production.
- Automatic management of `mkdocs serve`: start, stop and restart commands, with
  auto-detection of the workspace `.venv` (falling back to `mkdocs` on `PATH`).
- File-to-page synchronization: the preview follows the active Markdown file,
  honoring `docs_dir` and `use_directory_urls` from `mkdocs.yml`.
- Project detection that walks up from the active file (then the workspace
  folders) to locate `mkdocs.yml`, and restarts the server when the project
  changes.
- Startup overlay with an animated spinner; the preview waits for the server to
  respond instead of showing a blank page during the initial build.
- Preflight checks for Python and MkDocs on Windows, Linux and macOS, with clear,
  OS-aware guidance (copyable install command, links to the install guides).
- Editor-title button with a theme-aware MkDocs logo, a status bar indicator,
  and a `Ctrl+K V` keybinding.
- Markdown snippets for admonitions, collapsible admonitions, tabs, math blocks
  and captioned images.
- Internationalization: English by default, with a complete French localization.
- `build.sh` to produce an installable `.vsix` locally.

[Unreleased]: https://github.com/obook/mkdocs-vsc/compare/v0.1.6...HEAD
[0.1.6]: https://github.com/obook/mkdocs-vsc/releases/tag/v0.1.6
[0.1.5]: https://github.com/obook/mkdocs-vsc/releases/tag/v0.1.5
[0.1.4]: https://github.com/obook/mkdocs-vsc/releases/tag/v0.1.4
[0.1.3]: https://github.com/obook/mkdocs-vsc/releases/tag/v0.1.3
[0.1.2]: https://github.com/obook/mkdocs-vsc/releases/tag/v0.1.2
[0.1.1]: https://github.com/obook/mkdocs-vsc/releases/tag/v0.1.1
[0.1.0]: https://github.com/obook/mkdocs-vsc/releases/tag/v0.1.0

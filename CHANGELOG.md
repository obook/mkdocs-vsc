# Changelog

All notable changes to this extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/obook/mkdocs-vsc/releases/tag/v0.1.0

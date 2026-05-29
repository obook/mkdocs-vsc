# MkDocs Live Preview

A VS Code extension that previews an **MkDocs** site directly in the editor,
in a panel that follows the active Markdown file.

Unlike a generic Markdown preview, the rendering is produced by the **real
`mkdocs serve` server**: admonitions, tabs, math, and even interactive Python
blocks (pyodide) appear exactly as they do in production. MkDocs livereload
refreshes the preview on every save.

## How it works

The extension embeds `mkdocs serve` in an iframe (a webview panel). It does not
touch the editor: you edit the Markdown source as usual, and the panel on the
side shows the faithful rendering.

## Requirements

- VS Code 1.90 or later.
- An MkDocs project (a `mkdocs.yml` file at the root of the workspace).
- `mkdocs` installed, preferably in a `.venv` at the project root
  (auto-detected), otherwise available on the `PATH`.

## Run in development

No npm dependencies, no build step: the extension is written in plain
JavaScript.

1. Open this folder in VS Code.
2. Press **F5** (this launches an Extension Development Host).
3. In the new window, open your MkDocs project.
4. Open a `.md` file, then run **MkDocs: Open Live Preview to the Side**
   (the icon in the editor title bar, or `Ctrl+K V`).

The `mkdocs serve` server starts automatically and the preview opens to the side.

## Commands

| Command | Action |
|---|---|
| `MkDocs: Open Live Preview to the Side` | Open the preview beside the editor (starts the server if needed) |
| `MkDocs: Open Live Preview` | Open the preview in the active column |
| `MkDocs: Start Server` | Start `mkdocs serve` |
| `MkDocs: Stop Server` | Stop the server |
| `MkDocs: Restart Server` | Restart the server |

A status bar item shows the server state; clicking it opens the preview.

## Settings

| Setting | Default | Description |
|---|---|---|
| `mkdocsLivePreview.host` | `127.0.0.1` | Host the dev server binds to |
| `mkdocsLivePreview.port` | `9999` | Port the server listens on |
| `mkdocsLivePreview.mkdocsPath` | `""` | Path to `mkdocs` (empty = auto: `.venv` then `PATH`) |
| `mkdocsLivePreview.configFile` | `mkdocs.yml` | MkDocs config file |
| `mkdocsLivePreview.autoSync` | `true` | Follow the active file in the preview |
| `mkdocsLivePreview.serveArgs` | `["--livereload"]` | Extra arguments passed to `mkdocs serve` |

The file-to-page mapping honors `docs_dir` and `use_directory_urls` as read
from `mkdocs.yml`. If a server is already running on the configured
host and port, the extension reuses it instead of starting a second one.

## Snippets

Available in Markdown files: `!!!` (admonition), `???` (collapsible admonition),
`===` (tabs), `math` (math block), `fig` (captioned image).

## Build an installable package

```bash
./build.sh
```

This produces `dist/mkdocs-live-preview-<version>.vsix`, which you can install
with `code --install-extension <file>.vsix` or through *Extensions: Install
from VSIX...*.

## License

MIT.

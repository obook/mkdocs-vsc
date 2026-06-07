# Security - MkDocs Live Preview

**Last updated:** 2026-05-29
**Reference:** ANSSI secure development guide

## Supported versions

Security fixes target the latest released version.

| Version | Supported |
|---|---|
| 0.1.x | yes |

## Attack surface

### Permissions and capabilities

| Capability | Justification |
|---|---|
| Spawn a child process (`mkdocs serve`) | Build and serve the previewed site locally |
| Bind a local TCP port (default `9999`) | The MkDocs dev server listens on it |
| Open a webview | Display the served site beside the editor |
| Read workspace files | Locate `mkdocs.yml` and map the active file to its page |

### Network

- **Destinations:** none initiated by the extension. The webview only loads the
  local server on the loopback interface.
- **Protocol:** plain HTTP on `localhost`, appropriate for local development.
- **No CDN, no third-party service, no telemetry** initiated by the extension.
  The previewed site may itself load external resources (see `GDPR.md`).

### Storage

- VS Code settings under `mkdocsLivePreview.*` only.
- No secrets stored or transmitted; no synced personal data.

## Threat model

| Threat | Mitigation |
|---|---|
| Code injection / XSS in the webview | The webview Content-Security-Policy restricts framing to the configured localhost host and port; no remote scripts are loaded; the iframe only points at the local server. |
| Malicious or compromised served content | Content is built by MkDocs from the user's own files and isolated in the webview; the CSP limits framing to localhost. |
| Supply-chain (dependencies) | No runtime npm dependencies: only the VS Code API and Node.js built-ins. |
| Arbitrary command execution | Only the configured or auto-detected `mkdocs` executable is spawned, with fixed arguments; a shell is used only for PATH lookups during preflight checks on Windows. |
| Wrong project / port hijacking | The server is tied to the detected project and restarted when it changes; an already-bound port triggers a warning rather than a silent reuse; the server binds loopback only. |
| Unauthorized data access | Only workspace files are read, to locate `mkdocs.yml` and map pages; no secrets; no network calls of its own. |

## CSP policy

The preview webview enforces:

```
default-src 'none'; frame-src http(s)://<host>:<port>; style-src 'unsafe-inline'; script-src 'unsafe-inline'
```

Framing is limited to the configured local server; only the inline assets the
extension ships are allowed.

## Development practices

- **Zero external dependencies**: no runtime `npm install`, no third-party library.
- **No dynamic code**: no `eval()`, no `Function()`, no `setTimeout(string)`.
- **Bounded parsing**: `mkdocs.yml` is read with simple, bounded regular
  expressions; inputs come from the workspace only.
- **Cross-platform preflight**: Python and MkDocs availability is checked before
  starting, with OS-aware guidance.
- **No remote assets** are shipped or required by the extension itself.

## Privacy / GDPR

The extension collects no personal data, has no telemetry, and makes no network
calls of its own. See `GDPR.md` for the full assessment, including the external
resources the previewed MkDocs site may load.

## Reporting a vulnerability

Please report security issues privately through the repository's security
advisory feature, or by opening a minimal issue asking for a private channel:
https://github.com/obook/mkdocs-vsc/issues

A first response can be expected within a reasonable delay; confirmed issues are
fixed in a patch release and documented in `CHANGELOG.md`.

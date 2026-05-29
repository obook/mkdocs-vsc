# Accessibility - MkDocs Live Preview

**Last updated:** 2026-05-29
**Reference:** RGAA 4.x (French accessibility standard)

## Conformance status

The extension's **own** interface is minimal and relies on the accessibility of
VS Code itself. The accessibility of the **previewed content** depends on the
user's MkDocs theme and is outside the scope of this statement.

## Scope

| Surface | Owner |
|---|---|
| Editor-title button, status bar item, commands, keybinding | This extension (via the VS Code API) |
| Startup overlay inside the preview webview | This extension |
| Rendered MkDocs page shown in the iframe | The MkDocs site and its theme |

## Extension surface reviewed

- **Commands and button**: the preview is exposed as a VS Code command with a
  title, an icon and a `Ctrl+K V` keybinding; it is reachable from the command
  palette and operable from the keyboard, like any VS Code command.
- **Status bar item**: carries a text label and a tooltip, and is activatable.
- **Startup overlay**: the status text uses `role="status"` with
  `aria-live="polite"` so screen readers announce it; the spinner is marked
  `aria-hidden="true"` (decorative). The preview iframe has a `title`.
- **Color**: the overlay uses the webview's default foreground on a white
  background; no information is conveyed by color alone.

## Areas for improvement

- Validate the extension surface with a screen reader (NVDA, Orca, VoiceOver).
- The accessibility of the previewed site is the responsibility of the MkDocs
  theme; prefer a theme that meets RGAA 4.x (contrast, keyboard navigation,
  ARIA labels) for the published documentation.

## Contact

To report an accessibility issue, open an issue on the repository:
https://github.com/obook/mkdocs-vsc/issues

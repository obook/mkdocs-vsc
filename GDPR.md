# Privacy / GDPR

This document summarizes how the MkDocs Live Preview extension handles personal
data, in the spirit of the GDPR (Regulation (EU) 2016/679) and the CNIL
developer guidance.

## Data processed by the extension

**None.** The extension does not collect, store, transmit, or process any
personal data. It has:

- no telemetry or analytics;
- no account, login, or identifier;
- no cookies and no profiling;
- no network calls of its own.

All processing happens locally: starting a `mkdocs serve` process, reading the
workspace to locate `mkdocs.yml`, and displaying the local server in a webview.

## External elements to audit

The extension itself contacts nothing remote, but the **previewed MkDocs site**
runs the user's own configuration and theme, which may load external resources
outside the extension's control, for example:

- remote fonts (e.g. Google Fonts) or icon sets;
- assets served from a CDN;
- third-party scripts or analytics declared in `mkdocs.yml` or the theme;
- any network call made by the site's own JavaScript.

These flows belong to the MkDocs project, not to the extension. To keep the
preview (and the published site) free of external tracking, prefer to:

- self-host fonts and assets rather than loading them from a CDN;
- disable analytics in the theme configuration;
- review the site's Content-Security-Policy and outbound requests.

## Data controller and legal basis

Not applicable: since the extension performs no processing of personal data,
there is no data controller role, legal basis, or retention period to declare
for the extension. Responsibility for any data processed by the previewed site
lies with the site's author and configuration.

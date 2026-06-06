/*
 * webview.js
 * Builds the preview webview HTML document.
 *
 * Pure string builder (no VS Code dependency) so the security-relevant parts
 * (the iframe Content-Security-Policy and the baked-in src) can be unit-tested
 * with the built-in Node test runner. Consumed by the preview module.
 *
 * Author: O. Booklage
 * Date: May 2026
 * Licence: MIT
 */

/**
 * Builds the webview HTML: an iframe plus a status overlay with a spinner.
 * The status text uses role="status" so screen readers announce it, and the
 * spinner is marked decorative.
 *
 * @param {string} origin - The server origin allowed by the iframe CSP.
 * @param {string} startingText - Initial overlay message.
 * @param {string} [initialUrl] - When set, baked into the iframe `src` so the
 *        page loads on document load instead of via a later postMessage. A
 *        fresh document load is immune to the "navigation blocked from a
 *        chrome-error page" failure that a scripted cross-origin navigate hits
 *        once a previous load has failed.
 * @returns {string} The HTML document.
 */
function webviewHtml(origin, startingText, initialUrl = '') {
  /* Encode quotes so a page path can never break out of the src attribute. */
  const srcAttr = initialUrl ? ` src="${initialUrl.replace(/"/g, '%22')}"` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; frame-src ${origin}; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #fff; }
  iframe { width: 100%; height: 100vh; border: 0; background: #fff; }
  #overlay {
    position: fixed; inset: 0; display: flex; flex-direction: column; gap: 14px;
    align-items: center; justify-content: center; padding: 1rem; text-align: center;
    font-family: sans-serif; font-size: 13px; color: #888; background: #fff;
  }
  #overlay .spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid currentColor; border-top-color: transparent;
    opacity: 0.55; animation: mk-spin 0.9s linear infinite;
  }
  @keyframes mk-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    #overlay .spinner { animation-duration: 2.4s; }
  }
</style>
</head>
<body>
<div id="overlay" role="status" aria-live="polite"><div class="spinner" aria-hidden="true"></div><div id="overlay-text">${startingText}</div></div>
<iframe id="frame"${srcAttr} title="MkDocs preview"></iframe>
<script>
  const frame = document.getElementById('frame')
  const overlay = document.getElementById('overlay')
  const overlayText = document.getElementById('overlay-text')
  const spinner = overlay.querySelector('.spinner')
  frame.addEventListener('load', () => { if (frame.src) overlay.style.display = 'none' })
  window.addEventListener('message', (event) => {
    const msg = event.data
    if (!msg) return
    if (msg.type === 'navigate' && typeof msg.url === 'string') {
      overlay.style.display = 'none'
      frame.src = msg.url
    } else if (msg.type === 'status' && typeof msg.text === 'string') {
      overlayText.textContent = msg.text
      spinner.style.display = ''
      overlay.style.display = 'flex'
    } else if (msg.type === 'error' && typeof msg.text === 'string') {
      overlayText.textContent = msg.text
      spinner.style.display = 'none'
      overlay.style.display = 'flex'
    }
  })
</script>
</body>
</html>`;
}

module.exports = { webviewHtml };

# Contributing to MkDocs Live Preview

Thank you for your interest in improving this extension. Contributions of all
kinds are welcome: bug reports, feature ideas, documentation fixes, and code.

This is a small, dependency-free VS Code extension written in plain JavaScript.
Please read [`ARCHITECTURE.md`](ARCHITECTURE.md) before sending non-trivial code,
so your change fits the existing design.

## Ways to contribute

- **Report a bug** or **request a feature** through the
  [issue tracker](https://github.com/obook/mkdocs-vsc/issues).
- **Improve the documentation** (README, architecture, snippets).
- **Submit code** through a pull request, as described below.
- **Report a security issue** privately. Do not open a public issue for it;
  follow [`SECURITY.md`](SECURITY.md) instead.

## Reporting a bug

A good report saves a lot of back and forth. Please include:

- the extension version (from the Extensions view or `package.json`);
- your operating system and VS Code version;
- your MkDocs and Python versions (`mkdocs --version`, `python3 --version`);
- the exact steps to reproduce the problem;
- what you expected and what happened instead;
- any relevant output from the **Output** panel or the **Developer Tools**
  console (Help: Toggle Developer Tools).

A minimal `mkdocs.yml` and a small project that reproduces the issue are the most
helpful thing you can provide.

## Requirements

To work on the extension you need:

- **Node.js 18 or later** (the test runner and the packaging tool require it).
- **VS Code 1.90 or later**.
- **Python 3.8 or later** with the `mkdocs` package, to test the preview against
  a real MkDocs project.

The extension has **no runtime npm dependencies** and **no build step**: it uses
only the VS Code API and Node.js built-in modules. There is nothing to install
before running it.

## Running the extension from source

1. Clone the repository and open it in VS Code.
2. Press **F5** to launch the Extension Development Host. This opens a second
   VS Code window with the extension loaded from source.
3. In that window, open a folder that contains an MkDocs project (a `mkdocs.yml`
   at its root), open a Markdown file, and run
   **MkDocs: Open Live Preview to the Side** (or press `Ctrl+K V`).

Changes to the source take effect after you reload the development window
(**Developer: Reload Window**).

## Running the tests

Unit tests run on the built-in Node test runner, with no external dependency:

```bash
npm test
```

The same command runs in [continuous integration](.github/workflows/ci.yml) on
every push and pull request, so make sure it passes locally before you submit.

Tests live in `test/` and mirror the modules in `src/`. Please add or update
tests for any behavior you change, and keep new tests in the same style as the
existing ones.

## Building a package

To produce an installable `.vsix` locally:

```bash
./build.sh
```

This writes `dist/mkdocs-live-preview-<version>.vsix`. You do not need to build a
package to contribute code; this is only for testing the packaged install.

## Coding guidelines

- **Match the existing style.** Read the surrounding code and follow its naming,
  structure, and comment density. The codebase favors small, focused modules in
  `src/`.
- **Keep the zero-dependency policy.** Do not add runtime npm dependencies. Use
  only the VS Code API and Node.js built-in modules. This is a deliberate design
  choice that minimizes supply-chain risk and avoids a build step.
- **No dynamic code.** Do not introduce `eval()`, `Function()`, or
  `setTimeout(string)`. See [`SECURITY.md`](SECURITY.md) for the development
  practices the project follows.
- **Use plain ASCII punctuation** in source and comments: straight quotes,
  simple hyphens, no typographic dashes or curly quotes.
- **Internationalization.** User-facing strings go through `vscode.l10n.t()` for
  runtime messages, or `%key%` placeholders resolved by `package.nls*.json` for
  manifest strings. English is the default; please keep the French translation
  in sync when you add or change a string.

## Commit messages

This project follows the [Conventional Commits](https://www.conventionalcommits.org/)
style, with a type and an optional scope:

```
fix(preview): rebuild the iframe src on host or port change
feat(server): add a restart command
docs(readme): clarify the installation steps
chore(release): 0.1.8
```

Common types are `feat`, `fix`, `docs`, `chore`, `refactor`, and `test`. Write
the subject in the imperative mood and keep it concise. Add a body when the
change needs explanation.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make your change, with tests where it makes sense.
3. Run `npm test` and confirm it passes.
4. Update the documentation when behavior changes: the README, `ARCHITECTURE.md`,
   and a new entry under the **Unreleased** section of [`CHANGELOG.md`](CHANGELOG.md)
   when appropriate. The changelog follows
   [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
5. Open a pull request against `main` with a clear description of what changes
   and why. Link any related issue.

Keep pull requests focused: one logical change per request is easier to review
and to revert if needed.

## Code of conduct

This project has a [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). By taking part, you
agree to follow it. Please be respectful and constructive in issues, pull
requests, and reviews, so this stays a welcoming project for contributors of
every level of experience.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE), the same license as the project.

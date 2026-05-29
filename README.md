# MkDocs Live Preview

Extension VS Code qui affiche le rendu d'un site **MkDocs** directement dans
l'éditeur, avec un panneau d'aperçu synchronisé sur le fichier Markdown actif.

À la différence d'un aperçu Markdown classique, le rendu est produit par le
**vrai serveur `mkdocs serve`** : admonitions, onglets, mathématiques, et même
les blocs Python interactifs (pyodide) s'affichent exactement comme en
production. Le livereload de MkDocs rafraîchit l'aperçu à chaque sauvegarde.

## Fonctionnement

L'extension encapsule `mkdocs serve` dans un iframe (panneau webview). Elle ne
modifie pas l'éditeur : tu édites la source Markdown comme d'habitude, et le
panneau de droite montre le rendu fidèle.

## Prérequis

- VS Code 1.90 ou plus récent.
- Un projet MkDocs (un fichier `mkdocs.yml` à la racine de l'espace de travail).
- `mkdocs` installé, de préférence dans un `.venv` à la racine du projet
  (détecté automatiquement), sinon disponible sur le `PATH`.

## Lancer en développement

Aucune dépendance npm, aucun build : l'extension est en JavaScript pur.

1. Ouvrir ce dossier dans VS Code.
2. Appuyer sur **F5** (lance un hôte de développement d'extensions).
3. Dans la fenêtre qui s'ouvre, ouvrir ton projet MkDocs.
4. Ouvrir un fichier `.md`, puis lancer **MkDocs: Open Live Preview to the Side**
   (icône d'aperçu en haut à droite, ou `Ctrl+K V`).

Le serveur `mkdocs serve` démarre automatiquement et l'aperçu s'ouvre à droite.

## Commandes

| Commande | Effet |
|---|---|
| `MkDocs: Open Live Preview to the Side` | Ouvre l'aperçu à côté (démarre le serveur si besoin) |
| `MkDocs: Open Live Preview` | Ouvre l'aperçu dans la colonne active |
| `MkDocs: Start Server` | Démarre `mkdocs serve` |
| `MkDocs: Stop Server` | Arrête le serveur |
| `MkDocs: Restart Server` | Redémarre le serveur |

Un indicateur dans la barre d'état affiche l'état du serveur ; un clic ouvre
l'aperçu.

## Réglages

| Réglage | Défaut | Description |
|---|---|---|
| `mkdocsLivePreview.host` | `127.0.0.1` | Hôte du serveur de dev |
| `mkdocsLivePreview.port` | `9999` | Port du serveur |
| `mkdocsLivePreview.mkdocsPath` | `""` | Chemin de `mkdocs` (vide = auto : `.venv` puis `PATH`) |
| `mkdocsLivePreview.configFile` | `mkdocs.yml` | Fichier de config MkDocs |
| `mkdocsLivePreview.autoSync` | `true` | Suivre le fichier actif dans l'aperçu |
| `mkdocsLivePreview.serveArgs` | `["--livereload"]` | Arguments passés à `mkdocs serve` |

La correspondance fichier → page respecte `docs_dir` et `use_directory_urls`
lus dans le `mkdocs.yml`.

## Snippets

Disponibles dans les fichiers Markdown : `!!!` (admonition), `???` (admonition
repliable), `===` (onglets), `math` (bloc mathématique), `fig` (image légendée).

## Empaqueter une version installable

```bash
npx --yes @vscode/vsce package
```

Cela produit un fichier `.vsix` installable via *Extensions : Install from
VSIX...*.

## Licence

MIT.

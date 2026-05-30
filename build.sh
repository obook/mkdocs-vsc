#!/usr/bin/env bash
# Fabrique le paquet .vsix de l'extension localement, sans publication.
# Usage : ./build.sh
set -euo pipefail

cd "$(dirname "$0")"

# vsce exige Node >= 18. Si node n'est pas sur le PATH (ou trop ancien) et qu'une
# installation nvm existe, on ajoute au PATH la version de node la plus récente
# qui y est installée. On évite la fonction "nvm use", peu fiable sous set -e.
node_major() { node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0; }

if ! command -v node >/dev/null 2>&1 || [ "$(node_major)" -lt 18 ]; then
  nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [ -d "$nvm_dir/versions/node" ]; then
    # Trie les versions installées et retient la plus haute (tri par version).
    latest="$(ls -1 "$nvm_dir/versions/node" | sort -V | tail -n1)"
    if [ -n "$latest" ]; then
      PATH="$nvm_dir/versions/node/$latest/bin:$PATH"
    fi
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Erreur : node introuvable. Installez Node >= 18 (ou via nvm)." >&2
  exit 1
fi
if [ "$(node_major)" -lt 18 ]; then
  echo "Erreur : Node >= 18 requis, version détectée : $(node --version)." >&2
  exit 1
fi

name="$(node -p "require('./package.json').name")"
version="$(node -p "require('./package.json').version")"
out="dist/${name}-${version}.vsix"

mkdir -p dist
echo "Construction de ${out} ..."
# --allow-missing-repository évite un échec si le champ repository venait à manquer.
npx --yes @vscode/vsce package --allow-missing-repository --out "${out}"

echo
echo "VSIX généré : ${out}"
echo "Installation : code --install-extension \"${out}\""

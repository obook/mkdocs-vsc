#!/usr/bin/env bash
# Fabrique le paquet .vsix de l'extension localement, sans publication.
# Usage : ./build.sh
set -euo pipefail

cd "$(dirname "$0")"

# vsce exige Node >= 18. Si nvm est présent, on bascule sur une version récente.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use 22.21.1 >/dev/null 2>&1 || nvm use --lts >/dev/null 2>&1 || true
fi

name="$(node -p "require('./package.json').name")"
version="$(node -p "require('./package.json').version")"
out="dist/${name}-${version}.vsix"

mkdir -p dist
echo "Construction de ${out} ..."
# --allow-missing-repository évite un échec si le champ repository venait à manquer.
npx --yes @vscode/vsce package --out "${out}"

echo
echo "VSIX généré : ${out}"
echo "Installation : code --install-extension \"${out}\""

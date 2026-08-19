#!/usr/bin/env bash
# Fabrique le .zip à envoyer au Chrome Web Store.
# N'embarque que ce que l'extension charge vraiment — pas les scripts, docs, .git.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="dist/atelier-${VERSION}.zip"

echo "→ Vérifications"

# 1. manifeste valide
python3 -c "import json;json.load(open('manifest.json'))"

# 2. syntaxe de chaque module JS
if command -v node >/dev/null; then
  TMP=$(mktemp -d)
  find js -name '*.js' | while read -r f; do
    cp "$f" "$TMP/$(basename "$f" .js).mjs"
    node --check "$TMP/$(basename "$f" .js).mjs"
  done
  rm -rf "$TMP"
  echo "  js ok"
else
  echo "  ! node absent, vérification JS sautée"
fi

# 3. aucun fichier ou dossier commençant par _ dans TOUT le dépôt.
#    Chrome réserve ce préfixe et refuse de charger l'extension non
#    empaquetée si un seul fichier le porte — même dans docs/ ou scripts/.
if find . -path ./.git -prune -o -path ./dist -prune -o -name '_*' -print | grep -q .; then
  echo "  ✗ un nom de fichier commence par « _ » :" >&2
  find . -path ./.git -prune -o -path ./dist -prune -o -name '_*' -print >&2
  echo "    Chrome refusera de charger l'extension. Renomme-le." >&2
  exit 1
fi

# 4. aucun code distant : la CSP MV3 l'interdit et c'est le motif de rejet nº1
if grep -rnE "<script[^>]+src=[\"']https?://" newtab.html; then
  echo "  ✗ script distant détecté dans newtab.html" >&2
  exit 1
fi

# 5. les permissions déclarées sont-elles toutes utilisées ?
for perm in bookmarks storage favicon topSites; do
  case "$perm" in
    favicon) needle="_favicon" ;;
    *)       needle="chrome.${perm}" ;;
  esac
  grep -rq "$needle" js || echo "  ! permission « $perm » déclarée mais introuvable dans le code"
done

echo "→ Empaquetage $OUT"
rm -rf dist && mkdir -p dist
zip -qr "$OUT" \
  manifest.json \
  newtab.html \
  CHANGELOG.md \
  css \
  js \
  assets \
  -x '*.DS_Store' '*/.*'

echo "→ Contenu"
unzip -l "$OUT" | tail -n +4 | head -n -2 | awk '{print "   " $4}'
echo
echo "✓ $OUT  ($(du -h "$OUT" | cut -f1))"
echo "  Envoi : https://chrome.google.com/webstore/devconsole/"

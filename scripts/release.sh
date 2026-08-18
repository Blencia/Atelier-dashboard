#!/usr/bin/env bash
# Usage : scripts/release.sh 0.2.0
# Bumpe le manifeste, ouvre une section dans le CHANGELOG, commit, tag, build.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage : scripts/release.sh <majeur.mineur.correctif>" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "✗ Arbre de travail sale — commit ou stash d'abord." >&2
  exit 1
fi

python3 - "$VERSION" <<'PY'
import json, sys, pathlib, re, datetime
version = sys.argv[1]

m = pathlib.Path('manifest.json')
data = json.loads(m.read_text())
old = data['version']
data['version'] = version
m.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
print(f'  manifest.json  {old} → {version}')

c = pathlib.Path('CHANGELOG.md')
text = c.read_text()
today = datetime.date.today().isoformat()
text = text.replace('## [Non publié]',
                    f'## [Non publié]\n\n## [{version}] — {today}', 1)
c.write_text(text)
print(f'  CHANGELOG.md   section [{version}] ajoutée')
PY

git add manifest.json CHANGELOG.md
git commit -m "release: v$VERSION"
git tag -a "v$VERSION" -m "v$VERSION"

scripts/build.sh

echo
echo "Reste à faire :"
echo "  git push && git push --tags"
echo "  puis envoyer dist/atelier-$VERSION.zip au Developer Dashboard"

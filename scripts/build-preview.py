#!/usr/bin/env python3
"""Génère docs/apercu.html : l'extension complète dans un seul fichier,
avec l'API Chrome bouchonnée. Sert de démo et de page GitHub Pages."""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

def flatten(rel):
    s = (ROOT / rel).read_text()
    s = re.sub(r"^import .*?;\s*$", "", s, flags=re.M)
    s = re.sub(r"^export ", "", s, flags=re.M)
    return f"\n/* ==== {rel} ==== */\n" + s.strip() + "\n"

ORDER = [
    'js/store.js', 'js/registry.js', 'js/ui.js', 'js/settings.js',
    'js/widgets/bookmarks.js', 'js/widgets/misc.js', 'js/app.js',
]

app = "".join(flatten(p) for p in ORDER)

# En aperçu, les favicons passent par un service public au lieu de /_favicon/
app = app.replace(
    "function faviconUrl(pageUrl, size = 32) {\n  const u = new URL",
    "function faviconUrl(pageUrl, size = 32) {\n  if (window.__previewFavicon) return window.__previewFavicon(pageUrl, size);\n  const u = new URL",
)

css  = (ROOT / 'css/app.css').read_text()
html = (ROOT / 'newtab.html').read_text()
body = re.search(r'<body[^>]*>(.*)</body>', html, re.S).group(1)
body = body.replace('<script type="module" src="js/app.js"></script>', '')
mock = (ROOT / 'scripts/preview-mock.js').read_text()

out = ROOT / 'docs' / 'apercu.html'
out.parent.mkdir(exist_ok=True)
out.write_text(f"""<!DOCTYPE html>
<html lang="fr-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atelier — aperçu</title>
<style>
{css}
</style>
</head>
<body class="booting">
{body}
<script>
{mock}
</script>
<script>
(function(){{
{app}
}})();
</script>
</body>
</html>
""")
print(f"✓ {out.relative_to(ROOT)}  ({out.stat().st_size // 1024} Ko)")

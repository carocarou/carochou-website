#!/usr/bin/env python3
"""One-time migration: wrap each page's body content in <div class="page-content">
with a <div class="free-canvas"></div> overlay, enabling free-floating placement.
Safe to re-run -- skips files that already have the wrapper."""
import os
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

for fpath in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
    name = os.path.basename(fpath)
    with open(fpath, "r", encoding="utf-8") as f:
        html = f.read()

    if 'class="page-content"' in html:
        print(f"skip (already migrated): {name}")
        continue

    parts = html.split("</header>", 1)
    if len(parts) != 2:
        print(f"WARNING: no </header> found in {name}, skipping")
        continue
    before, rest = parts

    rest_parts = rest.split("<footer", 1)
    if len(rest_parts) != 2:
        print(f"WARNING: no <footer found in {name}, skipping")
        continue
    body_content, after = rest_parts

    new_html = (
        before + "</header>\n\n"
        '<div class="page-content">' + body_content.strip() +
        "\n<div class=\"free-canvas\"></div></div>\n\n"
        "<footer" + after
    )
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(new_html)
    print(f"migrated: {name}")

#!/usr/bin/env python3
"""
Optional helper to (re)generate the static HTML pages for this site.
This is NOT required to host the site -- the generated .html files in the
repo root are plain static files you can edit directly. This script just
makes it easy to update shared nav/footer across every page at once.

Usage: python3 scripts/generate.py
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NAV_LINKS = [
    ("index.html", "Home"),
]

WORKS = [
    ("work.html", "Overview"),
    ("work-within.html", "With(In)"),
    ("work-microbes-musical.html", "Microbes! The Musical"),
    ("work-mycelial-mat.html", "Mycelial Mat"),
    ("work-bioremediation-game.html", "Bioremediation Game"),
    ("work-animatronics.html", "Animatronics"),
    ("work-paintings.html", "Paintings"),
    ("work-film-photography.html", "Film Photography"),
    ("work-community-projects.html", "Community Projects"),
    ("work-zines-prints.html", "Zines + Prints"),
    ("work-personal-projects.html", "Personal Projects"),
]

TAIL_LINKS = [
    ("about.html", "About"),
    ("cv.html", "CV"),
    ("contact.html", "Contact"),
]


def build_nav(active=""):
    items = []
    for href, label in NAV_LINKS:
        items.append(f'<a href="{href}">{label}</a>')
    dropdown = "".join(
        f'<a href="{href}">{label}</a>' for href, label in WORKS
    )
    items.append(
        f'<div class="nav-dropdown"><span>Selected Works</span>'
        f'<div class="dropdown-menu">{dropdown}</div></div>'
    )
    for href, label in TAIL_LINKS:
        items.append(f'<a href="{href}">{label}</a>')
    return "\n      ".join(items)


def page(title, description, body, active=""):
    nav = build_nav(active)
    footer_links = "".join(
        f'<a href="{href}">{label}</a>'
        for href, label in [("about.html", "About"), ("cv.html", "CV"), ("contact.html", "Contact")]
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{description}">
<link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
<header class="site-header">
  <div class="header-inner">
    <a class="logo" href="index.html">caroline chou</a>
    <button class="menu-toggle" aria-label="Open Menu" aria-expanded="false">Open Menu</button>
    <nav class="site-nav">
      {nav}
    </nav>
  </div>
</header>

<div class="page-content">
{body}
<div class="free-canvas"></div>
</div>

<footer class="site-footer">
  <nav>{footer_links}</nav>
  <p>&copy; Caroline Chou</p>
</footer>
<script src="assets/js/main.js"></script>
</body>
</html>
"""


PROJECT_NAV_ORDER = [
    ("work-within.html", "with(in)"),
    ("work-microbes-musical.html", "microbes! the musical"),
    ("work-mycelial-mat.html", "mycelial mat"),
    ("work-bioremediation-game.html", "bioremediation game"),
    ("work-animatronics.html", "animatronics"),
    ("work-paintings.html", "paintings"),
    ("work-film-photography.html", "film photography"),
    ("work-community-projects.html", "community projects"),
    ("work-zines-prints.html", "zines + prints"),
    ("work-personal-projects.html", "personal projects"),
]


def project_nav(current_href):
    idx = [h for h, _ in PROJECT_NAV_ORDER].index(current_href)
    prev_href, prev_label = PROJECT_NAV_ORDER[idx - 1]
    next_href, next_label = PROJECT_NAV_ORDER[(idx + 1) % len(PROJECT_NAV_ORDER)]
    return f"""<div class="project-nav">
  <a href="{prev_href}">&larr; {prev_label}</a>
  <a href="work.html">all works</a>
  <a href="{next_href}">{next_label} &rarr;</a>
</div>"""


def write(path, content):
    full = os.path.join(ROOT, path)
    with open(full, "w") as f:
        f.write(content)
    print("wrote", path)

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const SITE_ROOT = path.join(__dirname, "..");
const PORT = 4848;

const app = express();
app.use(express.json({ limit: "20mb" }));

// ---- Serve the real static site at "/" (same origin as the editor iframe) ----
app.use(express.static(SITE_ROOT));

// ---- Serve the editor's own UI ----
app.use("/__editor__", express.static(path.join(__dirname, "public")));

// ---- List editable pages ----
const HTML_NAME_RE = /^[a-zA-Z0-9_-]+\.html$/;

app.get("/__editor__/api/pages", (req, res) => {
  const files = fs
    .readdirSync(SITE_ROOT)
    .filter((f) => f.endsWith(".html") && HTML_NAME_RE.test(f));
  files.sort();
  res.json(files);
});

// ---- Image upload ----
function slugFor(pageParam) {
  const slug = (pageParam || "uploads").replace(/\.html$/, "");
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return "uploads";
  return slug;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(SITE_ROOT, "assets", "images", slugFor(req.query.page));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const dir = path.join(SITE_ROOT, "assets", "images", slugFor(req.query.page));
    const ext = path.extname(safe);
    const base = path.basename(safe, ext) || "image";
    let final = safe || `image${ext}`;
    let i = 1;
    while (fs.existsSync(path.join(dir, final))) {
      final = `${base}-${i}${ext}`;
      i++;
    }
    cb(null, final);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

app.post("/__editor__/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });
  const slug = slugFor(req.query.page);
  res.json({ path: `assets/images/${slug}/${req.file.filename}` });
});

// ---- Save a page's HTML back to disk ----
app.post("/__editor__/api/save", (req, res) => {
  const { file, html } = req.body || {};
  if (!file || !HTML_NAME_RE.test(file)) {
    return res.status(400).json({ error: "invalid file name" });
  }
  if (typeof html !== "string" || html.length < 20) {
    return res.status(400).json({ error: "invalid html payload" });
  }
  const target = path.join(SITE_ROOT, file);
  if (path.dirname(target) !== SITE_ROOT) {
    return res.status(400).json({ error: "invalid path" });
  }
  fs.writeFileSync(target, html);
  res.json({ ok: true });
});

// ---- Create a new page (blank or duplicated), and sync nav links across all pages ----
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function insertDropdownLink(html, file, label) {
  const re = /(<div class="dropdown-menu">)([\s\S]*?)(<\/div>)/;
  const m = html.match(re);
  if (!m) return html;
  if (m[2].indexOf(`href="${file}"`) !== -1) return html;
  return html.replace(re, `$1$2<a href="${file}">${escapeHtml(label)}</a>$3`);
}

app.post("/__editor__/api/pages", (req, res) => {
  const { name, duplicateFrom, addToMenu } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "page name required" });
  }

  let slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) slug = "page";
  let file = `${slug}.html`;
  let n = 2;
  while (fs.existsSync(path.join(SITE_ROOT, file))) {
    file = `${slug}-${n}.html`;
    n++;
  }

  const title = name.trim();

  const refPath = path.join(SITE_ROOT, "about.html");
  if (!fs.existsSync(refPath)) return res.status(500).json({ error: "reference page (about.html) missing" });
  const refHtml = fs.readFileSync(refPath, "utf8");
  const headerMatch = refHtml.match(/<header[\s\S]*?<\/header>/);
  const footerMatch = refHtml.match(/<footer[\s\S]*?<\/footer>/);
  if (!headerMatch || !footerMatch) return res.status(500).json({ error: "could not read site header/footer template" });

  let bodyContent;
  if (duplicateFrom && HTML_NAME_RE.test(duplicateFrom) && fs.existsSync(path.join(SITE_ROOT, duplicateFrom))) {
    const srcHtml = fs.readFileSync(path.join(SITE_ROOT, duplicateFrom), "utf8");
    const afterHeader = srcHtml.split(/<\/header>/)[1] || "";
    const beforeFooter = afterHeader.split(/<footer/)[0] || "";
    bodyContent = beforeFooter.trim();
    if (!bodyContent.includes('class="page-content"')) {
      bodyContent = `<div class="page-content">\n${bodyContent}\n<div class="free-canvas"></div>\n</div>`;
    }
  } else {
    bodyContent = `<div class="page-content">\n<div class="page-header container">\n  <h1>${escapeHtml(title)}</h1>\n  <hr>\n</div>\n<div class="project-body container">\n  <p>Start writing here&hellip;</p>\n</div>\n<div class="free-canvas"></div>\n</div>`;
  }

  const newHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} &mdash; caroline chou</title>
<meta name="description" content="${escapeHtml(title)}">
<link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
${headerMatch[0]}

${bodyContent}

${footerMatch[0]}
<script src="assets/js/main.js"></script>
</body>
</html>
`;

  fs.writeFileSync(path.join(SITE_ROOT, file), newHtml);

  const updatedIn = [];
  if (addToMenu !== false) {
    fs.readdirSync(SITE_ROOT)
      .filter((f) => f.endsWith(".html") && HTML_NAME_RE.test(f))
      .forEach((f) => {
        const p = path.join(SITE_ROOT, f);
        const html = fs.readFileSync(p, "utf8");
        const next = insertDropdownLink(html, file, title);
        if (next !== html) {
          fs.writeFileSync(p, next);
          updatedIn.push(f);
        }
      });
  }

  res.json({ ok: true, file, updatedIn });
});

// ---- Read / rewrite the site-wide nav menu (duplicated across every page) ----
function parseNav(html) {
  const navBlock = html.match(/<nav class="site-nav">([\s\S]*?)<\/nav>/);
  if (!navBlock) return null;
  const inner = navBlock[1];
  const itemRe = /<a href="([^"]*)">([^<]*)<\/a>|<div class="nav-dropdown"><span>([^<]*)<\/span><div class="dropdown-menu">([\s\S]*?)<\/div><\/div>/g;
  const items = [];
  let m;
  while ((m = itemRe.exec(inner)) !== null) {
    if (m[1] !== undefined) {
      items.push({ type: "link", label: m[2], href: m[1] });
    } else {
      const children = [];
      const childRe = /<a href="([^"]*)">([^<]*)<\/a>/g;
      let cm;
      while ((cm = childRe.exec(m[4])) !== null) {
        children.push({ label: cm[2], href: cm[1] });
      }
      items.push({ type: "dropdown", label: m[3], children });
    }
  }
  return items;
}

function buildNavHtml(items) {
  const parts = items.map((item) => {
    if (item.type === "dropdown") {
      const children = (item.children || [])
        .map((c) => `<a href="${escapeHtml(c.href)}">${escapeHtml(c.label)}</a>`)
        .join("");
      return `<div class="nav-dropdown"><span>${escapeHtml(item.label)}</span><div class="dropdown-menu">${children}</div></div>`;
    }
    return `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`;
  });
  return parts.join("\n      ");
}

app.get("/__editor__/api/nav", (req, res) => {
  const refPath = path.join(SITE_ROOT, "index.html");
  if (!fs.existsSync(refPath)) return res.status(500).json({ error: "index.html missing" });
  const items = parseNav(fs.readFileSync(refPath, "utf8"));
  if (!items) return res.status(500).json({ error: "could not parse nav" });
  res.json({ items });
});

app.post("/__editor__/api/nav", (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });

  const navHtml = buildNavHtml(items);
  const fullNavRe = /<nav class="site-nav">[\s\S]*?<\/nav>/;
  const replacement = `<nav class="site-nav">\n      ${navHtml}\n    </nav>`;
  const updatedIn = [];

  fs.readdirSync(SITE_ROOT)
    .filter((f) => f.endsWith(".html") && HTML_NAME_RE.test(f))
    .forEach((f) => {
      const p = path.join(SITE_ROOT, f);
      const html = fs.readFileSync(p, "utf8");
      if (!fullNavRe.test(html)) return;
      const next = html.replace(fullNavRe, replacement);
      if (next !== html) {
        fs.writeFileSync(p, next);
        updatedIn.push(f);
      }
    });

  res.json({ ok: true, updatedIn });
});

// ---- Delete a page, and clean up any <a> links pointing to it from other pages ----
app.delete("/__editor__/api/pages/:file", (req, res) => {
  const { file } = req.params;
  if (!HTML_NAME_RE.test(file)) return res.status(400).json({ error: "invalid file name" });
  const target = path.join(SITE_ROOT, file);
  if (path.dirname(target) !== SITE_ROOT || !fs.existsSync(target)) {
    return res.status(404).json({ error: "page not found" });
  }

  fs.unlinkSync(target);

  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linkRe = new RegExp('<a[^>]*href="' + escaped + '"[^>]*>[\\s\\S]*?<\\/a>', "gi");
  const updatedIn = [];

  fs.readdirSync(SITE_ROOT)
    .filter((f) => f.endsWith(".html") && HTML_NAME_RE.test(f))
    .forEach((f) => {
      const p = path.join(SITE_ROOT, f);
      const html = fs.readFileSync(p, "utf8");
      if (linkRe.test(html)) {
        linkRe.lastIndex = 0;
        const next = html.replace(linkRe, "");
        fs.writeFileSync(p, next);
        updatedIn.push(f);
      }
    });

  res.json({ ok: true, updatedIn });
});

app.listen(PORT, () => {
  console.log(`\nVisual editor running:\n  http://localhost:${PORT}/__editor__/\n`);
});

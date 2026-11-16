const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const SiteTheme = require("./public/theme.js");

const SITE_ROOT = path.join(__dirname, "..");
const DRAFTS_DIR = path.join(__dirname, ".drafts");
const THEME_PATH = path.join(SITE_ROOT, "assets", "css", "theme.css");
const THEME_LINK = '<link rel="stylesheet" href="assets/css/theme.css">';
const PORT = 4848;

fs.mkdirSync(DRAFTS_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: "20mb" }));

const HTML_NAME_RE = /^[a-zA-Z0-9_-]+\.html$/;

function sitePages() {
  return fs
    .readdirSync(SITE_ROOT)
    .filter((f) => f.endsWith(".html") && HTML_NAME_RE.test(f))
    .sort();
}

// Real pages plus any autosaved drafts: site-wide edits (menu, styles, page
// deletions) are applied to both, so restoring a draft never brings back an
// old menu.
function editableFilePaths() {
  return sitePages().map((f) => path.join(SITE_ROOT, f)).concat(
    fs.readdirSync(DRAFTS_DIR).filter((f) => HTML_NAME_RE.test(f)).map((f) => path.join(DRAFTS_DIR, f))
  );
}

// ---- Drafts: "/page.html?__draft=1" serves the autosaved draft in place of the
// real file, at the same URL so relative asset paths keep working ----
app.get("/:file", (req, res, next) => {
  const { file } = req.params;
  if (!req.query.__draft || !HTML_NAME_RE.test(file)) return next();
  const draft = path.join(DRAFTS_DIR, file);
  if (!fs.existsSync(draft)) return next();
  res.type("html").send(fs.readFileSync(draft, "utf8"));
});

// ---- Serve the real static site at "/" (same origin as the editor iframe) ----
app.use(express.static(SITE_ROOT, { etag: false, lastModified: false, setHeaders: (res) => res.set("Cache-Control", "no-store") }));

// ---- Serve the editor's own UI ----
app.use("/__editor__", express.static(path.join(__dirname, "public")));

// ---- List editable pages ----
app.get("/__editor__/api/pages", (req, res) => {
  res.json(sitePages());
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

// ---- Site Styles (theme.css) ----
function readThemeSettings() {
  if (!fs.existsSync(THEME_PATH)) return Object.assign({}, SiteTheme.DEFAULTS);
  return SiteTheme.parseThemeSettings(fs.readFileSync(THEME_PATH, "utf8"));
}

// Fonts picked for individual bits of text (via the text toolbar) need to be
// loaded on the live site too, so theme.css imports every curated font that
// any page actually uses.
function writeTheme(settings) {
  const used = new Set();
  sitePages().forEach((f) => {
    SiteTheme.fontsUsedIn(fs.readFileSync(path.join(SITE_ROOT, f), "utf8")).forEach((n) => used.add(n));
  });
  const css = SiteTheme.buildThemeCss(settings, Array.from(used));
  const prev = fs.existsSync(THEME_PATH) ? fs.readFileSync(THEME_PATH, "utf8") : null;
  if (prev !== css) fs.writeFileSync(THEME_PATH, css);
}

function withThemeLink(html) {
  if (html.includes('href="assets/css/theme.css"')) return html;
  const styleLink = /<link rel="stylesheet" href="assets\/css\/style\.css">/;
  if (styleLink.test(html)) return html.replace(styleLink, (m) => `${m}\n${THEME_LINK}`);
  return html.replace(/<\/head>/i, `${THEME_LINK}\n</head>`);
}

app.get("/__editor__/api/theme", (req, res) => {
  res.json({ settings: readThemeSettings(), fonts: SiteTheme.FONTS.map((f) => f.name) });
});

app.post("/__editor__/api/theme", (req, res) => {
  const { settings } = req.body || {};
  if (!settings || typeof settings !== "object") return res.status(400).json({ error: "settings required" });
  writeTheme(settings);
  // make sure every page loads theme.css
  editableFilePaths().forEach((p) => {
    const html = fs.readFileSync(p, "utf8");
    const next = withThemeLink(html);
    if (next !== html) fs.writeFileSync(p, next);
  });
  res.json({ ok: true });
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
  const usesCustomFont = SiteTheme.fontsUsedIn(html).length > 0;
  const finalHtml = usesCustomFont || fs.existsSync(THEME_PATH) ? withThemeLink(html) : html;
  fs.writeFileSync(target, finalHtml);
  const draft = path.join(DRAFTS_DIR, file);
  if (fs.existsSync(draft)) fs.unlinkSync(draft);
  if (usesCustomFont || fs.existsSync(THEME_PATH)) writeTheme(readThemeSettings());
  res.json({ ok: true });
});

// ---- Autosaved drafts ----
app.get("/__editor__/api/drafts", (req, res) => {
  const list = fs.readdirSync(DRAFTS_DIR).filter((f) => HTML_NAME_RE.test(f)).map((f) => ({
    file: f,
    savedAt: fs.statSync(path.join(DRAFTS_DIR, f)).mtimeMs,
  }));
  res.json(list);
});

app.get("/__editor__/api/drafts/:file", (req, res) => {
  const { file } = req.params;
  if (!HTML_NAME_RE.test(file)) return res.status(400).json({ error: "invalid file name" });
  const p = path.join(DRAFTS_DIR, file);
  if (!fs.existsSync(p)) return res.json({ exists: false });
  res.json({ exists: true, savedAt: fs.statSync(p).mtimeMs, html: fs.readFileSync(p, "utf8") });
});

app.put("/__editor__/api/drafts/:file", (req, res) => {
  const { file } = req.params;
  const { html } = req.body || {};
  if (!HTML_NAME_RE.test(file)) return res.status(400).json({ error: "invalid file name" });
  if (typeof html !== "string" || html.length < 20) return res.status(400).json({ error: "invalid html payload" });
  fs.writeFileSync(path.join(DRAFTS_DIR, file), html);
  res.json({ ok: true, savedAt: Date.now() });
});

app.delete("/__editor__/api/drafts/:file", (req, res) => {
  const { file } = req.params;
  if (!HTML_NAME_RE.test(file)) return res.status(400).json({ error: "invalid file name" });
  const p = path.join(DRAFTS_DIR, file);
  if (fs.existsSync(p)) fs.unlinkSync(p);
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

  const themeLink = fs.existsSync(THEME_PATH) ? `\n${THEME_LINK}` : "";
  const newHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} &mdash; caroline chou</title>
<meta name="description" content="${escapeHtml(title)}">
<link rel="stylesheet" href="assets/css/style.css">${themeLink}
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
  if (addToMenu) {
    editableFilePaths().forEach((p) => {
      const html = fs.readFileSync(p, "utf8");
      const next = insertDropdownLink(html, file, title);
      if (next !== html) {
        fs.writeFileSync(p, next);
        updatedIn.push(path.basename(p));
      }
    });
  }

  res.json({ ok: true, file, updatedIn });
});

// ---- Read / rewrite the site-wide nav menu (duplicated across every page) ----
// A dropdown's title is either plain text (<span>) or itself a link (<a>), e.g.
// "Selected Works" links to work.html and also opens the project list.
function parseNav(html) {
  const navBlock = html.match(/<nav class="site-nav">([\s\S]*?)<\/nav>/);
  if (!navBlock) return null;
  const inner = navBlock[1];
  const itemRe = /<div class="nav-dropdown">(?:<span>([^<]*)<\/span>|<a href="([^"]*)">([^<]*)<\/a>)<div class="dropdown-menu">([\s\S]*?)<\/div><\/div>|<a href="([^"]*)">([^<]*)<\/a>/g;
  const items = [];
  let m;
  while ((m = itemRe.exec(inner)) !== null) {
    if (m[5] !== undefined) {
      items.push({ type: "link", label: m[6], href: m[5] });
    } else {
      const children = [];
      const childRe = /<a href="([^"]*)">([^<]*)<\/a>/g;
      let cm;
      while ((cm = childRe.exec(m[4])) !== null) {
        children.push({ label: cm[2], href: cm[1] });
      }
      items.push({
        type: "dropdown",
        label: m[1] !== undefined ? m[1] : m[3],
        href: m[2] || "",
        children,
      });
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
      const title = item.href
        ? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
        : `<span>${escapeHtml(item.label)}</span>`;
      return `<div class="nav-dropdown">${title}<div class="dropdown-menu">${children}</div></div>`;
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

  editableFilePaths().forEach((p) => {
    const html = fs.readFileSync(p, "utf8");
    if (!fullNavRe.test(html)) return;
    const next = html.replace(fullNavRe, replacement);
    if (next !== html) {
      fs.writeFileSync(p, next);
      updatedIn.push(path.basename(p));
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
  const draft = path.join(DRAFTS_DIR, file);
  if (fs.existsSync(draft)) fs.unlinkSync(draft);

  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linkRe = new RegExp('<a[^>]*href="' + escaped + '"[^>]*>[\\s\\S]*?<\\/a>', "gi");
  const updatedIn = [];

  editableFilePaths().forEach((p) => {
    const html = fs.readFileSync(p, "utf8");
    if (linkRe.test(html)) {
      linkRe.lastIndex = 0;
      const next = html.replace(linkRe, "");
      fs.writeFileSync(p, next);
      updatedIn.push(path.basename(p));
    }
  });

  res.json({ ok: true, updatedIn });
});

// ---- Publish: what's changed since the last publish, and push it live ----
function git(args, cb) {
  execFile("git", args, {
    cwd: SITE_ROOT,
    timeout: 90 * 1000,
    env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: "0" }),
    maxBuffer: 4 * 1024 * 1024,
  }, (err, stdout, stderr) => cb(err, String(stdout || ""), String(stderr || "")));
}

function changedFiles(cb) {
  git(["status", "--porcelain", "-uall"], (err, out) => {
    if (err) return cb(err);
    const files = out.split("\n").filter(Boolean).map((line) => {
      const code = line.slice(0, 2).trim();
      const file = line.slice(3).replace(/^"|"$/g, "");
      const kind = code === "??" || code === "A" ? "added" : code === "D" ? "deleted" : "changed";
      return { file, kind };
    });
    cb(null, files);
  });
}

app.get("/__editor__/api/publish-status", (req, res) => {
  changedFiles((err, files) => {
    if (err) return res.status(500).json({ error: String(err.message || err) });
    // a commit made earlier whose push failed shows up as "ahead of origin"
    git(["rev-list", "--count", "@{u}..HEAD"], (err2, out) => {
      res.json({ files, unpushed: err2 ? 0 : parseInt(out.trim(), 10) || 0 });
    });
  });
});

let publishing = false;
app.post("/__editor__/api/publish", (req, res) => {
  if (publishing) return res.status(409).json({ error: "A publish is already running." });
  const message = String((req.body && req.body.message) || "").trim() ||
    `Update site ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  publishing = true;
  const done = (status, body) => { publishing = false; res.status(status).json(body); };

  changedFiles((err, files) => {
    if (err) return done(500, { error: String(err.message || err) });
    const commitStep = (next) => {
      if (!files.length) return next(); // only retrying an earlier failed push
      git(["add", "-A"], (err1, _o1, e1) => {
        if (err1) return done(500, { error: "git add failed: " + (e1 || err1.message) });
        git(["commit", "-m", message], (err2, o2, e2) => {
          if (err2) return done(500, { error: "git commit failed: " + (e2 || o2 || err2.message) });
          next();
        });
      });
    };
    commitStep(() => {
        git(["push"], (err3, o3, e3) => {
          if (err3) {
            return done(500, {
              error: "Saved a commit locally, but pushing to GitHub failed. Nothing went live yet; " +
                "fix the problem below and press Publish again.\n\n" + (e3 || o3 || err3.message),
              committed: true,
            });
          }
          done(200, { ok: true, published: files.length });
        });
    });
  });
});

app.listen(PORT, () => {
  console.log(`\nVisual editor running:\n  http://localhost:${PORT}/__editor__/\n`);
});

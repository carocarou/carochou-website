(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  var frame = $("page-frame");
  var frameWrap = $("frame-wrap");
  var emptyState = $("empty-state");
  var pageTitle = $("page-title");
  var saveStatus = $("save-status");
  var undoBtn = $("undo-btn");
  var redoBtn = $("redo-btn");
  var saveBtn = $("save-btn");
  var discardBtn = $("discard-btn");
  var publishBtn = $("publish-btn");
  var publishCount = $("publish-count");
  var addBlock = $("add-block");
  var addBlockMenu = $("add-block-menu");
  var draftBanner = $("draft-banner");
  var treeEl = $("page-tree");
  var searchEl = $("page-search");

  var HISTORY_LIMIT = 100;
  var AUTOSAVE_DELAY = 1500; // ms after the last edit before the page file is written
  var autoSaveOn = true;
  try { autoSaveOn = localStorage.getItem("editor:autosave") !== "off"; } catch (e) {}
  var autoSaveTimer = null;
  var saving = false;
  var savePromise = null;              // the save in flight, if any
  var draftPromise = Promise.resolve(); // the latest draft write
  var SNAPSHOT_DELAY = 500;

  // ---------------------------------------------------------------- helpers
  function api(method, url, body) {
    var opts = { method: method, headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch("/__editor__/api/" + url, opts).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.error || ("HTTP " + r.status));
        return data;
      });
    });
  }

  // toast with an Undo button (e.g. after deleting a section)
  function notice(msg, withUndo) {
    var t = $("toast");
    t.innerHTML = "";
    var span = document.createElement("span");
    span.textContent = msg;
    t.appendChild(span);
    if (withUndo) {
      var b = document.createElement("button");
      b.className = "toast-action";
      b.textContent = "Undo";
      b.addEventListener("click", function () { t.hidden = true; undo(); });
      t.appendChild(b);
    }
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 6000);
  }

  var toastTimer = null;
  function toast(msg, ms) {
    var t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 2600);
  }

  function niceName(file) {
    var s = file.replace(/\.html$/, "").replace(/^work-/, "").replace(/[-_]/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function timeAgo(ms) {
    var s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return "just now";
    var m = Math.round(s / 60);
    if (m < 60) return m + " min ago";
    var h = Math.round(m / 60);
    if (h < 24) return h + " hr ago";
    return new Date(ms).toLocaleDateString();
  }

  // ---------------------------------------------------------------- page state
  // history holds clean-HTML snapshots of the page; history[idx] is what's on
  // screen. baseline is the version saved on disk. Undo/redo load a snapshot
  // into the frame (through the draft URL); every change is autosaved as a
  // draft so nothing is lost when switching pages or closing the browser.
  var st = {
    file: null,
    ready: false,
    baseline: null,
    history: [],
    idx: -1,
    snapTimer: null,
    restoring: false,     // frame is reloading to show a history snapshot
    autoRestore: false,   // on next load, silently restore the page's draft
    scrollY: 0,
    lastDraftAt: null,
  };
  window.__editorState = st; // handy for debugging from the browser console
  var labels = {};        // file -> label from the site menu
  var drafts = {};        // file -> savedAt for pages with autosaved drafts
  var pages = [];
  var navItems = [];

  function frameWin() { return frame.contentWindow; }
  function cleanHTML() {
    var w = frameWin();
    return w && w.__editorGetCleanHTML ? w.__editorGetCleanHTML() : null;
  }
  function isDirty() { return st.idx >= 0 && st.history[st.idx] !== st.baseline; }

  function updateUI() {
    var has = !!st.file && st.ready;
    undoBtn.disabled = !has || st.idx <= 0;
    redoBtn.disabled = !has || st.idx >= st.history.length - 1;
    saveBtn.disabled = !has || !isDirty();
    discardBtn.disabled = !has || !isDirty();
    saveBtn.hidden = autoSaveOn;
    discardBtn.hidden = autoSaveOn;
    addBlock.hidden = !has;
    $("settings-btn").disabled = !has;
    saveStatus.classList.remove("dirty", "ok");
    if (!st.file) saveStatus.textContent = "";
    else if (!st.ready) saveStatus.textContent = "Loading…";
    else if (isDirty()) {
      saveStatus.classList.add("dirty");
      saveStatus.textContent = autoSaveOn ? "Saving soon…" : "Unsaved changes" + (st.lastDraftAt ? " · draft kept" : "");
    } else saveStatus.textContent = "All changes saved";
    renderTree();
  }

  function snapshotNow() {
    clearTimeout(st.snapTimer);
    st.snapTimer = null;
    if (!st.ready) return;
    var html = cleanHTML();
    if (!html || html === st.history[st.idx]) return;
    st.history = st.history.slice(0, st.idx + 1);
    st.history.push(html);
    if (st.history.length > HISTORY_LIMIT) st.history.shift();
    st.idx = st.history.length - 1;
    autosave();
    scheduleAutoSave();
    updateUI();
  }

  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    if (!autoSaveOn || !isDirty()) return;
    autoSaveTimer = setTimeout(function () { save({ auto: true }); }, AUTOSAVE_DELAY);
  }
  function flush() { if (st.snapTimer) snapshotNow(); }

  function autosave() {
    var file = st.file;
    if (isDirty()) {
      var html = st.history[st.idx];
      draftPromise = api("PUT", "drafts/" + encodeURIComponent(file), { html: html }).then(function (d) {
        drafts[file] = d.savedAt;
        if (file === st.file) { st.lastDraftAt = d.savedAt; updateUI(); }
      }).catch(function () {});
    } else if (drafts[file]) {
      delete drafts[file];
      api("DELETE", "drafts/" + encodeURIComponent(file)).catch(function () {});
    }
  }

  function onDirty() {
    saveStatus.classList.add("dirty");
    saveStatus.textContent = "Editing…";
    clearTimeout(st.snapTimer);
    st.snapTimer = setTimeout(snapshotNow, SNAPSHOT_DELAY);
  }

  function onKey(action) {
    if (action === "undo") undo();
    else if (action === "redo") redo();
    else if (action === "save") save();
  }

  // show history[idx] in the frame (served from the draft slot)
  function showSnapshot() {
    var html = st.history[st.idx];
    var w = frameWin();
    st.scrollY = w ? w.scrollY : 0;
    st.restoring = true;
    st.ready = false;
    updateUI();
    api("PUT", "drafts/" + encodeURIComponent(st.file), { html: html }).then(function (d) {
      drafts[st.file] = d.savedAt;
      frame.src = "/" + st.file + "?__draft=1&t=" + Date.now();
    }).catch(function (err) { st.restoring = false; alert("Couldn't undo: " + err.message); });
  }

  function undo() {
    if (!st.ready) return;
    flush();
    if (st.idx <= 0) return;
    st.idx--;
    showSnapshot();
  }
  function redo() {
    if (!st.ready || st.idx >= st.history.length - 1) return;
    st.idx++;
    showSnapshot();
  }

  // ---------------------------------------------------------------- open a page
  function openPage(file, opts) {
    opts = opts || {};
    if (st.file && st.ready) {
      flush();
      if (autoSaveOn && isDirty()) save({ auto: true });
    }
    clearTimeout(autoSaveTimer);
    st.file = file;
    st.ready = false;
    st.baseline = null;
    st.history = [];
    st.idx = -1;
    st.restoring = false;
    st.autoRestore = !!opts.autoRestore;
    st.scrollY = opts.keepScroll && frameWin() ? frameWin().scrollY : 0;
    st.lastDraftAt = null;
    draftBanner.hidden = true;
    pageTitle.textContent = labels[file] || niceName(file);
    emptyState.style.display = "none";
    frame.style.display = "block";
    frame.src = "/" + file + "?t=" + Date.now();
    try { localStorage.setItem("editor:lastPage", file); } catch (e) {}
    updateUI();
  }

  function injectEditor() {
    var doc = frame.contentDocument;
    var win = frameWin();
    if (!doc || doc.getElementById("__editor_injected_style__")) return;

    var style = doc.createElement("link");
    style.id = "__editor_injected_style__";
    style.rel = "stylesheet";
    style.href = "/__editor__/editor-inject.css";
    doc.head.appendChild(style);

    var sortable = doc.createElement("script");
    sortable.id = "__editor_sortable_script__";
    sortable.src = "/__editor__/vendor/Sortable.min.js";
    sortable.onload = function () {
      var script = doc.createElement("script");
      script.id = "__editor_injected_script__";
      script.src = "/__editor__/editor-inject.js";
      script.onload = function () {
        win.__editorOnDirty = onDirty;
        win.__editorOnKey = onKey;
        win.__editorOnNotice = notice;
        win.__editorOnRebuild = function () { snapshotNow(); showSnapshot(); };
        applyThemePreview();
        onEditorReady();
      };
      doc.head.appendChild(script);
    };
    doc.head.appendChild(sortable);
  }

  frame.addEventListener("load", function () {
    if (!st.file) return;
    var w = frameWin();
    var loc = w && w.location ? w.location.pathname.replace(/^\//, "") : "";
    // a menu link was clicked inside the page: follow it as a page switch
    if (loc && loc !== st.file && /^[a-zA-Z0-9_-]+\.html$/.test(loc)) {
      openPage(loc);
      return;
    }
    if (!/^[a-zA-Z0-9_-]+\.html$/.test(loc)) return; // not a site page
    injectEditor();
  });

  function onEditorReady() {
    setTimeout(function () { if (window.__refreshPageSettings) window.__refreshPageSettings(); }, 0);
    var w = frameWin();
    if (st.restoring) {
      st.restoring = false;
      st.ready = true;
      if (w) w.scrollTo(0, st.scrollY);
      if (!isDirty()) autosave(); // stepped back to the saved version: drop the draft
      scheduleAutoSave();
      updateUI();
      return;
    }
    st.baseline = cleanHTML();
    st.history = [st.baseline];
    st.idx = 0;
    st.ready = true;
    if (st.scrollY && w) w.scrollTo(0, st.scrollY);
    updateUI();
    checkDraft();
  }

  function checkDraft() {
    var file = st.file;
    api("GET", "drafts/" + encodeURIComponent(file)).then(function (d) {
      if (file !== st.file) return;
      if (!d.exists) { delete drafts[file]; renderTree(); return; }
      if (d.html === st.baseline) {
        api("DELETE", "drafts/" + encodeURIComponent(file));
        delete drafts[file];
        renderTree();
        return;
      }
      drafts[file] = d.savedAt;
      var restore = function () {
        draftBanner.hidden = true;
        st.history.push(d.html);
        st.idx = st.history.length - 1;
        st.lastDraftAt = d.savedAt;
        showSnapshot();
      };
      if (st.autoRestore) { st.autoRestore = false; restore(); return; }
      $("draft-banner-text").textContent =
        "You have unsaved changes on this page from " + timeAgo(d.savedAt) + ".";
      draftBanner.hidden = false;
      $("draft-restore-btn").onclick = restore;
      $("draft-dismiss-btn").onclick = function () {
        draftBanner.hidden = true;
        delete drafts[file];
        api("DELETE", "drafts/" + encodeURIComponent(file));
        renderTree();
      };
      renderTree();
    }).catch(function () {});
  }

  // ---------------------------------------------------------------- save / discard
  // opts.auto: triggered by auto-save (quiet; problems show in the status line)
  function save(opts) {
    opts = opts || {};
    if (!st.ready) return Promise.resolve(false);
    flush();
    clearTimeout(autoSaveTimer);
    if (!isDirty()) return Promise.resolve(true);
    if (saving) return savePromise.then(function () { return save(opts); });
    var file = st.file;
    var html = st.history[st.idx];
    saving = true;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    if (opts.auto) { saveStatus.classList.remove("ok"); saveStatus.textContent = "Saving…"; }
    savePromise = api("POST", "save", { file: file, html: html }).then(function () {
      saving = false;
      saveBtn.textContent = "Save";
      delete drafts[file];
      if (file === st.file) {
        st.baseline = html;
        st.lastDraftAt = null;
        updateUI();
        if (!isDirty()) {
          saveStatus.classList.add("ok");
          saveStatus.textContent = (opts.auto ? "Saved automatically" : "Saved") + " · not live until you publish";
        }
      }
      refreshPublishStatus();
      // more edits arrived while saving: keep their draft and save them next
      if (file === st.file && isDirty()) { autosave(); scheduleAutoSave(); }
      return true;
    }).catch(function (err) {
      saving = false;
      saveBtn.textContent = "Save";
      updateUI();
      if (opts.auto) {
        saveStatus.classList.add("dirty");
        saveStatus.textContent = "Auto-save failed. Your draft is kept; retrying…";
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(function () { save({ auto: true }); }, 10000);
      } else {
        alert("Save failed: " + err.message);
      }
      return false;
    });
    return savePromise;
  }


  saveBtn.addEventListener("click", function () { save(); });

  // Before anything that rewrites every page (menu, styles, new page, site
  // icon): finish writing the open page first, so an auto-save landing
  // afterwards can't put back the old version of that page.
  function settle() {
    if (!st.ready) return Promise.all([savePromise, draftPromise]);
    flush();
    clearTimeout(autoSaveTimer);
    var p = autoSaveOn && isDirty() ? save({ auto: true }) : savePromise;
    return Promise.all([p, draftPromise]);
  }
  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", redo);
  discardBtn.addEventListener("click", function () {
    if (!confirm("Throw away all unsaved changes on this page?")) return;
    var file = st.file;
    delete drafts[file];
    api("DELETE", "drafts/" + encodeURIComponent(file)).finally(function () { openPage(file, { keepScroll: true }); });
  });

  document.addEventListener("keydown", function (e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    var k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
    else if (k === "s") { e.preventDefault(); save(); }
  });

  window.addEventListener("beforeunload", function () {
    flush();
    if (autoSaveOn && st.ready && isDirty() && navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify({ file: st.file, html: st.history[st.idx] })], { type: "application/json" });
      navigator.sendBeacon("/__editor__/api/save", blob);
    }
  });

  // ---------------------------------------------------------------- auto-save switch
  var autoSaveToggle = $("autosave-toggle");
  autoSaveToggle.checked = autoSaveOn;
  autoSaveToggle.addEventListener("change", function () {
    autoSaveOn = autoSaveToggle.checked;
    try { localStorage.setItem("editor:autosave", autoSaveOn ? "on" : "off"); } catch (e) {}
    toast(autoSaveOn ? "Auto-save on: edits are saved as you go" : "Auto-save off: press Save (⌘S) to keep edits");
    if (autoSaveOn) scheduleAutoSave(); else clearTimeout(autoSaveTimer);
    updateUI();
  });

  // ---------------------------------------------------------------- sidebar page tree
  var collapsed = {};
  try { collapsed = JSON.parse(localStorage.getItem("editor:collapsed") || "{}"); } catch (e) {}

  function loadPagesAndNav() {
    return Promise.all([api("GET", "pages"), api("GET", "nav").catch(function () { return { items: [] }; }), api("GET", "drafts")])
      .then(function (r) {
        pages = r[0];
        navItems = r[1].items || [];
        drafts = {};
        r[2].forEach(function (d) { drafts[d.file] = d.savedAt; });
        labels = {};
        navItems.forEach(function (it) {
          if (it.href && /\.html$/.test(it.href)) labels[it.href] = it.label;
          (it.children || []).forEach(function (c) { if (/\.html$/.test(c.href)) labels[c.href] = c.label; });
        });
        if (st.file) pageTitle.textContent = labels[st.file] || niceName(st.file);
        renderTree();
      });
  }

  function iconSvg(kind) {
    if (kind === "dup") return "<svg width='13' height='13' viewBox='0 0 14 14'><rect x='4.5' y='4.5' width='8' height='8' rx='1.5' fill='none' stroke='currentColor' stroke-width='1.3'/><path d='M9.5 2.5V2A.5.5 0 0 0 9 1.5H2A.5.5 0 0 0 1.5 2v7a.5.5 0 0 0 .5.5h.5' fill='none' stroke='currentColor' stroke-width='1.3'/></svg>";
    return "<svg width='13' height='13' viewBox='0 0 14 14'><path d='M2 3.5h10M5.5 3.5V2h3v1.5M3.5 3.5l.6 8.5h5.8l.6-8.5' fill='none' stroke='currentColor' stroke-width='1.3' stroke-linejoin='round'/></svg>";
  }

  function pageRow(file, label, opts) {
    opts = opts || {};
    var row = document.createElement("div");
    row.className = "tree-row" + (opts.child ? " child" : "") + (file === st.file ? " active" : "");
    if (opts.caret) row.appendChild(opts.caret);
    else {
      var sp = document.createElement("span");
      sp.className = "tree-caret-spacer";
      row.appendChild(sp);
    }
    var lab = document.createElement("span");
    lab.className = "tree-label" + (file ? "" : " muted");
    lab.textContent = label;
    row.appendChild(lab);
    if (!file) return row;
    row.title = file;
    row.addEventListener("click", function () { if (file !== st.file) openPage(file); });

    var dirtyHere = (file === st.file && isDirty()) || (file !== st.file && drafts[file]);
    if (dirtyHere) {
      var dot = document.createElement("span");
      dot.className = "tree-draft-dot";
      dot.title = "Unsaved changes";
      row.appendChild(dot);
    }
    var actions = document.createElement("span");
    actions.className = "tree-actions";
    var dup = document.createElement("button");
    dup.className = "tree-action";
    dup.title = "Duplicate page";
    dup.innerHTML = iconSvg("dup");
    dup.addEventListener("click", function (e) { e.stopPropagation(); openNewPage(file); });
    var del = document.createElement("button");
    del.className = "tree-action danger";
    del.title = "Delete page";
    del.innerHTML = iconSvg("del");
    del.addEventListener("click", function (e) { e.stopPropagation(); deletePage(file); });
    actions.appendChild(dup);
    actions.appendChild(del);
    row.appendChild(actions);
    return row;
  }

  function groupLabel(text) {
    var g = document.createElement("div");
    g.className = "tree-group-label";
    g.textContent = text;
    return g;
  }

  function renderTree() {
    var q = searchEl.value.trim().toLowerCase();
    var match = function (file, label) {
      return !q || (label || "").toLowerCase().indexOf(q) !== -1 || (file || "").toLowerCase().indexOf(q) !== -1;
    };
    var exists = function (f) { return pages.indexOf(f) !== -1; };
    var inMenu = {};
    treeEl.innerHTML = "";

    var menuFrag = document.createDocumentFragment();
    navItems.forEach(function (it) {
      if (it.type === "dropdown") {
        var key = "dd:" + it.label;
        var kids = (it.children || []).filter(function (c) { return exists(c.href); });
        kids.forEach(function (c) { inMenu[c.href] = true; });
        if (it.href && exists(it.href)) inMenu[it.href] = true;
        var visibleKids = kids.filter(function (c) { return match(c.href, c.label); });
        var selfMatch = match(it.href, it.label);
        if (!selfMatch && !visibleKids.length) return;
        var caret = document.createElement("button");
        caret.className = "tree-caret" + (collapsed[key] && !q ? " closed" : "");
        caret.textContent = "▼";
        caret.title = "Show/hide";
        caret.addEventListener("click", function (e) {
          e.stopPropagation();
          collapsed[key] = !collapsed[key];
          try { localStorage.setItem("editor:collapsed", JSON.stringify(collapsed)); } catch (err) {}
          renderTree();
        });
        menuFrag.appendChild(pageRow(it.href && exists(it.href) ? it.href : null, it.label, { caret: caret }));
        if (!collapsed[key] || q) {
          (q ? visibleKids : kids).forEach(function (c) {
            menuFrag.appendChild(pageRow(c.href, c.label, { child: true }));
          });
        }
      } else if (exists(it.href)) {
        inMenu[it.href] = true;
        if (match(it.href, it.label)) menuFrag.appendChild(pageRow(it.href, it.label));
      }
    });
    if (menuFrag.childNodes.length) {
      treeEl.appendChild(groupLabel("In the menu"));
      treeEl.appendChild(menuFrag);
    }

    var others = pages.filter(function (f) { return !inMenu[f] && match(f, niceName(f)); });
    if (others.length) {
      treeEl.appendChild(groupLabel("Not in the menu"));
      others.forEach(function (f) { treeEl.appendChild(pageRow(f, niceName(f))); });
    }
    if (!treeEl.childNodes.length) {
      var empty = document.createElement("div");
      empty.className = "tree-empty";
      empty.textContent = "No pages match “" + searchEl.value + "”";
      treeEl.appendChild(empty);
    }
  }
  searchEl.addEventListener("input", renderTree);

  function deletePage(file) {
    var name = labels[file] || niceName(file);
    if (!confirm("Delete the page “" + name + "”?\n\nLinks to it are removed from your other pages and the menu. Its photos stay in your files. The page stays live until you publish.")) return;
    api("DELETE", "pages/" + encodeURIComponent(file)).then(function () {
      delete drafts[file];
      if (st.file === file) {
        st.file = null;
        st.ready = false;
        frame.style.display = "none";
        frame.src = "about:blank";
        emptyState.style.display = "";
        pageTitle.textContent = "Pick a page";
        draftBanner.hidden = true;
      }
      toast("Deleted “" + name + "”");
      loadPagesAndNav().then(updateUI);
      refreshPublishStatus();
    }).catch(function (err) { alert("Delete failed: " + err.message); });
  }

  // ---------------------------------------------------------------- new / duplicate page
  var npModal = $("newpage-modal");
  var npCopyFrom = null;
  function openNewPage(copyFrom) {
    npCopyFrom = copyFrom || st.file;
    $("np-name").value = copyFrom ? (labels[copyFrom] || niceName(copyFrom)) + " copy" : "";
    $("np-copy-row").hidden = !npCopyFrom;
    $("np-copy-name").textContent = npCopyFrom ? (labels[npCopyFrom] || niceName(npCopyFrom)) : "";
    document.querySelector('input[name="np-start"][value="' + (copyFrom ? "copy" : "blank") + '"]').checked = true;
    $("np-menu").checked = true;
    npModal.hidden = false;
    $("np-name").focus();
    $("np-name").select();
  }
  $("new-page-btn").addEventListener("click", function () { openNewPage(null); });
  $("np-cancel-btn").addEventListener("click", function () { npModal.hidden = true; });
  $("np-name").addEventListener("keydown", function (e) { if (e.key === "Enter") $("np-create-btn").click(); });
  $("np-create-btn").addEventListener("click", function () {
    var name = $("np-name").value.trim();
    if (!name) { $("np-name").focus(); return; }
    var copy = document.querySelector('input[name="np-start"]:checked').value === "copy";
    settle().then(function () {
      return api("POST", "pages", {
      name: name,
      duplicateFrom: copy ? npCopyFrom : undefined,
      addToMenu: $("np-menu").checked,
      });
    }).then(function (data) {
      npModal.hidden = true;
      return loadPagesAndNav().then(function () {
        // the menu changed on every page, including any open draft
        openPage(data.file);
        refreshPublishStatus();
      });
    }).catch(function (err) { alert("Couldn't create page: " + err.message); });
  });

  // ---------------------------------------------------------------- insert blocks
  $("add-block-btn").addEventListener("click", function (e) {
    e.stopPropagation();
    addBlockMenu.hidden = !addBlockMenu.hidden;
  });
  document.addEventListener("click", function () { addBlockMenu.hidden = true; });
  addBlockMenu.querySelectorAll("button").forEach(function (b) {
    b.addEventListener("click", function () {
      addBlockMenu.hidden = true;
      var w = frameWin();
      if (!w || !w.__editorTools) { toast("The page is still loading. Try again in a second."); return; }
      w.__editorTools[b.dataset.tool]();
    });
  });

  // ---------------------------------------------------------------- phone / desktop
  $("viewport-desktop-btn").addEventListener("click", function () {
    frameWrap.classList.remove("phone-mode");
    this.classList.add("active");
    $("viewport-phone-btn").classList.remove("active");
  });
  $("viewport-phone-btn").addEventListener("click", function () {
    frameWrap.classList.add("phone-mode");
    this.classList.add("active");
    $("viewport-desktop-btn").classList.remove("active");
  });

  // ---------------------------------------------------------------- site styles
  var Theme = window.SiteTheme;
  var stylesPanel = $("styles-panel");
  var stylesBtn = $("styles-btn");
  var savedTheme = null;
  var draftTheme = null;
  var themeInputs = {
    headingFont: $("st-heading-font"),
    headingWeight: $("st-heading-weight"),
    bodyFont: $("st-body-font"),
    baseSize: $("st-base-size"),
    textColor: $("st-text-color"),
    backgroundColor: $("st-bg-color"),
  };

  (function setupFontMenus() {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = Theme.googleUrl(Theme.FONTS.map(function (f) { return f.name; }));
    document.head.appendChild(link);
    [themeInputs.headingFont, themeInputs.bodyFont].forEach(function (sel) {
      Theme.FONTS.forEach(function (f) {
        var o = document.createElement("option");
        o.value = f.name;
        o.textContent = f.name;
        if (f.css) o.style.fontFamily = f.css;
        sel.appendChild(o);
      });
    });
  })();

  function themeEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function fillThemeForm(s) {
    Object.keys(themeInputs).forEach(function (k) { themeInputs[k].value = s[k]; });
    $("st-base-size-val").textContent = s.baseSize + "px";
    $("st-text-color-val").textContent = s.textColor;
    $("st-bg-color-val").textContent = s.backgroundColor;
    var sample = $("font-sample");
    var hf = Theme.fontByName(s.headingFont), bf = Theme.fontByName(s.bodyFont);
    sample.querySelector(".font-sample-h").style.fontFamily = hf.css || "";
    sample.querySelector(".font-sample-h").style.fontWeight = s.headingWeight;
    sample.querySelector(".font-sample-p").style.fontFamily = bf.css || "";
    sample.style.color = s.textColor;
    sample.style.background = s.backgroundColor;
    $("st-apply-btn").disabled = themeEqual(s, savedTheme);
  }

  function readThemeForm() {
    return {
      headingFont: themeInputs.headingFont.value,
      bodyFont: themeInputs.bodyFont.value,
      baseSize: Number(themeInputs.baseSize.value),
      headingWeight: themeInputs.headingWeight.value,
      textColor: themeInputs.textColor.value,
      backgroundColor: themeInputs.backgroundColor.value,
    };
  }

  // live preview inside the page while the panel has un-applied changes
  function applyThemePreview() {
    var doc = frame.contentDocument;
    if (!doc || !doc.head) return;
    var existing = doc.getElementById("__theme_preview__");
    var realLink = doc.querySelector('link[href="assets/css/theme.css"]');
    if (!draftTheme || themeEqual(draftTheme, savedTheme)) {
      if (existing) existing.remove();
      if (realLink) realLink.disabled = false;
      return;
    }
    if (!existing) {
      existing = doc.createElement("style");
      existing.id = "__theme_preview__";
      existing.className = "editor-ui";
      doc.head.appendChild(existing);
    }
    if (realLink) realLink.disabled = true;
    existing.textContent = Theme.buildThemeCss(draftTheme, []);
  }

  function openStyles() {
    api("GET", "theme").then(function (d) {
      savedTheme = d.settings;
      draftTheme = Object.assign({}, savedTheme);
      fillThemeForm(draftTheme);
      stylesPanel.classList.add("open");
      stylesPanel.setAttribute("aria-hidden", "false");
      stylesBtn.classList.add("on");
    }).catch(function (err) { alert("Couldn't load site styles: " + err.message); });
  }
  function closeStyles() {
    draftTheme = null;
    applyThemePreview();
    stylesPanel.classList.remove("open");
    stylesPanel.setAttribute("aria-hidden", "true");
    stylesBtn.classList.remove("on");
  }
  stylesBtn.addEventListener("click", function () {
    if (stylesPanel.classList.contains("open")) {
      if (draftTheme && !themeEqual(draftTheme, savedTheme) && !confirm("Close without applying your style changes?")) return;
      closeStyles();
    } else openStyles();
  });
  $("styles-close-btn").addEventListener("click", function () { stylesBtn.click(); });
  $("st-cancel-btn").addEventListener("click", closeStyles);
  Object.keys(themeInputs).forEach(function (k) {
    themeInputs[k].addEventListener("input", function () {
      draftTheme = readThemeForm();
      fillThemeForm(draftTheme);
      applyThemePreview();
    });
  });
  $("st-reset-btn").addEventListener("click", function () {
    draftTheme = Object.assign({}, Theme.DEFAULTS);
    fillThemeForm(draftTheme);
    applyThemePreview();
  });
  $("st-apply-btn").addEventListener("click", function () {
    var settings = readThemeForm();
    var btn = this;
    btn.disabled = true;
    btn.textContent = "Applying…";
    settle().then(function () {
      return api("POST", "theme", { settings: settings });
    }).then(function () {
      btn.textContent = "Apply to all pages";
      savedTheme = settings;
      closeStyles();
      toast("Site styles applied to every page. Publish to make them live.");
      refreshPublishStatus();
      // pages were updated to load the style sheet; reopen, keeping any draft
      if (st.file) openPage(st.file, { autoRestore: true, keepScroll: true });
    }).catch(function (err) {
      btn.textContent = "Apply to all pages";
      btn.disabled = false;
      alert("Couldn't save styles: " + err.message);
    });
  });

  // ---------------------------------------------------------------- page settings (title, description, site icon)
  var settingsPanel = $("settings-panel");
  var settingsBtn = $("settings-btn");
  var psTitle = $("ps-title");
  var psDesc = $("ps-desc");
  var iconUrl = null;

  function showPanel(panel, btn, on) {
    panel.classList.toggle("open", on);
    panel.setAttribute("aria-hidden", on ? "false" : "true");
    btn.classList.toggle("on", on);
  }

  function frameDoc() { return st.ready ? frame.contentDocument : null; }
  function metaDesc(doc, create) {
    var m = doc.querySelector('meta[name="description"]');
    if (!m && create) {
      m = doc.createElement("meta");
      m.setAttribute("name", "description");
      var t = doc.querySelector("title");
      if (t && t.nextSibling) doc.head.insertBefore(m, t.nextSibling); else doc.head.appendChild(m);
    }
    return m;
  }

  function counter(el, n, limit) {
    el.textContent = n + " / " + limit;
    el.classList.toggle("over", n > limit);
  }

  function renderSettingsPreview() {
    var title = psTitle.value.trim();
    var desc = psDesc.value.trim();
    counter($("ps-title-count"), title.length, 60);
    counter($("ps-desc-count"), desc.length, 160);
    var slug = (st.file || "").replace(/\.html$/, "");
    $("ps-serp-url").textContent = "https://carochou.com" + (slug && slug !== "index" ? " › " + slug : "");
    $("ps-serp-title").textContent = title || "(no title)";
    var d = $("ps-serp-desc");
    d.textContent = desc || "No description yet. Google will pick some text from the page instead.";
    d.classList.toggle("empty", !desc);
    $("ps-tab-title").textContent = title || st.file || "";
    [$("ps-serp-icon"), $("ps-tab-icon")].forEach(function (img) {
      img.hidden = !iconUrl;
      if (iconUrl) img.src = iconUrl;
    });
    $("ps-tab-icon-empty").hidden = !!iconUrl;
    $("ps-icon-remove-btn").hidden = !iconUrl;
    $("ps-icon-upload-btn").textContent = iconUrl ? "Replace icon" : "Upload icon";
  }

  function loadIcon() {
    return api("GET", "icon").then(function (d) {
      iconUrl = d.url;
      // show it on the editor's own tab too
      var link = document.querySelector('link[rel="icon"]');
      if (iconUrl) {
        if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
        link.href = iconUrl;
      } else if (link) link.remove();
      renderSettingsPreview();
    }).catch(function () {});
  }

  window.__refreshPageSettings = function () {
    if (!settingsPanel.classList.contains("open")) return;
    var doc = frameDoc();
    if (!doc) return;
    $("ps-page-name").textContent = labels[st.file] || niceName(st.file);
    if (document.activeElement !== psTitle) psTitle.value = doc.title;
    var m = metaDesc(doc, false);
    if (document.activeElement !== psDesc) psDesc.value = m ? m.getAttribute("content") || "" : "";
    renderSettingsPreview();
  };

  function openSettings() {
    if (!st.ready) return;
    if (stylesPanel.classList.contains("open")) closeStyles();
    showPanel(settingsPanel, settingsBtn, true);
    window.__refreshPageSettings();
    loadIcon();
  }
  settingsBtn.addEventListener("click", function () {
    if (settingsPanel.classList.contains("open")) showPanel(settingsPanel, settingsBtn, false);
    else openSettings();
  });
  $("settings-close-btn").addEventListener("click", function () { showPanel(settingsPanel, settingsBtn, false); });

  psTitle.addEventListener("input", function () {
    var doc = frameDoc();
    if (!doc) return;
    doc.title = psTitle.value;
    renderSettingsPreview();
    onDirty();
  });
  psDesc.addEventListener("input", function () {
    var doc = frameDoc();
    if (!doc) return;
    metaDesc(doc, true).setAttribute("content", psDesc.value.replace(/\s*\n\s*/g, " "));
    renderSettingsPreview();
    onDirty();
  });

  // crop to a centered square and scale to 512px PNG in the browser
  function squarePng(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var side = Math.min(img.naturalWidth, img.naturalHeight);
        var size = Math.min(512, side) || 512;
        var c = document.createElement("canvas");
        c.width = c.height = size;
        c.getContext("2d").drawImage(img,
          (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error("couldn't convert image")); }, "image/png");
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That file isn't an image this browser can read.")); };
      img.src = url;
    });
  }

  function afterIconChange(msg) {
    return loadIcon().then(function () {
      toast(msg);
      refreshPublishStatus();
      if (st.file) openPage(st.file, { autoRestore: true, keepScroll: true });
    });
  }

  $("ps-icon-upload-btn").addEventListener("click", function () { $("ps-icon-file").click(); });
  $("ps-icon-file").addEventListener("change", function () {
    var file = this.files[0];
    this.value = "";
    if (!file) return;
    var btn = $("ps-icon-upload-btn");
    btn.disabled = true;
    btn.textContent = "Uploading…";
    squarePng(file).then(function (blob) {
      return settle().then(function () {
        var fd = new FormData();
        fd.append("icon", blob, "favicon.png");
        return fetch("/__editor__/api/icon", { method: "POST", body: fd }).then(function (r) {
          return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "upload failed"); });
        });
      });
    }).then(function () {
      return afterIconChange("Site icon added to every page. Publish to make it live.");
    }).catch(function (err) {
      alert("Couldn't use that image: " + err.message);
    }).then(function () { btn.disabled = false; renderSettingsPreview(); });
  });
  $("ps-icon-remove-btn").addEventListener("click", function () {
    if (!confirm("Remove the site icon from every page?")) return;
    settle().then(function () { return api("DELETE", "icon"); })
      .then(function () { return afterIconChange("Site icon removed."); })
      .catch(function (err) { alert("Couldn't remove the icon: " + err.message); });
  });

  // only one right-hand panel at a time
  stylesBtn.addEventListener("click", function () {
    if (stylesPanel.classList.contains("open") || !settingsPanel.classList.contains("open")) return;
    showPanel(settingsPanel, settingsBtn, false);
  }, true);

  loadIcon();

  // ---------------------------------------------------------------- publish
  var pubModal = $("publish-modal");
  var pubFiles = [];
  var pubUnpushed = 0;

  function refreshPublishStatus() {
    return api("GET", "publish-status").then(function (d) {
      pubFiles = d.files;
      pubUnpushed = d.unpushed || 0;
      var n = pubFiles.filter(function (f) { return f.file.indexOf("editor/") !== 0; }).length;
      publishCount.hidden = !(n || pubUnpushed);
      publishCount.textContent = n || "!";
      publishBtn.title = n ? n + " change" + (n === 1 ? "" : "s") + " not live yet" : "Everything is live";
    }).catch(function () {});
  }

  function fileGroup(f) {
    if (/\.html$/.test(f) && f.indexOf("/") === -1) return "Pages";
    if (/^assets\/images\//.test(f)) return "Photos";
    if (/^assets\/(css|js)\//.test(f)) return "Site styles & scripts";
    if (/^editor\//.test(f)) return "Editor (this tool)";
    return "Other files";
  }

  function renderPublishList() {
    var list = $("pub-files");
    list.innerHTML = "";
    var groups = {};
    pubFiles.forEach(function (f) { (groups[fileGroup(f.file)] = groups[fileGroup(f.file)] || []).push(f); });
    ["Pages", "Photos", "Site styles & scripts", "Other files", "Editor (this tool)"].forEach(function (g) {
      if (!groups[g]) return;
      var h = document.createElement("li");
      h.className = "group";
      h.textContent = g + " (" + groups[g].length + ")";
      list.appendChild(h);
      groups[g].forEach(function (f) {
        var li = document.createElement("li");
        var kind = document.createElement("span");
        kind.className = "kind " + f.kind;
        kind.textContent = f.kind === "changed" ? "edited" : f.kind === "added" ? "new" : "deleted";
        var name = document.createElement("span");
        name.className = "name";
        name.textContent = g === "Pages" ? (labels[f.file] || niceName(f.file)) : f.file.split("/").pop();
        name.title = f.file;
        li.appendChild(kind);
        li.appendChild(name);
        list.appendChild(li);
      });
    });
    list.hidden = !pubFiles.length;
  }

  publishBtn.addEventListener("click", function () {
    if (st.ready) flush();
    refreshPublishStatus().then(function () {
      var dirty = st.ready && isDirty();
      $("pub-title").textContent = "Publish to carochou.com";
      $("pub-body").hidden = false;
      $("pub-result").hidden = true;
      $("pub-dirty-note").hidden = !dirty;
      var otherDrafts = Object.keys(drafts).filter(function (f) { return f !== st.file && pages.indexOf(f) !== -1; });
      var dn = $("pub-drafts-note");
      dn.hidden = !otherDrafts.length;
      dn.textContent = "Unsaved changes on " + otherDrafts.map(function (f) { return labels[f] || niceName(f); }).join(", ") +
        " won't be published. Open " + (otherDrafts.length === 1 ? "that page" : "those pages") + " and press Save first if you want them live.";
      $("pub-message").value = "";
      $("pub-cancel-btn").textContent = "Cancel";
      var go = $("pub-go-btn");
      go.hidden = false;
      go.disabled = false;
      go.textContent = "Publish now";
      var n = pubFiles.length;
      if (!n && !pubUnpushed && !dirty) {
        $("pub-summary").textContent = "Everything is already live. There's nothing new to publish.";
        go.hidden = true;
        $("pub-cancel-btn").textContent = "Close";
      } else if (!n && !dirty) {
        $("pub-summary").textContent = "An earlier publish was saved but never reached the site. Publish again to send it.";
      } else {
        $("pub-summary").textContent = "These changes will go live. It takes about a minute for the site to update.";
      }
      renderPublishList();
      pubModal.hidden = false;
    });
  });
  $("pub-cancel-btn").addEventListener("click", function () { pubModal.hidden = true; });
  $("pub-go-btn").addEventListener("click", function () {
    var go = this;
    go.disabled = true;
    go.textContent = "Publishing…";
    var before = st.ready && isDirty() ? save() : Promise.resolve(true);
    before.then(function (ok) {
      if (!ok) { go.disabled = false; go.textContent = "Publish now"; return; }
      return api("POST", "publish", { message: $("pub-message").value }).then(function () {
        $("pub-title").textContent = "Published";
        $("pub-body").hidden = true;
        var res = $("pub-result");
        res.hidden = false;
        res.className = "pub-result ok";
        res.innerHTML = "Your changes are on their way. <a href='https://carochou.com' target='_blank' rel='noopener'>carochou.com</a> updates within about a minute.";
        go.hidden = true;
        $("pub-cancel-btn").textContent = "Close";
        refreshPublishStatus();
      });
    }).catch(function (err) {
      var res = $("pub-result");
      res.hidden = false;
      res.className = "pub-result";
      res.innerHTML = "";
      var p = document.createElement("div");
      p.textContent = "Publishing didn't finish.";
      var pre = document.createElement("pre");
      pre.textContent = err.message;
      res.appendChild(p);
      res.appendChild(pre);
      go.disabled = false;
      go.textContent = "Try again";
      refreshPublishStatus();
    });
  });

  // ---------------------------------------------------------------- menu editor
  var navModal = $("nav-modal");
  var navList = $("nav-items-list");
  var navState = [];

  function rowBtn(label, title, danger, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "row-btn" + (danger ? " danger" : "");
    b.title = title;
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  // a dropdown of real pages, plus "Custom URL…" (and optionally "No link")
  function hrefPicker(current, onChange, allowNone) {
    var wrap = document.createElement("div");
    wrap.className = "href-picker";
    var known = pages.indexOf(current) !== -1;
    var select = document.createElement("select");
    if (allowNone) {
      var none = document.createElement("option");
      none.value = "";
      none.textContent = "No link (just opens the list)";
      select.appendChild(none);
    }
    pages.forEach(function (p) {
      var o = document.createElement("option");
      o.value = p;
      o.textContent = labels[p] || niceName(p);
      select.appendChild(o);
    });
    var custom = document.createElement("option");
    custom.value = "__custom__";
    custom.textContent = "Custom URL…";
    select.appendChild(custom);
    var input = document.createElement("input");
    input.type = "text";
    input.className = "nav-href-input";
    input.placeholder = "https://…";
    var isCustom = !known && !(allowNone && !current);
    select.value = isCustom ? "__custom__" : current;
    input.hidden = !isCustom;
    if (isCustom) input.value = current;
    select.addEventListener("change", function () {
      if (select.value === "__custom__") { input.hidden = false; input.focus(); onChange(input.value); }
      else { input.hidden = true; onChange(select.value); }
    });
    input.addEventListener("input", function () { onChange(input.value); });
    wrap.appendChild(select);
    wrap.appendChild(input);
    return wrap;
  }

  function move(arr, i, dir) {
    var j = i + dir;
    if (j < 0 || j >= arr.length) return;
    var t = arr[j]; arr[j] = arr[i]; arr[i] = t;
    renderNav();
  }

  function labelInput(obj, placeholder) {
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className = "nav-label-input";
    inp.value = obj.label;
    inp.placeholder = placeholder;
    inp.addEventListener("input", function () { obj.label = inp.value; });
    return inp;
  }

  function renderNav() {
    navList.innerHTML = "";
    navState.forEach(function (item, i) {
      if (item.type === "dropdown") {
        var group = document.createElement("div");
        group.className = "nav-dropdown-group";
        var head = document.createElement("div");
        head.className = "nav-item-row";
        head.appendChild(labelInput(item, "Menu title"));
        head.appendChild(hrefPicker(item.href || "", function (v) { item.href = v; }, true));
        head.appendChild(rowBtn("↑", "Move up", false, function () { move(navState, i, -1); }));
        head.appendChild(rowBtn("↓", "Move down", false, function () { move(navState, i, 1); }));
        head.appendChild(rowBtn("✕", "Delete this whole dropdown", true, function () { navState.splice(i, 1); renderNav(); }));
        group.appendChild(head);
        var kids = document.createElement("div");
        kids.className = "nav-dropdown-children";
        item.children.forEach(function (c, ci) {
          var r = document.createElement("div");
          r.className = "nav-item-row";
          r.appendChild(labelInput(c, "Label"));
          r.appendChild(hrefPicker(c.href, function (v) { c.href = v; }));
          r.appendChild(rowBtn("↑", "Move up", false, function () { move(item.children, ci, -1); }));
          r.appendChild(rowBtn("↓", "Move down", false, function () { move(item.children, ci, 1); }));
          r.appendChild(rowBtn("✕", "Delete", true, function () { item.children.splice(ci, 1); renderNav(); }));
          kids.appendChild(r);
        });
        group.appendChild(kids);
        var add = document.createElement("button");
        add.type = "button";
        add.className = "btn btn-quiet btn-sm";
        add.textContent = "+ Add item to this menu";
        add.addEventListener("click", function () { item.children.push({ label: "New item", href: "index.html" }); renderNav(); });
        group.appendChild(add);
        navList.appendChild(group);
      } else {
        var row = document.createElement("div");
        row.className = "nav-item-row";
        row.appendChild(labelInput(item, "Label"));
        row.appendChild(hrefPicker(item.href, function (v) { item.href = v; }));
        row.appendChild(rowBtn("↑", "Move up", false, function () { move(navState, i, -1); }));
        row.appendChild(rowBtn("↓", "Move down", false, function () { move(navState, i, 1); }));
        row.appendChild(rowBtn("✕", "Delete", true, function () { navState.splice(i, 1); renderNav(); }));
        navList.appendChild(row);
      }
    });
  }

  $("edit-menu-btn").addEventListener("click", function () {
    loadPagesAndNav().then(function () {
      navState = JSON.parse(JSON.stringify(navItems));
      renderNav();
      navModal.hidden = false;
    }).catch(function (err) { alert("Couldn't load the menu: " + err.message); });
  });
  $("nav-add-link-btn").addEventListener("click", function () { navState.push({ type: "link", label: "New link", href: "index.html" }); renderNav(); });
  $("nav-add-dropdown-btn").addEventListener("click", function () { navState.push({ type: "dropdown", label: "New menu", href: "", children: [] }); renderNav(); });
  $("nav-cancel-btn").addEventListener("click", function () { navModal.hidden = true; });
  $("nav-save-btn").addEventListener("click", function () {
    settle().then(function () {
      return api("POST", "nav", { items: navState });
    }).then(function () {
      navModal.hidden = true;
      toast("Menu updated on every page");
      refreshPublishStatus();
      return loadPagesAndNav();
    }).then(function () {
      // the open page (and its draft) now have the new menu; reopen to show it
      if (st.file) openPage(st.file, { autoRestore: true, keepScroll: true });
    }).catch(function (err) { alert("Couldn't save the menu: " + err.message); });
  });

  // ---------------------------------------------------------------- start
  loadPagesAndNav().then(function () {
    var last = null;
    try { last = localStorage.getItem("editor:lastPage"); } catch (e) {}
    if (last && pages.indexOf(last) !== -1) openPage(last);
    else updateUI();
  });
  refreshPublishStatus();
  setInterval(refreshPublishStatus, 30000);
})();

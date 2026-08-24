(function () {
  var pageListEl = document.getElementById("page-list");
  var frame = document.getElementById("page-frame");
  var emptyState = document.getElementById("empty-state");
  var label = document.getElementById("current-page-label");
  var saveBtn = document.getElementById("save-btn");
  var reloadBtn = document.getElementById("reload-btn");
  var dirtyIndicator = document.getElementById("dirty-indicator");
  var newPageBtn = document.getElementById("new-page-btn");
  var editMenuBtn = document.getElementById("edit-menu-btn");
  var frameWrap = document.getElementById("frame-wrap");
  var desktopBtn = document.getElementById("viewport-desktop-btn");
  var phoneBtn = document.getElementById("viewport-phone-btn");
  var navModal = document.getElementById("nav-modal");
  var navItemsList = document.getElementById("nav-items-list");
  var navAddLinkBtn = document.getElementById("nav-add-link-btn");
  var navAddDropdownBtn = document.getElementById("nav-add-dropdown-btn");
  var navCancelBtn = document.getElementById("nav-cancel-btn");
  var navSaveBtn = document.getElementById("nav-save-btn");
  var insertTextBoxBtn = document.getElementById("insert-textbox-btn");
  var insertImageBtn = document.getElementById("insert-image-btn");
  var insertMailingBtn = document.getElementById("insert-mailing-btn");

  var currentFile = null;
  var isDirty = false;

  function niceName(file) {
    return file.replace(/\.html$/, "").replace(/[-_]/g, " ");
  }

  function setDirty(v) {
    isDirty = v;
    dirtyIndicator.textContent = v ? "Unsaved changes" : "";
    reloadBtn.disabled = !v;
    saveBtn.classList.remove("saved");
    saveBtn.textContent = "Save";
  }

  function loadPageList() {
    fetch("/__editor__/api/pages")
      .then(function (r) { return r.json(); })
      .then(function (files) {
        pageListEl.innerHTML = "";
        files.forEach(function (file) {
          var row = document.createElement("div");
          row.className = "page-list-row";

          var btn = document.createElement("button");
          btn.className = "page-list-item";
          btn.textContent = niceName(file);
          btn.dataset.file = file;
          btn.addEventListener("click", function () { selectPage(file); });
          row.appendChild(btn);

          var del = document.createElement("button");
          del.className = "page-delete-btn";
          del.title = "Delete this page";
          del.textContent = "×";
          del.addEventListener("click", function (e) {
            e.stopPropagation();
            deletePage(file);
          });
          row.appendChild(del);

          pageListEl.appendChild(row);
        });
      });
  }

  function deletePage(file) {
    var ok = confirm(
      "Delete " + file + "?\n\nThis removes the page and cleans up any menu/navigation " +
      "links to it on your other pages. Images used on this page are kept on disk."
    );
    if (!ok) return;
    fetch("/__editor__/api/pages/" + encodeURIComponent(file), { method: "DELETE" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) { alert("Delete failed: " + (data.error || "unknown error")); return; }
        if (currentFile === file) {
          currentFile = null;
          setDirty(false);
          saveBtn.disabled = true;
          insertTextBoxBtn.disabled = true;
          insertImageBtn.disabled = true;
          insertMailingBtn.disabled = true;
          frame.style.display = "none";
          frame.src = "about:blank";
          emptyState.style.display = "flex";
          label.textContent = "Select a page to edit";
        }
        loadPageList();
      })
      .catch(function (err) { alert("Delete failed: " + err); });
  }

  function markActiveInList(file) {
    pageListEl.querySelectorAll(".page-list-item").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.file === file);
    });
  }

  function selectPage(file) {
    if (isDirty && !confirm("You have unsaved changes on this page. Discard them and switch pages?")) {
      return;
    }
    currentFile = file;
    markActiveInList(file);
    label.textContent = "Editing: " + file;
    saveBtn.disabled = false;
    insertTextBoxBtn.disabled = false;
    insertImageBtn.disabled = false;
    insertMailingBtn.disabled = false;
    emptyState.style.display = "none";
    frame.style.display = "block";
    setDirty(false);
    frame.src = "/" + file + "?t=" + Date.now();
  }

  function callInsertTool(name) {
    var win = frame.contentWindow;
    if (!win || !win.__editorTools) {
      alert("Editor isn't ready on this page yet — try again in a moment.");
      return;
    }
    win.__editorTools[name]();
  }

  insertTextBoxBtn.addEventListener("click", function () { callInsertTool("addTextBox"); });
  insertImageBtn.addEventListener("click", function () { callInsertTool("addImage"); });
  insertMailingBtn.addEventListener("click", function () { callInsertTool("addMailingList"); });

  frame.addEventListener("load", function () {
    if (!currentFile) return;
    var doc = frame.contentDocument;
    var win = frame.contentWindow;
    if (!doc || doc.getElementById("__editor_injected_style__")) return;

    var style = doc.createElement("link");
    style.id = "__editor_injected_style__";
    style.rel = "stylesheet";
    style.href = "/__editor__/editor-inject.css";
    doc.head.appendChild(style);

    var sortableScript = doc.createElement("script");
    sortableScript.id = "__editor_sortable_script__";
    sortableScript.src = "/__editor__/vendor/Sortable.min.js";
    sortableScript.onload = function () {
      var editorScript = doc.createElement("script");
      editorScript.id = "__editor_injected_script__";
      editorScript.src = "/__editor__/editor-inject.js";
      editorScript.onload = function () {
        win.__editorOnDirty = function () { setDirty(true); };
      };
      doc.head.appendChild(editorScript);
    };
    doc.head.appendChild(sortableScript);
  });

  reloadBtn.addEventListener("click", function () {
    if (!currentFile) return;
    if (!confirm("Discard unsaved changes on this page?")) return;
    setDirty(false);
    frame.src = "/" + currentFile + "?t=" + Date.now();
  });

  saveBtn.addEventListener("click", function () {
    if (!currentFile) return;
    var win = frame.contentWindow;
    if (!win || !win.__editorGetCleanHTML) {
      alert("Editor isn't ready on this page yet — try again in a moment.");
      return;
    }
    var html = win.__editorGetCleanHTML();
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    fetch("/__editor__/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: currentFile, html: html }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        saveBtn.disabled = false;
        if (data.ok) {
          saveBtn.textContent = "Saved!";
          saveBtn.classList.add("saved");
          setDirty(false);
          frame.src = "/" + currentFile + "?t=" + Date.now();
        } else {
          alert("Save failed: " + (data.error || "unknown error"));
          saveBtn.textContent = "Save";
        }
      })
      .catch(function (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save";
        alert("Save failed: " + err);
      });
  });

  newPageBtn.addEventListener("click", function () {
    var name = prompt("Name for the new page (e.g. \"My New Project\"):");
    if (!name || !name.trim()) return;

    var duplicateFrom;
    if (currentFile) {
      var wantsDuplicate = confirm(
        "Start the new page as a copy of \"" + currentFile + "\"?\n\n" +
        "OK = duplicate its layout and content\nCancel = start from a blank page"
      );
      if (wantsDuplicate) duplicateFrom = currentFile;
    }

    fetch("/__editor__/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), duplicateFrom: duplicateFrom, addToMenu: true }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) { alert("Couldn't create page: " + (data.error || "unknown error")); return; }
        loadPageList();
        setTimeout(function () { selectPage(data.file); }, 100);
      })
      .catch(function (err) { alert("Couldn't create page: " + err); });
  });

  window.addEventListener("beforeunload", function (e) {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // ---------------------------------------------------------------- phone view toggle
  desktopBtn.addEventListener("click", function () {
    frameWrap.classList.remove("phone-mode");
    desktopBtn.classList.add("active");
    phoneBtn.classList.remove("active");
  });
  phoneBtn.addEventListener("click", function () {
    frameWrap.classList.add("phone-mode");
    phoneBtn.classList.add("active");
    desktopBtn.classList.remove("active");
  });

  // ---------------------------------------------------------------- nav / menu editor
  var navState = [];

  function navRow(controlsHtml) {
    var row = document.createElement("div");
    row.className = "nav-item-row";
    return row;
  }

  function makeIconBtn(label, title, danger, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "icon-btn" + (danger ? " danger" : "");
    b.title = title;
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  var availablePages = [];
  function loadAvailablePages() {
    return fetch("/__editor__/api/pages")
      .then(function (r) { return r.json(); })
      .then(function (files) {
        availablePages = files.map(function (f) { return { file: f, label: niceName(f) }; });
      });
  }

  // a <select> of real site pages plus a "Custom URL" fallback with its own text field
  function makeHrefPicker(currentHref, onChange) {
    var wrap = document.createElement("div");
    wrap.className = "href-picker";

    var isKnownPage = availablePages.some(function (p) { return p.file === currentHref; });

    var select = document.createElement("select");
    select.className = "nav-href-select";
    availablePages.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.file;
      opt.textContent = p.label;
      select.appendChild(opt);
    });
    var customOpt = document.createElement("option");
    customOpt.value = "__custom__";
    customOpt.textContent = "Custom URL…";
    select.appendChild(customOpt);
    select.value = isKnownPage ? currentHref : "__custom__";

    var customInput = document.createElement("input");
    customInput.type = "text";
    customInput.className = "nav-href-input";
    customInput.placeholder = "https://…";
    customInput.style.display = isKnownPage ? "none" : "inline-block";
    if (!isKnownPage) customInput.value = currentHref;

    select.addEventListener("change", function () {
      if (select.value === "__custom__") {
        customInput.style.display = "inline-block";
        customInput.focus();
        onChange(customInput.value);
      } else {
        customInput.style.display = "none";
        onChange(select.value);
      }
    });
    customInput.addEventListener("input", function () { onChange(customInput.value); });

    wrap.appendChild(select);
    wrap.appendChild(customInput);
    return wrap;
  }

  function renderNav() {
    navItemsList.innerHTML = "";
    navState.forEach(function (item, i) {
      if (item.type === "dropdown") {
        var group = document.createElement("div");
        group.className = "nav-dropdown-group";

        var headerRow = document.createElement("div");
        headerRow.className = "nav-item-row";
        var labelInput = document.createElement("input");
        labelInput.type = "text";
        labelInput.className = "nav-label-input";
        labelInput.value = item.label;
        labelInput.placeholder = "Menu label (e.g. Selected Works)";
        labelInput.addEventListener("input", function () { item.label = labelInput.value; });
        headerRow.appendChild(labelInput);
        headerRow.appendChild(makeIconBtn("↑", "Move up", false, function () { moveItem(i, -1); }));
        headerRow.appendChild(makeIconBtn("↓", "Move down", false, function () { moveItem(i, 1); }));
        headerRow.appendChild(makeIconBtn("×", "Delete this whole dropdown", true, function () {
          navState.splice(i, 1);
          renderNav();
        }));
        group.appendChild(headerRow);

        var childrenWrap = document.createElement("div");
        childrenWrap.className = "nav-dropdown-children";
        item.children.forEach(function (child, ci) {
          childrenWrap.appendChild(navChildRow(item, child, ci));
        });
        group.appendChild(childrenWrap);

        var addChildBtn = document.createElement("button");
        addChildBtn.type = "button";
        addChildBtn.className = "btn btn-ghost nav-dropdown-add";
        addChildBtn.textContent = "+ Add item to this menu";
        addChildBtn.addEventListener("click", function () {
          item.children.push({ label: "New Item", href: "index.html" });
          renderNav();
        });
        group.appendChild(addChildBtn);

        navItemsList.appendChild(group);
      } else {
        navItemsList.appendChild(navLinkRow(item, i));
      }
    });
  }

  function navLinkRow(item, i) {
    var row = navRow();
    var labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "nav-label-input";
    labelInput.value = item.label;
    labelInput.placeholder = "Label";
    labelInput.addEventListener("input", function () { item.label = labelInput.value; });

    var hrefPicker = makeHrefPicker(item.href, function (v) { item.href = v; });

    row.appendChild(labelInput);
    row.appendChild(hrefPicker);
    row.appendChild(makeIconBtn("↑", "Move up", false, function () { moveItem(i, -1); }));
    row.appendChild(makeIconBtn("↓", "Move down", false, function () { moveItem(i, 1); }));
    row.appendChild(makeIconBtn("×", "Delete", true, function () {
      navState.splice(i, 1);
      renderNav();
    }));
    return row;
  }

  function navChildRow(parentItem, child, ci) {
    var row = navRow();
    var labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "nav-label-input";
    labelInput.value = child.label;
    labelInput.addEventListener("input", function () { child.label = labelInput.value; });

    var hrefPicker = makeHrefPicker(child.href, function (v) { child.href = v; });

    row.appendChild(labelInput);
    row.appendChild(hrefPicker);
    row.appendChild(makeIconBtn("↑", "Move up", false, function () {
      if (ci === 0) return;
      var tmp = parentItem.children[ci - 1];
      parentItem.children[ci - 1] = parentItem.children[ci];
      parentItem.children[ci] = tmp;
      renderNav();
    }));
    row.appendChild(makeIconBtn("↓", "Move down", false, function () {
      if (ci === parentItem.children.length - 1) return;
      var tmp2 = parentItem.children[ci + 1];
      parentItem.children[ci + 1] = parentItem.children[ci];
      parentItem.children[ci] = tmp2;
      renderNav();
    }));
    row.appendChild(makeIconBtn("×", "Delete", true, function () {
      parentItem.children.splice(ci, 1);
      renderNav();
    }));
    return row;
  }

  function moveItem(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= navState.length) return;
    var tmp = navState[j];
    navState[j] = navState[i];
    navState[i] = tmp;
    renderNav();
  }

  editMenuBtn.addEventListener("click", function () {
    Promise.all([loadAvailablePages(), fetch("/__editor__/api/nav").then(function (r) { return r.json(); })])
      .then(function (results) {
        var data = results[1];
        if (!data.items) { alert("Couldn't load menu: " + (data.error || "unknown error")); return; }
        navState = data.items;
        renderNav();
        navModal.style.display = "flex";
      })
      .catch(function (err) { alert("Couldn't load menu: " + err); });
  });

  navAddLinkBtn.addEventListener("click", function () {
    navState.push({ type: "link", label: "New Link", href: "index.html" });
    renderNav();
  });
  navAddDropdownBtn.addEventListener("click", function () {
    navState.push({ type: "dropdown", label: "New Menu", children: [] });
    renderNav();
  });
  navCancelBtn.addEventListener("click", function () {
    navModal.style.display = "none";
  });
  navSaveBtn.addEventListener("click", function () {
    fetch("/__editor__/api/nav", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: navState }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) { alert("Couldn't save menu: " + (data.error || "unknown error")); return; }
        navModal.style.display = "none";
        if (currentFile) frame.src = "/" + currentFile + "?t=" + Date.now();
      })
      .catch(function (err) { alert("Couldn't save menu: " + err); });
  });

  loadPageList();
})();

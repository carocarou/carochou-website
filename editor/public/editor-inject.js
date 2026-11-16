(function () {
  if (window.__editorInjected) return;
  window.__editorInjected = true;

  var currentFile = location.pathname.replace(/^\//, "") || "index.html";
  var pageSlug = currentFile.replace(/\.html$/, "");

  window.__editorDirty = false;
  function markDirty() {
    window.__editorDirty = true;
    if (window.__editorOnDirty) window.__editorOnDirty();
  }

  // Repeating galleries: reorder, replace, delete, layout control. Simple by
  // design -- no per-tile resize, since the grid/columns setting governs size.
  var GRID_GALLERY_SELECTORS = [".gallery-grid", ".about-images"];
  var LINK_GALLERY_SELECTORS = [".work-grid"];
  var ROW_SELECTORS = [".media-row"];

  // Prose containers become ONE continuous editable region each -- like a
  // real document editor (Substack/Notion), not a pile of individually
  // toggled paragraphs. Enter/Backspace paragraph handling comes for free
  // from the browser's native contenteditable behavior.
  var PARA_LIST_SELECTORS = [".project-body", ".about-section", ".contact-section", ".poem"];

  var TEXT_CONTAINER_SELECTORS = [
    ".project-header", ".page-header", ".subwork",
    ".cv-section", ".hero",
  ];
  var TEXT_TAGS = ["P", "H1", "H2", "H3", "H4", "FIGCAPTION", "DIV", "SPAN"];

  // ---------------------------------------------------------------- upload
  function uploadFile(file, cb) {
    var fd = new FormData();
    fd.append("image", file);
    fetch("/__editor__/api/upload?page=" + encodeURIComponent(pageSlug), {
      method: "POST",
      body: fd,
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { alert("Upload failed: " + data.error); return; }
        cb(data.path);
      })
      .catch(function (err) { alert("Upload failed: " + err); });
  }

  function uploadBlob(blob, filename, cb) {
    var fd = new FormData();
    fd.append("image", blob, filename);
    fetch("/__editor__/api/upload?page=" + encodeURIComponent(pageSlug), {
      method: "POST",
      body: fd,
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { alert("Upload failed: " + data.error); return; }
        cb(data.path);
      })
      .catch(function (err) { alert("Upload failed: " + err); });
  }

  function pickAndUpload(cb) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.gif";
    input.addEventListener("change", function () {
      if (!input.files[0]) return;
      uploadFile(input.files[0], cb);
    });
    input.click();
  }

  // ---------------------------------------------------------------- crop modal
  function openCropModal(imgEl, onDone) {
    var overlay = document.createElement("div");
    overlay.className = "editor-ui editor-crop-overlay";

    var frame = document.createElement("div");
    frame.className = "editor-crop-frame";
    overlay.appendChild(frame);

    var stage = document.createElement("div");
    stage.className = "editor-crop-stage";
    frame.appendChild(stage);

    var pic = document.createElement("img");
    pic.src = imgEl.currentSrc || imgEl.src;
    pic.className = "editor-crop-pic";
    stage.appendChild(pic);

    var rect = document.createElement("div");
    rect.className = "editor-crop-rect";
    stage.appendChild(rect);
    ["nw", "ne", "sw", "se"].forEach(function (pos) {
      var h = document.createElement("div");
      h.className = "editor-crop-handle editor-crop-handle-" + pos;
      h.dataset.pos = pos;
      rect.appendChild(h);
    });

    var footer = document.createElement("div");
    footer.className = "editor-crop-footer";
    var cancelBtn = document.createElement("button");
    cancelBtn.className = "editor-btn";
    cancelBtn.textContent = "Cancel";
    var applyBtn = document.createElement("button");
    applyBtn.className = "editor-btn editor-btn-primary";
    applyBtn.textContent = "Apply Crop";
    footer.appendChild(cancelBtn);
    footer.appendChild(applyBtn);
    frame.appendChild(footer);

    document.body.appendChild(overlay);

    var box = { x: 0, y: 0, w: 0, h: 0 };
    function layoutRect() {
      rect.style.left = box.x + "px";
      rect.style.top = box.y + "px";
      rect.style.width = box.w + "px";
      rect.style.height = box.h + "px";
    }

    pic.addEventListener("load", initBox);
    if (pic.complete) initBox();
    function initBox() {
      var sw = stage.clientWidth, sh = stage.clientHeight;
      box = { x: sw * 0.1, y: sh * 0.1, w: sw * 0.8, h: sh * 0.8 };
      layoutRect();
    }

    rect.addEventListener("mousedown", function (e) {
      if (e.target !== rect) return;
      e.preventDefault();
      var startX = e.clientX, startY = e.clientY;
      var orig = { x: box.x, y: box.y };
      function onMove(ev) {
        var sw = stage.clientWidth, sh = stage.clientHeight;
        box.x = Math.min(Math.max(0, orig.x + (ev.clientX - startX)), sw - box.w);
        box.y = Math.min(Math.max(0, orig.y + (ev.clientY - startY)), sh - box.h);
        layoutRect();
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    rect.querySelectorAll(".editor-crop-handle").forEach(function (handle) {
      handle.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var pos = handle.dataset.pos;
        var startX = e.clientX, startY = e.clientY;
        var orig = { x: box.x, y: box.y, w: box.w, h: box.h };
        function onMove(ev) {
          var dx = ev.clientX - startX, dy = ev.clientY - startY;
          var sw = stage.clientWidth, sh = stage.clientHeight;
          var b = { x: orig.x, y: orig.y, w: orig.w, h: orig.h };
          if (pos.indexOf("e") >= 0) b.w = Math.max(20, orig.w + dx);
          if (pos.indexOf("s") >= 0) b.h = Math.max(20, orig.h + dy);
          if (pos.indexOf("w") >= 0) { b.w = Math.max(20, orig.w - dx); b.x = orig.x + dx; }
          if (pos.indexOf("n") >= 0) { b.h = Math.max(20, orig.h - dy); b.y = orig.y + dy; }
          b.x = Math.max(0, Math.min(b.x, sw - 20));
          b.y = Math.max(0, Math.min(b.y, sh - 20));
          b.w = Math.min(b.w, sw - b.x);
          b.h = Math.min(b.h, sh - b.y);
          box = b;
          layoutRect();
        }
        function onUp() {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    });

    function close() { overlay.remove(); }
    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });

    applyBtn.addEventListener("click", function () {
      var scaleX = pic.naturalWidth / stage.clientWidth;
      var scaleY = pic.naturalHeight / stage.clientHeight;
      var sx = box.x * scaleX, sy = box.y * scaleY;
      var sw = box.w * scaleX, sh = box.h * scaleY;
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      var ctx = canvas.getContext("2d");
      ctx.drawImage(pic, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) {
        var origName = (imgEl.src.split("/").pop() || "image").split("?")[0];
        var base = origName.replace(/\.[^.]+$/, "");
        uploadBlob(blob, base + "-cropped.png", function (path) {
          onDone(path);
          close();
        });
      }, "image/png");
    });
  }

  // ---------------------------------------------------------------- shared helpers
  function makeBtn(label, onClick, danger) {
    var b = document.createElement("button");
    b.className = "editor-btn" + (danger ? " editor-btn-danger" : "");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  function nextZIndex() {
    window.__editorZCounter = (window.__editorZCounter || 1000) + 1;
    return window.__editorZCounter;
  }

  function getPageContent() {
    return document.querySelector(".page-content");
  }

  function getFreeCanvas() {
    var pc = getPageContent();
    if (!pc) return null;
    var canvas = pc.querySelector(":scope > .free-canvas");
    if (!canvas) {
      canvas = document.createElement("div");
      canvas.className = "free-canvas";
      pc.appendChild(canvas);
    }
    return canvas;
  }

  function pageRelativeCoords(clientX, clientY) {
    var pc = getPageContent();
    var rect = pc ? pc.getBoundingClientRect() : { left: 0, top: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function makeDragHandle(title) {
    var handle = document.createElement("div");
    handle.className = "free-drag-handle editor-ui";
    handle.title = title || "Drag to move";
    handle.textContent = "☰";
    return handle;
  }

  // Simple handle-based dragging for an element that is ALREADY free-floating
  // (position:absolute). No promotion logic here -- that only happens
  // explicitly via the "Free position" toggle buttons below.
  function makeFreeDraggable(el, handle) {
    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var startMouseX = e.clientX, startMouseY = e.clientY;
      var startLeft = parseFloat(el.style.left) || 0;
      var startTop = parseFloat(el.style.top) || 0;
      el.style.zIndex = String(nextZIndex());
      function onMove(ev) {
        el.style.left = Math.max(0, startLeft + (ev.clientX - startMouseX)) + "px";
        el.style.top = Math.max(0, startTop + (ev.clientY - startMouseY)) + "px";
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        markDirty();
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  // popover: pick one of the site's real pages, or type a custom URL
  function openLinkPicker(existingHref, onConfirm) {
    fetch("/__editor__/api/pages")
      .then(function (r) { return r.json(); })
      .then(function (files) {
        var overlay = document.createElement("div");
        overlay.className = "editor-ui editor-link-overlay";

        var box = document.createElement("div");
        box.className = "editor-link-box";

        var heading = document.createElement("div");
        heading.className = "editor-link-heading";
        heading.textContent = "Link to";
        box.appendChild(heading);

        var select = document.createElement("select");
        var blankOpt = document.createElement("option");
        blankOpt.value = "";
        blankOpt.textContent = "— No link —";
        select.appendChild(blankOpt);
        files.forEach(function (f) {
          var opt = document.createElement("option");
          opt.value = f;
          opt.textContent = f;
          select.appendChild(opt);
        });
        var customOpt = document.createElement("option");
        customOpt.value = "__custom__";
        customOpt.textContent = "Custom URL…";
        select.appendChild(customOpt);

        var isKnown = files.indexOf(existingHref) !== -1;
        select.value = existingHref ? (isKnown ? existingHref : "__custom__") : "";

        var customInput = document.createElement("input");
        customInput.type = "text";
        customInput.placeholder = "https://…";
        customInput.style.display = select.value === "__custom__" ? "block" : "none";
        if (select.value === "__custom__") customInput.value = existingHref;

        select.addEventListener("change", function () {
          customInput.style.display = select.value === "__custom__" ? "block" : "none";
          if (select.value === "__custom__") customInput.focus();
        });

        box.appendChild(select);
        box.appendChild(customInput);

        var footer = document.createElement("div");
        footer.className = "editor-link-footer";
        footer.appendChild(makeBtn("Cancel", function () { overlay.remove(); }));
        footer.appendChild(makeBtn("Apply", function () {
          var href = select.value === "__custom__" ? customInput.value.trim() : select.value;
          overlay.remove();
          onConfirm(href);
        }));
        box.appendChild(footer);

        overlay.appendChild(box);
        overlay.addEventListener("mousedown", function (e) {
          if (e.target === overlay) overlay.remove();
        });
        document.body.appendChild(overlay);
      });
  }

  function setImageLink(imgEl, href) {
    var existingLink = imgEl.closest("a");
    if (existingLink) {
      if (href) {
        existingLink.setAttribute("href", href);
      } else {
        existingLink.parentNode.insertBefore(imgEl, existingLink);
        existingLink.remove();
      }
    } else if (href) {
      var a = document.createElement("a");
      a.setAttribute("href", href);
      imgEl.parentNode.insertBefore(a, imgEl);
      a.appendChild(imgEl);
    }
  }

  // ---------------------------------------------------------------- background image mode
  function convertToBackground(wrap, imgEl) {
    var page = getPageContent();
    if (!page) return;

    page.insertBefore(imgEl, page.firstChild);
    wrap.remove();

    imgEl.classList.add("editor-bg-image");
    imgEl.style.position = "absolute";
    imgEl.style.inset = "0";
    imgEl.style.width = "100%";
    imgEl.style.height = "100%";
    imgEl.style.objectFit = "cover";
    imgEl.style.zIndex = "-1";

    var toolbar = document.createElement("div");
    toolbar.className = "editor-toolbar editor-ui editor-bg-toolbar";
    toolbar.appendChild(makeBtn("Replace", function () {
      pickAndUpload(function (path) { imgEl.src = path; markDirty(); });
    }));
    toolbar.appendChild(makeBtn("Remove background", function () {
      revertBackground(imgEl, toolbar, page);
    }));
    toolbar.appendChild(makeBtn("Delete", function () {
      imgEl.remove();
      toolbar.remove();
      markDirty();
    }, true));
    page.appendChild(toolbar);
    markDirty();
  }

  function revertBackground(imgEl, toolbar, page) {
    imgEl.style.position = "";
    imgEl.style.inset = "";
    imgEl.style.width = "";
    imgEl.style.height = "";
    imgEl.style.objectFit = "";
    imgEl.style.zIndex = "";
    imgEl.classList.remove("editor-bg-image");
    toolbar.remove();
    imgEl.draggable = false;
    var wrap = setupImageBlock(imgEl, {
      allowDelete: true, allowLink: true, allowSize: true,
      allowBackground: true, allowFreePosition: true,
    });
    var canvas = page.querySelector(":scope > .free-canvas");
    if (canvas) page.insertBefore(wrap, canvas); else page.appendChild(wrap);
    addBlockHandle(wrap);
    markDirty();
  }

  // ---------------------------------------------------------------- gallery images (grid/link/row)
  // Deliberately simple: replace/crop/link/delete only. Size is governed by
  // the gallery's own Columns setting, and there's no free-position escape
  // hatch here -- an image that needs that should be a standalone block.
  function wrapGalleryItem(item, imgEl, opts) {
    imgEl.draggable = false;
    var wrap = document.createElement("div");
    wrap.className = "editor-img-wrap";
    item.parentNode.insertBefore(wrap, item);
    wrap.appendChild(item);

    var toolbar = document.createElement("div");
    toolbar.className = "editor-toolbar editor-ui";
    toolbar.appendChild(makeBtn("Replace", function () {
      pickAndUpload(function (path) { imgEl.src = path; markDirty(); });
    }));
    toolbar.appendChild(makeBtn("Crop", function () {
      openCropModal(imgEl, function (path) { imgEl.src = path; markDirty(); });
    }));
    if (opts.allowLink) {
      toolbar.appendChild(makeBtn("Link", function () {
        var existingA = imgEl.closest("a");
        var existing = existingA ? (existingA.getAttribute("href") || "") : "";
        openLinkPicker(existing, function (href) { setImageLink(imgEl, href); markDirty(); });
      }));
    }
    if (opts.allowDelete) {
      toolbar.appendChild(makeBtn("Delete", function () { wrap.remove(); markDirty(); }, true));
    }
    wrap.appendChild(toolbar);
    return wrap;
  }

  // ---------------------------------------------------------------- standalone image blocks
  // Used for project photos and any image added via the "+ Image" tool.
  // Gets size presets and an explicit, click-triggered "Free position"
  // toggle -- promoting/returning only ever happens on a deliberate click,
  // never as a side effect of dragging.
  function setupImageBlock(imgEl, opts) {
    opts = opts || {};
    imgEl.draggable = false;

    var wrap = document.createElement("div");
    wrap.className = "editor-img-wrap";
    imgEl.parentNode.insertBefore(wrap, imgEl);
    wrap.appendChild(imgEl);

    var toolbar = document.createElement("div");
    toolbar.className = "editor-toolbar editor-ui";
    wrap.appendChild(toolbar);

    var isFree = false;
    var dragHandle = null;

    function renderToolbar() {
      toolbar.innerHTML = "";
      toolbar.appendChild(makeBtn("Replace", function () {
        pickAndUpload(function (path) { imgEl.src = path; markDirty(); });
      }));
      toolbar.appendChild(makeBtn("Crop", function () {
        openCropModal(imgEl, function (path) { imgEl.src = path; markDirty(); });
      }));
      if (opts.allowLink !== false) {
        toolbar.appendChild(makeBtn("Link", function () {
          var existingA = imgEl.closest("a");
          var existing = existingA ? (existingA.getAttribute("href") || "") : "";
          openLinkPicker(existing, function (href) { setImageLink(imgEl, href); markDirty(); });
        }));
      }
      if (opts.allowSize !== false) {
        [["S", "33%"], ["M", "50%"], ["L", "75%"], ["Full", "100%"]].forEach(function (pair) {
          var b = makeBtn(pair[0], function () {
            wrap.style.width = pair[1];
            markDirty();
          });
          b.classList.add("editor-size-btn");
          toolbar.appendChild(b);
        });
      }
      if (opts.allowBackground) {
        toolbar.appendChild(makeBtn("Background", function () { convertToBackground(wrap, imgEl); }));
      }
      if (opts.allowFreePosition !== false) {
        toolbar.appendChild(makeBtn(isFree ? "Return to flow" : "Free position", toggleFree));
      }
      if (opts.allowDelete !== false) {
        toolbar.appendChild(makeBtn("Delete", function () { wrap.remove(); markDirty(); }, true));
      }
    }

    function toggleFree() {
      if (!isFree) {
        var canvas = getFreeCanvas();
        var rect = wrap.getBoundingClientRect();
        var pos = pageRelativeCoords(rect.left, rect.top);
        var width = rect.width;
        canvas.appendChild(wrap);
        wrap.style.position = "absolute";
        wrap.style.left = Math.max(0, pos.x) + "px";
        wrap.style.top = Math.max(0, pos.y) + "px";
        wrap.style.width = Math.round(width) + "px";
        wrap.style.zIndex = String(nextZIndex());
        dragHandle = makeDragHandle();
        wrap.appendChild(dragHandle);
        makeFreeDraggable(wrap, dragHandle);
        isFree = true;
      } else {
        var pc = getPageContent();
        var canvas2 = pc.querySelector(":scope > .free-canvas");
        wrap.style.position = "";
        wrap.style.left = "";
        wrap.style.top = "";
        wrap.style.zIndex = "";
        if (dragHandle) { dragHandle.remove(); dragHandle = null; }
        if (canvas2) pc.insertBefore(wrap, canvas2); else pc.appendChild(wrap);
        addBlockHandle(wrap);
        isFree = false;
      }
      renderToolbar();
      markDirty();
    }

    renderToolbar();
    return wrap;
  }

  function setupStandaloneImage(img, opts) {
    if (img.closest(".editor-img-wrap")) return;
    if (img.dataset.editorSetup) return;
    img.dataset.editorSetup = "true";
    setupImageBlock(img, opts);
  }

  // ---------------------------------------------------------------- gallery setup
  function setupGallery(container, opts) {
    if (container.dataset.editorSetup) return;
    container.dataset.editorSetup = "true";

    Array.prototype.slice.call(container.children).forEach(function (item) {
      var img = item.tagName === "IMG" ? item : item.querySelector("img");
      if (!img) return;
      wrapGalleryItem(item, img, opts);
    });

    if (window.Sortable) {
      window.Sortable.create(container, {
        animation: 150,
        group: "editor-photos",
        ghostClass: "editor-sortable-ghost",
        chosenClass: "editor-sortable-chosen",
        onEnd: markDirty,
      });
    }
  }

  // ---------------------------------------------------------------- text blocks
  var BLOCK_DISQUALIFY_TAGS = [
    "DIV", "SECTION", "ARTICLE", "HEADER", "FOOTER", "UL", "OL", "LI",
    "TABLE", "FIGURE", "P", "H1", "H2", "H3", "H4", "H5", "H6", "IMG",
  ];

  function isLeafTextEl(el) {
    if (el.tagName !== "DIV" && el.tagName !== "SPAN") return true;
    if (el.textContent.trim().length === 0) return false;
    for (var i = 0; i < el.children.length; i++) {
      if (BLOCK_DISQUALIFY_TAGS.indexOf(el.children[i].tagName) !== -1) return false;
    }
    return true;
  }

  // Explicit, click-triggered promote/return for a text element -- same idea
  // as the image toggle. Adds a small margin control (⛶ / ↩) rather than
  // relying on drag gestures, so it can never trigger by accident.
  function addTextFreeToggle(el) {
    var isFree = false;
    var dragHandle = null;
    var toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "editor-text-toggle editor-ui";
    toggleBtn.title = "Free position (place anywhere on the page)";
    toggleBtn.textContent = "⛶";

    toggleBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!isFree) {
        var canvas = getFreeCanvas();
        var rect = el.getBoundingClientRect();
        var pos = pageRelativeCoords(rect.left, rect.top);
        var width = rect.width;
        canvas.appendChild(el);
        el.style.position = "absolute";
        el.style.left = Math.max(0, pos.x) + "px";
        el.style.top = Math.max(0, pos.y) + "px";
        el.style.width = Math.round(width) + "px";
        el.style.zIndex = String(nextZIndex());
        el.classList.add("free-textbox");
        dragHandle = makeDragHandle();
        el.appendChild(dragHandle);
        makeFreeDraggable(el, dragHandle);
        toggleBtn.title = "Return to normal text flow";
        toggleBtn.textContent = "↩";
        isFree = true;
      } else {
        var pc = getPageContent();
        var canvas2 = pc.querySelector(":scope > .free-canvas");
        el.style.position = "";
        el.style.left = "";
        el.style.top = "";
        el.style.zIndex = "";
        el.classList.remove("free-textbox");
        if (dragHandle) { dragHandle.remove(); dragHandle = null; }
        if (canvas2) pc.insertBefore(el, canvas2); else pc.appendChild(el);
        addBlockHandle(el);
        toggleBtn.title = "Free position (place anywhere on the page)";
        toggleBtn.textContent = "⛶";
        isFree = false;
      }
      el.appendChild(toggleBtn);
      markDirty();
    });

    el.appendChild(toggleBtn);
  }

  // Inserts a freshly-uploaded image right at the current text cursor
  // position within `flow` -- this is the "+ Image while writing" move.
  // Falls back to the end of the passage if the cursor isn't in this flow.
  function insertImageAtCursor(flow) {
    var sel = document.getSelection();
    var refNode = null;
    if (sel.rangeCount && flow.contains(sel.anchorNode)) {
      var node = sel.anchorNode;
      while (node && node.parentElement !== flow) node = node.parentElement;
      refNode = node;
    }
    pickAndUpload(function (path) {
      var img = document.createElement("img");
      img.src = path;
      img.loading = "lazy";
      img.alt = "";
      img.style.width = "100%";
      if (refNode) flow.insertBefore(img, refNode.nextSibling);
      else flow.appendChild(img);
      setupStandaloneImage(img, {
        allowDelete: true, allowLink: true, allowSize: true,
        allowBackground: false, allowFreePosition: true,
      });
      markDirty();
    });
  }

  // Turns a prose container into ONE continuous editable passage -- like
  // typing in a real document. The actual contenteditable region is an inner
  // ".editor-text-flow" wrapper (unwrapped again on save) so the outer
  // section element stays untouched for whole-section drag reordering, and
  // the "+ Image" button can sit safely outside the editable area itself.
  function setupContinuousTextArea(container) {
    if (container.dataset.editorContinuousSetup) return;
    container.dataset.editorContinuousSetup = "true";

    var flow = document.createElement("div");
    flow.className = "editor-text-flow";
    // leave any already-injected editor UI (e.g. the "move section" handle)
    // as a direct child of container -- only the real content moves inside
    Array.prototype.slice.call(container.childNodes).forEach(function (node) {
      if (node.nodeType === 1 && node.classList.contains("editor-ui")) return;
      flow.appendChild(node);
    });
    container.appendChild(flow);

    flow.setAttribute("contenteditable", "true");
    flow.addEventListener("input", markDirty);

    var insertBtn = makeBtn("+ Image", function () {
      insertImageAtCursor(flow);
    });
    insertBtn.className += " editor-inline-insert-btn editor-ui";
    insertBtn.addEventListener("mousedown", function (e) { e.preventDefault(); });
    container.appendChild(insertBtn);
  }

  function setupTextEditing() {
    TEXT_CONTAINER_SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (container) {
        container.querySelectorAll(TEXT_TAGS.join(",")).forEach(function (el) {
          if (el.closest(".editor-img-wrap") || el.closest(".editor-ui")) return;
          if (el.closest(".editor-text-flow")) return;
          if (el.parentElement && el.parentElement.closest('[contenteditable="true"]')) return;
          if (!isLeafTextEl(el)) return;
          if (el.dataset.editorTextSetup) return;
          el.dataset.editorTextSetup = "true";
          el.setAttribute("contenteditable", "true");
          el.addEventListener("input", markDirty);
          addTextFreeToggle(el);
        });
      });
    });

    PARA_LIST_SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (container) {
        setupContinuousTextArea(container);
      });
    });
  }

  // ---------------------------------------------------------------- text toolbar
  // One floating toolbar for any text being edited: paragraph style, font,
  // size, bold/italic/underline/strike, color, highlight, alignment, links,
  // clear formatting. With text selected it styles just the selection; with
  // only a blinking cursor, font/size/alignment apply to the whole paragraph.
  function setupTextToolbar() {
    var Theme = window.parent && window.parent.SiteTheme;
    var fonts = Theme ? Theme.FONTS : [{ name: "System (default)", css: "" }];

    // load every curated font in the editor so the menu can preview them
    // (editor-only: stripped on save; the live site loads only fonts in use)
    if (Theme) {
      var fontLink = document.createElement("link");
      fontLink.rel = "stylesheet";
      fontLink.className = "editor-ui";
      fontLink.href = Theme.googleUrl(fonts.map(function (f) { return f.name; }));
      document.head.appendChild(fontLink);
    }

    var bar = document.createElement("div");
    bar.className = "editor-text-toolbar editor-ui";
    document.body.appendChild(bar);

    var savedRange = null;
    var activeRoot = null;

    function editableFrom(node) {
      var el = node && node.nodeType === 3 ? node.parentElement : node;
      return el && el.closest ? el.closest('[contenteditable="true"]') : null;
    }
    function rememberSelection() {
      var sel = document.getSelection();
      if (!sel || !sel.rangeCount) return;
      var root = editableFrom(sel.anchorNode);
      if (!root) return;
      savedRange = sel.getRangeAt(0).cloneRange();
      activeRoot = root;
    }
    function restoreSelection() {
      if (!savedRange) return;
      var sel = document.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    function hasSelection() { return savedRange && !savedRange.collapsed; }
    var BLOCK_TAGS = ["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "FIGCAPTION", "DIV"];
    function currentBlock() {
      if (!activeRoot) return null;
      var n = savedRange ? savedRange.startContainer : activeRoot;
      var el = n.nodeType === 3 ? n.parentElement : n;
      while (el && el !== activeRoot) {
        if (BLOCK_TAGS.indexOf(el.tagName) !== -1) return el;
        el = el.parentElement;
      }
      return activeRoot;
    }
    function isFlow() { return activeRoot && activeRoot.classList.contains("editor-text-flow"); }
    function changed() { markDirty(); rememberSelection(); sync(); position(); }

    function exec(cmd, val, css) {
      restoreSelection();
      document.execCommand("styleWithCSS", false, !!css);
      document.execCommand(cmd, false, val == null ? null : val);
      changed();
    }

    // ---- controls
    function select(title, options, onChange) {
      var s = document.createElement("select");
      s.title = title;
      options.forEach(function (o) {
        var opt = document.createElement("option");
        opt.value = o.value;
        opt.textContent = o.label;
        if (o.font) opt.style.fontFamily = o.font;
        s.appendChild(opt);
      });
      s.addEventListener("mousedown", rememberSelection);
      s.addEventListener("change", function () { onChange(s.value); });
      bar.appendChild(s);
      return s;
    }
    function button(html, title, onClick) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "editor-tt-btn";
      b.innerHTML = html;
      b.title = title;
      b.addEventListener("mousedown", function (e) { e.preventDefault(); });
      b.addEventListener("click", function (e) { e.preventDefault(); onClick(); });
      bar.appendChild(b);
      return b;
    }
    function divider() {
      var d = document.createElement("span");
      d.className = "editor-tt-divider";
      bar.appendChild(d);
    }
    function colorInput(title, swatchLabel, onPick) {
      var wrap = document.createElement("label");
      wrap.className = "editor-tt-color";
      wrap.title = title;
      var face = document.createElement("span");
      face.innerHTML = swatchLabel;
      var bar2 = document.createElement("span");
      bar2.className = "editor-tt-color-bar";
      var input = document.createElement("input");
      input.type = "color";
      input.addEventListener("mousedown", rememberSelection);
      input.addEventListener("input", function () { bar2.style.background = input.value; onPick(input.value); });
      wrap.appendChild(face);
      wrap.appendChild(bar2);
      wrap.appendChild(input);
      bar.appendChild(wrap);
      return { input: input, bar: bar2 };
    }

    var styleSel = select("Paragraph style", [
      { value: "P", label: "Paragraph" },
      { value: "H1", label: "Heading 1" },
      { value: "H2", label: "Heading 2" },
      { value: "H3", label: "Heading 3" },
      { value: "BLOCKQUOTE", label: "Quote" },
    ], function (tag) { exec("formatBlock", "<" + tag + ">"); });

    var fontSel = select("Font", fonts.map(function (f, i) {
      return { value: String(i), label: i === 0 ? "Site font" : f.name, font: f.css || "" };
    }), function (idx) {
      var f = fonts[Number(idx)];
      if (hasSelection()) {
        exec("fontName", f.css || "inherit", true);
      } else {
        var b = currentBlock();
        if (b) { b.style.fontFamily = f.css || ""; changed(); }
      }
    });
    fontSel.classList.add("editor-tt-font");

    var SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80];
    var sizeSel = select("Text size", [{ value: "", label: "Size" }].concat(SIZES.map(function (s) {
      return { value: String(s), label: s + "" };
    })), function (px) {
      if (!px) return;
      if (hasSelection()) {
        restoreSelection();
        document.execCommand("styleWithCSS", false, false);
        document.execCommand("fontSize", false, "7");
        var root = activeRoot || document.body;
        root.querySelectorAll('font[size="7"]').forEach(function (fEl) {
          var span = document.createElement("span");
          span.style.fontSize = px + "px";
          while (fEl.firstChild) span.appendChild(fEl.firstChild);
          fEl.replaceWith(span);
        });
        root.querySelectorAll("span").forEach(function (sp) {
          if (sp.style.fontSize === "xxx-large" || sp.style.fontSize === "-webkit-xxx-large") sp.style.fontSize = px + "px";
        });
        changed();
      } else {
        var b = currentBlock();
        if (b) { b.style.fontSize = px + "px"; changed(); }
      }
    });
    sizeSel.classList.add("editor-tt-size");

    // line spacing applies to whole paragraphs: every paragraph the selection
    // touches, or the paragraph holding the cursor
    var SPACINGS = [
      { value: "1.15", label: "↕ Single" },
      { value: "1.25", label: "↕ 1.25" },
      { value: "1.5", label: "↕ 1.5" },
      { value: "2", label: "↕ Double" },
    ];
    function blocksInSelection() {
      if (!activeRoot) return [];
      if (!isFlow()) return [activeRoot];
      var found = [];
      if (savedRange) {
        activeRoot.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption").forEach(function (el) {
          if (savedRange.intersectsNode(el)) found.push(el);
        });
      }
      if (!found.length) { var b = currentBlock(); if (b) found.push(b); }
      return found;
    }
    var spacingSel = select("Line spacing", [{ value: "", label: "↕ Spacing" }].concat(SPACINGS).concat([
      { value: "reset", label: "↕ Site default" },
    ]), function (val) {
      if (!val) return;
      blocksInSelection().forEach(function (el) {
        el.style.lineHeight = val === "reset" ? "" : val;
        if (!el.getAttribute("style")) el.removeAttribute("style");
      });
      restoreSelection();
      changed();
    });
    spacingSel.classList.add("editor-tt-spacing");

    divider();
    var boldBtn = button("<b>B</b>", "Bold (⌘B)", function () { exec("bold"); });
    var italicBtn = button("<i>I</i>", "Italic (⌘I)", function () { exec("italic"); });
    var underBtn = button("<u>U</u>", "Underline (⌘U)", function () { exec("underline"); });
    var strikeBtn = button("<s>S</s>", "Strikethrough", function () { exec("strikeThrough"); });
    divider();
    var textColor = colorInput("Text color", "A", function (c) { exec("foreColor", c, true); });
    colorInput("Highlight", "<span class='editor-tt-hl'>H</span>", function (c) { exec("hiliteColor", c, true); });
    divider();
    var ALIGN_ICONS = {
      left: "<svg width='14' height='14' viewBox='0 0 14 14'><path d='M1 2h12M1 5.3h8M1 8.6h12M1 12h8' stroke='currentColor' stroke-width='1.4'/></svg>",
      center: "<svg width='14' height='14' viewBox='0 0 14 14'><path d='M1 2h12M3 5.3h8M1 8.6h12M3 12h8' stroke='currentColor' stroke-width='1.4'/></svg>",
      right: "<svg width='14' height='14' viewBox='0 0 14 14'><path d='M1 2h12M5 5.3h8M1 8.6h12M5 12h8' stroke='currentColor' stroke-width='1.4'/></svg>",
    };
    var alignBtns = {};
    ["left", "center", "right"].forEach(function (a) {
      alignBtns[a] = button(ALIGN_ICONS[a], "Align " + a, function () {
        if (isFlow()) {
          exec("justify" + a.charAt(0).toUpperCase() + a.slice(1));
        } else if (activeRoot) {
          activeRoot.style.textAlign = a === "left" ? "" : a;
          changed();
        }
      });
    });
    divider();
    button("Link", "Add or change a link", function () {
      var range = savedRange ? savedRange.cloneRange() : null;
      var el = range ? (range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer) : null;
      var linkEl = el && el.closest ? el.closest("a") : null;
      var existing = linkEl ? (linkEl.getAttribute("href") || "") : "";
      openLinkPicker(existing, function (href) {
        savedRange = range;
        if (href) exec("createLink", href); else exec("unlink");
      });
    });
    button("&#x2715;&#xFE0E;<span class='editor-tt-small'>Clear</span>", "Clear formatting", function () {
      exec("removeFormat");
      if (!hasSelection()) {
        var b = currentBlock();
        if (b) { b.style.fontFamily = ""; b.style.fontSize = ""; b.style.textAlign = ""; changed(); }
      }
    });

    bar.addEventListener("mousedown", function (e) {
      var t = e.target;
      if (t.tagName !== "SELECT" && t.tagName !== "INPUT" && t.tagName !== "OPTION") e.preventDefault();
    });

    // ---- state
    function rgbToHex(rgb) {
      var m = rgb && rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return "#111111";
      return "#" + [m[1], m[2], m[3]].map(function (v) {
        var h = parseInt(v, 10).toString(16);
        return h.length === 1 ? "0" + h : h;
      }).join("");
    }
    function sync() {
      if (!activeRoot) return;
      var anchorEl = savedRange
        ? (savedRange.startContainer.nodeType === 3 ? savedRange.startContainer.parentElement : savedRange.startContainer)
        : activeRoot;
      var cs = window.getComputedStyle(anchorEl);
      var block = currentBlock();
      styleSel.disabled = !isFlow();
      styleSel.value = block && ["P", "H1", "H2", "H3", "BLOCKQUOTE"].indexOf(block.tagName) !== -1 ? block.tagName : "P";
      var fam = cs.fontFamily || "";
      var idx = 0;
      fonts.forEach(function (f, i) { if (i && fam.indexOf(f.name) !== -1) idx = i; });
      fontSel.value = String(idx);
      var px = Math.round(parseFloat(cs.fontSize));
      sizeSel.value = SIZES.indexOf(px) !== -1 ? String(px) : "";
      sizeSel.options[0].textContent = SIZES.indexOf(px) !== -1 ? "Size" : px + "";
      var lhBlock = blocksInSelection()[0];
      var lhCs = lhBlock ? window.getComputedStyle(lhBlock) : null;
      var ratio = lhCs ? parseFloat(lhCs.lineHeight) / parseFloat(lhCs.fontSize) : NaN;
      var match = SPACINGS.filter(function (o) { return Math.abs(Number(o.value) - ratio) < 0.03; })[0];
      spacingSel.value = match ? match.value : "";
      spacingSel.options[0].textContent = "↕ " + (match || isNaN(ratio) ? "Spacing" : Math.round(ratio * 100) / 100);
      boldBtn.classList.toggle("active", document.queryCommandState("bold"));
      italicBtn.classList.toggle("active", document.queryCommandState("italic"));
      underBtn.classList.toggle("active", document.queryCommandState("underline"));
      strikeBtn.classList.toggle("active", document.queryCommandState("strikeThrough"));
      textColor.bar.style.background = rgbToHex(cs.color);
      var al = window.getComputedStyle(block || activeRoot).textAlign;
      ["left", "center", "right"].forEach(function (a) {
        alignBtns[a].classList.toggle("active", al === a || (a === "left" && (al === "start" || al === "justify")));
      });
    }
    function position() {
      if (!activeRoot) return;
      var rect = null;
      if (hasSelection()) rect = savedRange.getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) rect = activeRoot.getBoundingClientRect();
      var bw = bar.offsetWidth, bh = bar.offsetHeight;
      var left = Math.min(Math.max(8, rect.left + rect.width / 2 - bw / 2), window.innerWidth - bw - 8);
      var top = rect.top - bh - 10;
      if (top < 8) top = Math.min(rect.bottom + 10, window.innerHeight - bh - 8);
      bar.style.left = left + "px";
      bar.style.top = Math.max(8, top) + "px";
    }
    function show() { bar.classList.add("open"); sync(); position(); }
    function hide() { bar.classList.remove("open"); activeRoot = null; savedRange = null; }

    document.addEventListener("selectionchange", function () {
      var sel = document.getSelection();
      if (!sel || !sel.rangeCount) return;
      if (!editableFrom(sel.anchorNode)) return; // keep state while using the toolbar's own inputs
      rememberSelection();
      show();
    });
    document.addEventListener("focusout", function () {
      setTimeout(function () {
        var a = document.activeElement;
        if (bar.contains(a)) return;
        if (a && a.closest && a.closest('[contenteditable="true"]')) return;
        if (document.querySelector(".editor-link-overlay, .editor-modal-overlay")) return;
        hide();
      }, 120);
    });
    window.addEventListener("scroll", function () { if (bar.classList.contains("open")) position(); }, true);
    window.addEventListener("resize", function () { if (bar.classList.contains("open")) position(); });
  }

  // ---------------------------------------------------------------- keyboard shortcuts
  // Undo/redo/save go to the editor shell, which keeps page-wide history
  // (text edits, moved photos, deleted blocks -- everything).
  document.addEventListener("keydown", function (e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    var k = e.key.toLowerCase();
    var action = null;
    if (k === "z" && !e.shiftKey) action = "undo";
    else if ((k === "z" && e.shiftKey) || k === "y") action = "redo";
    else if (k === "s") action = "save";
    if (!action) return;
    e.preventDefault();
    if (window.__editorOnKey) window.__editorOnKey(action);
  }, true);

  // ---------------------------------------------------------------- coarse block reordering
  // .page-content is a permanent part of every page's real structure, so we
  // can make its direct children sortable in place -- no temporary wrapper.
  function addBlockHandle(block) {
    if (block.dataset.editorBlockHandle) return;
    block.dataset.editorBlockHandle = "true";
    var cs = window.getComputedStyle(block);
    if (cs.position === "static") {
      block.style.position = "relative";
      block.dataset.editorPosAdded = "true"; // editor-only; removed again on save
    }
    var handle = document.createElement("div");
    handle.className = "editor-block-handle editor-ui";
    handle.title = "Drag to move this whole section up or down";
    handle.textContent = "☰ move section";
    block.insertBefore(handle, block.firstChild);
  }

  function setupContentFlow() {
    var pageContent = getPageContent();
    if (!pageContent || pageContent.dataset.editorFlowSetup) return;
    pageContent.dataset.editorFlowSetup = "true";

    Array.prototype.forEach.call(pageContent.children, function (block) {
      if (block.classList.contains("free-canvas")) return;
      addBlockHandle(block);
    });

    if (window.Sortable) {
      window.Sortable.create(pageContent, {
        animation: 150,
        handle: ".editor-block-handle",
        filter: ".free-canvas",
        ghostClass: "editor-sortable-ghost",
        chosenClass: "editor-sortable-chosen",
        onEnd: markDirty,
      });
    }
  }

  // ---------------------------------------------------------------- insert tools (from shell topbar)
  // Every tool appends a plain in-flow block at the end of the page. Drag it
  // into position afterward with its "move section" handle -- no more
  // click-somewhere-on-the-canvas placement.
  function appendBlock(el) {
    var pc = getPageContent();
    if (!pc) return;
    var canvas = pc.querySelector(":scope > .free-canvas");
    if (canvas) pc.insertBefore(el, canvas); else pc.appendChild(el);
    return el;
  }

  function insertTextBlock() {
    var p = document.createElement("p");
    p.className = "container";
    p.textContent = "New text";
    p.setAttribute("contenteditable", "true");
    p.dataset.editorTextSetup = "true";
    p.addEventListener("input", markDirty);
    addTextFreeToggle(p);
    appendBlock(p);
    addBlockHandle(p);
    markDirty();
    p.focus();
    document.execCommand("selectAll", false, null);
    p.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function insertImageBlock() {
    var placeholder = document.createElement("div");
    placeholder.className = "editor-img-wrap container";

    var inner = document.createElement("div");
    inner.className = "free-img-placeholder-inner editor-ui";
    inner.textContent = "+ Click to upload image";
    placeholder.appendChild(inner);

    inner.addEventListener("click", function () {
      pickAndUpload(function (path) {
        var img = document.createElement("img");
        img.src = path;
        img.loading = "lazy";
        img.alt = "";
        img.style.width = "100%";
        placeholder.replaceWith(img);
        setupStandaloneImage(img, {
          allowDelete: true, allowLink: true, allowSize: true,
          allowBackground: true, allowFreePosition: true,
        });
        var wrap = img.closest(".editor-img-wrap");
        addBlockHandle(wrap);
        markDirty();
        wrap.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    appendBlock(placeholder);
    addBlockHandle(placeholder);
    markDirty();
    placeholder.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ---------------------------------------------------------------- mailing list block
  var MAILING_LIST_MARKUP =
    '<form class="mailing-list-form" action="#" method="post">' +
    '<h3 class="mailing-list-heading">Join the mailing list</h3>' +
    '<p class="mailing-list-sub">Get updates on new work, straight to your inbox.</p>' +
    '<div class="mailing-list-row">' +
    '<input type="email" name="email" placeholder="you@example.com" required>' +
    '<button type="submit">Subscribe</button>' +
    "</div></form>";

  function insertMailingListBlock() {
    var wrap = document.createElement("div");
    wrap.className = "free-mailing-list container";
    wrap.innerHTML = MAILING_LIST_MARKUP;

    var delBtn = document.createElement("button");
    delBtn.className = "free-textbox-delete editor-ui";
    delBtn.type = "button";
    delBtn.title = "Delete this signup block";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      wrap.remove();
      markDirty();
    });
    wrap.appendChild(delBtn);

    wrap.querySelectorAll(".mailing-list-heading, .mailing-list-sub").forEach(function (el) {
      el.setAttribute("contenteditable", "true");
      el.addEventListener("input", markDirty);
    });
    var form = wrap.querySelector("form");
    if (form) form.addEventListener("submit", function (e) { e.preventDefault(); });

    appendBlock(wrap);
    addBlockHandle(wrap);
    markDirty();
    wrap.scrollIntoView({ behavior: "smooth", block: "center" });

    alert(
      "Added a mailing-list signup block.\n\n" +
      "This form doesn't send anywhere yet — GitHub Pages can't process form submissions on its own. " +
      "Sign up with a provider like Mailchimp, ConvertKit, or Buttondown, then edit the form's action URL " +
      "(and the email input's \"name\" attribute if the provider needs a different one) to match what they give you."
    );
  }

  function setupExistingMailingListBlock(wrap) {
    if (wrap.dataset.editorSetup) return;
    wrap.dataset.editorSetup = "true";
    if (!wrap.querySelector(".free-textbox-delete")) {
      var delBtn = document.createElement("button");
      delBtn.className = "free-textbox-delete editor-ui";
      delBtn.type = "button";
      delBtn.title = "Delete this signup block";
      delBtn.textContent = "×";
      delBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        wrap.remove();
        markDirty();
      });
      wrap.appendChild(delBtn);
    }
    wrap.querySelectorAll(".mailing-list-heading, .mailing-list-sub").forEach(function (el) {
      el.setAttribute("contenteditable", "true");
      el.addEventListener("input", markDirty);
    });
    var form = wrap.querySelector("form");
    if (form) form.addEventListener("submit", function (e) { e.preventDefault(); });
  }

  window.__editorTools = {
    addTextBox: insertTextBlock,
    addImage: insertImageBlock,
    addMailingList: insertMailingListBlock,
  };

  // ---------------------------------------------------------------- run setup
  document.querySelectorAll(GRID_GALLERY_SELECTORS.join(",")).forEach(function (c) {
    setupGallery(c, { allowDelete: true, allowLink: true });
  });
  document.querySelectorAll(LINK_GALLERY_SELECTORS.join(",")).forEach(function (c) {
    // these tiles already link to a project sub-page -- don't offer a separate Link override
    setupGallery(c, { allowDelete: false, allowLink: false });
  });
  document.querySelectorAll(ROW_SELECTORS.join(",")).forEach(function (c) {
    setupGallery(c, { allowDelete: true, allowLink: true });
  });
  document.querySelectorAll(".hero > img").forEach(function (img) {
    setupStandaloneImage(img, {
      allowDelete: false, allowLink: true, allowSize: true,
      allowBackground: false, allowFreePosition: false,
    });
  });
  document.querySelectorAll(".project-media > img").forEach(function (img) {
    setupStandaloneImage(img, {
      allowDelete: true, allowLink: true, allowSize: true,
      allowBackground: true, allowFreePosition: true,
    });
  });
  setupContentFlow();
  document.querySelectorAll(".free-mailing-list").forEach(function (wrap) {
    setupExistingMailingListBlock(wrap);
  });
  setupTextEditing();
  setupTextToolbar();

  // ---------------------------------------------------------------- serialize
  window.__editorGetCleanHTML = function () {
    var clone = document.documentElement.cloneNode(true);

    clone.querySelectorAll(".free-img-placeholder-inner").forEach(function (el) {
      // an unfilled "+ Click to upload" placeholder shouldn't be saved
      var wrap = el.closest(".editor-img-wrap");
      if (wrap && !wrap.querySelector("img")) wrap.remove();
    });

    clone.querySelectorAll(".editor-ui").forEach(function (el) { el.remove(); });

    clone.querySelectorAll(".editor-img-wrap").forEach(function (wrap) {
      var child = wrap.querySelector(":scope > img, :scope > a");
      if (child) {
        ["position", "left", "top", "width", "zIndex"].forEach(function (prop) {
          if (wrap.style[prop]) child.style[prop] = wrap.style[prop];
        });
        wrap.parentNode.insertBefore(child, wrap);
      }
      wrap.remove();
    });

    // unwrap the inner continuous-editing region, pushing its contents
    // (paragraphs, headings, any inline-inserted images) back up into the
    // real section element
    clone.querySelectorAll(".editor-text-flow").forEach(function (flow) {
      while (flow.firstChild) flow.parentNode.insertBefore(flow.firstChild, flow);
      flow.remove();
    });

    // the Site Styles live preview temporarily switches off theme.css
    clone.querySelectorAll("link[disabled]").forEach(function (el) { el.removeAttribute("disabled"); });

    // main.js adds a photo lightbox at runtime; it must not be saved into the page
    clone.querySelectorAll(".lightbox-overlay").forEach(function (el) { el.remove(); });

    // strip main.js runtime carousel artifacts so they don't accumulate across saves
    clone.querySelectorAll(".carousel-nav").forEach(function (el) { el.remove(); });
    clone.querySelectorAll(".carousel-track").forEach(function (track) {
      while (track.firstChild) track.parentNode.insertBefore(track.firstChild, track);
      track.remove();
    });
    clone.querySelectorAll("[data-carousel-init]").forEach(function (el) {
      el.removeAttribute("data-carousel-init");
    });

    clone.querySelectorAll("[data-editor-pos-added]").forEach(function (el) {
      if (el.style.position === "relative") el.style.position = "";
      if (!el.getAttribute("style")) el.removeAttribute("style");
    });
    clone.querySelectorAll('img[draggable="false"]').forEach(function (el) { el.removeAttribute("draggable"); });

    clone.querySelectorAll("[contenteditable]").forEach(function (el) {
      el.removeAttribute("contenteditable");
    });
    [
      "data-editor-setup", "data-editor-text-setup", "data-editor-block-handle",
      "data-editor-flow-setup", "data-editor-continuous-setup", "data-editor-pos-added",
    ].forEach(function (attr) {
      clone.querySelectorAll("[" + attr + "]").forEach(function (el) {
        el.removeAttribute(attr);
      });
    });
    ["__editor_injected_style__", "__editor_sortable_script__", "__editor_injected_script__"].forEach(
      function (id) {
        var el = clone.querySelector("#" + id);
        if (el) el.remove();
      }
    );
    return "<!DOCTYPE html>\n" + clone.outerHTML + "\n";
  };
})();

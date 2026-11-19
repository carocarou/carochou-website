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
  var GRID_GALLERY_SELECTORS = [".gallery-grid", ".about-images", ".carousel-track"];
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

    // drags use pointer capture, so they keep tracking even when the cursor
    // goes outside the crop box, the dark backdrop, or the page itself
    function capture(el, e, onMove) {
      el.setPointerCapture(e.pointerId);
      function up() {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
      }
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    }

    rect.addEventListener("pointerdown", function (e) {
      if (e.target !== rect || e.button !== 0) return;
      e.preventDefault();
      var startX = e.clientX, startY = e.clientY;
      var orig = { x: box.x, y: box.y };
      capture(rect, e, function (ev) {
        var sw = stage.clientWidth, sh = stage.clientHeight;
        box.x = Math.min(Math.max(0, orig.x + (ev.clientX - startX)), sw - box.w);
        box.y = Math.min(Math.max(0, orig.y + (ev.clientY - startY)), sh - box.h);
        layoutRect();
      });
    });

    rect.querySelectorAll(".editor-crop-handle").forEach(function (handle) {
      handle.addEventListener("pointerdown", function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        var pos = handle.dataset.pos;
        var startX = e.clientX, startY = e.clientY;
        var orig = { x: box.x, y: box.y, w: box.w, h: box.h };
        capture(handle, e, function onMove(ev) {
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
        });
      });
    });

    function close() { overlay.remove(); }
    // closes only with Apply Crop or Cancel -- never by clicking the backdrop,
    // since finishing a drag over the backdrop counts as a click there
    cancelBtn.addEventListener("click", close);

    applyBtn.addEventListener("click", function () {
      var scaleX = pic.naturalWidth / stage.clientWidth;
      var scaleY = pic.naturalHeight / stage.clientHeight;
      var sx = box.x * scaleX, sy = box.y * scaleY;
      var sw = box.w * scaleX, sh = box.h * scaleY;
      // web-sized output: at most 2400px on the long side (sharp on retina
      // screens), saved as a high-quality JPEG unless the crop has
      // see-through areas, which only PNG keeps. A PNG of a photo is ~10x bigger.
      var MAX_SIDE = 2400;
      var k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw * k));
      canvas.height = Math.max(1, Math.round(sh * k));
      var ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(pic, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      var transparent = false;
      if (/\.(png|gif|webp)$/i.test((imgEl.src || "").split("?")[0])) {
        var px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (var i = 3; i < px.length; i += 4) { if (px[i] < 255) { transparent = true; break; } }
      }
      var origName = (imgEl.src.split("/").pop() || "image").split("?")[0];
      var base = decodeURIComponent(origName).replace(/\.[^.]+$/, "").replace(/(-cropped)+(-\d+)?$/, "");
      applyBtn.disabled = true;
      applyBtn.textContent = "Saving…";
      canvas.toBlob(function (blob) {
        uploadBlob(blob, base + "-cropped." + (transparent ? "png" : "jpg"), function (path) {
          onDone(path);
          close();
        });
      }, transparent ? "image/png" : "image/jpeg", 0.88);
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
    var wrap = setupImageBlock(imgEl, {
      allowDelete: true, allowLink: true, allowSize: true,
      allowBackground: true, allowFreePosition: true,
    });
    var canvas = page.querySelector(":scope > .free-canvas");
    if (canvas) page.insertBefore(wrap, canvas); else page.appendChild(wrap);
    addBlockHandle(wrap);
    markDirty();
  }

  // ================================================================ PHOTOS & VIDEOS
  // Click a photo/video to select it (no lightbox zoom in the editor). A
  // selected item gets an outline, corner handles to resize, a toolbar, and
  // can be dragged to a new spot (a blue line shows where it will land).
  // Photos in galleries/carousels are reordered by dragging within the
  // gallery instead; their size comes from the gallery layout.

  var MEDIA_STYLE_PROPS = ["position", "left", "top", "width", "zIndex", "marginLeft", "marginRight", "float"];
  var selectedWrap = null;

  // stop the browser's own image dragging while editing; remembered so that
  // saving removes only what the editor added
  function noNativeDrag(el) {
    if (el.hasAttribute("draggable")) return;
    el.draggable = false;
    el.dataset.editorUndrag = "1";
  }

  function mediaOf(wrap) {
    return wrap.querySelector(":scope > img, :scope > video, :scope > a > img, :scope > a > video") ||
      wrap.querySelector("img, video"); // e.g. project tiles: <a><div><img></div><span>title</span></a>
  }
  function isVideo(el) { return el && el.tagName === "VIDEO"; }

  // ---- uploads with progress (videos can be big)
  var MAX_MB = 95;
  function checkFile(file) {
    var mb = file.size / 1024 / 1024;
    var vid = /^video\//.test(file.type);
    if (!/^(image|video)\//.test(file.type)) { alert("“" + file.name + "” isn't a photo or video."); return false; }
    if (mb > MAX_MB) {
      alert("“" + file.name + "” is " + Math.round(mb) + " MB, over the " + MAX_MB + " MB limit GitHub allows.\n\n" +
        "Make it smaller first (e.g. export at 1080p, or compress with HandBrake), or upload it to YouTube/Vimeo.");
      return false;
    }
    if (vid && mb > 40) {
      return confirm("“" + file.name + "” is " + Math.round(mb) + " MB. Big videos load slowly for visitors, " +
        "especially on phones. A compressed 1080p version is usually under 30 MB.\n\nUpload it anyway?");
    }
    return true;
  }
  function uploadWithProgress(file, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/__editor__/api/upload?page=" + encodeURIComponent(pageSlug));
      xhr.upload.onprogress = function (e) { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onload = function () {
        var d = null;
        try { d = JSON.parse(xhr.responseText); } catch (err) {}
        if (!d || xhr.status >= 400 || d.error) reject(new Error((d && d.error) || "upload failed"));
        else resolve(d.path);
      };
      xhr.onerror = function () { reject(new Error("couldn't reach the editor server")); };
      var fd = new FormData();
      fd.append("image", file);
      xhr.send(fd);
    });
  }
  function pickFiles(accept, multiple, cb) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = !!multiple;
    input.addEventListener("change", function () {
      var files = Array.prototype.filter.call(input.files, checkFile);
      if (files.length) cb(files);
    });
    input.click();
  }
  function makePlaceholder(file) {
    var ph = document.createElement("div");
    ph.className = "editor-upload-placeholder editor-ui";
    ph.contentEditable = "false";
    var label = document.createElement("div");
    label.className = "editor-upload-label";
    label.textContent = "Uploading " + file.name + "…";
    var bar = document.createElement("div");
    bar.className = "editor-upload-bar";
    var fill = document.createElement("div");
    bar.appendChild(fill);
    ph.appendChild(label);
    ph.appendChild(bar);
    ph.setProgress = function (f) { fill.style.width = Math.round(f * 100) + "%"; };
    return ph;
  }
  function createMediaEl(path, file) {
    var el;
    if (/^video\//.test(file.type) || /\.(mp4|mov|webm|m4v)$/i.test(path)) {
      el = document.createElement("video");
      el.setAttribute("src", path);
      el.setAttribute("controls", "");
      el.setAttribute("playsinline", "");
      el.setAttribute("preload", "metadata");
    } else {
      el = document.createElement("img");
      el.setAttribute("src", path);
      el.setAttribute("loading", "lazy");
      el.setAttribute("alt", "");
    }
    return el;
  }

  // ---- selection
  function selectWrap(wrap) {
    if (selectedWrap === wrap) return;
    deselect();
    selectedWrap = wrap;
    wrap.classList.add("editor-selected");
    var sel = document.getSelection();
    if (sel) sel.removeAllRanges();
    positionFrame(wrap);
  }
  function deselect() {
    if (!selectedWrap) return;
    selectedWrap.classList.remove("editor-selected");
    var v = mediaOf(selectedWrap);
    selectedWrap = null;
    if (isVideo(v) && !v.hasAttribute("autoplay")) v.pause();
  }

  // the outline/handles/toolbar sit exactly over the photo, which can be
  // narrower than its wrapper
  function positionFrame(wrap) {
    var media = mediaOf(wrap);
    var frame = wrap.querySelector(":scope > .editor-media-frame");
    if (!media || !frame) return;
    var w = wrap.getBoundingClientRect();
    var m = media.getBoundingClientRect();
    frame.style.left = (m.left - w.left) + "px";
    frame.style.top = (m.top - w.top) + "px";
    frame.style.width = m.width + "px";
    frame.style.height = m.height + "px";
  }
  function positionAllFrames() {
    document.querySelectorAll(".editor-img-wrap").forEach(positionFrame);
  }
  window.addEventListener("resize", positionAllFrames);
  window.addEventListener("load", positionAllFrames);
  document.addEventListener("load", function (e) {
    var t = e.target;
    if (t && (t.tagName === "IMG" || t.tagName === "VIDEO")) {
      var w = t.closest(".editor-img-wrap");
      if (w) positionFrame(w);
    }
  }, true);
  document.addEventListener("loadedmetadata", function (e) {
    var w = e.target.closest && e.target.closest(".editor-img-wrap");
    if (w) positionFrame(w);
  }, true);

  // clicks on photos select them -- never zoom (main.js lightbox), follow a
  // link, or flip a carousel while editing
  window.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest || t.closest(".editor-ui")) return;
    var wrap = t.closest(".editor-img-wrap");
    var media = wrap || t.closest("img, video");
    if (!media || !media.closest(".page-content")) return;
    e.preventDefault();
    e.stopPropagation();
    if (wrap && !e.shiftKey) selectWrap(wrap);
  }, true);
  document.addEventListener("mousedown", function (e) {
    if (!selectedWrap) return;
    var t = e.target;
    if (selectedWrap.contains(t)) return;
    if (t.closest && t.closest(".editor-crop-overlay, .editor-link-overlay, .editor-drop-line")) return;
    deselect();
  }, true);
  document.addEventListener("keydown", function (e) {
    if (!selectedWrap) return;
    if (e.key === "Escape") { deselect(); return; }
    var a = document.activeElement;
    var typing = a && (a.isContentEditable || a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT");
    if ((e.key === "Delete" || e.key === "Backspace") && !typing && selectedWrap.dataset.editorDeletable) {
      e.preventDefault();
      removeWrap(selectedWrap);
    }
  });

  function removeWrap(wrap) {
    if (wrap === selectedWrap) deselect();
    var parent = wrap.parentElement;
    wrap.remove();
    cleanupEmptyHolder(parent);
    markDirty();
  }
  // a .project-media box left with nothing in it goes too
  function cleanupEmptyHolder(el) {
    if (!el || !el.classList || !el.classList.contains("project-media")) return;
    var real = Array.prototype.filter.call(el.childNodes, function (n) {
      if (n.nodeType === 3) return n.textContent.trim();
      return !(n.classList && n.classList.contains("editor-ui"));
    });
    if (!real.length) el.remove();
  }

  // ---- toolbar
  function tbBtn(html, title, onClick, cls) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "editor-mt-btn" + (cls ? " " + cls : "");
    b.innerHTML = html;
    b.title = title;
    b.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); onClick(b); });
    return b;
  }
  function tbSep() { var s = document.createElement("span"); s.className = "editor-mt-sep"; return s; }
  var ICON = {
    left: "<svg width='14' height='14' viewBox='0 0 14 14'><path d='M1.5 1.5v11' stroke='currentColor' stroke-width='1.4'/><rect x='4' y='4' width='8' height='6' rx='1' fill='currentColor'/></svg>",
    center: "<svg width='14' height='14' viewBox='0 0 14 14'><path d='M7 1v2.5M7 10.5V13' stroke='currentColor' stroke-width='1.4'/><rect x='3' y='4' width='8' height='6' rx='1' fill='currentColor'/></svg>",
    right: "<svg width='14' height='14' viewBox='0 0 14 14'><path d='M12.5 1.5v11' stroke='currentColor' stroke-width='1.4'/><rect x='2' y='4' width='8' height='6' rx='1' fill='currentColor'/></svg>",
    trash: "<svg width='14' height='14' viewBox='0 0 14 14'><path d='M2 3.5h10M5.5 3.5V2h3v1.5M3.5 3.5l.6 8.5h5.8l.6-8.5' fill='none' stroke='currentColor' stroke-width='1.3' stroke-linejoin='round'/></svg>",
  };

  function alignOf(wrap) {
    var l = wrap.style.marginLeft, r = wrap.style.marginRight;
    if (l === "auto" && r === "auto") return "center";
    if (l === "auto") return "right";
    if (r === "auto") return "left";
    return wrap.style.width ? "left" : "none";
  }
  function setAlign(wrap, a) {
    wrap.style.float = "";
    wrap.style.marginLeft = a === "left" ? "0px" : "auto";
    wrap.style.marginRight = a === "right" ? "0px" : "auto";
    if (a === "left") wrap.style.marginRight = "auto";
    if (a === "right") wrap.style.marginLeft = "auto";
  }

  function buildToolbar(wrap, opts) {
    var tb = wrap.querySelector(":scope > .editor-media-frame > .editor-media-toolbar");
    tb.innerHTML = "";
    var media = mediaOf(wrap);
    var vid = isVideo(media);
    var free = wrap.dataset.editorFree === "true";

    tb.appendChild(tbBtn("Replace", vid ? "Replace with another video or photo" : "Replace with another photo or video", function () {
      pickFiles("image/*,video/*", false, function (files) {
        replaceMedia(wrap, files[0], opts);
      });
    }));
    if (!vid) {
      tb.appendChild(tbBtn("Crop", "Crop this photo", function () {
        openCropModal(media, function (path) { media.src = path; markDirty(); });
      }));
    }
    if (opts.allowLink !== false) {
      var a = media.closest("a");
      tb.appendChild(tbBtn(a ? "Link ✓" : "Link", "Make this open a page or website when clicked", function () {
        var existing = media.closest("a");
        openLinkPicker(existing ? existing.getAttribute("href") || "" : "", function (href) {
          setImageLink(media, href);
          markDirty();
          buildToolbar(wrap, opts);
        });
      }));
    }
    // the live site opens photos larger when clicked (main.js lightbox) --
    // except linked photos and slideshows, which do their own thing
    if (!vid && !media.closest("a") && !media.closest('[data-layout="carousel"]')) {
      var zoom = !media.hasAttribute("data-no-zoom");
      tb.appendChild(tbBtn(zoom ? "Click to enlarge ✓" : "Click to enlarge",
        zoom ? "Visitors can click this photo to see it larger. Click to turn that off"
             : "Let visitors click this photo to see it larger", function () {
        if (media.hasAttribute("data-no-zoom")) media.removeAttribute("data-no-zoom");
        else media.setAttribute("data-no-zoom", "");
        markDirty();
        buildToolbar(wrap, opts);
      }));
    }
    var heroSec = media.closest(".hero");
    if (heroSec) {
      var fill = heroSec.classList.contains("hero--fill");
      tb.appendChild(tbBtn(fill ? "Show whole" : "Show whole ✓",
        "Show the entire image, with a blurred copy filling the space around it", function () {
        heroSec.classList.remove("hero--fill");
        markDirty(); buildToolbar(wrap, opts); if (wrap._refreshHeroHint) wrap._refreshHeroHint();
      }));
      tb.appendChild(tbBtn(fill ? "Fill screen ✓" : "Fill screen",
        "Crop the image to fill the screen edge to edge (then drag it to choose which part shows)", function () {
        heroSec.classList.add("hero--fill");
        markDirty(); buildToolbar(wrap, opts); if (wrap._refreshHeroHint) wrap._refreshHeroHint();
      }));
    }
    if (vid) {
      tb.appendChild(tbBtn(media.paused ? "▶ Play" : "❚❚ Pause", "Preview the video", function (b) {
        if (media.paused) media.play(); else media.pause();
        setTimeout(function () { b.innerHTML = media.paused ? "▶ Play" : "❚❚ Pause"; }, 50);
      }));
      var auto = media.hasAttribute("autoplay");
      tb.appendChild(tbBtn(auto ? "Autoplay ✓" : "Autoplay", "Plays silently on a loop with no controls, like a moving photo", function () {
        if (media.hasAttribute("autoplay")) {
          ["autoplay", "muted", "loop"].forEach(function (k) { media.removeAttribute(k); });
          media.setAttribute("controls", "");
          media.muted = false;
          media.pause();
        } else {
          media.setAttribute("autoplay", "");
          media.setAttribute("muted", "");
          media.setAttribute("loop", "");
          media.removeAttribute("controls");
          media.muted = true;
          media.play();
        }
        markDirty();
        buildToolbar(wrap, opts);
      }));
    }
    if (opts.allowResize) {
      tb.appendChild(tbSep());
      var cur = alignOf(wrap);
      ["left", "center", "right"].forEach(function (al) {
        tb.appendChild(tbBtn(ICON[al], "Align " + al, function () {
          setAlign(wrap, al);
          markDirty();
          buildToolbar(wrap, opts);
          positionFrame(wrap);
        }, cur === al ? "active" : ""));
      });
      tb.appendChild(tbBtn("Full width", "Make it as wide as the page column", function () {
        wrap.style.width = "";
        wrap.style.marginLeft = "";
        wrap.style.marginRight = "";
        wrap.classList.remove("editor-sized");
        markDirty();
        positionFrame(wrap);
        buildToolbar(wrap, opts);
      }));
    }
    if (opts.allowFree) {
      tb.appendChild(tbBtn(free ? "Back in line" : "Free position",
        free ? "Put it back between the page's text and sections" : "Place it anywhere, on top of other things",
        function () { toggleFree(wrap, opts); }));
    }
    if (opts.allowBackground && !vid) {
      tb.appendChild(tbBtn("Background", "Use as the page's background", function () {
        deselect();
        convertToBackground(wrap, media);
      }));
    }
    if (opts.allowDelete !== false) {
      tb.appendChild(tbSep());
      tb.appendChild(tbBtn(ICON.trash, "Delete (or press Delete)", function () { removeWrap(wrap); }, "danger"));
    }
  }

  function replaceMedia(wrap, file, opts) {
    var media = mediaOf(wrap);
    var ph = makePlaceholder(file);
    wrap.appendChild(ph);
    uploadWithProgress(file, ph.setProgress).then(function (path) {
      ph.remove();
      var next = createMediaEl(path, file);
      if (next.tagName === media.tagName) {
        media.setAttribute("src", path);
        if (isVideo(media)) media.load();
      } else {
        if (media.getAttribute("alt") && next.tagName === "IMG") next.setAttribute("alt", media.getAttribute("alt"));
        media.replaceWith(next);
      }
      markDirty();
      buildToolbar(wrap, opts);
      positionFrame(wrap);
    }).catch(function (err) { ph.remove(); alert("Upload failed: " + err.message); });
  }

  // ---- free position (on top of the page, anywhere)
  function toggleFree(wrap, opts) {
    var holder = wrap.parentElement;
    if (wrap.dataset.editorFree !== "true") {
      var canvas = getFreeCanvas();
      var media = mediaOf(wrap);
      var r = media.getBoundingClientRect();
      var pos = pageRelativeCoords(r.left, r.top);
      canvas.appendChild(wrap);
      cleanupEmptyHolder(holder);
      removeBlockHandle(wrap);
      wrap.style.position = "absolute";
      wrap.style.left = Math.max(0, pos.x) + "px";
      wrap.style.top = Math.max(0, pos.y) + "px";
      wrap.style.width = Math.round(r.width) + "px";
      wrap.style.marginLeft = "";
      wrap.style.marginRight = "";
      wrap.style.zIndex = String(nextZIndex());
      wrap.classList.add("editor-sized");
      wrap.dataset.editorFree = "true";
    } else {
      ["position", "left", "top", "zIndex"].forEach(function (k) { wrap.style[k] = ""; });
      var pw = getPageContent().getBoundingClientRect().width;
      wrap.style.width = Math.min(100, Math.round(wrap.getBoundingClientRect().width / pw * 1000) / 10) + "%";
      setAlign(wrap, "center");
      delete wrap.dataset.editorFree;
      placeAtTopLevel(wrap, nearestTopBlock(wrap.getBoundingClientRect().top), "after");
    }
    markDirty();
    buildToolbar(wrap, opts);
    positionFrame(wrap);
  }

  // ---- resize by dragging a corner
  function contentWidth(el) {
    var cs = window.getComputedStyle(el);
    return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }
  function startResize(e, wrap, corner) {
    e.preventDefault();
    e.stopPropagation();
    var media = mediaOf(wrap);
    var free = wrap.dataset.editorFree === "true";
    var parentW = contentWidth(wrap.parentElement) || 1;
    var startW = media.getBoundingClientRect().width;
    var startLeft = parseFloat(wrap.style.left) || 0;
    var startX = e.clientX;
    var east = corner.indexOf("e") !== -1;
    var align = alignOf(wrap);
    if (!free && align === "none") { setAlign(wrap, "center"); align = "center"; }
    // a centered photo grows on both sides, so each pixel of mouse movement counts twice
    var factor = !free && align === "center" ? 2 : 1;
    var badge = document.createElement("div");
    badge.className = "editor-size-badge editor-ui";
    wrap.querySelector(":scope > .editor-media-frame").appendChild(badge);
    wrap.classList.add("editor-sized", "editor-resizing");
    function onMove(ev) {
      var dx = (ev.clientX - startX) * (east ? 1 : -1);
      var w = Math.max(60, Math.min(parentW, startW + dx * factor));
      if (free) {
        wrap.style.width = Math.round(w) + "px";
        if (!east) wrap.style.left = Math.round(startLeft + (startW - w)) + "px";
        badge.textContent = Math.round(w) + " px";
      } else {
        var pct = Math.round(w / parentW * 1000) / 10;
        wrap.style.width = pct + "%";
        badge.textContent = Math.round(pct) + "%";
      }
      positionFrame(wrap);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      badge.remove();
      wrap.classList.remove("editor-resizing");
      markDirty();
      positionFrame(wrap);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ---- drag to move
  var dropLine = document.createElement("div");
  dropLine.className = "editor-drop-line editor-ui";
  document.body.appendChild(dropLine);

  function topBlocks() {
    var pc = getPageContent();
    return Array.prototype.filter.call(pc.children, function (el) {
      return !el.classList.contains("free-canvas") && !el.classList.contains("editor-ui");
    });
  }
  function nearestTopBlock(y) {
    var best = null, bestD = Infinity;
    topBlocks().forEach(function (el) {
      var r = el.getBoundingClientRect();
      var d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (d < bestD) { bestD = d; best = el; }
    });
    return best;
  }
  // where would a drop at (x, y) go? Between paragraphs inside text, or
  // between the page's sections.
  function dropTargetAt(x, y, dragging) {
    var unit = moveUnit(dragging);
    var candidates = [];
    topBlocks().forEach(function (block) {
      if (block === unit) return;
      var r = block.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) {
        // text can be nested (a section holding a poem holding lines): offer
        // the innermost paragraphs/lines, not the boxes that contain them
        block.querySelectorAll(".editor-text-flow").forEach(function (flow) {
          Array.prototype.forEach.call(flow.children, function (child) {
            if (child === dragging || (child.classList && child.classList.contains("editor-ui"))) return;
            if (child.querySelector(".editor-text-flow")) return;
            candidates.push({ el: child, flow: flow });
          });
        });
      }
      candidates.push({ el: block, flow: null });
    });
    var best = null, bestD = Infinity;
    candidates.forEach(function (c) {
      var r = c.el.getBoundingClientRect();
      if (!r.height) return;
      var inside = y >= r.top && y <= r.bottom;
      var d = inside ? 0 : Math.min(Math.abs(y - r.top), Math.abs(y - r.bottom));
      // inside a text block, prefer its paragraphs over the whole block
      if (d < bestD || (d === bestD && c.flow)) { bestD = d; best = c; }
    });
    if (!best) return null;
    var br = best.el.getBoundingClientRect();
    return { el: best.el, flow: best.flow, where: y < br.top + br.height / 2 ? "before" : "after", rect: br };
  }
  function moveUnit(wrap) {
    var p = wrap.parentElement;
    if (p && p.classList.contains("project-media") && p.parentElement === getPageContent()) {
      var others = Array.prototype.filter.call(p.childNodes, function (n) {
        if (n === wrap) return false;
        if (n.nodeType === 3) return n.textContent.trim();
        return !(n.classList && n.classList.contains("editor-ui"));
      });
      if (!others.length) return p;
    }
    return wrap;
  }
  function removeBlockHandle(el) {
    var h = el.querySelector(":scope > .editor-block-bar");
    if (h) h.remove();
    delete el.dataset.editorBlockHandle;
  }
  function placeAtTopLevel(wrap, refEl, where) {
    var unit = moveUnit(wrap);
    var oldHolder = wrap.parentElement;
    if (unit === wrap) {
      unit = document.createElement("div");
      unit.className = "project-media container";
      unit.appendChild(wrap);
    }
    var pc = getPageContent();
    if (refEl) pc.insertBefore(unit, where === "before" ? refEl : refEl.nextSibling);
    else {
      var canvas = pc.querySelector(":scope > .free-canvas");
      pc.insertBefore(unit, canvas);
    }
    if (oldHolder !== unit) cleanupEmptyHolder(oldHolder);
    addBlockHandle(unit);
  }
  function placeInFlow(wrap, refEl, where) {
    var oldHolder = wrap.parentElement;
    refEl.parentNode.insertBefore(wrap, where === "before" ? refEl : refEl.nextSibling);
    if (oldHolder !== wrap.parentElement) cleanupEmptyHolder(oldHolder);
  }

  function startMove(e, wrap) {
    if (e.button !== 0) return;
    var startX = e.clientX, startY = e.clientY;
    var free = wrap.dataset.editorFree === "true";
    var moving = false;
    var target = null;
    var startLeft = parseFloat(wrap.style.left) || 0, startTop = parseFloat(wrap.style.top) || 0;
    e.preventDefault();
    function onMove(ev) {
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!moving && Math.abs(dx) + Math.abs(dy) < 6) return;
      if (!moving) {
        moving = true;
        selectWrap(wrap);
        wrap.classList.add("editor-dragging");
        if (free) wrap.style.zIndex = String(nextZIndex());
      }
      if (free) {
        wrap.style.left = Math.max(0, startLeft + dx) + "px";
        wrap.style.top = Math.max(0, startTop + dy) + "px";
        positionFrame(wrap);
        return;
      }
      target = dropTargetAt(ev.clientX, ev.clientY, wrap);
      if (!target) { dropLine.style.display = "none"; return; }
      var r = target.rect;
      dropLine.style.display = "block";
      dropLine.style.left = r.left + "px";
      dropLine.style.width = r.width + "px";
      dropLine.style.top = (target.where === "before" ? r.top - 3 : r.bottom + 1) + "px";
      // scroll when dragging near the top/bottom edge
      if (ev.clientY < 60) window.scrollBy(0, -12);
      else if (ev.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      dropLine.style.display = "none";
      wrap.classList.remove("editor-dragging");
      if (!moving) return;
      if (!free && target) {
        if (target.flow) {
          removeBlockHandle(wrap);
          placeInFlow(wrap, target.el, target.where);
        } else {
          placeAtTopLevel(wrap, target.el, target.where);
        }
      }
      markDirty();
      positionAllFrames();
      selectWrap(wrap);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ---- wrapping a photo/video so it can be edited
  function makeWrap(target) {
    var wrap = document.createElement("div");
    wrap.className = "editor-img-wrap";
    wrap.contentEditable = "false";
    target.parentNode.insertBefore(wrap, target);
    wrap.appendChild(target);
    var frame = document.createElement("div");
    frame.className = "editor-media-frame editor-ui";
    var tb = document.createElement("div");
    tb.className = "editor-media-toolbar";
    tb.addEventListener("mousedown", function (e) { e.stopPropagation(); });
    frame.appendChild(tb);
    wrap.appendChild(frame);
    return wrap;
  }

  // opts: allowResize, allowMove, allowFree, allowLink, allowDelete, allowBackground
  function setupMediaBlock(mediaEl, opts) {
    opts = opts || {};
    if (mediaEl.closest(".editor-img-wrap")) return mediaEl.closest(".editor-img-wrap");
    noNativeDrag(mediaEl);
    var a = mediaEl.parentElement && mediaEl.parentElement.tagName === "A" && mediaEl.parentElement.children.length === 1
      ? mediaEl.parentElement : null;
    var target = a || mediaEl;

    // sizing/placement saved on the photo itself moves onto the wrapper while editing
    var wrapStyles = {};
    MEDIA_STYLE_PROPS.forEach(function (k) {
      if (target.style[k]) { wrapStyles[k] = target.style[k]; target.style[k] = ""; }
    });
    if (target !== mediaEl) {
      MEDIA_STYLE_PROPS.forEach(function (k) {
        if (mediaEl.style[k] && !wrapStyles[k]) { wrapStyles[k] = mediaEl.style[k]; mediaEl.style[k] = ""; }
      });
    }
    // "margin: 0 auto" on the photo itself
    var wasFree = wrapStyles.position === "absolute";

    var wrap = makeWrap(target);
    Object.keys(wrapStyles).forEach(function (k) { wrap.style[k] = wrapStyles[k]; });
    if (wrap.style.width) wrap.classList.add("editor-sized");
    if (wasFree || target.closest(".free-canvas")) {
      wrap.dataset.editorFree = "true";
      if (!wrap.style.position) wrap.style.position = "absolute";
    }
    if (opts.allowDelete !== false) wrap.dataset.editorDeletable = "true";

    if (opts.allowResize) {
      var frame = wrap.querySelector(":scope > .editor-media-frame");
      ["nw", "ne", "sw", "se"].forEach(function (c) {
        var h = document.createElement("div");
        h.className = "editor-media-handle editor-media-handle-" + c;
        h.title = "Drag to resize";
        h.addEventListener("mousedown", function (e) { startResize(e, wrap, c); });
        frame.appendChild(h);
      });
    }
    if (opts.allowMove) {
      wrap.classList.add("editor-movable");
      wrap.addEventListener("mousedown", function (e) {
        if (e.target.closest(".editor-ui")) return;
        startMove(e, wrap);
      });
    }
    buildToolbar(wrap, opts);
    requestAnimationFrame(function () { positionFrame(wrap); });
    return wrap;
  }


  // Home hero photo: "Show whole" (default; a blurred copy fills the edges) or
  // "Fill screen" (cropped to fill). In Fill screen, drag the photo to choose
  // which part shows; double-click re-centers. Saved as --hero-pos on the photo.
  function setupHeroPan(wrap, img) {
    var hero = wrap.closest(".hero");
    function filling() { return hero && hero.classList.contains("hero--fill"); }
    function refreshHint() {
      wrap.classList.toggle("editor-hero-pan", filling());
      wrap.title = filling() ? "Drag to choose which part of the image shows · double-click to center" : "";
    }
    // an earlier version saved the drag position as object-position: keep it as
    // the Fill screen position so the whole-image view stays centered
    if (img.style.objectPosition) {
      if (!img.style.getPropertyValue("--hero-pos")) img.style.setProperty("--hero-pos", img.style.objectPosition);
      img.style.removeProperty("object-position");
    }
    refreshHint();
    wrap._refreshHeroHint = refreshHint;
    function pos() {
      var v = img.style.getPropertyValue("--hero-pos").trim() || "50% 50%";
      var p = v.split(/\s+/);
      return [parseFloat(p[0]) || 0, parseFloat(p[1] === undefined ? p[0] : p[1]) || 0];
    }
    wrap.addEventListener("mousedown", function (e) {
      if (!filling()) return;
      if (e.button !== 0 || e.shiftKey || e.target.closest(".editor-ui")) return;
      if (!img.naturalWidth) return;
      e.preventDefault();
      var r = img.getBoundingClientRect();
      var scale = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight);
      var overX = img.naturalWidth * scale - r.width, overY = img.naturalHeight * scale - r.height;
      var start = pos(), sx = e.clientX, sy = e.clientY, moved = false;
      function mm(ev) {
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
        moved = true;
        document.body.classList.add("editor-hero-panning");
        var x = overX > 0.5 ? start[0] - dx / overX * 100 : start[0];
        var y = overY > 0.5 ? start[1] - dy / overY * 100 : start[1];
        x = Math.round(Math.max(0, Math.min(100, x)) * 10) / 10;
        y = Math.round(Math.max(0, Math.min(100, y)) * 10) / 10;
        img.style.setProperty("--hero-pos", x + "% " + y + "%");
      }
      function mu() {
        window.removeEventListener("mousemove", mm, true);
        window.removeEventListener("mouseup", mu, true);
        document.body.classList.remove("editor-hero-panning");
        if (moved) markDirty();
      }
      window.addEventListener("mousemove", mm, true);
      window.addEventListener("mouseup", mu, true);
    });
    wrap.addEventListener("dblclick", function (e) {
      if (!filling() || e.target.closest(".editor-ui")) return;
      img.style.removeProperty("--hero-pos");
      if (!img.getAttribute("style")) img.removeAttribute("style");
      markDirty();
    });
  }

  var STANDALONE = { allowResize: true, allowMove: true, allowFree: true, allowLink: true, allowDelete: true, allowBackground: true };

  // older code paths (background image mode) still call these names
  function setupImageBlock(imgEl, opts) {
    return setupMediaBlock(imgEl, Object.assign({}, STANDALONE, opts && {
      allowDelete: opts.allowDelete !== false,
      allowLink: opts.allowLink !== false,
      allowBackground: !!opts.allowBackground,
    }));
  }
  function setupStandaloneImage(img, opts) { return setupImageBlock(img, opts); }

  // ---- photos inside galleries/carousels: select, replace, crop, link,
  // delete; drag to reorder (Sortable); size comes from the gallery layout
  function wrapGalleryItem(item, imgEl, opts) {
    noNativeDrag(imgEl);
    var wrap = makeWrap(item);
    wrap.classList.add("editor-gallery-item");
    if (opts.allowDelete) wrap.dataset.editorDeletable = "true";
    buildToolbar(wrap, { allowLink: !!opts.allowLink, allowDelete: !!opts.allowDelete });
    return wrap;
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

  }

  // ---------------------------------------------------------------- blank space block
  // <div class="space-block container" style="min-height: 80px"><div class="space-text"></div></div>
  // A clear block whose height is dragged from its bottom edge. Type in it
  // (the text toolbar works as usual) or leave it empty as a gap.
  function setupSpaceBlock(block) {
    if (block.dataset.editorSetup) return;
    block.dataset.editorSetup = "true";
    var text = block.querySelector(":scope > .space-text");
    if (!text) {
      text = document.createElement("div");
      text.className = "space-text";
      block.appendChild(text);
    }
    text.setAttribute("contenteditable", "true");
    text.addEventListener("input", markDirty);
    if (getComputedStyle(block).position === "static") {
      block.style.position = "relative";
      block.dataset.editorPosAdded = "true";
    }
    var handle = document.createElement("div");
    handle.className = "editor-space-handle editor-ui";
    handle.contentEditable = "false";
    handle.title = "Drag up or down to change the height";
    var label = document.createElement("span");
    handle.appendChild(label);
    function showH() { label.textContent = "↕ " + Math.round(block.getBoundingClientRect().height) + " px"; }
    showH();
    handle.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
    handle.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      var startY = e.clientY;
      var startH = parseFloat(block.style.minHeight) || block.getBoundingClientRect().height;
      block.classList.add("editor-space-resizing");
      function move(ev) {
        block.style.minHeight = Math.max(16, Math.round(startH + ev.clientY - startY)) + "px";
        showH();
      }
      function up() {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        block.classList.remove("editor-space-resizing");
        markDirty();
      }
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
    text.addEventListener("input", showH);
    block.appendChild(handle);
  }

  function insertSpaceBlock(after) {
    var pc = getPageContent();
    if (!pc) return;
    var block = document.createElement("div");
    block.className = "space-block container";
    block.style.minHeight = "80px";
    var text = document.createElement("div");
    text.className = "space-text";
    block.appendChild(text);
    if (after) { pc.insertBefore(block, after.nextSibling); requestAnimationFrame(function () { tightenGaps(block); }); }
    else appendBlock(block);
    addBlockHandle(block);
    setupSpaceBlock(block);
    markDirty();
    block.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setupTextLeaf(el) {
    if (el.dataset.editorTextSetup) return;
    el.dataset.editorTextSetup = "true";
    el.setAttribute("contenteditable", "true");
    el.addEventListener("input", markDirty);
  }

  function setupTextEditing() {
    TEXT_CONTAINER_SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (container) {
        container.querySelectorAll(TEXT_TAGS.join(",")).forEach(function (el) {
          if (el.closest(".editor-img-wrap") || el.closest(".editor-ui")) return;
          if (el.closest(".editor-text-flow")) return;
          if (el.parentElement && el.parentElement.closest('[contenteditable="true"]')) return;
          if (!isLeafTextEl(el)) return;
          setupTextLeaf(el);
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
  var repositionTextToolbar = function () {};
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
      // stay clear of the text box's own bar (Move / Remove line / Duplicate / Delete)
      var boxBar = document.querySelector(".editor-box-bar:not([hidden])");
      if (boxBar) {
        var b = boxBar.getBoundingClientRect();
        var t = Math.max(8, top);
        if (left < b.right + 6 && left + bw > b.left - 6 && t < b.bottom + 6 && t + bh > b.top - 6) {
          top = b.top - bh - 8;
          if (top < 8) top = Math.max(rect.bottom, b.bottom) + 10;
        }
      }
      bar.style.left = left + "px";
      bar.style.top = Math.max(8, top) + "px";
    }
    repositionTextToolbar = function () { if (bar.classList.contains("open")) position(); };
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

  // ---------------------------------------------------------------- room for "+ Add block"
  // The shell's floating "+ Add block" button sits at the bottom of the
  // preview. Give the page a little extra room at the very end (editor only,
  // never saved) so that, scrolled to the bottom, the button's middle sits
  // halfway between the footer's last line ("© Caroline Chou") and the end.
  var roomStyle = document.createElement("style");
  roomStyle.className = "editor-ui";
  document.head.appendChild(roomStyle);
  window.__editorSetBottomRoom = function (center) {
    roomStyle.textContent = "";
    var footer = document.querySelector(".site-footer");
    var last = footer && (footer.querySelector(":scope > p:last-child") || footer.lastElementChild || footer);
    if (!last) return;
    var docEnd = document.documentElement.scrollHeight;
    var below = docEnd - (last.getBoundingClientRect().bottom + window.scrollY);
    var extra = Math.max(0, Math.round(2 * center - below));
    roomStyle.textContent = "body { padding-bottom: " + extra + "px !important; }";
  };

  // ---------------------------------------------------------------- clean paste
  // Text pasted from Word, Google Docs, web pages etc. arrives full of hidden
  // fonts, sizes, colors and classes. Keep only the writing and its basic
  // formatting (paragraphs, headings, lists, bold, italic, underline,
  // strikethrough, links) so it takes on the site's own font and size.
  var PASTE_BLOCK = { P: "p", H1: "h2", H2: "h2", H3: "h3", H4: "h3", H5: "h3", H6: "h3", BLOCKQUOTE: "blockquote", UL: "ul", OL: "ol", LI: "li" };
  var PASTE_INLINE = { B: "strong", STRONG: "strong", I: "em", EM: "em", U: "u", S: "s", STRIKE: "s", DEL: "s", SUB: "sub", SUP: "sup" };
  var PASTE_DROP = /^(SCRIPT|STYLE|META|LINK|TITLE|HEAD|O:P|XML|IMG|PICTURE|VIDEO|AUDIO|IFRAME|OBJECT|SVG|CANVAS|BUTTON|INPUT|SELECT|TEXTAREA|NOSCRIPT|TEMPLATE)$/;

  function cleanPastedHtml(html, inlineOnly) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var out = document.createElement("div");

    function wrapStyles(el, frag) {
      // Docs/Word mark bold/italic with inline styles on spans, not tags
      var st = el.style || {};
      var w = st.fontWeight;
      // Google Docs wraps everything in <b style="font-weight:normal">
      if (el.tagName === "B" && w === "normal") return frag;
      var wraps = [];
      if (w === "bold" || w === "bolder" || parseInt(w, 10) >= 600) wraps.push("strong");
      if (st.fontStyle === "italic") wraps.push("em");
      var deco = (st.textDecorationLine || st.textDecoration || "");
      if (/underline/.test(deco)) wraps.push("u");
      if (/line-through/.test(deco)) wraps.push("s");
      if (st.verticalAlign === "super") wraps.push("sup");
      if (st.verticalAlign === "sub") wraps.push("sub");
      wraps.forEach(function (tag) {
        var w2 = document.createElement(tag);
        w2.appendChild(frag);
        frag = document.createDocumentFragment();
        frag.appendChild(w2);
      });
      return frag;
    }

    function walk(node) {
      var frag = document.createDocumentFragment();
      Array.prototype.forEach.call(node.childNodes, function (n) {
        if (n.nodeType === 3) {
          frag.appendChild(document.createTextNode(n.textContent.replace(/ /g, " ").replace(/[\r\n\t]+/g, " ")));
          return;
        }
        if (n.nodeType !== 1) return;
        var tag = n.tagName.toUpperCase();
        if (PASTE_DROP.test(tag) || tag.indexOf(":") !== -1 && tag !== "O:P") return;
        if (tag === "BR") { frag.appendChild(document.createElement("br")); return; }
        var inner = walk(n);
        if (tag === "A" && n.getAttribute("href") && !/^\s*javascript:/i.test(n.getAttribute("href"))) {
          var a = document.createElement("a");
          a.setAttribute("href", n.getAttribute("href"));
          if (/^https?:/i.test(n.getAttribute("href"))) { a.target = "_blank"; a.rel = "noopener"; }
          a.appendChild(wrapStyles(n, inner));
          frag.appendChild(a);
          return;
        }
        if (PASTE_INLINE[tag]) {
          if (tag === "B" && n.style.fontWeight === "normal") { frag.appendChild(wrapStyles(n, inner)); return; }
          var el = document.createElement(PASTE_INLINE[tag]);
          el.appendChild(inner);
          frag.appendChild(el);
          return;
        }
        if (PASTE_BLOCK[tag] && !inlineOnly) {
          var bl = document.createElement(PASTE_BLOCK[tag]);
          bl.appendChild(wrapStyles(n, inner));
          frag.appendChild(bl);
          return;
        }
        // Word Online / Docs put each paragraph in a styled <div>; treat a
        // div holding only inline content as a paragraph
        if (!inlineOnly && (tag === "DIV" || tag === "SECTION" || tag === "ARTICLE") && !n.querySelector("p, div, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, table")) {
          var pp = document.createElement("p");
          pp.appendChild(wrapStyles(n, inner));
          frag.appendChild(pp);
          return;
        }
        if (inlineOnly && (PASTE_BLOCK[tag] || /^(DIV|TR|TABLE|SECTION|ARTICLE)$/.test(tag))) {
          // one-line text box: paragraphs become line breaks
          frag.appendChild(wrapStyles(n, inner));
          frag.appendChild(document.createElement("br"));
          return;
        }
        // spans, fonts and anything else: keep the content, drop the wrapper
        frag.appendChild(wrapStyles(n, inner));
      });
      return frag;
    }
    out.appendChild(walk(doc.body));

    // tidy: drop empty paragraphs/formatting, merge whitespace, trailing <br>s
    for (var pass = 0; pass < 3; pass++) {
      out.querySelectorAll("p, h2, h3, li, blockquote, strong, em, u, s, sub, sup").forEach(function (el) {
        if (!el.textContent.trim() && !el.querySelector("br")) el.remove();
      });
    }
    // links are already underlined by the site
    out.querySelectorAll("a u").forEach(function (u) {
      while (u.firstChild) u.parentNode.insertBefore(u.firstChild, u);
      u.remove();
    });
    out.querySelectorAll("p, h2, h3, li").forEach(function (el) {
      while (el.lastChild && el.lastChild.nodeName === "BR") el.lastChild.remove();
      if (!el.textContent.trim()) el.remove();
    });
    while (out.lastChild && (out.lastChild.nodeName === "BR" || (out.lastChild.nodeType === 3 && !out.lastChild.textContent.trim()))) out.lastChild.remove();
    // loose text at the top level (no blocks) inside a passage becomes a paragraph
    if (!inlineOnly && out.querySelector("p, h2, h3, ul, ol, blockquote")) {
      var loose = [];
      Array.prototype.slice.call(out.childNodes).forEach(function (n) {
        var isBlock = n.nodeType === 1 && /^(P|H2|H3|UL|OL|BLOCKQUOTE)$/.test(n.nodeName);
        if (!isBlock) { loose.push(n); return; }
        if (loose.length) { flushLoose(loose, n); loose = []; }
      });
      if (loose.length) flushLoose(loose, null);
    }
    function flushLoose(nodes, before) {
      var txt = nodes.map(function (n) { return n.textContent; }).join("").trim();
      if (!txt) { nodes.forEach(function (n) { n.remove(); }); return; }
      var p = document.createElement("p");
      nodes.forEach(function (n) { if (n.nodeName !== "BR" || p.childNodes.length) p.appendChild(n); else n.remove(); });
      out.insertBefore(p, before);
    }
    return out.innerHTML.replace(/ {2,}/g, " ");
  }

  function escapeHtml(t) {
    return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function plainToHtml(text, inlineOnly) {
    var paras = text.replace(/\r\n?/g, "\n").split(/\n{2,}/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (inlineOnly) return paras.map(function (p) { return escapeHtml(p).replace(/\n/g, "<br>"); }).join("<br>");
    if (paras.length < 2 && text.indexOf("\n") === -1) return escapeHtml(text);
    return paras.map(function (p) { return "<p>" + escapeHtml(p).replace(/\n/g, "<br>") + "</p>"; }).join("");
  }

  document.addEventListener("paste", function (e) {
    var t = e.target;
    var host = t && (t.nodeType === 1 ? t : t.parentElement);
    host = host && host.closest('[contenteditable="true"]');
    if (!host || host.closest(".editor-ui")) return;
    var cd = e.clipboardData;
    if (!cd) return;
    var types = Array.prototype.slice.call(cd.types || []);
    if (types.indexOf("Files") !== -1 && !cd.getData("text/plain")) return; // pasted photo: leave alone
    // a passage (several paragraphs) can take paragraphs; a one-line box
    // (a CV title, a heading) gets the text with line breaks instead
    var inlineOnly = !host.classList.contains("editor-text-flow") && !host.classList.contains("space-text");
    var html = cd.getData("text/html");
    var clean = html ? cleanPastedHtml(html, inlineOnly) : plainToHtml(cd.getData("text/plain") || "", inlineOnly);
    e.preventDefault();
    if (!clean) return;
    // Chrome's insertHTML sometimes adds styled <span>s to match the
    // surroundings; anything styled that wasn't there before is unwrapped
    // (formatting you set with the toolbar beforehand is left alone)
    var before = new Set(host.querySelectorAll("span, font"));
    document.execCommand("insertHTML", false, clean);
    host.querySelectorAll("span, font").forEach(function (el) {
      if (before.has(el) || el.closest(".editor-ui, .editor-img-wrap")) return;
      while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
      el.remove();
    });
    markDirty();
  }, true);

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
    // hover bar: drag tab + delete button
    var bar = document.createElement("div");
    bar.className = "editor-block-bar editor-ui";
    bar.contentEditable = "false";
    var handle = document.createElement("div");
    handle.className = "editor-block-handle";
    handle.title = "Drag to move this whole section up or down";
    handle.textContent = "☰ move section";
    var del = document.createElement("button");
    del.type = "button";
    del.className = "editor-block-delete";
    del.title = "Delete this section";
    del.innerHTML = "<svg width='12' height='12' viewBox='0 0 14 14'><path d='M2 3.5h10M5.5 3.5V2h3v1.5M3.5 3.5l.6 8.5h5.8l.6-8.5' fill='none' stroke='currentColor' stroke-width='1.4' stroke-linejoin='round'/></svg> Delete";
    del.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
    del.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      deleteBlock(block);
    });
    bar.appendChild(handle);
    if (findGallery(block)) addGalleryControls(bar, block);
    bar.appendChild(del);
    block.insertBefore(bar, block.firstChild);
    addGapHandle(block);
  }

  // ---------------------------------------------------------------- gap between sections
  // A small "↕ 40 px" tab on the top edge of each section: drag it up/down to
  // set the space between this section and the one above. Double-click resets.
  // Stored as inline margins (this section's margin-top; the one above gets
  // margin-bottom: 0 so the two margins don't collapse into each other).
  function prevBlock(block) {
    var p = block.previousElementSibling;
    while (p && (p.classList.contains("editor-ui") || p.classList.contains("free-canvas"))) p = p.previousElementSibling;
    return p;
  }
  // the space you actually see: from the bottom of the last visible thing
  // (photo, text, line...) in the section above to the top of the first
  // visible thing in this one -- built-in padding inside sections counts as gap
  function visibleBoxes(el) {
    var out = [];
    el.querySelectorAll("*").forEach(function (n) {
      if (n.closest(".editor-ui")) return;
      var tag = n.tagName;
      var leaf = /^(IMG|VIDEO|IFRAME|HR|INPUT|BUTTON|CANVAS|SVG)$/.test(tag);
      if (!leaf) {
        for (var i = 0; i < n.childNodes.length; i++) {
          var c = n.childNodes[i];
          if (c.nodeType === 3 && c.textContent.trim()) { leaf = true; break; }
        }
      }
      if (!leaf) return;
      var r = n.getBoundingClientRect();
      if (r.width || r.height) out.push(r);
    });
    return out;
  }
  function contentBottom(el) {
    var boxes = visibleBoxes(el);
    if (!boxes.length) { var r = el.getBoundingClientRect(); return r.bottom - (parseFloat(getComputedStyle(el).paddingBottom) || 0); }
    return Math.max.apply(null, boxes.map(function (b) { return b.bottom; }));
  }
  function contentTop(el) {
    var boxes = visibleBoxes(el);
    if (!boxes.length) { var r = el.getBoundingClientRect(); return r.top + (parseFloat(getComputedStyle(el).paddingTop) || 0); }
    return Math.min.apply(null, boxes.map(function (b) { return b.top; }));
  }
  function gapAbove(block) {
    var p = prevBlock(block);
    if (!p) return 0;
    return Math.round(contentTop(block) - contentBottom(p));
  }
  // set the visible gap above `block` to px (margins only; the section above
  // gets margin-bottom 0 so the two margins don't collapse into each other)
  function setGapAbove(block, px) {
    var p = prevBlock(block);
    if (!p) return;
    p.style.marginBottom = "0px";
    var mt = parseFloat(getComputedStyle(block).marginTop) || 0;
    block.style.marginTop = Math.round(mt + (px - gapAbove(block))) + "px";
  }
  // new blocks start close to their neighbours instead of inheriting the
  // big built-in section spacing (drag the ↕ tab to change it)
  var NEW_BLOCK_GAP = 24;
  function tightenGaps(block) {
    if (!block.isConnected) return;
    if (prevBlock(block) && gapAbove(block) > NEW_BLOCK_GAP) setGapAbove(block, NEW_BLOCK_GAP);
    var n = block.nextElementSibling;
    while (n && (n.classList.contains("editor-ui") || n.classList.contains("free-canvas"))) n = n.nextElementSibling;
    if (n && gapAbove(n) > NEW_BLOCK_GAP) setGapAbove(n, NEW_BLOCK_GAP);
    [block, n].forEach(function (x) {
      var hh = x && x.querySelector(":scope > .editor-gap-handle");
      if (hh && hh._refresh) hh._refresh();
    });
  }
  function addGapHandle(block) {
    if (block.querySelector(":scope > .editor-gap-handle")) return;
    var h = document.createElement("div");
    h.className = "editor-gap-handle editor-ui";
    h.contentEditable = "false";
    h.title = "Drag up or down to change the space above this section. Double-click to reset.";
    var label = document.createElement("span");
    h.appendChild(label);
    function refresh() {
      var p = prevBlock(block);
      h.hidden = !p;
      label.textContent = "↕ " + gapAbove(block) + " px";
    }
    block.addEventListener("mouseenter", refresh);
    h._refresh = refresh;
    h.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); }); // no text selection while dragging
    h.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      var p = prevBlock(block);
      if (!p) return;
      e.preventDefault();
      e.stopPropagation();
      // make spacing linear: the section above stops contributing a margin,
      // and this section's top margin is set to keep the same gap for now
      setGapAbove(block, gapAbove(block));
      var startMt = parseFloat(block.style.marginTop) || 0;
      var startY = e.clientY;
      var base = gapAbove(block);
      h.setPointerCapture(e.pointerId);
      block.classList.add("editor-gap-resizing");
      function move(ev) {
        var dy = ev.clientY - startY;
        // never let the gap go below 0 (sections would overlap)
        var want = Math.max(-base, dy);
        block.style.marginTop = Math.round(startMt + want) + "px";
        label.textContent = "↕ " + gapAbove(block) + " px";
      }
      function up() {
        h.removeEventListener("pointermove", move);
        h.removeEventListener("pointerup", up);
        h.removeEventListener("pointercancel", up);
        block.classList.remove("editor-gap-resizing");
        markDirty();
      }
      h.addEventListener("pointermove", move);
      h.addEventListener("pointerup", up);
      h.addEventListener("pointercancel", up);
    });
    h.addEventListener("dblclick", function (e) {
      e.preventDefault();
      e.stopPropagation();
      block.style.marginTop = "";
      var p = prevBlock(block);
      if (p) { p.style.marginBottom = ""; if (!p.getAttribute("style")) p.removeAttribute("style"); }
      if (!block.getAttribute("style")) block.removeAttribute("style");
      refresh();
      markDirty();
    });
    block.appendChild(h);
    refresh();
  }

  // ---------------------------------------------------------------- gallery layout
  // A photo gallery can be shown as a grid (.gallery-grid) or as a slideshow
  // (.carousel[data-layout=carousel], built into a slideshow by main.js).
  var SLIDESHOW_SEL = '[data-layout="carousel"]';
  function findGallery(block) {
    if (block.matches(".gallery-grid, " + SLIDESHOW_SEL)) return block;
    return block.querySelector(":scope > .gallery-grid, :scope > " + SLIDESHOW_SEL);
  }

  function barButton(label, title, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "editor-block-opt";
    b.title = title;
    b.textContent = label;
    b.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  function addGalleryControls(bar, block) {
    var gal = findGallery(block);
    var isShow = gal.matches(SLIDESHOW_SEL);
    var seg = document.createElement("div");
    seg.className = "editor-block-seg";
    var grid = barButton("▦ Grid", "Show these photos as a grid", function () {
      var g = findGallery(block);
      if (g && g.matches(SLIDESHOW_SEL)) { toGrid(g); rebuild(); }
    });
    var show = barButton("◧ Slideshow", "Show one photo at a time with arrows", function () {
      var g = findGallery(block);
      if (g && !g.matches(SLIDESHOW_SEL)) { toSlideshow(g); rebuild(); }
    });
    (isShow ? show : grid).classList.add("on");
    seg.appendChild(grid);
    seg.appendChild(show);
    bar.appendChild(seg);
    if (isShow) {
      var fit = gal.classList.contains("carousel--fit");
      bar.appendChild(barButton(fit ? "Whole photos ✓" : "Whole photos",
        fit ? "Photos show uncropped. Click to crop them to the same 4:3 frame"
            : "Show each photo uncropped instead of cropping to a 4:3 frame",
        function () {
          var g = findGallery(block);
          if (!g) return;
          g.classList.toggle("carousel--fit");
          rebuild();
        }));
    }
    bar.appendChild(barButton("+ Photos", "Add more photos to this gallery", function () {
      var g = findGallery(block);
      if (g) addPhotosTo(g);
    }));
  }

  // the gallery's photo items (editor wrappers) in order
  function galleryItems(gal) {
    var holder = gal.querySelector(":scope > .carousel-track") || gal;
    return Array.prototype.filter.call(holder.children, function (el) {
      return !el.classList.contains("editor-ui") && el.querySelector("img, video") || /^(IMG|A)$/.test(el.tagName);
    });
  }

  function toSlideshow(grid) {
    var car = document.createElement("div");
    car.className = "carousel";
    car.setAttribute("data-layout", "carousel");
    galleryItems(grid).forEach(function (item) {
      // a slideshow takes photos (or linked photos); captioned figures give up their photo
      var fig = item.tagName === "FIGURE" ? item : item.querySelector("figure");
      if (fig) {
        var media = fig.querySelector("a > img") ? fig.querySelector("a") : fig.querySelector("img");
        if (media) fig.replaceWith(media); else return;
      }
      car.appendChild(item);
    });
    grid.replaceWith(car);
  }

  function toGrid(car) {
    var grid = document.createElement("div");
    grid.className = "gallery-grid";
    galleryItems(car).forEach(function (item) { grid.appendChild(item); });
    car.replaceWith(grid);
  }

  // save a snapshot of the page and reload it, so main.js rebuilds the
  // slideshow (arrows, counter) from the new markup. Undo works as usual.
  function rebuild() {
    deselect();
    markDirty();
    if (window.__editorOnRebuild) window.__editorOnRebuild();
  }

  function uploadPhotosInto(holder, files, done) {
    var pending = files.length;
    files.forEach(function (file) {
      var ph = makePlaceholder(file);
      holder.appendChild(ph);
      uploadWithProgress(file, ph.setProgress).then(function (path) {
        ph.replaceWith(createMediaEl(path, file));
      }).catch(function (err) { ph.remove(); alert("Upload failed: " + err.message); })
        .then(function () { if (!--pending) done(); });
    });
  }

  function addPhotosTo(gal) {
    pickFiles("image/*", true, function (files) {
      var holder = gal.querySelector(":scope > .carousel-track") || gal;
      uploadPhotosInto(holder, files, rebuild);
    });
  }

  function insertSlideshowBlock() {
    pickFiles("image/*", true, function (files) {
      var outer = document.createElement("div");
      outer.className = "container";
      var car = document.createElement("div");
      car.className = "carousel";
      car.setAttribute("data-layout", "carousel");
      outer.appendChild(car);
      appendBlock(outer);
      outer.scrollIntoView({ behavior: "smooth", block: "center" });
      uploadPhotosInto(car, files, function () {
        if (!car.querySelector("img")) { outer.remove(); return; }
        rebuild();
      });
    });
  }

  function deleteBlock(block) {
    if (selectedWrap && block.contains(selectedWrap)) deselect();
    block.remove();
    markDirty();
    if (window.__editorOnNotice) window.__editorOnNotice("Section deleted", true);
  }

  // ---------------------------------------------------------------- text boxes & lines
  // Hovering a text box (a CV entry, a heading, a paragraph...) shows a small
  // bar to delete it or add/remove the thin line under it. Hovering a
  // standalone line (<hr>) offers to delete it. Lines under boxes are site
  // CSS borders, so they're switched with classes defined in style.css:
  // .line-below / .no-line-below / .no-line-above.
  // strip the editor's per-element editing state so the element can be set up again
  function resetTextEl(el) {
    el.querySelectorAll(".editor-text-toggle").forEach(function (u) { u.remove(); });
    [el].concat(Array.prototype.slice.call(el.querySelectorAll("[data-editor-text-setup], [contenteditable='true']"))).forEach(function (n) {
      if (n.getAttribute("contenteditable") === "true") n.removeAttribute("contenteditable");
      delete n.dataset.editorTextSetup;
    });
  }
  // make a moved/copied text box editable in its new spot
  function setupTextAfterMove(el) {
    if (el.parentElement && el.parentElement.closest('[contenteditable="true"]')) return; // inside a text passage already
    setupTextEditing();
    var leaves = [el].concat(Array.prototype.slice.call(el.querySelectorAll(TEXT_TAGS.join(","))));
    leaves.forEach(function (n) {
      if (n.closest(".editor-ui, .editor-img-wrap")) return;
      if (n.parentElement && n.parentElement.closest('[contenteditable="true"]')) return;
      if (n.getAttribute("contenteditable") === "true") return;
      if (!isLeafTextEl(n) || !n.textContent.trim()) return;
      setupTextLeaf(n);
    });
  }

  function setupBoxBar() {
    var pc = getPageContent();
    if (!pc) return;
    var bar = document.createElement("div");
    bar.className = "editor-box-bar editor-ui";
    bar.hidden = true;
    var outline = document.createElement("div");
    outline.className = "editor-box-outline editor-ui";
    outline.hidden = true;
    document.body.appendChild(outline);
    document.body.appendChild(bar);
    var target = null;
    var hideTimer = null;

    function realNext(el) {
      var n = el.nextElementSibling;
      while (n && n.classList.contains("editor-ui")) n = n.nextElementSibling;
      return n;
    }
    function hasBorder(el, side) {
      var cs = getComputedStyle(el);
      return parseFloat(cs["border" + side + "Width"]) > 0 && cs["border" + side + "Style"] !== "none";
    }
    function lineBelow(box) {
      if (hasBorder(box, "Bottom")) return true;
      var n = realNext(box);
      return !!(n && n.tagName !== "HR" && hasBorder(n, "Top"));
    }
    function tidyClass(el) { if (!el.className) el.removeAttribute("class"); }
    function toggleLine(box) {
      if (lineBelow(box)) {
        box.classList.remove("line-below");
        if (hasBorder(box, "Bottom")) box.classList.add("no-line-below");
        var n = realNext(box);
        if (n && hasBorder(n, "Top")) n.classList.add("no-line-above");
      } else {
        box.classList.remove("no-line-below");
        var n2 = realNext(box);
        if (n2) { n2.classList.remove("no-line-above"); tidyClass(n2); }
        if (!lineBelow(box)) box.classList.add("line-below");
      }
      tidyClass(box);
      markDirty();
    }

    function boxFor(el) {
      if (!el || !el.closest || !pc.contains(el)) return null;
      if (el.closest(".editor-ui, .editor-img-wrap, .editor-block-bar, .free-canvas, form")) return null;
      var entry = el.closest(".cv-entry");
      if (entry) return entry;
      var flow = el.closest(".editor-text-flow");
      if (flow) {
        var n = el;
        while (n && n.parentElement !== flow) n = n.parentElement;
        if (!n || n.matches("img, video, figure, .editor-img-wrap") || !n.textContent.trim()) return null;
        return n;
      }
      var leaf = el.closest('[contenteditable="true"]');
      if (!leaf || leaf.parentElement === pc || leaf.closest(".site-header, .hero, .space-block")) return null;
      return leaf;
    }
    function hrNear(x, y) {
      var hit = null;
      pc.querySelectorAll("hr").forEach(function (hr) {
        var r = hr.getBoundingClientRect();
        if (r.width && Math.abs(y - (r.top + r.height / 2)) <= 8 && x >= r.left - 6 && x <= r.right + 6) hit = hr;
      });
      return hit;
    }

    function btn(label, title, cls, onClick) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "editor-box-btn" + (cls ? " " + cls : "");
      b.title = title;
      b.textContent = label;
      b.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
      b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); onClick(); });
      b.addEventListener("mouseenter", function () { outline.classList.toggle("danger", !!cls); });
      b.addEventListener("mouseleave", function () { outline.classList.remove("danger"); });
      return b;
    }

    function place() {
      if (!target || !target.isConnected) return hide();
      var r = target.getBoundingClientRect();
      var isHr = target.tagName === "HR";
      outline.style.left = (r.left + scrollX - 4) + "px";
      outline.style.top = (r.top + scrollY - (isHr ? 6 : 4)) + "px";
      outline.style.width = (r.width + 8) + "px";
      outline.style.height = (r.height + (isHr ? 12 : 8)) + "px";
      var bw = bar.offsetWidth, bh = bar.offsetHeight;
      var left, top;
      if (isHr) {
        left = r.right + 8;
        top = r.top + r.height / 2 - bh / 2;
        if (left + bw > document.documentElement.clientWidth - 4) { left = r.right - bw; top = r.top - bh - 4; }
      } else {
        // inside the dashed outline, bottom-right corner: reachable without
        // the cursor ever leaving the box
        left = r.right + 2 - bw;
        top = r.bottom + 2 - bh;
      }
      bar.style.left = (left + scrollX) + "px";
      bar.style.top = (top + scrollY) + "px";
      repositionTextToolbar();
    }

    function render() {
      bar.innerHTML = "";
      if (target.tagName === "HR") {
        bar.appendChild(btn("Delete line", "Delete this line", "danger", function () {
          var hr = target; hide();
          var parent = hr.parentElement;
          hr.remove();
          // a "Line" block that's now empty goes too
          if (parent && parent.parentElement === pc && !Array.prototype.some.call(parent.children, function (c) { return !c.classList.contains("editor-ui"); })) parent.remove();
          markDirty();
          if (window.__editorOnNotice) window.__editorOnNotice("Line deleted", true);
        }));
      } else {
        var box = target;
        var has = lineBelow(box);
        var grip = document.createElement("button");
        grip.type = "button";
        grip.className = "editor-box-btn editor-box-grip";
        grip.title = "Drag to move this text up or down the page";
        grip.textContent = "✥ Move";
        grip.addEventListener("mousedown", function (e) { startTextMove(e, box); });
        bar.appendChild(grip);
        bar.appendChild(btn(has ? "Remove line below" : "Add line below",
          has ? "Remove the line under this box" : "Add a thin grey line under this box", "",
          function () { toggleLine(box); render(); place(); }));
        bar.appendChild(btn("Duplicate", "Make a copy of this text right below it", "", function () {
          var copy = box.cloneNode(true);
          resetTextEl(copy);
          box.parentNode.insertBefore(copy, box.nextSibling);
          setupTextAfterMove(copy);
          markDirty();
          show(copy);
          if (window.__editorOnNotice) window.__editorOnNotice("Text duplicated", true);
        }));
        bar.appendChild(btn("Delete", box.classList.contains("cv-entry") ? "Delete this entry" : "Delete this text box", "danger", function () {
          hide(); box.remove(); markDirty();
          if (window.__editorOnNotice) window.__editorOnNotice("Text box deleted", true);
        }));
      }
    }

    // ---- drag a text box up/down the page (blue line shows where it lands)
    function allBoxes() {
      var list = [];
      pc.querySelectorAll(".cv-entry").forEach(function (el) { list.push(el); });
      pc.querySelectorAll(".editor-text-flow").forEach(function (flow) {
        Array.prototype.forEach.call(flow.children, function (c) { if (boxFor(c) === c) list.push(c); });
      });
      pc.querySelectorAll('[contenteditable="true"]').forEach(function (el) { if (boxFor(el) === el) list.push(el); });
      return list;
    }
    function textDropTarget(x, y, items) {
      var cands = [];
      var hasSection = items.some(function (it) { return it.parentElement === pc; });
      function related(el) {
        return items.some(function (it) { return el === it || it.contains(el) || el.contains(it); });
      }
      if (!hasSection) allBoxes().forEach(function (el) {
        if (related(el)) return;
        cands.push({ el: el, box: true });
      });
      topBlocks().forEach(function (el) {
        if (items.indexOf(el) !== -1) return;
        if (items.length === 1 && el.contains(items[0]) && soleContent(el, items[0])) return;
        cands.push({ el: el, box: false });
      });
      var best = null, bestD = Infinity;
      cands.forEach(function (c) {
        var r = c.el.getBoundingClientRect();
        if (!r.height) return;
        var d = y >= r.top && y <= r.bottom ? 0 : Math.min(Math.abs(y - r.top), Math.abs(y - r.bottom));
        // on a tie prefer a text box over a whole section, and the innermost box
        if (d < bestD || (d === bestD && best && c.box && (!best.box || best.el.contains(c.el)))) { bestD = d; best = c; }
      });
      if (!best) return null;
      var br = best.el.getBoundingClientRect();
      return { el: best.el, box: best.box, where: y < br.top + br.height / 2 ? "before" : "after", rect: br };
    }
    function topLevelOf(el) {
      while (el && el.parentElement !== pc) el = el.parentElement;
      return el;
    }
    // is `el` the only real content of `block`?
    function soleContent(block, el) {
      var c = block.cloneNode(true);
      c.querySelectorAll(".editor-ui").forEach(function (u) { u.remove(); });
      return c.textContent.trim() === el.textContent.trim();
    }
    function removeIfEmpty(block) {
      if (!block || !block.isConnected || block.parentElement !== pc) return;
      var c = block.cloneNode(true);
      c.querySelectorAll(".editor-ui").forEach(function (u) { u.remove(); });
      if (!c.textContent.trim() && !c.querySelector("img, video, iframe, hr, form")) block.remove();
    }

    function startTextMove(e, box) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      var items = group.length > 1 && group.indexOf(box) !== -1 ? sortedGroup() : [box];
      var startY = e.clientY, moving = false, drop = null;
      function onMove(ev) {
        if (!moving && Math.abs(ev.clientY - startY) < 4) return;
        if (!moving) {
          moving = true;
          hide();
          items.forEach(function (it) { it.classList.add("editor-text-dragging"); });
          document.body.classList.add("editor-text-moving");
        }
        drop = textDropTarget(ev.clientX, ev.clientY, items);
        if (!drop) { dropLine.style.display = "none"; return; }
        var r = drop.rect;
        dropLine.style.display = "block";
        dropLine.style.left = r.left + "px";
        dropLine.style.width = r.width + "px";
        dropLine.style.top = (drop.where === "before" ? r.top - 3 : r.bottom + 1) + "px";
        if (ev.clientY < 60) window.scrollBy(0, -14);
        else if (ev.clientY > window.innerHeight - 60) window.scrollBy(0, 14);
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        dropLine.style.display = "none";
        items.forEach(function (it) { it.classList.remove("editor-text-dragging"); tidyClass(it); });
        document.body.classList.remove("editor-text-moving");
        if (!moving || !drop) return;
        var sections = items.filter(function (it) { return it.parentElement === pc; });
        var oldTops = items.map(topLevelOf);
        var parent = drop.box ? drop.el.parentNode : pc;
        // a fixed marker keeps the drop spot stable while items move around it
        var marker = document.createElement("span");
        parent.insertBefore(marker, drop.where === "before" ? drop.el : drop.el.nextSibling);
        var sec = null;
        items.forEach(function (n) {
          if (sections.indexOf(n) !== -1) { pc.insertBefore(n, marker); sec = null; return; }
          resetTextEl(n);
          if (drop.box) { parent.insertBefore(n, marker); return; }
          // between sections: text gets a section of its own
          if (!sec) {
            sec = document.createElement("div");
            sec.className = n.classList.contains("cv-entry") ? "cv-section container" : "project-body container";
            pc.insertBefore(sec, marker);
            addBlockHandle(sec);
          }
          sec.appendChild(n);
        });
        marker.remove();
        items.forEach(function (n) { if (sections.indexOf(n) === -1) setupTextAfterMove(n); });
        var newTops = items.map(topLevelOf);
        oldTops.forEach(function (t) { if (newTops.indexOf(t) === -1) removeIfEmpty(t); });
        markDirty();
        renderGroup();
        if (items.length === 1) show(items[0]);
      }
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
    }

    // ---- shift-click to pick several blocks and move them together
    var group = [];
    var pill = document.createElement("div");
    pill.className = "editor-group-pill editor-ui";
    pill.hidden = true;
    document.body.appendChild(pill);

    function sortedGroup() {
      return group.slice().sort(function (a, b) {
        return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
    }
    function renderGroup() {
      group = group.filter(function (el) { return el.isConnected; });
      pc.querySelectorAll(".editor-group-selected").forEach(function (el) {
        if (group.indexOf(el) === -1) { el.classList.remove("editor-group-selected"); tidyClass(el); }
      });
      group.forEach(function (el) { el.classList.add("editor-group-selected"); });
      pill.innerHTML = "";
      if (!group.length) { pill.hidden = true; return; }
      pill.hidden = false;
      var label = document.createElement("span");
      label.textContent = group.length + " selected · shift-click to add or remove";
      var grip = document.createElement("button");
      grip.type = "button";
      grip.className = "editor-box-btn editor-box-grip";
      grip.textContent = "✥ Drag to move together";
      grip.title = "Drag up or down the page; a blue line shows where they'll go";
      grip.addEventListener("mousedown", function (e) { startTextMove(e, sortedGroup()[0]); });
      var clear = document.createElement("button");
      clear.type = "button";
      clear.className = "editor-box-btn";
      clear.textContent = "Clear";
      clear.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
      clear.addEventListener("click", function (e) { e.preventDefault(); clearGroup(); });
      pill.appendChild(label);
      pill.appendChild(grip);
      pill.appendChild(clear);
    }
    function clearGroup() { group = []; renderGroup(); }
    function toggleInGroup(el) {
      var i = group.indexOf(el);
      if (i !== -1) { group.splice(i, 1); return; }
      // picking a section replaces any boxes inside it; a box inside a picked section is ignored
      if (group.some(function (g) { return g.contains(el); })) return;
      group = group.filter(function (g) { return !el.contains(g); });
      group.push(el);
    }
    function itemAt(t) {
      if (!t || !t.closest || !pc.contains(t) || t.closest(".editor-ui")) return null;
      var item = boxFor(t) || topLevelOf(t);
      if (!item || item === pc || item.classList.contains("free-canvas")) return null;
      return item;
    }
    window.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      if (!e.shiftKey) {
        if (group.length && !(e.target.closest && e.target.closest(".editor-group-pill, .editor-box-bar"))) clearGroup();
        return;
      }
      var item = itemAt(e.target);
      if (!item) return;
      // shift-click inside the text you're typing in still extends the text selection
      var sel = document.getSelection();
      var an = sel && sel.rangeCount ? sel.anchorNode : null;
      var caretBox = an ? boxFor(an.nodeType === 1 ? an : an.parentElement) : null;
      if (!group.length && caretBox === item) return;
      e.preventDefault();
      e.stopPropagation();
      if (!group.length && caretBox) toggleInGroup(caretBox);
      toggleInGroup(item);
      renderGroup();
    }, true);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && group.length) clearGroup(); });

    function show(t) {
      clearTimeout(hideTimer);
      if (t === target && !bar.hidden) return;
      target = t;
      bar.hidden = false;
      outline.hidden = false;
      outline.classList.remove("danger");
      render();
      place();
    }
    function hide() {
      clearTimeout(hideTimer);
      target = null;
      bar.hidden = true;
      outline.hidden = true;
    }

    document.addEventListener("mousemove", function (e) {
      if (bar.contains(e.target)) { clearTimeout(hideTimer); return; }
      if (e.buttons) return hide();
      var t = hrNear(e.clientX, e.clientY) || boxFor(e.target);
      if (t) return show(t);
      if (target && !hideTimer) hideTimer = setTimeout(function () { hideTimer = null; hide(); }, 350);
    }, true);
    window.addEventListener("scroll", function () { if (target) place(); }, true);
    window.addEventListener("resize", function () { if (target) place(); });
    document.addEventListener("input", function () { if (target) place(); });
  }

  function insertLineBlock() {
    var wrap = document.createElement("div");
    wrap.className = "container";
    var hr = document.createElement("hr");
    hr.className = "divider";
    wrap.appendChild(hr);
    appendBlock(wrap);
    addBlockHandle(wrap);
    markDirty();
    wrap.scrollIntoView({ behavior: "smooth", block: "center" });
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
    var ref = nearestTopBlock(window.innerHeight / 2);
    if (ref) pc.insertBefore(el, ref.nextSibling);
    else {
      var canvas = pc.querySelector(":scope > .free-canvas");
      if (canvas) pc.insertBefore(el, canvas); else pc.appendChild(el);
    }
    requestAnimationFrame(function () { tightenGaps(el); });
    return el;
  }

  function insertTextBlock() {
    // same centered column as the page's other paragraphs (.project-body),
    // and a full text passage: Enter makes new paragraphs, + Media works
    var sec = document.createElement("div");
    sec.className = "project-body container";
    var p = document.createElement("p");
    var tn = document.createTextNode("New text");
    p.appendChild(tn);
    sec.appendChild(p);
    appendBlock(sec);
    addBlockHandle(sec);
    setupContinuousTextArea(sec);
    markDirty();
    // select just the placeholder words so typing replaces them
    var flow = sec.querySelector(".editor-text-flow");
    window.focus();
    if (flow) flow.focus();
    var r = document.createRange();
    r.setStart(tn, 0);
    r.setEnd(tn, tn.length);
    var sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    sec.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function insertMediaBlock() {
    pickFiles("image/*,video/*", true, function (files) {
      var photos = files.filter(function (f) { return !/^video\//.test(f.type); });
      var videos = files.filter(function (f) { return /^video\//.test(f.type); });
      var lastBlock = null;
      function addBlock(block) {
        if (lastBlock) lastBlock.parentNode.insertBefore(block, lastBlock.nextSibling);
        else appendBlock(block);
        addBlockHandle(block);
        lastBlock = block;
        block.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (photos.length > 1) {
        var outer = document.createElement("div");
        outer.className = "container";
        var grid = document.createElement("div");
        grid.className = "gallery-grid";
        outer.appendChild(grid);
        addBlock(outer);
        var pending = photos.length;
        photos.forEach(function (file) {
          var ph = makePlaceholder(file);
          grid.appendChild(ph);
          uploadWithProgress(file, ph.setProgress).then(function (path) {
            ph.replaceWith(createMediaEl(path, file));
          }).catch(function (err) { ph.remove(); alert("Upload failed: " + err.message); })
            .then(function () {
              if (--pending) return;
              if (!grid.querySelector("img")) { outer.remove(); return; }
              setupGallery(grid, { allowDelete: true, allowLink: true });
              markDirty();
            });
        });
      } else {
        videos = files;
      }
      videos.forEach(function (file) {
        var block = document.createElement("div");
        block.className = "project-media container";
        var ph = makePlaceholder(file);
        block.appendChild(ph);
        addBlock(block);
        uploadWithProgress(file, ph.setProgress).then(function (path) {
          var el = createMediaEl(path, file);
          ph.replaceWith(el);
          var wrap = setupMediaBlock(el, STANDALONE);
          markDirty();
          selectWrap(wrap);
        }).catch(function (err) { block.remove(); alert("Upload failed: " + err.message); });
      });
    });
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
    addMedia: insertMediaBlock,
    addImage: insertMediaBlock,
    addSlideshow: insertSlideshowBlock,
    addLine: insertLineBlock,
    addSpace: function () { insertSpaceBlock(null); },
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
    var wrap = setupMediaBlock(img, { allowLink: true, allowDelete: false });
    setupHeroPan(wrap, img);
  });
  var GALLERY_SEL = GRID_GALLERY_SELECTORS.concat(LINK_GALLERY_SELECTORS, ROW_SELECTORS).join(",");
  document.querySelectorAll(".page-content img, .page-content video").forEach(function (m) {
    if (m.closest(".editor-img-wrap, .editor-ui, .lightbox-overlay, .hero")) return;
    if (m.closest(GALLERY_SEL)) return;
    if (m.classList.contains("editor-bg-image")) return;
    setupMediaBlock(m, STANDALONE);
  });
  setupContentFlow();
  setupBoxBar();
  document.querySelectorAll(".page-content .space-block").forEach(setupSpaceBlock);
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
      // put back everything the wrapper holds (a photo, a link, or a whole
      // <figure> with its caption) -- never drop content
      var kids = Array.prototype.filter.call(wrap.childNodes, function (n) {
        return !(n.nodeType === 1 && n.classList.contains("editor-ui"));
      });
      var child = kids.filter(function (n) { return n.nodeType === 1; })[0];
      if (child) {
        var sized = !!wrap.style.width;
        MEDIA_STYLE_PROPS.forEach(function (prop) {
          if (wrap.style[prop]) child.style[prop] = wrap.style[prop];
        });
        // auto margins (centered/right-aligned) only work on a block
        if (wrap.style.marginLeft === "auto" || wrap.style.marginRight === "auto") child.style.display = "block";
        if (child.tagName === "A") {
          var inner = child.querySelector("img, video");
          if (inner && sized) inner.style.width = "100%";
        }
      }
      kids.forEach(function (n) { wrap.parentNode.insertBefore(n, wrap); });
      wrap.remove();
    });
    clone.querySelectorAll("video").forEach(function (v) {
      v.removeAttribute("data-editor-paused");
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
    clone.querySelectorAll(".lightbox-overlay, .hero-backdrop").forEach(function (el) { el.remove(); });
    // main.js sets these on <html> at runtime; they must not be saved
    ["--header-h", "--hero-ratio", "--hero-w", "--hero-h"].forEach(function (k) { clone.style.removeProperty(k); });
    if (!clone.getAttribute("style")) clone.removeAttribute("style");

    // strip main.js runtime carousel artifacts so they don't accumulate across saves
    clone.querySelectorAll(".carousel-nav, .carousel-count").forEach(function (el) { el.remove(); });
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
    clone.querySelectorAll("[data-editor-undrag]").forEach(function (el) {
      el.removeAttribute("draggable");
      el.removeAttribute("data-editor-undrag");
    });

    clone.querySelectorAll(".editor-group-selected, .editor-text-dragging").forEach(function (el) {
      el.classList.remove("editor-group-selected", "editor-text-dragging");
      if (!el.className) el.removeAttribute("class");
    });
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

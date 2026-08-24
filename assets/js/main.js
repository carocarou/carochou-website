document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      toggle.textContent = isOpen ? "Close Menu" : "Open Menu";
    });
  }

  initCarousels();
  initLightbox();
});

function initLightbox() {
  var overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  var img = document.createElement("img");
  var closeBtn = document.createElement("button");
  closeBtn.className = "lightbox-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "×";
  overlay.appendChild(img);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);

  function close() {
    overlay.classList.remove("open");
    img.src = "";
  }

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay || e.target === closeBtn) close();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });

  document.addEventListener("click", function (e) {
    var target = e.target;
    if (target.tagName !== "IMG") return;
    if (!target.closest(".page-content")) return;
    if (target.closest("a")) return;
    if (target.closest('[data-layout="carousel"]')) return;
    img.src = target.currentSrc || target.src;
    img.alt = target.alt || "";
    overlay.classList.add("open");
  });
}

function initCarousels() {
  document.querySelectorAll('[data-layout="carousel"]').forEach(function (container) {
    if (container.dataset.carouselInit) return;
    container.dataset.carouselInit = "true";

    var slides = Array.prototype.filter.call(container.children, function (el) {
      return el.tagName === "IMG" || el.tagName === "A";
    });
    if (!slides.length) return;

    var track = document.createElement("div");
    track.className = "carousel-track";
    slides.forEach(function (s) { track.appendChild(s); });
    container.appendChild(track);

    if (slides.length < 2) return;

    var index = 0;
    function update() {
      var gap = parseFloat(getComputedStyle(track).gap) || 0;
      var step = slides[0].getBoundingClientRect().width + gap;
      track.style.transform = "translateX(-" + (index * step) + "px)";
    }

    slides.forEach(function (slide) {
      slide.addEventListener("click", function () {
        index = (index + 1) % slides.length;
        update();
      });
    });

    var prev = document.createElement("button");
    prev.className = "carousel-nav carousel-nav-prev";
    prev.type = "button";
    prev.setAttribute("aria-label", "Previous image");
    prev.textContent = "‹";
    prev.addEventListener("click", function () {
      index = (index - 1 + slides.length) % slides.length;
      update();
    });

    var next = document.createElement("button");
    next.className = "carousel-nav carousel-nav-next";
    next.type = "button";
    next.setAttribute("aria-label", "Next image");
    next.textContent = "›";
    next.addEventListener("click", function () {
      index = (index + 1) % slides.length;
      update();
    });

    container.appendChild(prev);
    container.appendChild(next);
    window.addEventListener("resize", update);
    update();
  });
}

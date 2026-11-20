// Opens gallery photos full size. Works on any link with data-lightbox inside .masonry.
(function () {
  const links = Array.from(document.querySelectorAll("a[data-lightbox]"));
  if (!links.length) return;

  const box = document.createElement("div");
  box.className = "lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Photo viewer");
  box.innerHTML = `
    <button class="lb-close" type="button" aria-label="Close">&times;</button>
    <button class="lb-prev" type="button" aria-label="Previous photo">&#8249;</button>
    <img alt="">
    <button class="lb-next" type="button" aria-label="Next photo">&#8250;</button>
    <p class="lb-count"></p>`;
  document.body.appendChild(box);
  const img = box.querySelector("img");
  const count = box.querySelector(".lb-count");
  let index = 0;
  let lastFocus = null;

  function show(i) {
    index = (i + links.length) % links.length;
    const a = links[index];
    img.src = a.getAttribute("href");
    img.alt = (a.querySelector("img") || {}).alt || "";
    count.textContent = `${index + 1} / ${links.length}`;
  }
  function open(i) {
    lastFocus = document.activeElement;
    show(i);
    box.classList.add("open");
    document.body.style.overflow = "hidden";
    box.querySelector(".lb-close").focus();
  }
  function close() {
    box.classList.remove("open");
    document.body.style.overflow = "";
    img.removeAttribute("src");
    if (lastFocus) lastFocus.focus();
  }

  links.forEach((a, i) => a.addEventListener("click", (e) => { e.preventDefault(); open(i); }));
  box.querySelector(".lb-close").addEventListener("click", close);
  box.querySelector(".lb-prev").addEventListener("click", () => show(index - 1));
  box.querySelector(".lb-next").addEventListener("click", () => show(index + 1));
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  document.addEventListener("keydown", (e) => {
    if (!box.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });
  let startX = null;
  box.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    startX = null;
  });
})();

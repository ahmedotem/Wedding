// Draws the two maps and the cards next to them (data lives in places.js):
//   weekend.html  Things To Do: map, filters and six categories of small photo cards (three
//                 to a row), three cards each until "Show more"
//   travel.html   Where to Stay: one map with Airbnbs and hotels, filters, the Cayuta Lake homes on
//                 top, then two columns (Airbnbs left, hotels right) of towns that open into
//                 swipe rows
// Tap a card to see it on the map; tap a pin and its card lights up. "More" on a card opens
// its description and links.
// Map tiles come from OpenStreetMap; if they can't load, it switches to a second map provider.
// Pins that would sit on top of each other fan out in a small circle; zoom in and they
// move back to their real spots.
(function () {
  if (typeof VENUE === "undefined") return;
  const hasLeaflet = typeof L !== "undefined";

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LIGHT = ["#F5C5B1", "#FCB780", "#EBA100", "#C29133", "#FFF0DC"];
  const textOn = (hex) => (LIGHT.includes(hex.toUpperCase()) ? "#662844" : "#FFF0DC");
  const tint = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };
  // how strong each color's soft background is behind the line drawings
  const TINT = { "#747B2C": 0.16, "#EBA100": 0.18, "#E46436": 0.14, "#C29133": 0.2, "#FCB780": 0.38, "#F5C5B1": 0.5, "#662844": 0.1 };
  const ext = 'target="_blank" rel="noopener"';
  const phone = (n) => "tel:+1" + n.replace(/\D/g, "");
  const PHONE_ICON =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6.6 3.5h2.6l1.4 4-2 1.4a12 12 0 0 0 6.5 6.5l1.4-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/></svg>';

  const gmaps = (p) =>
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(p.q || p.name + ", " + p.town + ", NY") +
    (p.pid ? "&query_place_id=" + p.pid : "");
  const reviews = (p) => (p.pid ? "https://search.google.com/local/reviews?placeid=" + p.pid : gmaps(p));
  const directions =
    "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(VENUE.name + ", " + VENUE.address) +
    "&destination_place_id=" + VENUE.pid + "&travelmode=driving";
  const fromInn = (mins, mi) => "≈ " + mins + " min from the Inn" + (mi ? " (" + mi + " mi)" : "");
  const short = (mins) => "≈ " + mins + " min from the Inn";

  // ---------------------------------------------------------------- small cards with "More"
  // A card shows the essentials; "More" opens the description and the extra links.
  function miniCard(o) {
    const card = document.createElement("article");
    card.className = "card mini " + (o.cls || "");
    card.setAttribute("role", "listitem");
    const moreId = "more-" + Math.random().toString(36).slice(2, 9);
    card.innerHTML =
      o.media +
      '<div class="card-body">' +
      (o.kicker ? `<p class="kicker">${esc(o.kicker)}</p>` : "") +
      `<h5>${esc(o.title)}</h5>` +
      (o.lines || []).join("") +
      '<div class="card-foot-row">' + (o.foot || "<span></span>") +
      (o.more ? `<button type="button" class="more" aria-expanded="false" aria-controls="${moreId}">More</button>` : "") +
      "</div>" +
      (o.more ? `<div class="more-body" id="${moreId}" hidden>${o.more}</div>` : "") +
      "</div>";
    const btn = card.querySelector(".more");
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const body = card.querySelector(".more-body");
        const open = body.hidden;
        body.hidden = !open;
        btn.setAttribute("aria-expanded", String(open));
        btn.textContent = open ? "Less" : "More";
        card.classList.toggle("is-open", open);
        const col = card.closest(".col");
        if (col && col._update) col._update();
      });
    }
    return card;
  }

  // Tapping anywhere on a card (except its links and its "More" button) shows it on the map.
  function onCardTap(card, fn) {
    card.classList.add("is-tappable");
    card.addEventListener("click", (e) => {
      if (e.target.closest("a, .more")) return;
      fn();
    });
  }

  function setActive(scope, card, reveal) {
    if (!scope) return;
    scope.querySelectorAll(".card.is-active").forEach((c) => c.classList.remove("is-active"));
    if (!card) return;
    card.classList.add("is-active");
    if (reveal) reveal(card);
  }

  // ---------------------------------------------------------------- swipe rows (Where to Stay)
  // Each town is a row that opens and closes. Phones swipe; computers get arrow buttons.
  const CHEVRON = (d) =>
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="${d}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function rowShell(o) {
    const sec = document.createElement("section");
    sec.className = "row" + (o.cls ? " " + o.cls : "");
    if (o.id) sec.id = o.id;
    const body = (o.id || "row") + "-cards";
    const mark = o.heart
      ? '<span class="row-heart" aria-hidden="true">&#9829;&#xFE0E;</span>'
      : `<i class="row-dot${o.sq ? " sq" : ""}" style="background:${o.color}"></i>`;
    sec.innerHTML =
      '<div class="row-head">' +
      `<h4 class="row-title"><button type="button" class="row-toggle" aria-expanded="false" aria-controls="${body}">` +
      `<span class="row-name">${mark}<span class="row-label">${esc(o.title)}</span><span class="row-chev">${CHEVRON("M6 9l6 6 6-6")}</span></span>` +
      `<span class="row-meta">${o.meta}${o.tag || ""}</span>` +
      "</button></h4>" +
      '<div class="row-ctrl">' +
      '<span class="row-hint" aria-hidden="true">Swipe &rarr;</span>' +
      `<button type="button" class="row-btn" data-dir="-1" aria-label="Scroll back">${CHEVRON("M15 5l-7 7 7 7")}</button>` +
      `<button type="button" class="row-btn" data-dir="1" aria-label="Scroll forward">${CHEVRON("M9 5l7 7-7 7")}</button>` +
      "</div></div>" +
      `<div class="row-body" id="${body}"><div class="row-clip">` +
      `<div class="row-track" role="list" tabindex="0" aria-label="${esc(o.title)}"></div>` +
      "</div></div>";
    return sec;
  }

  function initRows(root) {
    (root || document).querySelectorAll(".row").forEach((row) => {
      if (row.dataset.ready) return;
      row.dataset.ready = "1";
      const track = row.querySelector(".row-track");
      const btns = row.querySelectorAll(".row-btn");
      if (!track) return;
      const update = () => {
        const max = track.scrollWidth - track.clientWidth;
        row.classList.toggle("can-scroll", track.clientWidth > 0 && max > 4);
        btns.forEach((b) => {
          b.disabled = +b.dataset.dir < 0 ? track.scrollLeft <= 4 : track.scrollLeft >= max - 4;
        });
      };
      btns.forEach((b) =>
        b.addEventListener("click", () => {
          const card = track.firstElementChild;
          const gap = parseFloat(getComputedStyle(track).columnGap) || 14;
          const step = card ? card.getBoundingClientRect().width + gap : track.clientWidth;
          const per = Math.max(1, Math.floor((track.clientWidth + gap) / step));
          track.scrollBy({ left: +b.dataset.dir * step * per, behavior: "smooth" });
        })
      );
      let ticking = false;
      track.addEventListener("scroll", () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { ticking = false; update(); });
      }, { passive: true });
      window.addEventListener("resize", update);
      row._update = update;
      update();
    });
  }

  // Bring a card into view inside its row without moving the page up or down.
  function revealInRow(card) {
    const track = card.parentElement;
    if (!track || !track.classList.contains("row-track")) return;
    const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const left = card.offsetLeft - pad;
    const right = card.offsetLeft + card.offsetWidth + pad - track.clientWidth;
    if (track.scrollLeft > left) track.scrollTo({ left, behavior: "smooth" });
    else if (track.scrollLeft < right) track.scrollTo({ left: right, behavior: "smooth" });
  }

  // ---------------------------------------------------------------- columns (Things To Do)
  // Each column shows three cards; "Show N more" opens the rest right there. Nothing scrolls
  // inside a column, so scrolling the page never gets caught in one.
  function initColumn(col) {
    const list = col.querySelector(".col-list");
    const moreBtn = col.querySelector(".col-more");
    const phone = () => window.matchMedia("(max-width: 600px)").matches;
    // After "Show more" on computers and tablets, the column keeps the height of three cards
    // (plus a peek of the next) and the rest scroll inside it. Phones just open the full list.
    const fit = () => {
      const scroll = col.classList.contains("show-all") && !phone() && !col.closest(".board.is-single");
      col.classList.toggle("is-scroll", scroll);
      if (!scroll) { list.style.maxHeight = ""; list.scrollTop = 0; return; }
      const third = list.children[2];
      if (third) list.style.maxHeight = (third.offsetTop - list.offsetTop + third.offsetHeight + 46) + "px";
    };
    const update = () => {
      fit();
      if (!moreBtn) return;
      const extra = list.children.length - 3;
      const open = col.classList.contains("show-all");
      moreBtn.hidden = extra <= 0;
      moreBtn.textContent = open ? "Show less" : `Show ${extra} more`;
      moreBtn.setAttribute("aria-expanded", String(open));
    };
    if (moreBtn) moreBtn.addEventListener("click", () => {
      const open = !col.classList.contains("show-all");
      col.classList.toggle("show-all", open);
      update();
      if (!open && col.getBoundingClientRect().top < 72) col.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    window.addEventListener("resize", fit);
    col._update = update;
    update();
  }

  // A pin lights up its card: if the card is past the first three, open the column.
  function revealInColumn(card) {
    const col = card.closest(".col");
    if (!col) return;
    const list = col.querySelector(".col-list");
    if (!col.classList.contains("show-all") && [...list.children].indexOf(card) > 2) {
      col.classList.add("show-all");
      col._update();
    }
    if (col.classList.contains("is-scroll")) {
      const top = card.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + card.offsetHeight > list.scrollTop + list.clientHeight)
        list.scrollTo({ top: top - 4, behavior: "smooth" });
    }
  }

  // ---------------------------------------------------------------- shared map setup
  const PROVIDERS = [
    {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
    },
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      options: { maxZoom: 19, attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors" },
    },
  ];

  function baseMap(el) {
    const map = L.map(el, { scrollWheelZoom: false, zoomSnap: 0.25 });
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    let layer = null;
    (function use(i) {
      if (i >= PROVIDERS.length) return;
      if (layer) map.removeLayer(layer);
      let loaded = 0, failed = 0;
      layer = L.tileLayer(PROVIDERS[i].url, PROVIDERS[i].options)
        .on("tileload", () => { loaded++; })
        .on("tileerror", () => { failed++; if (!loaded && failed >= 4) use(i + 1); })
        .addTo(map);
    })(0);

    const icon = L.divIcon({
      className: "venue-icon",
      html: '<span class="venue-halo"></span><span class="venue-pin">&#9829;&#xFE0E;</span>',
      iconSize: [46, 46], iconAnchor: [23, 23], popupAnchor: [0, -20], tooltipAnchor: [20, 0],
    });
    const venue = L.marker([VENUE.lat, VENUE.lng], { icon, zIndexOffset: 1000, title: VENUE.name })
      .addTo(map)
      .bindPopup(
        `<strong>${esc(VENUE.name)}</strong><span class="pop-cat">Our wedding &middot; September 4, 2027</span>` +
        `<p>${esc(VENUE.address)}</p>` +
        `<p class="pop-links"><a href="${directions}" ${ext}>Directions</a>` +
        `<a href="${gmaps({ name: VENUE.name, town: "Alpine", pid: VENUE.pid })}" ${ext}>Google Maps</a></p>`
      )
      .bindTooltip('<strong>Fontainebleau Inn</strong><span>Our wedding</span>', {
        permanent: true, direction: "right", className: "venue-label", offset: [8, 0],
      });
    map._innLabel = venue.getTooltip();
    return map;
  }

  // Pins are a little smaller on phone-sized maps.
  const pinSize = (map) => (map.getSize().x < 600 ? 24 : 30);

  function pinIcon(color, label, dx, dy, S, sq) {
    S = S || 30;
    dx = Math.round(dx || 0);
    dy = Math.round(dy || 0);
    const sz = S === 30 ? "" : `;width:${S}px;height:${S}px;font-size:11px`;
    return L.divIcon({
      className: "pin-icon",
      html: `<span class="pin${sq ? " sq" : ""}" style="background:${color};color:${textOn(color)}${sz}">${label}</span>`,
      iconSize: [S, S], iconAnchor: [S / 2 - dx, S / 2 - dy], popupAnchor: [dx, dy - S / 2 + 1],
    });
  }

  // Where the pins of one crowded group go, relative to the group's center. Small groups make a
  // ring; bigger ones fill rings outward from the middle. Around the Inn they use the left side
  // only, so the Inn's label stays readable.
  function slots(n, nearInn, S) {
    const gap = S + 8;
    const out = [];
    if (!nearInn && n <= 7) {
      const r = Math.max(S * 0.8, (n * gap) / (2 * Math.PI));
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (2 * Math.PI * k) / n;
        out.push([r * Math.cos(a), r * Math.sin(a)]);
      }
      return out;
    }
    let r = 23 + S / 2 + 12;
    if (!nearInn) { out.push([0, 0]); r = S + 6; }
    while (out.length < n) {
      const left = n - out.length;
      if (nearInn) {
        const m = Math.min(Math.floor((r * 2.79) / gap) + 1, left);
        for (let k = 0; k < m; k++) {
          const a = (100 + (m === 1 ? 80 : (160 * k) / (m - 1))) * (Math.PI / 180);
          out.push([r * Math.cos(a), r * Math.sin(a)]);
        }
      } else {
        const m = Math.min(Math.floor((2 * Math.PI * r) / (S + 7)), left);
        for (let k = 0; k < m; k++) {
          const a = -Math.PI / 2 + r / 70 + (2 * Math.PI * k) / m;
          out.push([r * Math.cos(a), r * Math.sin(a)]);
        }
      }
      r += S + 4;
    }
    return out;
  }

  // Fan out pins that would overlap at the current zoom; zoom in and they return to their real
  // spots. Groups that bump into each other are merged and laid out again; a group that bumps
  // into the Inn is nudged away from it; a group that would spill off the map is moved inside.
  function declutter(map, items) {
    const vis = items.filter((it) => map.hasLayer(it.m));
    if (!vis.length) return;
    const S = pinSize(map);
    const innGap = 23 + S / 2 + 4;
    const size = map.getSize();
    const P = vis.map((it) => map.latLngToLayerPoint(it.ll));
    const V = map.latLngToLayerPoint([VENUE.lat, VENUE.lng]);
    const parent = vis.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
    const nearInn = vis.map((_, i) => P[i].distanceTo(V) < innGap);
    for (let i = 0; i < vis.length; i++) {
      for (let j = i + 1; j < vis.length; j++) if (P[i].distanceTo(P[j]) < S) join(i, j);
    }
    const ang = (x, y) => Math.atan2(y, x);
    // the Inn's label is an obstacle too
    let R = null;
    const lab = map._innLabel && map._innLabel.getElement && map._innLabel.getElement();
    if (lab && lab.offsetWidth) {
      const mr = map.getContainer().getBoundingClientRect(), lr = lab.getBoundingClientRect();
      const tl = map.containerPointToLayerPoint([lr.left - mr.left, lr.top - mr.top]);
      R = { x1: tl.x - S / 2, y1: tl.y - S / 2, x2: tl.x + lr.width + S / 2, y2: tl.y + lr.height + S / 2 };
    }
    const shift = {};               // extra move per group (away from the Inn / off the edge)
    let F = [];
    for (let pass = 0; pass < 12; pass++) {
      const groups = {};
      vis.forEach((_, i) => { const r = find(i); (groups[r] = groups[r] || []).push(i); });
      F = new Array(vis.length);
      Object.keys(groups).forEach((key) => {
        const g = groups[key];
        let cx = 0, cy = 0;
        g.forEach((i) => { cx += P[i].x; cy += P[i].y; });
        cx /= g.length; cy /= g.length;
        const nv = g.some((i) => nearInn[i]);
        if (nv) { cx = V.x; cy = V.y; }
        else if (shift[key]) { cx += shift[key][0]; cy += shift[key][1]; }
        if (g.length === 1 && !nv) { F[g[0]] = L.point(cx, cy); return; }
        const rings = [];
        slots(g.length, nv, S).forEach((sl) => {
          const r = Math.round(Math.hypot(sl[0], sl[1]));
          let ring = rings.find((x) => x.r === r);
          if (!ring) rings.push((ring = { r, slots: [] }));
          ring.slots.push(sl);
        });
        const byDist = g.slice().sort((a, b) => Math.hypot(P[a].x - cx, P[a].y - cy) - Math.hypot(P[b].x - cx, P[b].y - cy));
        let at = 0;
        rings.forEach((ring) => {
          const members = byDist.slice(at, at + ring.slots.length);
          at += ring.slots.length;
          members.sort((a, b) => ang(P[a].x - cx, P[a].y - cy) - ang(P[b].x - cx, P[b].y - cy));
          const sl = ring.slots.slice().sort((a, b) => ang(a[0], a[1]) - ang(b[0], b[1]));
          members.forEach((i, k) => { F[i] = L.point(cx + sl[k][0], cy + sl[k][1]); });
        });
      });
      let changed = false;
      Object.keys(groups).forEach((key) => {
        const g = groups[key];
        if (g.some((i) => nearInn[i])) return;
        // nudge away from the Inn
        const d = Math.min.apply(null, g.map((i) => F[i].distanceTo(V)));
        if (d < innGap) {
          let gx = 0, gy = 0;
          g.forEach((i) => { gx += F[i].x; gy += F[i].y; });
          gx = gx / g.length - V.x; gy = gy / g.length - V.y;
          const len = Math.hypot(gx, gy) || 1;
          const push = innGap - d + 2;
          const sh = shift[key] || [0, 0];
          shift[key] = [sh[0] + (gx / len) * push, sh[1] + (gy / len) * push];
          changed = true;
          return;
        }
        // move out from under the Inn's label
        if (R) {
          const under = g.filter((i) => F[i].x > R.x1 && F[i].x < R.x2 && F[i].y > R.y1 && F[i].y < R.y2);
          if (under.length) {
            let gy = 0;
            g.forEach((i) => { gy += F[i].y; });
            const up = gy / g.length < V.y;
            const need = up ? Math.max.apply(null, under.map((i) => F[i].y - R.y1)) : Math.max.apply(null, under.map((i) => R.y2 - F[i].y));
            const sh = shift[key] || [0, 0];
            shift[key] = [sh[0], sh[1] + (up ? -need - 1 : need + 1)];
            changed = true;
            return;
          }
        }
        // keep fanned-out groups inside the map
        if (g.length < 2) return;
        const C = g.map((i) => map.layerPointToContainerPoint(F[i]));
        const xs = C.map((c) => c.x), ys = C.map((c) => c.y);
        const T = g.map((i) => map.layerPointToContainerPoint(P[i]));
        const tx = T.reduce((a, c) => a + c.x, 0) / T.length, ty = T.reduce((a, c) => a + c.y, 0) / T.length;
        if (tx < 0 || tx > size.x || ty < 0 || ty > size.y) return;
        const m = S / 2 + 3;
        let sx = 0, sy = 0;
        if (Math.min.apply(null, xs) < m) sx = m - Math.min.apply(null, xs);
        else if (Math.max.apply(null, xs) > size.x - m) sx = size.x - m - Math.max.apply(null, xs);
        if (Math.min.apply(null, ys) < m) sy = m - Math.min.apply(null, ys);
        else if (Math.max.apply(null, ys) > size.y - m) sy = size.y - m - Math.max.apply(null, ys);
        if (Math.abs(sx) > 0.5 || Math.abs(sy) > 0.5) {
          const sh = shift[key] || [0, 0];
          shift[key] = [sh[0] + sx, sh[1] + sy];
          changed = true;
        }
      });
      for (let i = 0; i < vis.length; i++) {
        for (let j = i + 1; j < vis.length; j++) {
          if (find(i) !== find(j) && F[i].distanceTo(F[j]) < S) {
            const ri = find(i), rj = find(j);
            join(i, j);
            const keep = find(i), gone = keep === ri ? rj : ri;
            if (shift[gone] && !shift[keep]) shift[keep] = shift[gone];
            delete shift[gone];
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
    if (R) {
      const left = {};
      vis.forEach((_, i) => { const r = find(i); (left[r] = left[r] || []).push(i); });
      Object.keys(left).forEach((key) => {
        const g = left[key];
        if (g.some((i) => nearInn[i])) return;
        const under = g.filter((i) => F[i].x > R.x1 && F[i].x < R.x2 && F[i].y > R.y1 && F[i].y < R.y2);
        if (!under.length) return;
        const gx = g.reduce((a, i) => a + F[i].x, 0) / g.length;
        const dx = gx >= (R.x1 + R.x2) / 2
          ? Math.max.apply(null, under.map((i) => R.x2 - F[i].x)) + 1
          : -Math.max.apply(null, under.map((i) => F[i].x - R.x1)) - 1;
        g.forEach((i) => { F[i] = L.point(F[i].x + dx, F[i].y); });
      });
    }
    vis.forEach((it, i) => setOffset(it, F[i].x - P[i].x, F[i].y - P[i].y, S));
  }

  function setOffset(it, dx, dy, S) {
    if (Math.round(it.dx || 0) === Math.round(dx) && Math.round(it.dy || 0) === Math.round(dy) && it.S === S) return;
    it.dx = dx;
    it.dy = dy;
    it.S = S;
    it.m.setIcon(pinIcon(it.color, it.label, dx, dy, S, it.sq));
  }

  function fitTo(map, items) {
    const pts = [[VENUE.lat, VENUE.lng]].concat(items.map((p) => [p.lat, p.lng]));
    // leave room for the Inn's label when the Inn is the furthest place east
    const east = Math.max.apply(null, items.map((p) => p.lng));
    const right = VENUE.lng >= east - 0.01 ? 200 : 40;
    map.fitBounds(pts, { paddingTopLeft: [40, 40], paddingBottomRight: [right, 40], maxZoom: 13, animate: false });
  }

  function noMap(el) {
    el.classList.add("map-off");
    el.innerHTML = "<p>The map couldn't load right now. Every place below still has its own link.</p>";
  }

  function addPins(map, list, colorOf, popupOf, sqOf) {
    const items = list.map((p) => {
      const it = { ll: L.latLng(p.lat, p.lng), color: colorOf(p), label: p.num, dx: 0, dy: 0, sq: sqOf ? !!sqOf(p) : false };
      it.m = L.marker(it.ll, { icon: pinIcon(it.color, it.label, 0, 0, 30, it.sq), title: p.name, riseOnHover: true })
        .bindPopup(popupOf(p), { maxWidth: 270, autoPanPaddingTopLeft: [56, 14] })
        .addTo(map);
      p.item = it;
      return it;
    });
    map.on("zoomend", () => declutter(map, items));
    return items;
  }

  // Scroll the map into view only when most of it is off screen.
  function bringIntoView(el) {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const top = 72; // the sticky menu bar
    const seen = Math.min(r.bottom, vh) - Math.max(r.top, top);
    if (seen < Math.min(r.height, vh - top) * 0.7) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function showOnMap(map, mapEl, items, p) {
    bringIntoView(mapEl);
    map.closePopup();
    map.setView([p.lat, p.lng], Math.max(map.getZoom(), 13), { animate: false });
    declutter(map, items);
    p.item.m.openPopup();
  }

  // ---------------------------------------------------------------- Things To Do (weekend.html)
  function initThings() {
    const mapEl = document.getElementById("map");
    const board = document.getElementById("place-list");
    const filterEl = document.getElementById("place-filters");
    if (!mapEl && !board) return;
    const cats = Object.keys(CATEGORIES);
    PLACES.forEach((p, i) => { p.num = i + 1; });

    function popup(p) {
      return `<strong>${p.num}. ${esc(p.name)}</strong>` +
        `<span class="pop-cat">${esc(CATEGORIES[p.cat].label)} &middot; ${esc(p.town)}</span>` +
        `<p>${esc(p.note)}</p><p class="pop-drive">${fromInn(p.mins, p.mi)}</p>` +
        `<p class="pop-links"><a href="${gmaps(p)}" ${ext}>Google Maps</a><a href="${reviews(p)}" ${ext}>Reviews</a></p>`;
    }

    let map = null;
    let items = [];
    if (mapEl && hasLeaflet) {
      map = baseMap(mapEl);
      items = addPins(map, PLACES, (p) => CATEGORIES[p.cat].color, popup);
      fitTo(map, PLACES.filter((p) => !p.far));
      declutter(map, items);
      // the Inn's label grows a little once the web font loads: lay the pins out again then
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => declutter(map, items));
      PLACES.forEach((p) => p.item.m.on("popupopen", () => setActive(board, p.card, revealInColumn)));
      map.on("popupclose", () => setActive(board, null));
    } else if (mapEl) {
      noMap(mapEl);
    }

    function focus(p) {
      if (!map) { window.open(gmaps(p), "_blank", "noopener"); return; }
      if (!map.hasLayer(p.item.m)) setFilter("all", false);
      showOnMap(map, mapEl, items, p);
    }

    const cols = {};
    if (board) {
      cats.forEach((c) => {
        const list = PLACES.filter((p) => p.cat === c);
        if (!list.length) return;
        const color = CATEGORIES[c].color;
        const col = document.createElement("section");
        col.className = "col";
        col.id = "todo-" + c;
        col.style.setProperty("--c", color);
        col.innerHTML =
          `<header class="col-head"><h4><i class="row-dot" style="background:${color}"></i><span>${esc(CATEGORIES[c].label)}</span></h4>` +
          `<p class="col-meta">${list.length} places${c === "eat" ? " &middot; most-reviewed first" : ""}</p></header>` +
          `<div class="col-list" role="list" aria-label="${esc(CATEGORIES[c].label)}"></div>` +
          '<button type="button" class="col-more" hidden></button>';
        const listEl = col.querySelector(".col-list");
        list.forEach((p) => {
          const card = miniCard({
            cls: "place-card",
            media:
              '<div class="card-photo">' +
              `<img src="images/places/${p.img}.jpg" alt="${esc(p.alt || "")}" width="800" height="533" loading="lazy">` +
              `<span class="num" style="background:${color};color:${textOn(color)}">${p.num}</span>` +
              (p.badge ? `<span class="badge">${esc(p.badge)}</span>` : "") + "</div>",
            kicker: p.town,
            title: p.name,
            lines: p.badge ? [`<p class="tag">&#9829;&#xFE0E; ${esc(p.badge)}</p>`] : [],
            foot: `<span class="drive">≈ ${p.mins} min</span>`,
            more:
              `<p class="note">${esc(p.note)}</p>` +
              `<p class="meta">${fromInn(p.mins, p.mi)}</p>` +
              `<p class="links"><a href="${gmaps(p)}" ${ext}>Google Maps</a><a href="${reviews(p)}" ${ext}>Reviews</a>` +
              (map ? '<button type="button" class="show-on-map">Show on map</button>' : "") + "</p>",
          });
          if (map) onCardTap(card, () => focus(p));
          p.card = card;
          listEl.appendChild(card);
        });
        board.appendChild(col);
        cols[c] = col;
        initColumn(col);
      });
    }

    // A category button shows that category's pins and opens its column across the full width.
    function setFilter(c, refit) {
      if (filterEl) filterEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === c)));
      if (board) {
        board.classList.toggle("is-single", c !== "all");
        Object.keys(cols).forEach((k) => {
          cols[k].classList.toggle("is-on", k === c);
          cols[k].hidden = !(c === "all" || k === c);
        });
        Object.keys(cols).forEach((k) => cols[k]._update && cols[k]._update());
      }
      if (!map) return;
      PLACES.forEach((p) => {
        const show = c === "all" || p.cat === c;
        if (show && !map.hasLayer(p.item.m)) p.item.m.addTo(map);
        if (!show && map.hasLayer(p.item.m)) p.item.m.remove();
      });
      if (refit !== false) {
        map.closePopup();
        fitTo(map, PLACES.filter((p) => (c === "all" ? !p.far : p.cat === c)));
      }
      declutter(map, items);
    }

    if (filterEl) {
      filterEl.innerHTML =
        '<button type="button" data-cat="all" aria-pressed="true">All</button>' +
        cats.map((c) => `<button type="button" data-cat="${c}" aria-pressed="false"><i style="background:${CATEGORIES[c].color}"></i>${esc(CATEGORIES[c].label)}</button>`).join("");
      filterEl.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-cat]");
        if (b) setFilter(b.dataset.cat);
      });
    }

    // Links elsewhere on the page, e.g. the highlight cards
    document.querySelectorAll("[data-show-cat]").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        setFilter(a.dataset.showCat);
        (mapEl || board).scrollIntoView({ behavior: "smooth", block: "center" });
      })
    );
    document.querySelectorAll("[data-show-place]").forEach((a) =>
      a.addEventListener("click", (e) => {
        const p = PLACES.find((x) => x.name === a.dataset.showPlace);
        if (p && map) { e.preventDefault(); focus(p); }
      })
    );
  }

  // ---------------------------------------------------------------- Where to Stay (travel.html)
  // The homes on Cayuta Lake (closest to the Inn) sit on top, highlighted. Below them, Airbnbs on
  // the left and hotels on the right: the towns that have both (Ithaca, Watkins Glen) side by
  // side, then the rest. Tapping a town opens or closes it; inside, its places swipe sideways.
  function initStays() {
    const mapEl = document.getElementById("stay-map");
    const gridEl = document.getElementById("stay-cols");
    const featureEl = document.getElementById("stay-feature");
    const moreEl = document.getElementById("airbnb-more");
    const filterEl = document.getElementById("stay-filters");
    if (!mapEl && !gridEl) return;
    const link = (s) => `https://www.airbnb.com/rooms/${s.id}?check_in=${STAY_DATES.checkin}&check_out=${STAY_DATES.checkout}`;
    // estimated price per night (see places.js); hotels without one say so
    const priceText = (x) => x.price
      ? `&asymp; $${x.price.toLocaleString("en-US")} a night` + (x.min ? ` &middot; ${x.min}-night minimum` : "")
      : x.priceNote ? "2027 rates not posted yet" : "";
    const priceLine = (x) => priceText(x) ? `<p class="price${x.price ? "" : " is-na"}">${priceText(x)}</p>` : "";
    const popPrice = (x) => priceText(x) ? `<p class="pop-price">${priceText(x)}</p>` : "";
    const hotels = typeof HOTELS === "undefined" ? [] : HOTELS;
    STAYS.forEach((s, i) => { s.num = i + 1; s.kind = "airbnb"; });
    let n = STAYS.length;
    hotels.forEach((h) => { h.kind = "hotel"; if (h.lat) h.num = ++n; });
    const pinned = STAYS.concat(hotels.filter((h) => h.lat));
    const areaOf = (x) => STAY_AREAS[x.area];
    const scope = document.getElementById("stay") || document;
    const TOP = "cayuta";   // highlighted on top: the homes steps from the Inn

    // Each town row opens on its own (a town filter opens that town's Airbnbs and hotels together).
    const rows = [];   // {el, kind, area}
    function setOpen(r, open) {
      r.el.classList.toggle("is-open", open);
      r.el.querySelector(".row-toggle").setAttribute("aria-expanded", String(open));
      const body = r.el.querySelector(".row-body");
      if (open) body.removeAttribute("inert");
      else body.setAttribute("inert", "");
      if (open && r.el._update) requestAnimationFrame(r.el._update);
    }
    const openArea = (area, open) => rows.filter((r) => r.area === area).forEach((r) => setOpen(r, open !== false));
    // a pin lights up its card: open the card's town first
    function revealCard(card) {
      const r = rows.find((x) => x.el.contains(card));
      if (r && !r.el.classList.contains("is-open")) setOpen(r, true);
      revealInRow(card);
    }

    let map = null;
    let items = [];
    if (mapEl && hasLeaflet) {
      map = baseMap(mapEl);
      items = addPins(map, pinned, (x) => areaOf(x).color, (x) =>
        x.kind === "airbnb"
          ? `<strong>${esc(x.name)}</strong><span class="pop-cat">Airbnb &middot; ${esc(x.type)}</span><p>${esc(x.beds)}</p>` +
            `<p class="pop-drive">${fromInn(x.mins)}</p>${popPrice(x)}<p class="pop-links"><a href="${link(x)}" ${ext}>View on Airbnb</a></p>`
          : `<strong>${esc(x.name)}</strong><span class="pop-cat">Hotel &middot; ${esc(x.where)}</span>` +
            `<p class="pop-drive">${fromInn(x.mins)}</p>${popPrice(x)}` +
            `<p class="pop-links"><a href="${phone(x.phone)}">${esc(x.phone)}</a>` +
            (x.web ? `<a href="${x.web}" ${ext}>Website</a>` : `<a href="${gmaps(x)}" ${ext}>Google Maps</a>`) + "</p>",
        (x) => x.kind === "hotel"
      );
      fitTo(map, pinned);
      declutter(map, items);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => declutter(map, items));
      pinned.forEach((x) => x.item.m.on("popupopen", () => setActive(scope, x.card, revealCard)));
      map.on("popupclose", () => setActive(scope, null));
    } else if (mapEl) {
      noMap(mapEl);
    }

    const focus = (x) => { if (map) showOnMap(map, mapEl, items, x); };

    function art(x) {
      const a = areaOf(x);
      return `<div class="card-art" style="background:${tint(a.color, TINT[a.color.toUpperCase()] || 0.18)}">` +
        `<svg class="art" viewBox="0 0 160 100" aria-hidden="true"><use href="#art-${x.art || "house"}"></use></svg>` +
        (x.num ? `<span class="num ${x.kind === "hotel" ? "sq" : ""}" style="background:${a.color};color:${textOn(a.color)}">${x.num}</span>` : "") +
        "</div>";
    }

    function airbnbRow(key) {
      const a = STAY_AREAS[key];
      const list = STAYS.filter((s) => s.area === key);
      if (!list.length) return null;
      const top = key === TOP;
      const row = rowShell({
        id: "stay-" + key, color: a.color, title: a.label, cls: top ? "is-feature" : "", heart: top,
        meta: `${list.length} Airbnb${list.length === 1 ? "" : "s"} &middot; ${esc(a.drive)} from the Inn`,
        tag: top ? '<span class="row-tag">Closest to the Inn</span>' : "",
      });
      const track = row.querySelector(".row-track");
      list.forEach((s) => {
        const card = miniCard({
          cls: "stay-card",
          media: art(s),
          kicker: s.type,
          title: s.name,
          lines: [`<p class="meta">${esc(s.beds)}</p>`, `<p class="drive">${short(s.mins)}</p>`, priceLine(s)],
          foot: `<a class="go" href="${link(s)}" ${ext}>View on Airbnb</a>`,
          more: `<p class="note">${esc(s.note)}</p>` + (map ? '<p class="links"><button type="button" class="show-on-map">Show on map</button></p>' : ""),
        });
        if (map) onCardTap(card, () => focus(s));
        s.card = card;
        track.appendChild(card);
      });
      rows.push({ el: row, kind: "airbnb", area: key });
      return row;
    }

    function hotelRow(key) {
      const r = HOTEL_ROWS.find((x) => x.area === key);
      const list = hotels.filter((h) => h.area === key);
      if (!r || !list.length) return null;
      const a = STAY_AREAS[key];
      const count = list.filter((h) => !h.guide).length;
      const meta = (count ? `${count} hotel${count === 1 ? "" : "s"}` : "Visitor guide") + ` &middot; ${esc(r.drive)} from the Inn`;
      const row = rowShell({ id: "hotels-" + key, color: a.color, title: a.label, meta, sq: true });
      const track = row.querySelector(".row-track");
      list.forEach((h) => {
        const more = [];
        if (h.note) more.push(`<p class="note">${esc(h.note)}</p>`);
        const links = [];
        if (h.web && h.phone) links.push(`<a href="${h.web}" ${ext}>${esc(h.webLabel || "Website")}</a>`);
        if (h.lat) links.push(`<a href="${gmaps(h)}" ${ext}>Google Maps</a>`);
        if (links.length) more.push(`<p class="links">${links.join("")}</p>`);
        const card = miniCard({
          cls: "hotel-card" + (h.guide ? " is-guide" : ""),
          media: art(h),
          kicker: h.where,
          title: h.name,
          lines: (h.mins ? [`<p class="drive">${short(h.mins)}</p>`] : []).concat(priceLine(h) ? [priceLine(h)] : []),
          foot: h.phone
            ? `<a class="tel" href="${phone(h.phone)}">${PHONE_ICON}${esc(h.phone)}</a>`
            : `<a class="go" href="${h.web}" ${ext}>${esc(h.webLabel || "Website")}</a>`,
          more: more.join(""),
        });
        if (map && h.lat) onCardTap(card, () => focus(h));
        h.card = card;
        track.appendChild(card);
      });
      rows.push({ el: row, kind: "hotel", area: key });
      return row;
    }

    if (featureEl && STAYS.some((s) => s.area === TOP)) featureEl.appendChild(airbnbRow(TOP));
    if (gridEl) {
      const aAreas = Object.keys(STAY_AREAS).filter((k) => k !== TOP && STAYS.some((s) => s.area === k));
      const hAreas = HOTEL_ROWS.map((r) => r.area).filter((k) => hotels.some((h) => h.area === k));
      const both = hAreas.filter((k) => aAreas.includes(k));   // in the hotels' order: Ithaca first
      const cell = (kind, list) => {
        const c = document.createElement("div");
        c.className = "sg-cell";
        c.dataset.kind = kind;
        list.forEach((el) => { if (el) c.appendChild(el); });
        return c;
      };
      const line = (cls, a, h) => {
        const d = document.createElement("div");
        d.className = "sg-row " + cls;
        d.append(a, h);
        gridEl.appendChild(d);
      };
      both.forEach((k) => line("sg-pair", cell("airbnb", [airbnbRow(k)]), cell("hotel", [hotelRow(k)])));
      line("sg-rest",
        cell("airbnb", aAreas.filter((k) => !both.includes(k)).map(airbnbRow)),
        cell("hotel", hAreas.filter((k) => !both.includes(k)).map(hotelRow)));
    }

    rows.forEach((r) => {
      setOpen(r, r.area === TOP);
      r.el.querySelector(".row-toggle").addEventListener("click", () => setOpen(r, !r.el.classList.contains("is-open")));
    });

    // Filters: All · Airbnbs · Hotels · one per town. The first three keep the Cayuta Lake homes
    // on top (the closest stays to the Inn); a town button shows and opens just that town.
    const general = (f) => f === "all" || f === "airbnb" || f === "hotel";
    const keep = (f, x) => (x.kind === "airbnb" && x.area === TOP)
      ? general(f) || f === TOP
      : f === "all" || f === x.kind || f === x.area;
    function setFilter(f, refit) {
      if (filterEl) filterEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === f)));
      rows.forEach((r) => { r.el.hidden = !keep(f, r); });
      const shown = { airbnb: false, hotel: false };
      rows.forEach((r) => { if (!r.el.hidden && r.area !== TOP) shown[r.kind] = true; });
      if (gridEl) {
        gridEl.classList.toggle("is-one", !(shown.airbnb && shown.hotel));
        gridEl.classList.toggle("is-empty", !shown.airbnb && !shown.hotel);
        gridEl.querySelectorAll(".sg-cell").forEach((c) => {
          c.hidden = !shown[c.dataset.kind] || (!c.classList.contains("col-title") && !c.querySelector(".row:not([hidden])"));
        });
        gridEl.querySelectorAll(".sg-row").forEach((line) => { line.hidden = ![...line.children].some((c) => !c.hidden); });
      }
      if (featureEl) featureEl.hidden = !rows.some((r) => r.area === TOP && !r.el.hidden);
      if (moreEl) moreEl.hidden = !(f === "all" || f === "airbnb" || STAYS.some((s) => s.area === f));
      if (!general(f)) openArea(f);
      rows.forEach((r) => { if (!r.el.hidden && r.el._update) r.el._update(); });
      if (!map) return;
      const vis = pinned.filter((x) => keep(f, x));
      pinned.forEach((x) => {
        const show = vis.includes(x);
        if (show && !map.hasLayer(x.item.m)) x.item.m.addTo(map);
        if (!show && map.hasLayer(x.item.m)) x.item.m.remove();
      });
      if (refit !== false && vis.length) { map.closePopup(); fitTo(map, vis); }
      declutter(map, items);
    }

    if (filterEl) {
      const dot = (c, sq) => `<i class="${sq ? "sq" : ""}" style="background:${c}"></i>`;
      filterEl.innerHTML =
        '<button type="button" data-f="all" aria-pressed="true">All</button>' +
        `<button type="button" data-f="airbnb" aria-pressed="false">${dot("#662844")}Airbnbs</button>` +
        `<button type="button" data-f="hotel" aria-pressed="false">${dot("#662844", true)}Hotels</button>` +
        '<span class="f-sep" aria-hidden="true"></span>' +
        Object.keys(STAY_AREAS).map((k) => `<button type="button" data-f="${k}" aria-pressed="false">${dot(STAY_AREAS[k].color)}${esc(STAY_AREAS[k].short)}</button>`).join("");
      filterEl.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-f]");
        if (b) setFilter(b.dataset.f);
      });
    }
  }

  // ---------------------------------------------------------------- filter buttons
  // The filter buttons stay on one line. When a narrow screen can't fit them all, the row
  // scrolls sideways and its edges fade to show there is more.
  function initFilterRows() {
    document.querySelectorAll(".filters").forEach((f) => {
      const check = () => {
        const max = f.scrollWidth - f.clientWidth;
        f.classList.toggle("is-scroll", max > 2);
        f.classList.toggle("at-start", f.scrollLeft <= 2);
        f.classList.toggle("at-end", f.scrollLeft >= max - 2);
      };
      f.addEventListener("scroll", check, { passive: true });
      window.addEventListener("resize", check);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(check);
      check();
    });
  }

  initThings();
  initStays();
  initRows(document);
  initFilterRows();
})();

// Personalizes the thank-you page after an RSVP is sent.
(function () {
  let name = "", attending = "";
  try {
    name = sessionStorage.getItem("rsvpName") || "";
    attending = sessionStorage.getItem("rsvpAttending") || "";
  } catch (_) { /* storage unavailable */ }
  const nameEl = document.querySelector("[data-name]");
  const msgEl = document.querySelector("[data-message]");
  if (nameEl && name) nameEl.textContent = ", " + name;
  if (msgEl) {
    msgEl.textContent =
      attending === "No"
        ? "We'll miss you, and we're grateful you let us know."
        : "We can't wait to celebrate with you by the lake on September 4, 2027.";
  }
})();

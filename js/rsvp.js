// Where RSVP answers are sent.
// "/api/rsvp" saves each RSVP as a new row in  rsvp-responses/RSVP responses.xlsx  on this computer.
// For that to work, open the site with "Start Website.command" (not by double-clicking the HTML file).
// Later this can be switched to Google Sheets by changing this one line.
const RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbyWskjXRYLOJnfvJqlJwGZv1dVhupgXKwM1pLP1xRUIS8Yqp8Gmv9dmNHQ1UfnMfino/exec";

(function () {
  const form = document.getElementById("rsvp-form");
  if (!form) return;
  const status = document.getElementById("rsvp-status");
  const button = form.querySelector('button[type="submit"]');
  const otherBox = document.getElementById("dietary-other-box");
  const otherInput = document.getElementById("dietary-other");
  const dietary = Array.from(form.querySelectorAll('input[name="dietary"]'));
  const none = dietary.find((c) => c.value === "No restrictions");
  const other = dietary.find((c) => c.value === "Other");

  // "Other" opens a text box; "No restrictions" can't be combined with anything else.
  function syncOther() {
    otherBox.hidden = !other.checked;
    otherInput.required = other.checked;
    if (!other.checked) otherInput.value = "";
  }
  dietary.forEach((c) =>
    c.addEventListener("change", () => {
      if (c === none && c.checked) dietary.forEach((d) => { if (d !== none) d.checked = false; });
      if (c !== none && c.checked && none) none.checked = false;
      syncOther();
      if (other.checked && c === other) otherInput.focus();
    })
  );
  syncOther();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.hidden = true;
    const fd = new FormData(form);
    const data = {
      first_name: (fd.get("first_name") || "").trim(),
      last_name: (fd.get("last_name") || "").trim(),
      email: (fd.get("email") || "").trim(),
      attending: fd.get("attending") || "",
      dietary: fd.getAll("dietary").join(", "),
      dietary_other: other.checked ? (fd.get("dietary_other") || "").trim() : "",
      requests: (fd.get("requests") || "").trim(),
    };
    button.disabled = true;
    button.textContent = "Sending…";
    try {
      const res = await fetch(RSVP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.error || "not saved");
      try {
        sessionStorage.setItem("rsvpName", data.first_name);
        sessionStorage.setItem("rsvpAttending", data.attending);
      } catch (_) { /* private mode: the thank-you page still works without the name */ }
      location.href = "thank-you.html";
    } catch (err) {
      status.textContent =
        location.protocol === "file:"
          ? "This RSVP wasn't saved. To save RSVPs to Excel, open the site with “Start Website.command” in the website folder."
          : "Sorry, your RSVP couldn't be sent. Please try again in a moment.";
      status.hidden = false;
      button.disabled = false;
      button.textContent = "Send RSVP";
    }
  });
})();

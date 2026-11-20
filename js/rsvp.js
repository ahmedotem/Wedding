// RSVPs go to our Google Sheet through a small Google Apps Script web app.
// Step 1 looks the guest's name up on the sheet's private "Guests" tab (the guest list is
// never part of this website); step 2 is the rest of the form. Guests marked Yes in the
// Plus-one column also get a "bring a guest" question.
const RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbyWskjXRYLOJnfvJqlJwGZv1dVhupgXKwM1pLP1xRUIS8Yqp8Gmv9dmNHQ1UfnMfino/exec";

(function () {
  const form = document.getElementById("rsvp-form");
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  const first = $("first");
  const last = $("last");
  const findBtn = $("find-btn");
  const findStatus = $("find-status");
  const details = $("rsvp-details");
  const hello = $("rsvp-hello");
  const status = $("rsvp-status");
  const sendBtn = $("send-btn");
  const plusBox = $("plus-one-box");
  const plusNameBox = $("plus-one-name-box");
  const guestFirst = $("guest-first");
  const otherBox = $("dietary-other-box");
  const otherInput = $("dietary-other");
  const dietary = Array.from(form.querySelectorAll('input[name="dietary"]'));
  const none = dietary.find((c) => c.value === "No restrictions");
  const other = dietary.find((c) => c.value === "Other");
  const radios = (name) => Array.from(form.querySelectorAll(`input[name="${name}"]`));
  const picked = (name) => (radios(name).find((r) => r.checked) || {}).value || "";
  let guest = null;   // what the guest list says about this name: { found, plusOne }

  // ---------------------------------------------------------------- step 1: find the name
  async function find() {
    findStatus.hidden = true;
    for (const input of [first, last]) {
      if (!input.value.trim()) { input.reportValidity(); input.focus(); return; }
    }
    findBtn.disabled = true;
    findBtn.textContent = "Checking…";
    // Names not on the guest list (or a lookup that fails) still go through; they just aren't
    // asked about a guest.
    let out = { found: false, plusOne: false };
    try {
      const url = `${RSVP_ENDPOINT}?action=lookup&first=${encodeURIComponent(first.value.trim())}&last=${encodeURIComponent(last.value.trim())}`;
      out = await (await fetch(url)).json();
    } catch (err) { /* carry on without the guest list */ }
    try {
      guest = { found: !!out.found, plusOne: !!(out.found && out.plusOne) };
      first.readOnly = last.readOnly = true;
      findBtn.hidden = true;
      hello.textContent = `Welcome, ${first.value.trim()}!`;
      details.hidden = false;
      syncGuest();
      $("email").focus();
    } finally {
      findBtn.disabled = false;
      findBtn.textContent = "Continue";
    }
  }

  // "Not you?" goes back to the name step
  $("change-name").addEventListener("click", () => {
    guest = null;
    details.hidden = true;
    status.hidden = true;
    findBtn.hidden = false;
    first.readOnly = last.readOnly = false;
    radios("plus_one").forEach((r) => { r.checked = false; });
    syncGuest();
    first.focus();
  });
  findBtn.addEventListener("click", find);
  [first, last].forEach((input) => input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && details.hidden) { e.preventDefault(); find(); }
  }));

  // ---------------------------------------------------------------- the guest question
  // Only for people with a plus-one who are coming; the name is needed if they bring someone.
  function syncGuest() {
    const ask = !!(guest && guest.plusOne) && picked("attending") === "Yes";
    plusBox.hidden = !ask;
    radios("plus_one").forEach((r) => { r.required = ask; });
    const bringing = ask && picked("plus_one") === "Yes";
    plusNameBox.hidden = !bringing;
    guestFirst.required = bringing;
  }
  radios("attending").concat(radios("plus_one")).forEach((r) => r.addEventListener("change", () => {
    syncGuest();
    if (r.name === "plus_one" && r.value === "Yes" && r.checked) guestFirst.focus();
  }));

  // ---------------------------------------------------------------- dietary
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
  syncGuest();

  // ---------------------------------------------------------------- send
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (details.hidden) { find(); return; }
    status.hidden = true;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const bringing = !plusBox.hidden && picked("plus_one") === "Yes";
    const data = {
      first_name: first.value.trim(),
      last_name: last.value.trim(),
      email: (fd.get("email") || "").trim(),
      attending: picked("attending"),
      dietary: fd.getAll("dietary").join(", "),
      dietary_other: other.checked ? (fd.get("dietary_other") || "").trim() : "",
      requests: (fd.get("requests") || "").trim(),
      plus_one: plusBox.hidden ? "" : picked("plus_one"),
      plus_one_first: bringing ? (fd.get("plus_one_first") || "").trim() : "",
      plus_one_last: bringing ? (fd.get("plus_one_last") || "").trim() : "",
      plus_one_dietary: bringing ? (fd.get("plus_one_dietary") || "").trim() : "",
    };
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";
    try {
      // plain text keeps this a "simple" request, which Google accepts from another website
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
        sessionStorage.setItem("rsvpGuest", data.plus_one === "Yes" ? "Yes" : "");
      } catch (_) { /* private mode: the thank-you page still works without the name */ }
      location.href = "thank-you.html";
    } catch (err) {
      status.textContent = "Sorry, your RSVP couldn’t be sent. Please try again in a moment.";
      status.hidden = false;
      sendBtn.disabled = false;
      sendBtn.textContent = "Send RSVP";
    }
  });
})();

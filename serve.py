#!/usr/bin/env python3
"""Runs the wedding website on this computer and saves every RSVP in Excel.

Start it by double-clicking "Start Website.command", or in Terminal:  python3 serve.py
Then use the site at http://localhost:8027  (it opens by itself).

Each RSVP is saved in the "private" folder (never shown on the website):
  private/The Wedding.xlsx       your planner: the "RSVP Responses" tab is filled in
  private/RSVP responses.xlsx    just the RSVPs, one row each
  private/responses.jsonl        a plain-text backup of every RSVP (both Excel files are rebuilt from it)
Stop it by closing the Terminal window (or pressing Control-C).

Only uses Python's built-in modules, so nothing needs to be installed.
"""
import datetime
import http.server
import json
import os
import posixpath
import re
import shutil
import sys
import threading
import webbrowser
import zipfile
from urllib.parse import unquote
from xml.sax.saxutils import escape

PORT = 8027
HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "private")
RECORDS = os.path.join(DATA_DIR, "responses.jsonl")        # every RSVP, one per line (the safe copy)
EXCEL = os.path.join(DATA_DIR, "RSVP responses.xlsx")       # rebuilt from the records after each RSVP
PLANNER = os.path.join(DATA_DIR, "The Wedding.xlsx")        # its "RSVP Responses" tab is rebuilt too
PLANNER_SHEET = "RSVP Responses"
OLD_DIR = os.path.join(HERE, "rsvp-responses")              # where earlier versions saved RSVPs

COLUMNS = [
    ("submitted", "Submitted", 18),
    ("first_name", "First Name", 16),
    ("last_name", "Last Name", 18),
    ("email", "Email", 30),
    ("attending", "Attending", 11),
    ("dietary", "Dietary Restrictions", 32),
    ("dietary_other", "Other Dietary Needs", 30),
    ("requests", "Special Requests", 60),
]
LOCK = threading.Lock()


# ---------------------------------------------------------------- Excel helpers (no extra packages needed)
def _col(i):
    s, i = "", i + 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def _cell(ref, value, style=0):
    text = escape(str(value)).replace("\n", "&#10;")
    s = f' s="{style}"' if style else ""
    return f'<c r="{ref}"{s} t="inlineStr"><is><t xml:space="preserve">{text}</t></is></c>'


def write_excel(rows, path):
    """The simple one-tab file with just the RSVPs."""
    lines = ['<row r="1">' + "".join(_cell(f"{_col(i)}1", h, 1) for i, (_, h, _) in enumerate(COLUMNS)) + "</row>"]
    for n, row in enumerate(rows, start=2):
        lines.append(f'<row r="{n}">' + "".join(_cell(f"{_col(i)}{n}", row.get(k, ""), 2) for i, (k, _, _) in enumerate(COLUMNS)) + "</row>")
    cols = "".join(f'<col min="{i + 1}" max="{i + 1}" width="{w}" customWidth="1"/>' for i, (_, _, w) in enumerate(COLUMNS))
    last = f"{_col(len(COLUMNS) - 1)}{max(len(rows) + 1, 1)}"
    sheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        f'<cols>{cols}</cols><sheetData>{"".join(lines)}</sheetData>'
        f'<autoFilter ref="A1:{last}"/></worksheet>'
    )
    styles = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts>'
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FFF0EAD6"/><bgColor indexed="64"/></patternFill></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        "</styleSheet>"
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="RSVPs" sheetId="1" r:id="rId1"/></sheets>'
        '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'
        f"RSVPs!$A$1:${_col(len(COLUMNS) - 1)}${max(len(rows) + 1, 1)}</definedName></definedNames></workbook>"
    )
    files = {
        "[Content_Types].xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            "</Types>"
        ),
        "_rels/.rels": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>"
        ),
        "xl/workbook.xml": workbook,
        "xl/_rels/workbook.xml.rels": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            "</Relationships>"
        ),
        "xl/worksheets/sheet1.xml": sheet,
        "xl/styles.xml": styles,
    }
    tmp = path + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for name, content in files.items():
            z.writestr(name, content)
    os.replace(tmp, path)


def _attr(tag, name):
    m = re.search(r'\b' + re.escape(name) + r'="([^"]*)"', tag)
    return m.group(1) if m else None


def update_planner(rows, path=PLANNER):
    """Rewrite only the rows of the planner's "RSVP Responses" tab. Every other tab, formula and
    format in the planner is copied over untouched. Returns True if the planner was updated."""
    if not os.path.exists(path):
        return False
    with zipfile.ZipFile(path) as z:
        infos = z.infolist()
        data = {i.filename: z.read(i.filename) for i in infos}
    wb = data["xl/workbook.xml"].decode("utf-8")
    rels = data["xl/_rels/workbook.xml.rels"].decode("utf-8")

    sheet_tag = next((t for t in re.findall(r"<(?:\w+:)?sheet\b[^>]*>", wb)
                      if _attr(t, "name") == PLANNER_SHEET), None)
    if not sheet_tag:
        raise ValueError(f'the planner has no "{PLANNER_SHEET}" tab')
    rid = _attr(sheet_tag, "r:id")
    rel = next((t for t in re.findall(r"<Relationship\b[^>]*>", rels) if _attr(t, "Id") == rid), None)
    target = _attr(rel, "Target")
    part = target.lstrip("/") if target.startswith("/") else "xl/" + target.lstrip("./")
    sheet = data[part].decode("utf-8")

    # Keep the header row exactly as it is; replace everything below it.
    m = re.search(r"<sheetData\s*/>|<sheetData>(.*?)</sheetData>", sheet, re.S)
    inner = m.group(1) or ""
    head = re.search(r'<row\b[^>]*\br="1"[^>]*>.*?</row>', inner, re.S)
    head_xml = head.group(0) if head else ""
    col_style = {}
    for c in re.findall(r"<col\b[^>]*/>", sheet):
        lo, hi, st = _attr(c, "min"), _attr(c, "max"), _attr(c, "style")
        if lo and hi and st:
            for k in range(int(lo), int(hi) + 1):
                col_style[k] = st
    body = []
    for n, row in enumerate(rows, start=2):
        cells = "".join(_cell(f"{_col(i)}{n}", row.get(k, ""), col_style.get(i + 1, 0)) for i, (k, _, _) in enumerate(COLUMNS))
        body.append(f'<row r="{n}">{cells}</row>')
    sheet = sheet[:m.start()] + "<sheetData>" + head_xml + "".join(body) + "</sheetData>" + sheet[m.end():]
    dim = f'<dimension ref="A1:{_col(len(COLUMNS) - 1)}{len(rows) + 1}"/>'
    sheet = re.sub(r"<dimension\b[^>]*/>", dim, sheet, count=1)
    data[part] = sheet.encode("utf-8")

    # Ask Excel to recalculate the Guest List totals when the planner is opened.
    if "fullCalcOnLoad" not in wb:
        if re.search(r"<calcPr\b", wb):
            wb = re.sub(r"<calcPr\b", '<calcPr fullCalcOnLoad="1"', wb, count=1)
        else:
            wb = wb.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>')
        data["xl/workbook.xml"] = wb.encode("utf-8")

    tmp = path + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for i in infos:
            z.writestr(i, data[i.filename], compress_type=zipfile.ZIP_DEFLATED)
    os.replace(tmp, path)
    return True


def load_records():
    if not os.path.exists(RECORDS):
        return []
    with open(RECORDS, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def sync_files():
    """Rebuild both Excel files from the backup. Returns (rsvp_file_ok, planner_ok)."""
    rows = load_records()
    ok_rsvp = ok_planner = False
    try:
        write_excel(rows, EXCEL)
        ok_rsvp = True
    except OSError as e:
        print(f"  ! Couldn't update {os.path.basename(EXCEL)} right now ({e}). It will catch up on the next RSVP.")
    try:
        ok_planner = update_planner(rows)
    except (OSError, KeyError, ValueError, zipfile.BadZipFile) as e:
        print(f"  ! Couldn't update the planner's RSVP tab right now ({e}). If it's open in Excel, close it; "
              "it will catch up on the next RSVP or the next time the website starts.")
    return ok_rsvp, ok_planner


def migrate_old_folder():
    """Earlier versions saved RSVPs in "rsvp-responses"; carry them over once."""
    old = os.path.join(OLD_DIR, "responses.jsonl")
    if os.path.exists(old) and not os.path.exists(RECORDS):
        os.makedirs(DATA_DIR, exist_ok=True)
        shutil.copyfile(old, RECORDS)


# ---------------------------------------------------------------- web server
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def _private(self):
        p = posixpath.normpath(unquote(self.path.split("?", 1)[0].split("#", 1)[0]).lower())
        parts = [x for x in p.split("/") if x]
        return ((parts and parts[0] in ("private", "rsvp-responses"))
                or any(x.startswith(".") for x in parts)
                or p.endswith((".py", ".command", ".xlsx", ".jsonl", ".tmp")))

    def list_directory(self, path):
        self.send_error(404)  # never show folder contents
        return None

    def do_GET(self):
        if self._private():
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        if self._private():
            self.send_error(404)
            return
        super().do_HEAD()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/rsvp":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > 20000:
            return self._reply(400, {"ok": False, "error": "Empty or too large"})
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self._reply(400, {"ok": False, "error": "Could not read the form"})
        if not isinstance(data, dict):
            return self._reply(400, {"ok": False, "error": "Could not read the form"})
        row = {k: " ".join(str(data.get(k, "")).split()) if k != "requests" else str(data.get(k, "")).strip()
               for k, _, _ in COLUMNS if k != "submitted"}
        row = {k: v[:2000] for k, v in row.items()}
        if not row["first_name"] or not row["last_name"] or "@" not in row["email"] or row["attending"] not in ("Yes", "No"):
            return self._reply(400, {"ok": False, "error": "Please fill in your name, email and whether you'll attend."})
        row = {"submitted": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), **row}
        with LOCK:
            os.makedirs(DATA_DIR, exist_ok=True)
            with open(RECORDS, "a", encoding="utf-8") as f:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
            excel_ok, planner_ok = sync_files()
        print(f"  RSVP saved: {row['first_name']} {row['last_name']} ({row['attending']})")
        self._reply(200, {"ok": True, "excel_updated": excel_ok, "planner_updated": planner_ok})

    def _reply(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # keep the Terminal window quiet


def main():
    migrate_old_folder()
    if os.path.exists(RECORDS):
        with LOCK:
            sync_files()
    server = None
    for port in range(PORT, PORT + 10):
        try:
            server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            continue
    if server is None:
        sys.exit("Couldn't start: ports 8027-8036 are all busy.")
    url = f"http://localhost:{server.server_address[1]}/"
    print("\n  Briana & Ahmed wedding website is running.")
    print(f"  Open: {url}")
    print(f"  RSVPs are saved to: {EXCEL}")
    if os.path.exists(PLANNER):
        print(f"  and to the '{PLANNER_SHEET}' tab of: {PLANNER}")
    print("  To stop it, close this window (or press Control-C).\n")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")


if __name__ == "__main__":
    main()

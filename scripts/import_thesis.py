#!/usr/bin/env python3
"""Import the PRM from the thesis LaTeX sources into the YAML content files.

Usage:
    python3 scripts/import_thesis.py <thesis LaTeX dir> [--out content] [--force]

The YAML files are the source of truth once imported, and the admin panel
edits them. Run this again only to re-import, with --force to overwrite.
"""

import argparse
import re
import sys
from pathlib import Path

import yaml

ORIGINS = {
    "Standards and literature": "standards-and-literature",
    "Standards only": "standards-only",
    "Standards": "standards-only",
    "Decomposed": "decomposed",
    "Decomposed from standards": "decomposed",
}

WP_TYPES = {"I": "information-item", "A": "artifact", "R": "record"}


# --- LaTeX helpers -------------------------------------------------------

def strip_comments(tex):
    return re.sub(r"(?<!\\)%.*", "", tex)


def read_group(tex, start):
    """Return (content, end) of the {...} group opening at tex[start]."""
    assert tex[start] == "{", tex[start:start + 40]
    depth = 0
    for i in range(start, len(tex)):
        c = tex[i]
        if c == "\\":
            continue
        if c == "{" and tex[i - 1] != "\\":
            depth += 1
        elif c == "}" and tex[i - 1] != "\\":
            depth -= 1
            if depth == 0:
                return tex[start + 1:i], i + 1
    raise ValueError("Unbalanced braces")


def split_top(tex, sep):
    """Split on sep outside braces."""
    parts, depth, cur, i = [], 0, [], 0
    while i < len(tex):
        # Escaped characters such as \& or \{ never split or nest.
        if not tex.startswith(sep, i) and tex[i] == "\\" and tex[i + 1:i + 2] in ("{", "}", "&"):
            cur.append(tex[i:i + 2])
            i += 2
            continue
        if tex[i] == "{":
            depth += 1
        elif tex[i] == "}":
            depth -= 1
        if depth == 0 and tex.startswith(sep, i):
            parts.append("".join(cur))
            cur = []
            i += len(sep)
            continue
        cur.append(tex[i])
        i += 1
    parts.append("".join(cur))
    return parts


def replace_cmd(tex, name, fn):
    """Replace every \\name{arg} with fn(arg), innermost content converted first."""
    out, i, token = [], 0, "\\" + name + "{"
    while True:
        j = tex.find(token, i)
        if j < 0:
            out.append(tex[i:])
            return "".join(out)
        out.append(tex[i:j])
        arg, end = read_group(tex, j + len(token) - 1)
        out.append(fn(arg))
        i = end


def to_text(tex):
    """Convert a LaTeX fragment to plain text with Markdown emphasis."""
    t = strip_comments(tex)
    t = t.replace("\\ISOIECIEEE", "ISO/IEC/IEEE").replace("\\ISOIEC", "ISO/IEC")
    t = re.sub(r"\\allowbreak\s*", "", t)
    t = replace_cmd(t, "emph", lambda a: "*" + to_text(a) + "*")
    t = replace_cmd(t, "textit", lambda a: "*" + to_text(a) + "*")
    t = replace_cmd(t, "textbf", lambda a: "**" + to_text(a) + "**")
    t = replace_cmd(t, "texttt", lambda a: "`" + to_text(a) + "`")
    t = replace_cmd(t, "autocite", lambda a: "")
    t = replace_cmd(t, "cite", lambda a: "")
    t = re.sub(r"\$\^\{?\\dagger\}?\$", "†", t)
    t = t.replace("\\dots", "…").replace("\\ldots", "…")
    t = t.replace("\\textasciitilde", "\0").replace("\\newline", "\n")
    t = t.replace("\\&", "&").replace("\\%", "%").replace("\\_", "_").replace("\\#", "#")
    t = t.replace("``", "“").replace("''", "”").replace("---", "—").replace("--", "–")
    t = re.sub(r"(?<!\\)~", " ", t).replace("\0", "~")
    t = re.sub(r"\\[,;:! ]", " ", t)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r" *\n *", "\n", t)
    return t.strip()


def cite_keys(tex):
    keys = []
    for m in re.finditer(r"\\autocite\{([^}]*)\}", tex):
        keys += [k.strip() for k in m.group(1).split(",") if k.strip()]
    return keys


def table_rows(tex):
    """Rows of the body of a tabular, as lists of raw cells.

    A row whose single cell is a \\tabband\\multicolumn header is returned as
    {"band": text}.
    """
    t = strip_comments(tex)
    start = t.find("\\midrule")
    end = t.rfind("\\bottomrule")
    body = t[start + len("\\midrule"):end]
    rows = []
    for raw in split_top(body, "\\\\"):
        raw = re.sub(r"\\(lightrule|thinlightrule|midrule|toprule|hline)\b", "", raw)
        raw = re.sub(r"\\shortlightrule\{[^}]*\}", "", raw).strip()
        if not raw:
            continue
        if "\\multicolumn" in raw:
            j = raw.find("\\multicolumn")
            _, k = read_group(raw, raw.index("{", j))
            _, k = read_group(raw, raw.index("{", k))
            text, _ = read_group(raw, raw.index("{", k))
            rows.append({"band": to_text(text)})
            continue
        rows.append([c.strip() for c in split_top(raw, "&")])
    return rows


def items(tex):
    """Split the body of an itemize/enumerate into its \\item contents."""
    parts = re.split(r"\\item\b", tex)
    return [p.strip() for p in parts[1:]]


def env_body(tex, env):
    m = re.search(r"\\begin\{" + env + r"\}(\[[^\]]*\])?", tex)
    if not m:
        return None
    # Skip the optional argument, which may contain nested brackets.
    i = m.start() + len("\\begin{" + env + "}")
    if tex[i] == "[":
        depth = 0
        for k in range(i, len(tex)):
            depth += {"[": 1, "]": -1}.get(tex[k], 0)
            if depth == 0:
                i = k + 1
                break
    end = tex.index("\\end{" + env + "}", i)
    return tex[i:end]


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


# --- Processes -----------------------------------------------------------

def parse_io(body):
    result = []
    for it in items(env_body(body, "itemize") or ""):
        serves = []
        m = re.search(r"\\prmserves\{([^}]*)\}", it)
        if m:
            serves = [s.strip() for s in m.group(1).split(",") if s.strip()]
            it = it[:m.start()] + it[m.end():]
        text = to_text(it)
        name, _, desc = text.partition(":")
        name = name.strip()
        optional = name.endswith("(optional)")
        name = name.removesuffix("(optional)").strip()
        io = {"workProduct": slug(name), "name": name, "description": desc.strip(), "serves": serves}
        if optional:
            io["optional"] = True
        result.append(io)
    return result


def parse_activities(body):
    enum = env_body(body, "enumerate")
    activities = []
    for n, it in enumerate(items(enum or ""), 1):
        studies, literature = [], []
        m = re.search(r"\\prmsources\{", it)
        if m:
            a, k = read_group(it, m.end() - 1)
            b, _ = read_group(it, it.index("{", k))
            studies = [s.strip() for s in a.split(",") if s.strip()]
            literature = cite_keys(b)
            it = it[:m.start()]
        title_tex, rest = "", it
        m = re.match(r"\s*\\textbf\{", it)
        if m:
            title_tex, k = read_group(it, m.end() - 1)
            rest = it[k:]
        title = to_text(title_tex).rstrip(":").strip()
        act = {"id": f"A{n}", "title": title, "description": to_text(rest)}
        if studies:
            act["primaryStudies"] = studies
        if literature:
            act["literature"] = literature
        activities.append(act)
    return activities


def parse_process(path):
    tex = strip_comments(path.read_text(encoding="utf-8"))
    m = re.search(r"\\begin\{prmprocess\}(\[[^\]]*\])?\{", tex)
    name, _ = read_group(tex, m.end() - 1)
    body = tex[m.end():tex.rindex("\\end{prmprocess}")]
    # Activities may be wrapped in prmactivities (v1) or follow the field (v2).
    body = body.replace("\\begin{prmactivities}", "\\prmfield{Activities}")
    body = body.replace("\\end{prmactivities}", "")
    fields = {}
    chunks = re.split(r"\\prmfield\{([^}]*)\}", body)
    for k in range(1, len(chunks), 2):
        fields[chunks[k]] = chunks[k + 1]
    outcomes = []
    for k, it in enumerate(items(env_body(fields["Outcomes"], "enumerate") or "")):
        outcomes.append({"id": chr(ord("a") + k), "text": to_text(it)})
    return {
        "name": to_text(name),
        "purpose": to_text(fields["Purpose"]),
        "outcomes": outcomes,
        "inputs": parse_io(fields.get("Inputs", "")),
        "outputs": parse_io(fields.get("Outputs", "")),
        "activities": parse_activities(fields.get("Activities", "")),
    }


def parse_summary(path):
    """Process number -> origin, from the PRM overview table."""
    origins = {}
    for row in table_rows(path.read_text(encoding="utf-8")):
        if isinstance(row, list) and len(row) >= 3 and row[0].isdigit():
            origins[int(row[0])] = ORIGINS[to_text(row[2])]
    return origins


def parse_work_products(path):
    wps = {}
    external = False
    for row in table_rows(path.read_text(encoding="utf-8")):
        if isinstance(row, dict):
            external = "outside" in row["band"]
            continue
        if len(row) < 2:
            continue
        name = to_text(row[0])
        wps[slug(name)] = {"type": WP_TYPES.get(to_text(row[1]), "information-item"),
                           "external": external}
    return wps


def parse_trace(path, names_to_ids):
    """Standard activities traced to one PRM process (v1 numbering).

    "Mapping" tables pair the activities of one standard process with the
    activities of the PRM process. "Decomposition" tables spread a standard
    process over several PRM processes and mark the one they describe in bold;
    only the rows of that process are kept.
    """
    tex = strip_comments(path.read_text(encoding="utf-8"))
    i = tex.index("\\caption") + len("\\caption")
    # Skip the optional short caption, which may not name the process.
    if tex[i] == "[":
        depth = 0
        for k in range(i, len(tex)):
            depth += {"[": 1, "]": -1}.get(tex[k], 0)
            if depth == 0:
                i = k + 1
                break
    caption, _ = read_group(tex, tex.index("{", i))
    focal = next(i for n, i in names_to_ids.items() if f"*{n}*" in to_text(caption))
    header = re.search(r"\\textbf\{(.*?)Activity\}\s*&", tex)
    standard = to_text(header.group(1)).strip() if header else ""
    std_process, last_activity, last_target = "", "", ""
    rows = []
    for row in table_rows(tex):
        if isinstance(row, dict):
            band = row["band"].strip("*")
            m = re.match(r"(ISO/IEC(?:/IEEE)? \d+)\s+(.*)", band)
            std_process = m.group(2) if m else band
            if m:
                standard = m.group(1)
            continue
        if len(row) < 2:
            continue
        activity = to_text(row[0]).replace("**", "")
        target = to_text(row[1]).replace("**", "").strip("*").strip()
        bold = "\\textbf" in row[1]
        # Empty cells continue the merged cell above them.
        activity = activity or last_activity
        target = target or last_target
        last_activity, last_target = activity, target
        if not target:
            continue
        entry = {"standard": standard, "activity": "" if activity == "–" else activity}
        if std_process:
            entry["standardProcess"] = std_process
        m = re.match(r"(A\d+)\.?\s*(.*)", target)
        if m:
            entry["prmActivity"] = m.group(1)
        elif names_to_ids.get(target) == focal:
            pass
        elif bold:
            entry["note"] = target
        else:
            continue
        rows.append(entry)
    return focal, rows


def votes(cell):
    """Vote count of a cell; annotations raised elsewhere show a dash."""
    text = to_text(cell)
    return int(text) if text.isdigit() else None


CHANGE_KINDS = {"+": "added", "~": "updated", "–": "removed"}


def change(line):
    """'(+) A5: text' -> {kind: added, target: A5, text: text}."""
    m = re.match(r"\((.)\)\s*(.*)", line.strip())
    kind, rest = (CHANGE_KINDS.get(m.group(1), "updated"), m.group(2)) if m else ("updated", line.strip())
    target, sep, text = rest.partition(":")
    if not sep or len(target) > 40:
        return {"kind": kind, "text": rest}
    return {"kind": kind, "target": target.strip(), "text": text.strip()}


def parse_changes(path):
    changes = []
    for row in table_rows(path.read_text(encoding="utf-8")):
        if isinstance(row, dict) or len(row) < 6:
            continue
        ident = to_text(row[0])
        changes.append({
            "annotation": ident.replace("†", "").strip(),
            "raisedElsewhere": "†" in ident or None,
            "text": to_text(row[1]),
            "redVotes": votes(row[2]),
            "yellowVotes": votes(row[3]),
            "decision": to_text(row[4]).lower(),
            "changes": [change(l) for l in to_text(row[5]).split("\n") if l.strip() not in ("", "–")],
        })
        if not changes[-1]["raisedElsewhere"]:
            del changes[-1]["raisedElsewhere"]
    return changes


# --- Studies and bibliography -------------------------------------------

def parse_studies(path):
    studies = []
    for row in table_rows(path.read_text(encoding="utf-8")):
        if isinstance(row, dict) or len(row) < 5:
            continue
        keys = cite_keys(row[0])
        studies.append({
            "id": to_text(row[0]),
            "title": to_text(row[1]),
            "year": int(to_text(row[2])),
            "source": to_text(row[3]),
            "type": {"J": "journal", "C": "conference", "O": "online"}.get(to_text(row[4]), "other"),
            "reference": keys[0] if keys else None,
        })
    return studies


def parse_bib(path, wanted):
    tex = path.read_text(encoding="utf-8")
    entries = {}
    for m in re.finditer(r"@(\w+)\s*\{\s*([^,\s]+)\s*,", tex):
        key = m.group(2)
        if key not in wanted:
            continue
        body, _ = read_group(tex, tex.index("{", m.start()))
        fields = {}
        for f in re.finditer(r"(\w+)\s*=\s*", body):
            pos = f.end()
            if body[pos] == "{":
                val, _ = read_group(body, pos)
            elif body[pos] == '"':
                val = body[pos + 1:body.index('"', pos + 1)]
            else:
                val = re.match(r"[^,\n]*", body[pos:]).group(0)
            fields.setdefault(f.group(1).lower(), to_text(val.replace("{", "").replace("}", "")))
        entry = {
            "key": key,
            "authors": fields.get("author", ""),
            "title": fields.get("title", ""),
            "year": fields.get("year") or fields.get("date", "")[:4],
        }
        for f in ("journaltitle", "journal", "booktitle", "publisher", "doi", "url"):
            if fields.get(f):
                entry["venue" if f in ("journaltitle", "journal", "booktitle") else f] = fields[f]
        entries[key] = entry
    return [entries[k] for k in sorted(entries)]


# --- Output --------------------------------------------------------------

class Dumper(yaml.SafeDumper):
    pass


def _str(dumper, data):
    style = "|" if "\n" in data else ">" if len(data) > 80 else None
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style=style)


Dumper.add_representer(str, _str)


def write(path, data, force):
    if path.exists() and not force:
        print(f"skip {path} (exists, use --force)")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.dump(data, Dumper=Dumper, sort_keys=False, allow_unicode=True, width=100),
                    encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("thesis", type=Path)
    ap.add_argument("--out", type=Path, default=Path("content"))
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    src, out = args.thesis, args.out
    tables = src / "tables"

    origins = parse_summary(tables / "04_results/prm_summary.tex")
    wp_meta = parse_work_products(tables / "04_results/prm_information_items.tex")

    versions = {}
    for version, folder, suffix in (("v1", "v1", ""), ("v2", "v2", "_v2")):
        procs = []
        for n in range(1, 26):
            p = parse_process(tables / f"prm/{folder}/P{n:02d}{suffix}.tex")
            p = {"id": f"P{n:02d}", "number": n, "origin": origins[n], **p}
            procs.append(p)
        versions[version] = procs

    names_to_ids = {p["name"]: p["id"] for p in versions["v1"]}

    for n in range(1, 26):
        f = tables / f"05_validation/process_changes/changes_p{n:02d}.tex"
        if f.exists():
            versions["v2"][n - 1]["changes"] = parse_changes(f)

    for f in sorted(tables.glob("04_results/prm_activities_*.tex")):
        focal, rows = parse_trace(f, names_to_ids)
        versions["v1"][int(focal[1:]) - 1]["standards"] = rows

    # The second version drops the sources from the specification. Carry them
    # over for the activities whose title did not change.
    carried = 0
    for p1, p2 in zip(versions["v1"], versions["v2"]):
        by_title = {a["title"]: a for a in p1["activities"]}
        for a in p2["activities"]:
            old = by_title.get(a["title"])
            if old and "primaryStudies" not in a and "literature" not in a:
                for k in ("primaryStudies", "literature"):
                    if k in old:
                        a[k] = old[k]
                carried += 1

    cited = set()
    for procs in versions.values():
        for p in procs:
            for a in p["activities"]:
                cited.update(a.get("literature", []))

    studies = parse_studies(tables / "02_literature_review/selected_studies.tex")
    cited.update(s["reference"] for s in studies if s["reference"])
    refs = parse_bib(src / "references.bib", cited)

    for version, procs in versions.items():
        for p in procs:
            write(out / f"prm/{version}/processes/en/{p['id']}.yaml", p, args.force)
        produced = {}
        for p in procs:
            for io in p["inputs"] + p["outputs"]:
                produced.setdefault(io["workProduct"], {"id": io["workProduct"]})
        wps = []
        for wid in sorted(produced):
            meta = wp_meta.get(wid, {"type": "information-item", "external": False})
            wps.append({"id": wid, **meta})
        write(out / f"prm/{version}/work-products.yaml", {"workProducts": wps}, args.force)

    write(out / "studies.yaml", {"studies": studies}, args.force)
    write(out / "references.yaml", {"references": refs}, args.force)

    missing = sorted(cited - {r["key"] for r in refs})
    print(f"Imported {sum(len(v) for v in versions.values())} processes, "
          f"{len(studies)} studies, {len(refs)} references; "
          f"carried sources to {carried} unchanged v2 activities.")
    unknown = sorted({io["workProduct"] for procs in versions.values() for p in procs
                      for io in p["inputs"] + p["outputs"]} - set(wp_meta))
    if unknown:
        print("Work products not in the information items table:", ", ".join(unknown))
    if missing:
        print("References not found in the bibliography:", ", ".join(missing), file=sys.stderr)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build one page per Inhabit team member from the bios doc and the Our Team cards.

Inputs
  tools/bios-source.txt    plain-text download of "Inhabit Agent Bios: Before + After"
  tools/staff-bios.json    staff bios copied word for word from the current site
  tools/agent-template.html  Dara's page with the person-specific parts marked
  tools/agent-parts.txt      listings, awards and reviews blocks (agents and leadership only)
  team.html                names, roles, groups and headshots (one card per person)

Outputs
  agent-<first>-<last>.html for every card, and team.html with each card linked
  to its own page.

To fold in Tammi's edits: download the doc as plain text again, save it over
tools/bios-source.txt, and rerun this script. Running it twice gives the same result.
bios-source.txt holds internal review notes, so it stays out of this public repo
(see tools/.gitignore); a copy lives in the Inhabit project files.
"""
import html, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
PLACEHOLDER_DESC = "[Descriptor line to come]"
BANNED = ["RF050125-9", "Samantha"]

# Headshots served from this repo instead of Squarespace. Jonathan's Squarespace file
# (a PNG screenshot) shows as a broken image in iPhone Safari, so a JPG copy lives here.
PHOTO_OVERRIDES = {
    "jonathan rand": "assets/photos/headshot-jonathan-rand.jpg",
}

# Our Team sections, top to bottom: (data-group, heading, filter label)
GROUPS = [
    ("leadership", "Leadership Team", "Leadership"),
    ("agent", "Our Brokers", "Brokers"),
    ("staff", "Staff", "Staff"),
]
GROUP_CSS = (".team-group .sec-title{margin-top:44px}.team-group:first-of-type .sec-title{margin-top:20px}"
             ".team-group .cards-b{margin-top:14px}")


def slug(name):
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"agent-{s}.html"


def first_name(name):
    return name.split()[0]


def smart(text):
    """Escape for HTML and use curly apostrophes, as the rest of the site does."""
    return html.escape(text, quote=False).replace("'", "&rsquo;")


def parse_bios(path):
    lines = [l.strip() for l in path.read_text(encoding="utf-8").splitlines()]
    people, cur, mode = {}, None, None
    for line in lines:
        m = re.match(r"^(.+?) · (.+)$", line)
        if m and not line.startswith("*"):
            cur = {"name": m.group(1).strip(), "after": []}
            people[cur["name"].lower()] = cur
            mode = None
            continue
        if cur is None:
            continue
        if line in ("Before", "After"):
            mode = line
            continue
        if line in ("Leadership", "Agents") or line.startswith("Staff ("):
            cur, mode = None, None
            continue
        if not line or set(line) <= {"_"} or line.startswith("Note"):
            continue
        if mode == "After":
            cur["after"].append(line)
    out = {}
    for key, p in people.items():
        if p["after"]:
            out[key] = {"descriptor": p["after"][0], "bio": p["after"][1:]}
    return out


def parse_cards(team_html):
    cards = []
    for m in re.finditer(r'<li data-group="(\w+)" data-name="([^"]+)"><a href="[^"]*">(.*?)</a></li>', team_html, re.S):
        group, key, inner = m.groups()
        img = re.search(r'<img src="([^"]+)"', inner).group(1)
        name = html.unescape(re.search(r"<h3>([^<]+)</h3>", inner).group(1))
        role = html.unescape(re.search(r'<p class="role">([^<]+)</p>', inner).group(1))
        d = re.search(r"<p class=d>([^<]+)</p>", inner)
        cards.append({"group": group, "key": key, "name": name, "role": role,
                      "img": img, "card_desc": html.unescape(d.group(1)) if d else None})
    return cards


def img_at(url, width):
    return re.sub(r"format=\d+w", f"format={width}w", url)


def group_team(team):
    """Split the one card grid into Leadership, Brokers and Staff sections (once)."""
    if 'class="team-group"' not in team:
        m = re.search(r'<ul class="cards-b">(.*?)</ul>', team, re.S)
        items = re.findall(r'<li data-group="\w+".*?</li>', m.group(1), re.S)
        sections = []
        for key, heading, _ in GROUPS:
            mine = "".join(i for i in items if i.startswith(f'<li data-group="{key}"'))
            sections.append(f'<section class="team-group" aria-labelledby="g-{key}"><div class="sec-title">'
                            f'<h2 id="g-{key}">{heading}</h2></div><ul class="cards-b">{mine}</ul></section>')
        assert sum(s.count("<li ") for s in sections) == len(items)
        team = team[:m.start()] + "\n".join(sections) + team[m.end():]
        team = team.replace("</style>", GROUP_CSS + "\n</style>", 1)
    # filter chips follow the section order and names
    counts = {k: len(re.findall(f'<li data-group="{k}"', team)) for k, _, _ in GROUPS}
    chips = "\n".join(f'<button type="button" data-filter="{k}" aria-pressed="false">{label} ({counts[k]})</button>'
                      for k, _, label in GROUPS)
    team = re.sub(r'(<button type="button" data-filter="all" aria-pressed="true">[^<]*</button>\n).*?(</div><p id="count")',
                  lambda m: m.group(1) + chips + m.group(2), team, flags=re.S)
    # hide a section's heading when the filter or search leaves it empty
    hook = "if(count)count.textContent="
    if "team-group" not in team.split("<script>")[-1]:
        team = team.replace(hook, "[].forEach.call(document.querySelectorAll('.team-group'),function(s){"
                            "s.hidden=!s.querySelector('[data-group]:not([hidden])');});" + hook, 1)
    return team


def split_bio(paras):
    """Dara's sample splits a long one-paragraph bio in two at a sentence break. Same words."""
    if len(paras) != 1 or len(paras[0].split()) < 70:
        return paras
    text = paras[0]
    breaks = [m.end() for m in re.finditer(r"[.!?)](?=\s+[A-Z(])", text)]
    if not breaks:
        return paras
    mid = len(text) / 2
    cut = min(breaks, key=lambda b: abs(b - mid))
    return [text[:cut].strip(), text[cut:].strip()]


def bio_html(first, paras):
    if not paras:
        return (f'<div class="slot2"><strong>{smart(first)}&rsquo;s bio goes here</strong>'
                f'Carried over word for word from the current site.</div>')
    paras = split_bio(paras)
    out = []
    for i, p in enumerate(paras):
        style = ' style="margin:0"' if i == len(paras) - 1 else ""
        out.append(f"   <p{style}>{smart(p)}</p>")
    return "\n" + "\n".join(out)


def more_html(cards, i):
    picks = [cards[(i + k) % len(cards)] for k in range(1, 5)]
    items = "".join(
        f'<li><a href="{slug(c["name"])}"><div class="ph"><img src="{img_at(c["img"], 500)}" alt="" loading="lazy"></div>'
        f'<h3>{smart(c["name"])}</h3></a></li>' for c in picks)
    return f'<ul class="more" style="margin-top:14px">{items}</ul>'


def load_parts(path):
    parts, cur = {}, None
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("=== "):
            cur = line[4:].strip()
            parts[cur] = []
        elif cur:
            parts[cur].append(line)
    return {k: "\n".join(v) for k, v in parts.items()}


def build():
    parts = load_parts(TOOLS / "agent-parts.txt")
    bios = parse_bios(TOOLS / "bios-source.txt")
    staff = json.loads((TOOLS / "staff-bios.json").read_text(encoding="utf-8"))
    tpl = (TOOLS / "agent-template.html").read_text(encoding="utf-8")
    team_path = ROOT / "team.html"
    team = group_team(team_path.read_text(encoding="utf-8"))
    for key, photo in PHOTO_OVERRIDES.items():
        team = re.sub(r'(<li data-group="\w+" data-name="' + re.escape(key) + r'"><a href="[^"]*"><div class="ph"><img src=")[^"]*(")',
                      lambda m: m.group(1) + photo + m.group(2), team)
    cards = parse_cards(team)
    report = {"built": [], "placeholder_bio": [], "no_descriptor": [], "bios_without_card": []}

    for i, c in enumerate(cards):
        first = first_name(c["name"])
        if c["group"] == "staff":
            s = staff.get(c["key"])
            desc = (s or {}).get("descriptor") or c["card_desc"]
            paras = (s or {}).get("bio") or []
        else:
            b = bios.get(c["key"])
            if not b:
                sys.exit(f"No After text in the bios doc for {c['name']}")
            desc, paras = b["descriptor"], b["bio"]
        if desc == PLACEHOLDER_DESC:
            desc = None
        if not desc:
            report["no_descriptor"].append(c["name"])
        if not paras:
            report["placeholder_bio"].append(c["name"])
        role_html = smart(c["role"]).replace("®", "&reg;")
        is_staff = c["group"] == "staff"
        page = (tpl
                .replace("{{LISTINGS_BTN}}", "" if is_staff else parts["LISTINGS_BTN"])
                .replace("{{SIDE}}", "" if is_staff else "\n" + parts["SIDE"])
                .replace("{{LISTINGS}}", "" if is_staff else "\n" + parts["LISTINGS"])
                .replace("{{NAME}}", smart(c["name"]))
                .replace("{{NAME_ATTR}}", html.escape(c["name"]))
                .replace("{{FIRST}}", smart(first))
                .replace("{{ROLE}}", role_html)
                .replace("{{ROLE_TEXT}}", html.escape(c["role"]))
                .replace("{{PHOTO}}", img_at(c["img"], 1000))
                .replace("{{TAG}}", f'\n   <p class="tag">{smart(desc)}</p>' if desc else "")
                .replace("{{BIO}}", bio_html(first, paras))
                .replace("{{MORE}}", more_html(cards, i)))
        if "{{" in page:
            sys.exit(f"Unfilled marker on {c['name']}'s page")
        (ROOT / slug(c["name"])).write_text(page, encoding="utf-8")
        report["built"].append(slug(c["name"]))
        # point this person's card(s) at their own page
        team = re.sub(r'(<li data-group="\w+" data-name="' + re.escape(c["key"]) + r'"><a href=")[^"]*(")',
                      r"\g<1>" + slug(c["name"]) + r"\2", team)

    card_keys = {c["key"] for c in cards}
    report["bios_without_card"] = sorted(k for k in bios if k not in card_keys)

    # Becky's note: Tammi and Connie alone at the top read as the whole team. Drop that block;
    # they stay in the grid and under the Leadership filter.
    team = re.sub(r'<div class="leads4" aria-label="Led by">.*?</a></div>', "", team, flags=re.S)
    team = team.replace(
        "@media(min-width:900px){.thead4{grid-template-columns:1.5fr 1fr;padding:32px 40px;gap:36px}}",
        "@media(min-width:900px){.thead4{padding:32px 40px}}")
    team_path.write_text(team, encoding="utf-8")

    for f in [team_path] + [ROOT / s for s in report["built"]]:
        t = f.read_text(encoding="utf-8")
        for b in BANNED:
            if b in t:
                sys.exit(f"Hard rule: {b} found in {f.name}")
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    build()

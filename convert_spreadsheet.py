"""Converts master_card_catalog xlsx -> data.json for the app.
Usage: python convert_spreadsheet.py master_card_catalog-v74.xlsx"""
import sys, re, json
from openpyxl import load_workbook

src = sys.argv[1] if len(sys.argv) > 1 else "master_card_catalog-v74.xlsx"
wb = load_workbook(src, data_only=True)
S = lambda v: "" if v is None else str(v).strip()
def num(v):
    try: return int(float(v))
    except: return 0

def card_row(r):
    r = list(r) + [None] * 15
    return {"name": S(r[0]), "source": S(r[1]), "colors": S(r[2]), "cost": S(r[3]), "cmc": S(r[4]),
            "type": S(r[5]), "subtype": S(r[6]), "power": S(r[7]), "toughness": S(r[8]),
            "text": S(r[9]), "keywords": S(r[10]), "legal": S(r[11]), "qty": num(r[12]),
            "finish": S(r[13]), "status": S(r[14])}

# ---- Master catalog
cards = []
for r in list(wb["Master Card Catalog"].iter_rows(values_only=True))[1:]:
    if r[0] and r[1] is not None and r[12] is not None:
        cards.append(card_row(r))

# ---- Decks
decks, cur, mode = [], None, None
for r in wb["Deck Inventories"].iter_rows(values_only=True):
    a = S(r[0])
    if not a: continue
    rest = [c for c in r[1:] if c is not None]
    if "SLEEVE COLOR" in a and " — " in a and not rest:
        t = re.sub(r"^\d+\.\s*", "", a.split(" | ")[0])
        title = t.split(" — ")[0].strip()
        sleeve = a.split("SLEEVE COLOR:")[-1].strip()
        cur = {"name": title.title() if title.isupper() else title, "sleeve": sleeve,
               "format": "Commander" if "COMMANDER" in a.upper() else "Casual", "commander": "", "info": "", "cards": [], "tokens": []}
        decks.append(cur); mode = None; continue
    if cur is None: continue
    if a.startswith("Format:"):
        cur["info"] = a
        m = re.search(r"Commander:\s*([^|]+)", a)
        if m: cur["commander"] = m.group(1).strip()
        continue
    if a == "Card Name": mode = "cards"; continue
    if "TOKENS" in a and not rest: mode = "tokens"; continue
    if a.startswith("Total") or not rest: continue
    if mode in ("cards", "tokens") and len(r) > 12 and r[12] is not None:
        c = card_row(r)
        cur["cards" if mode == "cards" or c["type"] != "Token" and not c["name"].startswith("Token") else "tokens"].append(c) if mode == "cards" else cur["tokens"].append(c)
for d in decks:  # slim deck cards to name/qty/finish (specs live in master catalog; keep full row if not in catalog)
    names = {c["name"] for c in cards}
    d["cards"] = [c if c["name"] not in names else {"name": c["name"], "qty": c["qty"], "finish": c["finish"]} for c in d["cards"]]
    d["total"] = sum(c["qty"] for c in d["cards"])

# ---- Cross reference (swap log)
swaps, deck, sec, hdr = [], "", "", []
for r in wb["Deck Cross-Reference"].iter_rows(values_only=True):
    a = S(r[0])
    if not a: continue
    rest = [S(c) for c in r[1:] if c is not None]
    if "SLEEVE COLOR" in a and not rest: deck = a.split(" (")[0].title(); continue
    if a.startswith("Section"): sec = a; continue
    if a == "Card Name": hdr = [S(c) for c in r[:6]]; continue
    if a.startswith("None currently") or a.startswith("MAGIC") or a.startswith("Card Swap"): continue
    swaps.append({"deck": deck, "section": sec, "header": hdr, "row": [S(c) for c in r[:6]]})

# ---- Generic table sections (matchups)
def sections(ws):
    out, cur = [], None
    for r in ws.iter_rows(values_only=True):
        vals = [S(c) for c in r]
        if not any(vals): continue
        if vals[0] and not any(vals[1:]):
            cur = {"title": vals[0], "rows": []}; out.append(cur)
        elif cur is not None:
            while vals and not vals[-1]: vals.pop()
            cur["rows"].append(vals)
    return [s for s in out[1:] if s["rows"]]
matchups = sections(wb["Deck Matchup Analytics"])

# ---- Sleeves
sleeves = []
for r in wb["Raw Source Log"].iter_rows(min_row=6, max_row=17, values_only=True):
    if r[0]: sleeves.append({"color": S(r[0]), "total": num(r[1]), "deck": S(r[3]) if S(r[3]) != "Unassigned" else "", "inUse": num(r[4])})

json.dump({"cards": cards, "decks": decks, "swaps": swaps, "matchups": matchups, "sleeves": sleeves},
          open("data.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(cards), "cards;", [(d["name"], d["format"], d["total"], len(d["tokens"])) for d in decks],
      len(swaps), "swap rows;", len(matchups), "matchup sections;", len(sleeves), "sleeves")

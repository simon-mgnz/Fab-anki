# Regenerates decks/card-counts.json so the deck browser can show
# due/new totals without fetching every XML file.
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DECKS = os.path.join(ROOT, "decks")
OUT = os.path.join(DECKS, "card-counts.json")
CARD_OPEN = re.compile(r"<card(?:\s|>|/)", re.I)

def main():
    counts = {}
    for dirpath, _, files in os.walk(DECKS):
        for name in files:
            if not name.lower().endswith(".xml"):
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, DECKS).replace("\\", "/")
            with open(full, "r", encoding="utf-8", errors="ignore") as fh:
                text = fh.read()
            counts[rel] = len(CARD_OPEN.findall(text))
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(counts, fh, ensure_ascii=False, indent=2, sort_keys=True)
        fh.write("\n")
    print(f"Wrote {len(counts)} decks, {sum(counts.values())} cards -> {OUT}")

if __name__ == "__main__":
    main()

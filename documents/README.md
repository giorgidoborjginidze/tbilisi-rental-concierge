# Clinical trial labels — protocol PB-115-GT-211

`PB-115-GT-211_labels.docx` — print-ready label sheets for A4 self-adhesive paper.

Sheet 1 is a cover/instruction page; sheets 2–27 are the labels (235 in total).

| # | Product | Label size (mm) | Qty | Per sheet | Sheets | Pages |
|---|---------|-----------------|-----|-----------|--------|-------|
| 1 | Loratadine | 115 × 50 | 54 | 8 (landscape) | 7 | 2–8 |
| 2 | Quamatel | 100 × 45 | 27 | 12 | 3 | 9–11 |
| 3 | Naproxen | 95 × 85 | 28 | 6 | 5 | 12–16 |
| 4 | Famotidine | 85 × 45 | 84 | 12 | 7 | 17–23 |
| 5 | Prednisolon Cortico | 100 × 45 | 42 | 12 | 4 | 24–27 |

Label sizes are taken from the largest (front) face of each carton. Labels butt up
against each other so the thin border doubles as the cut line; the leftover paper is
split evenly into top/bottom and left/right margins (4 mm minimum).

Print at 100% scale — no "fit to page".

## Regenerating

```bash
npm install docx
node documents/scripts/generate-labels.js documents/PB-115-GT-211_labels.docx
```

Edit the `PRODUCTS` table at the top of the script to change quantities, label sizes,
grid layout or font size.

# Clinical trial labels — protocol PB-115-GT-211

`PB-115-GT-211_labels.docx` — print-ready label sheets for A4 self-adhesive paper.

Sheet 1 is a cover/instruction page; sheets 2–7 carry the labels.

- **Label size:** 67 × 20.5 mm, identical for every product
- **Per A4 sheet:** 3 across × 14 down = 42 labels
- **Total:** 235 labels → 6 sticker sheets (25 labels on the last one)

| # | Product | Carton (cm) | Labels |
|---|---------|-------------|--------|
| 1 | Loratadine | 11.5 × 5 × 2 | 54 |
| 2 | Quamatel | 10 × 4.5 × 2 | 27 |
| 3 | Naproxen | 9.5 × 8.5 × 2 | 28 |
| 4 | Famotidine | 8.5 × 4.5 × 2 | 84 |
| 5 | Prednisolon Cortico | 10 × 4.5 × 3 | 42 |
| | | **Total** | **235** |

Because every label is identical, the sheets are not split per product — cut and
count against the table above. 67 × 20.5 mm fits the front face of every carton
(the smallest is Famotidine at 85 × 45 mm).

Labels butt up against each other so the 0.5 pt border doubles as the cut line; the
leftover paper is split into ~4.5 mm margins. Print at 100% scale — no "fit to page".

## Regenerating

```bash
npm install docx
node documents/scripts/generate-labels.js documents/PB-115-GT-211_labels.docx
```

The constants at the top of the script (`COLS`, `ROWS`, `LW`, `LH`, `FSIZE`) control
the grid; `PRODUCTS` controls the quantities on the cover page and the total.

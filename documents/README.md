# Clinical trial labels — protocol PB-115-GT-211

`PB-115-GT-211_labels.docx` — laid out for **TW-2040** A4 label sheets.

- **Label:** 52.5 × 29.7 mm
- **Per sheet:** 4 across × 10 down = 40
- **Total:** 235 labels → 6 sheets (35 on the last one)
- **Page:** A4 portrait, all margins 0 — the grid covers the sheet edge to edge,
  4 × 52.5 = 210 mm and 10 × 29.7 = 297 mm, no gaps

The document is nothing but the label grid, so page 1 is already a label sheet —
print all 6 pages onto TW-2040 stock at 100% scale ("Actual size", never "Fit to page").

Label text is identical on every one:

```
პროტოკოლის ნომერი:
PB-115-GT-211
გამოიყენება მხოლოდ
კლინიკური კვლევებისთვის
```

Set in 9 pt Sylfaen, centred in the die-cut cell: the text block measures about
42 × 14.5 mm, leaving ≥5 mm horizontally and ≥7 mm vertically to the cut edge, so
normal printer registration drift cannot clip it.

| # | Product | Carton (cm) | Labels |
|---|---------|-------------|--------|
| 1 | Loratadine | 11.5 × 5 × 2 | 54 |
| 2 | Quamatel | 10 × 4.5 × 2 | 27 |
| 3 | Naproxen | 9.5 × 8.5 × 2 | 28 |
| 4 | Famotidine | 8.5 × 4.5 × 2 | 84 |
| 5 | Prednisolon Cortico | 10 × 4.5 × 3 | 42 |
| | | **Total** | **235** |

Every label is identical, so the sheets are not split per product — count against the
table above as they come off the sheet.

## Regenerating

```bash
npm install docx
node documents/scripts/generate-labels.js documents/PB-115-GT-211_labels.docx

# dry run on plain paper: adds hairline cell outlines to check registration
node documents/scripts/generate-labels.js /tmp/check.docx --guides
```

Constants at the top of the script control the sheet: `COLS`/`ROWS`, `LW`/`LH`,
`PAD` and `FSIZE`. `PRODUCTS` only sets the total that gets printed.

Two things the script is deliberate about, and that any edit has to preserve:

- **Row heights are floored, not rounded** (`dxa()`). 29.7 mm rounds up to 1684
  twips; ten of those is 16840 against A4's 16838, and Word drops the tenth row
  onto a new page. Flooring to 1683 keeps 10 rows per sheet.
- **It emits one continuous 59-row table**, not one table per sheet. The grid fills
  the page exactly, so a page-break paragraph between per-sheet tables gets a page
  of its own and the file comes out 11 pages instead of 6. Exact row heights make
  Word paginate the single table into perfect sheets by itself.

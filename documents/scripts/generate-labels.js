// TW-2040 label sheet: A4, 4 across x 10 down, 52.5 x 29.7 mm, no margins, no gaps.
// Usage: node generate-labels.js <out.docx> [--guides]
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType,
  Table, TableRow, TableCell, TableLayoutType, WidthType, HeightRule,
  VerticalAlign, PageOrientation, BorderStyle,
} = require('docx');

const MM = 56.6929;                            // 1 mm in DXA (twips)
const dxa = (v) => Math.floor(v * MM);         // floor, never round: a single twip
                                               // of overshoot pushes a row to the next page
const FONT = 'Sylfaen';                        // standard Georgian-capable font

const PROTOCOL = 'PB-115-GT-211';
const LINES = [
  ['პროტოკოლის ნომერი:', false],
  [PROTOCOL, true],
  ['გამოიყენება მხოლოდ', false],
  ['კლინიკური კვლევებისთვის', false],
];

// ---- TW-2040 geometry -----------------------------------------------------
const COLS = 4, ROWS = 10;
const LW = 52.5, LH = 29.7;                    // mm — 4x52.5 = 210, 10x29.7 = 297 (full A4)
const PAD = 2;                                 // mm of horizontal padding inside each label
const FSIZE = 9;                               // pt
const PER_PAGE = COLS * ROWS;                  // 40

const PRODUCTS = [
  { name: 'Loratadine',          box: '11.5 × 5 × 2',  qty: 54 },
  { name: 'Quamatel',            box: '10 × 4.5 × 2',  qty: 27 },
  { name: 'Naproxen',            box: '9.5 × 8.5 × 2', qty: 28 },
  { name: 'Famotidine',          box: '8.5 × 4.5 × 2', qty: 84 },
  { name: 'Prednisolon Cortico', box: '10 × 4.5 × 3',  qty: 42 },
];
const TOTAL = PRODUCTS.reduce((s, p) => s + p.qty, 0);   // 235
const SHEETS = Math.ceil(TOTAL / PER_PAGE);              // 6

// The sheet is die-cut, so borders are off by default; --guides turns on hairlines
// for a dry run on plain paper (hold it against a label sheet to check registration).
const GUIDES = process.argv.includes('--guides');
const edge = GUIDES
  ? { style: BorderStyle.SINGLE, size: 2, color: 'BFBFBF' }
  : { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const borders = { top: edge, bottom: edge, left: edge, right: edge };

const labelCell = () => new TableCell({
  width: { size: dxa(LW), type: WidthType.DXA },
  verticalAlign: VerticalAlign.CENTER,
  borders,
  children: LINES.map(([text, bold]) => new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0, line: 240, lineRule: 'auto' },
    children: [new TextRun({ text, bold, size: FSIZE * 2, font: FONT })],
  })),
});

const blankCell = () => new TableCell({
  width: { size: dxa(LW), type: WidthType.DXA },
  borders: { top: edge, bottom: edge, left: edge, right: edge },
  children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
});

// One continuous table: the grid fills the sheet edge to edge, so a page-break
// paragraph between per-sheet tables would land on a page of its own. With exact
// 29.7 mm rows, 10 fit a 297 mm page and an 11th cannot, so Word paginates it
// into perfect sheets on its own.
const NROWS = Math.ceil(TOTAL / COLS);
const rows = [];
for (let r = 0; r < NROWS; r++) {
  const cells = [];
  for (let c = 0; c < COLS; c++) cells.push(r * COLS + c < TOTAL ? labelCell() : blankCell());
  rows.push(new TableRow({ height: { value: dxa(LH), rule: HeightRule.EXACT }, cantSplit: true, children: cells }));
}
const grid = new Table({
  layout: TableLayoutType.FIXED,
  indent: { size: 0, type: WidthType.DXA },
  columnWidths: Array(COLS).fill(dxa(LW)),
  width: { size: dxa(LW) * COLS, type: WidthType.DXA },
  margins: { top: 0, bottom: 0, left: dxa(PAD), right: dxa(PAD) },
  rows,
});

const doc = new Document({
  creator: 'GeoStorage LLC',
  title: `Clinical trial labels ${PROTOCOL} (TW-2040)`,
  description: `${TOTAL} labels, ${LW} x ${LH} mm, ${COLS}x${ROWS} per A4 sheet`,
  styles: { default: { document: { run: { font: FONT, size: FSIZE * 2 } } } },
  sections: [{
    properties: {
      page: {
        size: { orientation: PageOrientation.PORTRAIT },
        margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0, gutter: 0 },
      },
    },
    children: [grid],
  }],
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync(process.argv[2], b);
  const last = TOTAL - (SHEETS - 1) * PER_PAGE;
  console.log(`written ${process.argv[2]} — TW-2040, ${LW}x${LH} mm, ${COLS}x${ROWS}=${PER_PAGE}/sheet, ` +
              `${TOTAL} labels on ${SHEETS} sheets (${NROWS} rows, last sheet: ${last})${GUIDES ? ' [guides on]' : ''}`);
});

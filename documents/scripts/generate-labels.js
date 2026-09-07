const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType,
  Table, TableRow, TableCell, TableLayoutType, WidthType, HeightRule,
  VerticalAlign, PageOrientation, BorderStyle, ShadingType,
} = require('docx');

const MM = 56.6929;                 // 1 mm in DXA (twips)
const mm = (v) => Math.round(v * MM);
const FONT = 'Sylfaen';             // standard Georgian-capable font

const PROTOCOL = 'PB-115-GT-211';
const L1 = 'პროტოკოლის ნომერი:';
const L2 = PROTOCOL;
const L3 = 'გამოიყენება მხოლოდ';
const L4 = 'კლინიკური კვლევებისთვის';

// ---- one uniform label, 3 across x 14 down on A4 --------------------------
const COLS = 3;
const ROWS = 14;
const LW = 67;                      // mm — 3 x 67 = 201 of the 210 mm width
const LH = 20.5;                    // mm — 14 x 20.5 = 287 of the 297 mm height
const FSIZE = 9;                    // pt — 4 lines fit 20.5 mm with room to spare for the cut
const PER_PAGE = COLS * ROWS;       // 42

const PRODUCTS = [
  { name: 'Loratadine',          box: '11.5 × 5 × 2',  qty: 54 },
  { name: 'Quamatel',            box: '10 × 4.5 × 2',  qty: 27 },
  { name: 'Naproxen',            box: '9.5 × 8.5 × 2', qty: 28 },
  { name: 'Famotidine',          box: '8.5 × 4.5 × 2', qty: 84 },
  { name: 'Prednisolon Cortico', box: '10 × 4.5 × 3',  qty: 42 },
];
const TOTAL = PRODUCTS.reduce((s, p) => s + p.qty, 0);          // 235
const SHEETS = Math.ceil(TOTAL / PER_PAGE);                     // 6

const CUT = { style: BorderStyle.SINGLE, size: 4, color: '000000' };  // 0.5 pt cut guide
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const allCut = { top: CUT, bottom: CUT, left: CUT, right: CUT };
const allNone = { top: NONE, bottom: NONE, left: NONE, right: NONE };

function line(text, bold) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0, line: 240, lineRule: 'auto' },
    children: [new TextRun({ text, bold: !!bold, size: FSIZE * 2, font: FONT })],
  });
}

const labelCell = () => new TableCell({
  width: { size: mm(LW), type: WidthType.DXA },
  verticalAlign: VerticalAlign.CENTER,
  borders: allCut,
  children: [line(L1), line(L2, true), line(L3), line(L4)],
});

const blankCell = () => new TableCell({
  width: { size: mm(LW), type: WidthType.DXA },
  borders: allNone,
  children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
});

// one A4 sheet carrying `n` labels
function sheet(n) {
  const rows = [];
  for (let r = 0; r < ROWS && r * COLS < n; r++) {
    const cells = [];
    for (let c = 0; c < COLS; c++) cells.push(r * COLS + c < n ? labelCell() : blankCell());
    rows.push(new TableRow({ height: { value: mm(LH), rule: HeightRule.EXACT }, cantSplit: true, children: cells }));
  }
  return new Table({
    alignment: AlignmentType.CENTER,
    layout: TableLayoutType.FIXED,
    columnWidths: Array(COLS).fill(mm(LW)),
    width: { size: mm(LW) * COLS, type: WidthType.DXA },
    margins: { top: 0, bottom: 0, left: mm(1.5), right: mm(1.5) },
    rows,
  });
}

const breakPara = () => new Paragraph({
  spacing: { before: 0, after: 0, line: 20, lineRule: 'exact' },
  children: [new PageBreak(), new TextRun({ text: '', size: 2 })],
});

const labelPages = [];
for (let i = 0, left = TOTAL; i < SHEETS; i++, left -= PER_PAGE) {
  if (i > 0) labelPages.push(breakPara());
  labelPages.push(sheet(Math.min(left, PER_PAGE)));
}

// ---- cover / instruction page --------------------------------------------
const t = (text, opt = {}) => new Paragraph({
  alignment: opt.align || AlignmentType.LEFT,
  spacing: { before: opt.before || 0, after: opt.after === undefined ? 120 : opt.after },
  children: [new TextRun({ text, bold: !!opt.bold, size: (opt.size || 11) * 2, font: FONT })],
});

const hdrCell = (s) => new TableCell({
  shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E7E6E6' },
  children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 }, children: [new TextRun({ text: s, bold: true, size: 18, font: FONT })] })],
});
const txtCell = (s, align, bold, fill) => new TableCell({
  shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
  children: [new Paragraph({ alignment: align || AlignmentType.CENTER, spacing: { before: 40, after: 40 }, children: [new TextRun({ text: s, bold: !!bold, size: 18, font: FONT })] })],
});

const COLW = [mm(10), mm(52), mm(44), mm(28)];
const summaryRows = [new TableRow({ tableHeader: true, children: ['#', 'პრეპარატი', 'კოლოფის ზომა (სმ)', 'ლეიბლი'].map(hdrCell) })];
PRODUCTS.forEach((p, i) => summaryRows.push(new TableRow({
  children: [txtCell(String(i + 1)), txtCell(p.name, AlignmentType.LEFT), txtCell(p.box), txtCell(String(p.qty))],
})));
summaryRows.push(new TableRow({
  children: [
    new TableCell({ columnSpan: 3, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 40, after: 40 }, children: [new TextRun({ text: 'სულ ლეიბლი:', bold: true, size: 18, font: FONT })] })] }),
    txtCell(String(TOTAL), AlignmentType.CENTER, true, 'F2F2F2'),
  ],
}));

const cover = [
  t('ლეიბლების საბეჭდი ფაილი', { bold: true, size: 18, align: AlignmentType.CENTER, after: 60 }),
  t(`პროტოკოლი ${PROTOCOL} — კლინიკური კვლევა`, { size: 12, align: AlignmentType.CENTER, after: 240 }),

  t('ლეიბლის ტექსტი', { bold: true, size: 12, after: 60 }),
  t(`${L1} ${L2} / ${L3} ${L4}`, { size: 11, after: 240 }),

  t('განლაგება', { bold: true, size: 12, after: 60 }),
  ...[
    `ლეიბლის ზომა: ${LW} × ${LH} მმ — ერთნაირი ყველა პრეპარატისთვის.`,
    `ერთ A4 ფურცელზე: ${COLS} ცალი სიგანეში × ${ROWS} ცალი სიგრძეში = ${PER_PAGE} ცალი.`,
    `სულ ${TOTAL} ლეიბლი → ${SHEETS} წებოვანი ფურცელი (გვერდები 2–${SHEETS + 1}). ბოლო ფურცელზე ${TOTAL - (SHEETS - 1) * PER_PAGE} ცალია.`,
  ].map(s => new Paragraph({ spacing: { after: 80 }, indent: { left: mm(4), hanging: mm(4) }, children: [new TextRun({ text: '•  ' + s, size: 20, font: FONT })] })),
  t('', { after: 140 }),

  t('რაოდენობა პრეპარატების მიხედვით', { bold: true, size: 12, after: 60 }),
  new Table({
    alignment: AlignmentType.CENTER,
    layout: TableLayoutType.FIXED,
    columnWidths: COLW,
    width: { size: COLW.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    rows: summaryRows,
  }),
  t('', { after: 200 }),

  t('ბეჭდვის ინსტრუქცია', { bold: true, size: 12, after: 60 }),
  ...[
    `1.  ეს (პირველი) გვერდი საინფორმაციოა — წებოვან ფურცელზე დასაბეჭდად აირჩიეთ გვერდები 2–${SHEETS + 1}.`,
    '2.  ბეჭდვა მასშტაბის გარეშე: „Scale: 100%" / „Actual size". არ გამოიყენოთ „Fit to page" ან „Shrink oversized pages" — თორემ ზომები აირევა.',
    '3.  ქაღალდის ზომა: A4, ვერტიკალური (portrait). მინდვრები ~4.5 მმ — დარწმუნდით, რომ პრინტერი ამ ზღვარს უჭერს მხარს.',
    '4.  თხელი ჩარჩო ჭრის ხაზია — ლეიბლები ერთმანეთს ეკვრის, ჭრა ხაზზე ზუსტად.',
    `5.  ჭრამდე გადაზომეთ პირველი ლეიბლი სახაზავით: უნდა იყოს ${LW} × ${LH} მმ.`,
  ].map(s => new Paragraph({ spacing: { after: 80 }, indent: { left: mm(4), hanging: mm(4) }, children: [new TextRun({ text: s, size: 20, font: FONT })] })),
  t('', { after: 120 }),

  t('შენიშვნა', { bold: true, size: 12, after: 60 }),
  ...[
    `ყველა ლეიბლი იდენტურია, ამიტომ ფურცლები პრეპარატებზე არ არის დაყოფილი — ჭრის შემდეგ დაითვალეთ ცხრილის მიხედვით.`,
    `${LW} × ${LH} მმ ლეიბლი ჯდება ყველა კოლოფის წინა წახნაგზე (ყველაზე პატარაა Famotidine — 85 × 45 მმ).`,
    'დაბეჭდილია ზუსტად დათვლილი რაოდენობა, სათადარიგო ეგზემპლარების გარეშე.',
  ].map(s => new Paragraph({ spacing: { after: 80 }, indent: { left: mm(4), hanging: mm(4) }, children: [new TextRun({ text: '•  ' + s, size: 20, font: FONT })] })),
];

// ---- assemble -------------------------------------------------------------
const doc = new Document({
  creator: 'GeoStorage LLC',
  title: `Clinical trial labels ${PROTOCOL}`,
  styles: { default: { document: { run: { font: FONT, size: 22 } } } },
  sections: [
    {
      properties: { page: { size: { orientation: PageOrientation.PORTRAIT }, margin: { top: mm(18), bottom: mm(18), left: mm(18), right: mm(18) } } },
      children: cover,
    },
    {
      properties: {
        page: {
          size: { orientation: PageOrientation.PORTRAIT },
          // 210 - 3x67 = 9 mm and 297 - 14x20.5 = 10 mm of slack, split evenly
          margin: { top: mm(4.5), bottom: mm(4.5), left: mm(4), right: mm(4), header: 0, footer: 0, gutter: 0 },
        },
      },
      children: labelPages,
    },
  ],
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync(process.argv[2], b);
  console.log(`written ${process.argv[2]} — ${TOTAL} labels, ${LW}x${LH} mm, ${PER_PAGE}/sheet, ${SHEETS} sheets`);
});

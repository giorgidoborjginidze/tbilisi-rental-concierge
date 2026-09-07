const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType,
  Table, TableRow, TableCell, TableLayoutType, WidthType, HeightRule,
  VerticalAlign, ShadingType, PageOrientation, BorderStyle, HeadingLevel,
} = require('docx');

const MM = 56.6929;                 // 1 mm in DXA (twips)
const mm = (v) => Math.round(v * MM);
const FONT = 'Sylfaen';             // standard Georgian-capable font

const PROTOCOL = 'PB-115-GT-211';
const L1 = 'პროტოკოლის ნომერი:';
const L2 = PROTOCOL;
const L3 = 'გამოიყენება მხოლოდ';
const L4 = 'კლინიკური კვლევებისთვის';

// ---- label sheet geometry -------------------------------------------------

const PRODUCTS = [
  { name: 'Loratadine',          box: '11.5 × 5 × 2',  qty: 54, w: 115, h: 50, cols: 2, rows: 4, landscape: true,  font: 18 },
  { name: 'Quamatel',            box: '10 × 4.5 × 2',  qty: 27, w: 100, h: 45, cols: 2, rows: 6, landscape: false, font: 16 },
  { name: 'Naproxen',            box: '9.5 × 8.5 × 2', qty: 28, w: 95,  h: 85, cols: 2, rows: 3, landscape: false, font: 16 },
  { name: 'Famotidine',          box: '8.5 × 4.5 × 2', qty: 84, w: 85,  h: 45, cols: 2, rows: 6, landscape: false, font: 14 },
  { name: 'Prednisolon Cortico', box: '10 × 4.5 × 3',  qty: 42, w: 100, h: 45, cols: 2, rows: 6, landscape: false, font: 16 },
];
PRODUCTS.forEach(p => {
  p.perPage = p.cols * p.rows;
  p.pages = Math.ceil(p.qty / p.perPage);
});

const CUT = { style: BorderStyle.SINGLE, size: 4, color: '000000' };  // 0.5 pt cut guide
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const allCut = { top: CUT, bottom: CUT, left: CUT, right: CUT };
const allNone = { top: NONE, bottom: NONE, left: NONE, right: NONE };

function line(text, size, bold) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0, line: 240, lineRule: 'auto' },
    children: [new TextRun({ text, bold: !!bold, size: size * 2, font: FONT })],
  });
}

function labelCell(p) {
  return new TableCell({
    width: { size: mm(p.w), type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    borders: allCut,
    children: [line(L1, p.font), line(L2, p.font, true), line(L3, p.font), line(L4, p.font)],
  });
}

function blankCell(p) {
  return new TableCell({
    width: { size: mm(p.w), type: WidthType.DXA },
    borders: allNone,
    children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
  });
}

// one full A4 sheet of `n` labels for product p
function sheet(p, n) {
  const rows = [];
  for (let r = 0; r < p.rows; r++) {
    const cells = [];
    let used = 0;
    for (let c = 0; c < p.cols; c++) {
      const idx = r * p.cols + c;
      if (idx < n) { cells.push(labelCell(p)); used++; } else { cells.push(blankCell(p)); }
    }
    if (r * p.cols >= n) break;           // skip entirely empty rows
    rows.push(new TableRow({
      height: { value: mm(p.h), rule: HeightRule.EXACT },
      cantSplit: true,
      children: cells,
    }));
  }
  return new Table({
    alignment: AlignmentType.CENTER,
    layout: TableLayoutType.FIXED,
    columnWidths: Array(p.cols).fill(mm(p.w)),
    width: { size: mm(p.w) * p.cols, type: WidthType.DXA },
    margins: { top: 0, bottom: 0, left: mm(1.5), right: mm(1.5) },
    rows,
  });
}

const breakPara = () => new Paragraph({
  spacing: { before: 0, after: 0, line: 20, lineRule: 'exact' },
  children: [new PageBreak(), new TextRun({ text: '', size: 2 })],
});

function productBlock(p) {
  const out = [];
  let left = p.qty;
  for (let i = 0; i < p.pages; i++) {
    if (i > 0) out.push(breakPara());
    out.push(sheet(p, Math.min(left, p.perPage)));
    left -= p.perPage;
  }
  return out;
}

// margins = whatever is left over after the label grid, split evenly (min 4 mm),
// minus 1 mm of slack so rounding can never push a row onto the next sheet
function sheetPage(p) {
  const pw = p.landscape ? 297 : 210, ph = p.landscape ? 210 : 297;
  const hm = Math.max(4, (pw - p.cols * p.w) / 2 - 1);
  const vm = Math.max(4, (ph - p.rows * p.h) / 2 - 1);
  return {
    page: {
      size: { orientation: p.landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
      margin: { top: mm(vm), bottom: mm(vm), left: mm(hm), right: mm(hm), header: 0, footer: 0, gutter: 0 },
    },
  };
}

// ---- cover / instruction page --------------------------------------------
const t = (text, opt = {}) => new Paragraph({
  alignment: opt.align || AlignmentType.LEFT,
  spacing: { before: opt.before || 0, after: opt.after === undefined ? 120 : opt.after },
  children: [new TextRun({ text, bold: !!opt.bold, size: (opt.size || 11) * 2, font: FONT, color: opt.color })],
});

const hdrCell = (s) => new TableCell({
  shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E7E6E6' },
  children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 }, children: [new TextRun({ text: s, bold: true, size: 18, font: FONT })] })],
});
const txtCell = (s, align) => new TableCell({
  children: [new Paragraph({ alignment: align || AlignmentType.CENTER, spacing: { before: 40, after: 40 }, children: [new TextRun({ text: s, size: 18, font: FONT })] })],
});

const COLW = [mm(9), mm(38), mm(28), mm(25), mm(24), mm(20), mm(26)];
const summaryRows = [new TableRow({ tableHeader: true, children: ['#', 'პრეპარატი', 'ლეიბლის ზომა (მმ)', 'რაოდენობა', 'ფურცელზე', 'ფურცელი', 'გვერდები'].map(hdrCell) })];
let pageNo = 2;
PRODUCTS.forEach((p, i) => {
  const from = pageNo, to = pageNo + p.pages - 1;
  pageNo = to + 1;
  summaryRows.push(new TableRow({
    children: [
      txtCell(String(i + 1)),
      txtCell(p.name, AlignmentType.LEFT),
      txtCell(`${p.w} × ${p.h}`),
      txtCell(String(p.qty)),
      txtCell(`${p.perPage} ცალი${p.landscape ? ' (ჰორიზ.)' : ''}`),
      txtCell(String(p.pages)),
      txtCell(from === to ? String(from) : `${from}–${to}`),
    ],
  }));
});
const totalQty = PRODUCTS.reduce((s, p) => s + p.qty, 0);
const totalPages = PRODUCTS.reduce((s, p) => s + p.pages, 0);
summaryRows.push(new TableRow({
  children: [
    new TableCell({ columnSpan: 3, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 40, after: 40 }, children: [new TextRun({ text: 'სულ:', bold: true, size: 18, font: FONT })] })] }),
    new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 }, children: [new TextRun({ text: String(totalQty), bold: true, size: 18, font: FONT })] })] }),
    new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' }, children: [new Paragraph({ children: [] })] }),
    new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 }, children: [new TextRun({ text: String(totalPages), bold: true, size: 18, font: FONT })] })] }),
    new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' }, children: [new Paragraph({ children: [] })] }),
  ],
}));

const cover = [
  t('ლეიბლების საბეჭდი ფაილი', { bold: true, size: 18, align: AlignmentType.CENTER, after: 60 }),
  t(`პროტოკოლი ${PROTOCOL} — კლინიკური კვლევა`, { size: 12, align: AlignmentType.CENTER, after: 240 }),
  t('ლეიბლის ტექსტი', { bold: true, size: 12, after: 60 }),
  t(`${L1} ${L2} / ${L3} ${L4}`, { size: 11, after: 240 }),
  t('განაწილება ფურცლებზე', { bold: true, size: 12, after: 60 }),
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
    '1.  ეს (პირველი) გვერდი საინფორმაციოა — წებოვან ფურცელზე დასაბეჭდად აირჩიეთ გვერდები 2–' + (totalPages + 1) + '.',
    '2.  ბეჭდვა მასშტაბის გარეშე: „Scale: 100%" / „Actual size". არ გამოიყენოთ „Fit to page" ან „Shrink oversized pages" — თორემ ზომები აირევა.',
    '3.  ქაღალდის ზომა: A4. მინდვრები თითოეულ ბლოკზე ავტომატურად არის გაწონასწორებული; ყველაზე ვიწრო მინდორი 4 მმ-ია — დარწმუნდით, რომ პრინტერი ამ ზღვარს უჭერს მხარს.',
    '4.  ლორატადინის ფურცლები (გვ. 2–8) ჰორიზონტალურია (landscape) — დანარჩენი ვერტიკალური. Word-ს ეს თვითონ აქვს გაწერილი, პრინტერში ორიენტაცია ხელით არ შეცვალოთ.',
    '5.  თხელი ჩარჩო ჭრის ხაზია — ლეიბლები ერთმანეთს ეკვრის, ჭრა ხაზზე ზუსტად.',
    '6.  ჭრამდე გადაზომეთ პირველი ლეიბლი სახაზავით და შეადარეთ ცხრილში მითითებულ ზომას.',
  ].map(s => new Paragraph({ spacing: { after: 80 }, indent: { left: mm(4), hanging: mm(4) }, children: [new TextRun({ text: s, size: 20, font: FONT })] })),
  t('', { after: 120 }),
  t('შენიშვნები', { bold: true, size: 12, after: 60 }),
  ...[
    'ლეიბლის ზომა აღებულია კოლოფის ყველაზე დიდი (წინა) წახნაგის მიხედვით — მაგ. 11.5 × 5 × 2 სმ კოლოფზე ლეიბლი 115 × 50 მმ.',
    'Quamatel-ის ზომა („10x4x5x2") წაკითხულია როგორც 10 × 4.5 × 2 სმ.',
    'დაბეჭდილია ზუსტად დათვლილი რაოდენობა, სათადარიგო ეგზემპლარების გარეშე.',
  ].map(s => new Paragraph({ spacing: { after: 80 }, indent: { left: mm(4), hanging: mm(4) }, children: [new TextRun({ text: '•  ' + s, size: 20, font: FONT })] })),
];

// ---- assemble -------------------------------------------------------------
const sections = [
  {
    properties: { page: { size: { orientation: PageOrientation.PORTRAIT }, margin: { top: mm(18), bottom: mm(18), left: mm(18), right: mm(18) } } },
    children: cover,
  },
  ...PRODUCTS.map(p => ({ properties: sheetPage(p), children: productBlock(p) })),
];

const doc = new Document({
  creator: 'GeoStorage LLC',
  title: `Clinical trial labels ${PROTOCOL}`,
  styles: { default: { document: { run: { font: FONT, size: 22 } } } },
  sections,
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync(process.argv[2], b);
  console.log('written', process.argv[2], b.length, 'bytes;', totalQty, 'labels on', totalPages, 'sheets');
});

// Build a downloadable export of the draft board — the same round × team grid
// shown on screen. Two formats: a plain CSV (opens anywhere, no colors) and a
// real .xlsx workbook that keeps the QB/RB/WR/TE/DEF position colors. Both are
// generated client-side from the board state, with no dependencies — the .xlsx
// is assembled here as a minimal OOXML package (a ZIP of XML parts).

import {
  buildOwnerMap,
  cellToPick,
  effectiveOwnerSlot,
  type DraftState,
} from "./draftLogic";

type CellState = "made" | "skipped" | "traded" | "empty";
type GridCell = { text: string; position: string | null; state: CellState };

// Turn the board state into a header row + per-round rows of cells, indexed by
// the same snake position the on-screen board uses (cellToPick). Made picks show
// the player; a pick traded away from its snake slot is annotated with its
// current owner; skipped-but-unfilled picks read "(skipped)".
function buildGrid(state: DraftState): {
  header: string[];
  rows: { round: number; cells: GridCell[] }[];
} {
  const { draft, members, picks, skipped, trades } = state;
  const byNumber = new Map(picks.map((p) => [p.pickNumber, p]));
  const skippedSet = new Set(skipped);
  const owners = buildOwnerMap(trades);
  const memberName = (slot: number) =>
    members.find((m) => m.slot === slot)?.name ?? `Slot ${slot}`;

  const header = ["Round", ...members.map((m) => m.name)];
  const rows = Array.from({ length: draft.numRounds }, (_, i) => i + 1).map(
    (round) => {
      const cells: GridCell[] = members.map((m) => {
        const pickNumber = cellToPick(round, m.slot, draft.numSlots);
        const pick = byNumber.get(pickNumber);
        const ownerSlot = effectiveOwnerSlot(pickNumber, draft.numSlots, owners);
        const traded = ownerSlot !== m.slot;
        if (pick) {
          const meta = [pick.playerTeam, pick.playerPosition]
            .filter(Boolean)
            .join("·");
          const base = meta ? `${pick.playerName} (${meta})` : pick.playerName;
          return {
            text: traded ? `${base} ⇄ ${memberName(ownerSlot)}` : base,
            position: pick.playerPosition,
            state: "made",
          };
        }
        if (skippedSet.has(pickNumber))
          return { text: "(skipped)", position: null, state: "skipped" };
        if (traded)
          return {
            text: `⇄ ${memberName(ownerSlot)}`,
            position: null,
            state: "traded",
          };
        return { text: "", position: null, state: "empty" };
      });
      return { round, cells };
    },
  );
  return { header, rows };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvEscape(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function boardToCsv(state: DraftState): string {
  const { header, rows } = buildGrid(state);
  const lines = [header.map(csvEscape).join(",")];
  for (const { round, cells } of rows)
    lines.push(
      [String(round), ...cells.map((c) => c.text)].map(csvEscape).join(","),
    );
  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// XLSX (real OOXML workbook)
// ---------------------------------------------------------------------------

function xmlEscape(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Fixed style table (indices match the cellXfs order in STYLES_XML below):
//   0 plain · 1 header · 2 round · 3 QB · 4 RB · 5 WR · 6 TE · 7 DEF
//   8 skipped · 9 traded · 10 empty
const POSITION_STYLE: Record<string, number> = {
  QB: 3,
  RB: 4,
  WR: 5,
  TE: 6,
  DST: 7,
  DEF: 7,
  IDP: 7,
  DL: 7,
  LB: 7,
  DB: 7,
};
function cellStyle(cell: GridCell): number {
  if (cell.state === "made")
    return (cell.position && POSITION_STYLE[cell.position.toUpperCase()]) || 0;
  if (cell.state === "skipped") return 8;
  if (cell.state === "traded") return 9;
  return 10;
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="9">` +
  `<font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FF334155"/><name val="Calibri"/></font>` +
  `<font><sz val="11"/><color rgb="FF065F46"/><name val="Calibri"/></font>` +
  `<font><sz val="11"/><color rgb="FF1E40AF"/><name val="Calibri"/></font>` +
  `<font><sz val="11"/><color rgb="FF854D0E"/><name val="Calibri"/></font>` +
  `<font><sz val="11"/><color rgb="FF9A3412"/><name val="Calibri"/></font>` +
  `<font><sz val="11"/><color rgb="FF991B1B"/><name val="Calibri"/></font>` +
  `<font><sz val="11"/><color rgb="FF334155"/><name val="Calibri"/></font>` +
  `</fonts>` +
  `<fills count="11">` +
  `<fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFFEF9C3"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFFFEDD5"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFFAE8FF"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="1"><border>` +
  `<left style="thin"><color rgb="FFCBD5E1"/></left>` +
  `<right style="thin"><color rgb="FFCBD5E1"/></right>` +
  `<top style="thin"><color rgb="FFCBD5E1"/></top>` +
  `<bottom style="thin"><color rgb="FFCBD5E1"/></bottom>` +
  `<diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="11">` +
  `<xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>` +
  `<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>` +
  `<xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="4" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="5" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="6" fillId="7" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="7" fillId="8" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="8" fillId="9" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="8" fillId="10" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1" applyBorder="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

// 1-indexed column number -> spreadsheet letters (1 -> A, 27 -> AA).
function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function textCell(ref: string, style: number, text: string): string {
  if (text === "") return `<c r="${ref}" s="${style}"/>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
}

// Excel sheet names can't exceed 31 chars or contain : \ / ? * [ ].
function sheetName(name: string): string {
  const clean = name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31);
  return clean || "Board";
}

function worksheetXml(state: DraftState): string {
  const { header, rows } = buildGrid(state);
  const numCols = header.length;
  const lastRef = `${colLetter(numCols)}${rows.length + 1}`;

  const headerRow =
    `<row r="1">` +
    header.map((h, i) => textCell(`${colLetter(i + 1)}1`, 1, h)).join("") +
    `</row>`;

  const bodyRows = rows
    .map(({ round, cells }, ri) => {
      const r = ri + 2; // row 1 is the header
      const roundCell = `<c r="A${r}" s="2"><v>${round}</v></c>`;
      const dataCells = cells
        .map((c, ci) =>
          textCell(`${colLetter(ci + 2)}${r}`, cellStyle(c), c.text),
        )
        .join("");
      return `<row r="${r}">${roundCell}${dataCells}</row>`;
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="A1:${lastRef}"/>` +
    `<sheetViews><sheetView workbookViewId="0">` +
    `<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>` +
    `</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>` +
    `<col min="1" max="1" width="7" customWidth="1"/>` +
    `<col min="2" max="${numCols}" width="22" customWidth="1"/>` +
    `</cols>` +
    `<sheetData>${headerRow}${bodyRows}</sheetData>` +
    `</worksheet>`
  );
}

// --- minimal store-only ZIP writer (OOXML packages don't require compression) ---

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(
  files: { name: string; data: Uint8Array }[],
): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const out: number[] = [];
  const central: number[] = [];
  const u16 = (a: number[], v: number) => a.push(v & 0xff, (v >>> 8) & 0xff);
  const u32 = (a: number[], v: number) =>
    a.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  const bytes = (a: number[], b: Uint8Array) => {
    for (let i = 0; i < b.length; i++) a.push(b[i]);
  };

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const offset = out.length;
    // local file header
    u32(out, 0x04034b50);
    u16(out, 20); // version needed
    u16(out, 0); // flags
    u16(out, 0); // method: store
    u16(out, 0); // mod time
    u16(out, 0); // mod date
    u32(out, crc);
    u32(out, f.data.length); // compressed size
    u32(out, f.data.length); // uncompressed size
    u16(out, name.length);
    u16(out, 0); // extra length
    bytes(out, name);
    bytes(out, f.data);
    // central directory record
    u32(central, 0x02014b50);
    u16(central, 20); // version made by
    u16(central, 20); // version needed
    u16(central, 0); // flags
    u16(central, 0); // method
    u16(central, 0); // time
    u16(central, 0); // date
    u32(central, crc);
    u32(central, f.data.length);
    u32(central, f.data.length);
    u16(central, name.length);
    u16(central, 0); // extra
    u16(central, 0); // comment
    u16(central, 0); // disk start
    u16(central, 0); // internal attrs
    u32(central, 0); // external attrs
    u32(central, offset);
    bytes(central, name);
  }

  const cdOffset = out.length;
  for (const b of central) out.push(b);
  // end of central directory
  const eocd: number[] = [];
  u32(eocd, 0x06054b50);
  u16(eocd, 0);
  u16(eocd, 0);
  u16(eocd, files.length);
  u16(eocd, files.length);
  u32(eocd, central.length);
  u32(eocd, cdOffset);
  u16(eocd, 0);
  for (const b of eocd) out.push(b);

  return Uint8Array.from(out);
}

export function boardToXlsx(state: DraftState): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const file = (name: string, xml: string) => ({ name, data: enc.encode(xml) });

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${xmlEscape(sheetName(state.draft.name))}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  return zipStore([
    file("[Content_Types].xml", contentTypes),
    file("_rels/.rels", rootRels),
    file("xl/workbook.xml", workbook),
    file("xl/_rels/workbook.xml.rels", workbookRels),
    file("xl/styles.xml", STYLES_XML),
    file("xl/worksheets/sheet1.xml", worksheetXml(state)),
  ]);
}

// A filesystem-friendly base name derived from the draft name.
export function slugifyName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "board"
  );
}

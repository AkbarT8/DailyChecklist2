/**
 * Excel → catalog: one row per Excel line.
 * part_number = primary code column (Item Code, etc.); other codes stay in extra for search.
 */
import * as XLSX from 'xlsx';

export function norm(s: string): string {
  return s.toLowerCase().replace(/[\s_\-\.\/\\()[\]]/g, '');
}

export function cellToString(val: unknown): string {
  if (val == null || val === '') return '';
  if (typeof val === 'number') {
    if (!isNaN(val) && isFinite(val)) {
      if (Number.isInteger(val) || Math.abs(val - Math.round(val)) < 1e-9) {
        return String(Math.trunc(Math.round(val)));
      }
      if (Math.abs(val) >= 1e15) return val.toFixed(0);
      const rounded = Math.round(val * 100000) / 100000;
      return String(rounded).replace(/\.?0+$/, '');
    }
    return String(val);
  }
  const s = String(val).trim();
  if (/^[\d.]+[eE][+-]?\d+$/.test(s)) {
    const n = Number(s);
    if (!isNaN(n) && isFinite(n)) {
      if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-9) {
        return String(Math.trunc(Math.round(n)));
      }
      return String(n);
    }
  }
  return s;
}

/** Decimal-only values (10.889) — prices, not part codes */
export function looksLikePriceValue(s: string): boolean {
  const t = s.trim().replace(/,/g, '.');
  if (/[A-Za-z\-\/]/.test(s)) return false;
  if (!/^\d+(\.\d+)?$/.test(t)) return false;
  const n = parseFloat(t);
  if (isNaN(n) || n < 0) return false;
  if (Number.isInteger(n)) return n < 10000 && String(n).length <= 4;
  return true;
}

function isPriceLikeKey(key: string): boolean {
  const nk = norm(key);
  return /price|cost|amount|sum|total|unitprice|unit_price|salesprice|listprice|retail|netprice|gross|value|aed|usd|eur|gbp|цена|стоимость|прайс|сумма/.test(nk);
}

function isStockLikeKey(key: string): boolean {
  const nk = norm(key);
  if (isPriceLikeKey(key)) return false;
  if (/description|remark|note|comment|status|name|brand|price|date|email|phone/.test(nk)) return false;
  return /stock|qty|quantity|balance|onhand|inventory|available|instock|warehouse|pcs|остаток|наличие|количество|склад/.test(nk);
}

export function isCodeColumnKey(key: string): boolean {
  const nk = norm(key);
  if (!nk || isPriceLikeKey(key) || isStockLikeKey(key)) return false;
  const hasCodeWord =
    /code|oem|partnumber|partno|partnum|itemcode|itemno|itemnumber|articleno|articlenumber|productcode|sku|referenceno|refno|barcode|crossref|alternat|original|замен|аналог|артикул|код|номер|деталь|crossreference/.test(nk);
  const exactCode =
    nk === 'code' || nk === 'ref' || nk === 'reference' || nk === 'oem' || nk === 'sku' || nk === 'pn';
  if (hasCodeWord || exactCode) {
    if (/description|remark|note|comment|category|country|origin|coo|email|phone|date|price|cost|qty|quantity|stock|brand|manufacturer|название|описание|марка|категория|страна|цена|остаток|наличие/.test(nk)) {
      return /code|oem|part|item|sku|ref|артикул|код|номер|деталь|alternat|original|pn/.test(nk);
    }
    return true;
  }
  return false;
}

const CODE_COLUMN_PRIORITY = [
  'itemcode', 'itemnumber', 'itemno', 'item',
  'partnumber', 'partno', 'partnum',
  'originalcode', 'alternativecode', 'altcode', 'crossreference',
  'productcode', 'sku', 'oemnumber', 'oemno', 'oem',
  'articlenumber', 'articleno', 'article',
  'referenceno', 'refno', 'reference', 'ref', 'code',
  'barcode', 'код', 'артикул', 'номер',
];

function codeColumnScore(key: string): number {
  const nk = norm(key);
  for (let i = 0; i < CODE_COLUMN_PRIORITY.length; i++) {
    const p = CODE_COLUMN_PRIORITY[i];
    if (nk === p || nk.includes(p) || p.includes(nk)) return CODE_COLUMN_PRIORITY.length - i;
  }
  return isCodeColumnKey(key) ? 1 : -1;
}

function findCol(keys: string[], ...candidates: string[]): string | null {
  for (const candidate of candidates) {
    const nc = norm(candidate);
    const found = keys.find(k => {
      const nk = norm(k);
      return nk.includes(nc) || nc.includes(nk);
    });
    if (found) return found;
  }
  return null;
}

function parsePriceValue(val: unknown): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !isNaN(val) && isFinite(val) && val >= 0) {
    return +Number(val).toFixed(4);
  }
  const raw = String(val).trim().replace(/[^0-9.,]/g, '').replace(',', '.');
  if (!raw) return null;
  const parsed = parseFloat(raw);
  if (isNaN(parsed) || parsed < 0) return null;
  return +parsed.toFixed(4);
}

function scorePriceColumnHeader(key: string): number {
  const nk = norm(key);
  if (!isPriceLikeKey(key)) return -1;
  const priority: [RegExp, number][] = [
    [/^unitprice$/, 100],
    [/^salesprice$/, 95],
    [/^listprice$/, 90],
    [/^netprice$/, 88],
    [/^price$/, 85],
    [/unitprice/, 80],
    [/salesprice/, 78],
    [/price/, 70],
    [/cost/, 60],
    [/net/, 55],
    [/list/, 50],
    [/retail/, 50],
    [/aed/, 45],
    [/value/, 40],
    [/amount/, 35],
    [/цена/, 70],
    [/стоимость/, 65],
  ];
  let score = 10;
  for (const [re, pts] of priority) {
    if (re.test(nk)) score = Math.max(score, pts);
  }
  return score;
}

/** Pick price column by header name, then by numeric content */
function findPriceColumn(keys: string[], rows: Record<string, unknown>[]): string | null {
  const headerMatches = keys
    .map(k => ({ k, s: scorePriceColumnHeader(k) }))
    .filter(x => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  if (headerMatches.length > 0) return headerMatches[0].k;

  const byName = findCol(
    keys,
    'price', 'unitprice', 'unit_price', 'salesprice', 'listprice', 'netprice',
    'sellingprice', 'retail', 'cost', 'amount', 'value', 'rate', 'aed', 'usd',
    'цена', 'стоимость', 'прайс',
  );
  if (byName) return byName;

  const codeColSet = new Set(resolveEffectiveCodeColumns(keys, null));
  let best: { k: string; score: number } | null = null;
  for (const k of keys) {
    if (codeColSet.has(k) || isStockLikeKey(k)) continue;
    let hits = 0;
    let n = 0;
    for (const row of rows.slice(0, 100)) {
      const p = parsePriceValue(row[k]);
      if (p === null) continue;
      n++;
      if (p > 0 && p < 1_000_000) hits++;
    }
    if (n < 5) continue;
    const ratio = hits / n;
    if (ratio < 0.5) continue;
    const score = Math.round(ratio * 50);
    if (!best || score > best.score) best = { k, score };
  }
  return best?.k ?? null;
}

function findAllCodeColumns(keys: string[], priceCol: string | null): string[] {
  return keys
    .filter(k => k !== priceCol && isCodeColumnKey(k))
    .sort((a, b) => codeColumnScore(b) - codeColumnScore(a));
}

function resolveEffectiveCodeColumns(keys: string[], priceCol: string | null): string[] {
  let codeCols = findAllCodeColumns(keys, priceCol);
  const fuzzyCodeCols = keys.filter(k => {
    if (k === priceCol || isPriceLikeKey(k)) return false;
    const nk = norm(k);
    return (
      nk.includes('itemcode') || nk.includes('originalcode') || nk.includes('alternativecode') ||
      nk.includes('partnumber') || nk.includes('partno') || nk === 'oem' ||
      (nk.includes('code') && !isStockLikeKey(k))
    );
  });
  for (const c of fuzzyCodeCols) {
    if (!codeCols.includes(c)) codeCols.push(c);
  }
  codeCols = [...new Set(codeCols)]
    .filter(k => k !== priceCol)
    .sort((a, b) => codeColumnScore(b) - codeColumnScore(a));

  if (codeCols.length === 0) {
    const single = findCol(keys, 'itemcode', 'partnumber', 'originalcode', 'alternativecode', 'oem', 'code', 'sku', 'артикул', 'код');
    if (single && single !== priceCol) codeCols = [single];
  }
  return codeCols;
}

/** Primary part number: first code column with a real (non-price) value */
function pickPartNumber(
  row: Record<string, unknown>,
  codeCols: string[],
  priceCol: string | null,
): string {
  for (const col of codeCols) {
    if (col === priceCol) continue;
    const v = cellToString(row[col]);
    if (v && !looksLikePriceValue(v)) return v;
  }
  return '';
}

function pickFallbackIdentifier(
  row: Record<string, unknown>,
  keys: string[],
  skipCols: Set<string>,
  priceCol: string | null,
): string {
  for (const key of keys) {
    if (skipCols.has(key) || key === priceCol) continue;
    if (isPriceLikeKey(key) || isStockLikeKey(key)) continue;
    const nk = norm(key);
    if (/description|remark|note|comment|brand|manufacturer|category|country|origin|coo|email|phone|date|name|title|наименование|описание|марка|категория/.test(nk)) {
      continue;
    }
    const v = cellToString(row[key]);
    if (v && !looksLikePriceValue(v) && v.length <= 80) return v;
  }
  return '';
}

function parseStockValue(val: unknown): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !isNaN(val)) return Math.max(0, Math.floor(val));
  const s = String(val).trim();
  if (!s || /^n\/?a$/i.test(s)) return null;
  const m = s.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  if (isNaN(n) || n < 0) return null;
  return Math.floor(n);
}

function scoreStockColumn(key: string, sampleRows: Record<string, unknown>[]): number {
  if (!isStockLikeKey(key)) return -1;
  const nk = norm(key);
  let score = /stock|qty|quantity|available|наличие|остаток/.test(nk) ? 40 : 10;
  let numericHits = 0;
  for (const row of sampleRows.slice(0, 50)) {
    if (parseStockValue(row[key]) !== null) numericHits++;
  }
  return score + numericHits * 3;
}

function findBestStockColumns(keys: string[], sampleRows: Record<string, unknown>[]): string[] {
  const scored = keys
    .map(k => ({ k, s: scoreStockColumn(k, sampleRows) }))
    .filter(x => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  if (scored.length === 0) {
    const fallback = findCol(keys, 'stock', 'qty', 'quantity', 'available', 'остаток', 'наличие');
    return fallback ? [fallback] : [];
  }
  return scored.map(x => x.k);
}

function makeUniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h, i) => {
    let name = h.trim();
    if (!name || name.startsWith('__EMPTY')) name = `Column${i + 1}`;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name}_${count + 1}`;
  });
}

function scoreHeaderRow(cells: unknown[]): number {
  let score = 0;
  for (const cell of cells) {
    const label = String(cell ?? '').trim();
    if (!label) continue;
    if (isCodeColumnKey(label)) score += 4;
    if (/brand|desc|price|stock|qty|name|марка|цена|остаток|наименование|category/i.test(label)) score += 1;
  }
  return score;
}

function parseSheetWithSmartHeader(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: true,
  }) as unknown[][];

  if (aoa.length === 0) return [];

  let headerIdx = 0;
  let bestScore = scoreHeaderRow(aoa[0]);
  for (let r = 1; r < Math.min(aoa.length, 25); r++) {
    const s = scoreHeaderRow(aoa[r]);
    if (s > bestScore) {
      bestScore = s;
      headerIdx = r;
    }
  }

  const headerCells = aoa[headerIdx] as unknown[];
  const keys = makeUniqueHeaders(
    headerCells.map((c, i) => String(c ?? '').trim() || `Column${i + 1}`),
  );

  const rows: Record<string, unknown>[] = [];
  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const line = aoa[r] as unknown[];
    if (!line || line.every(c => !String(c ?? '').trim())) continue;
    const obj: Record<string, unknown> = {};
    for (let c = 0; c < keys.length; c++) {
      obj[keys[c]] = line[c] ?? '';
    }
    rows.push(obj);
  }
  return rows;
}

export async function parseWorkbookRows(file: File): Promise<Record<string, unknown>[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: false });
  const rows: Record<string, unknown>[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    rows.push(...parseSheetWithSmartHeader(sheet));
  }
  return rows;
}

export function buildRecordsFromRows(
  rows: Record<string, unknown>[],
  filename: string,
): {
  records: Record<string, unknown>[];
  skippedEmpty: number;
  fallbackUsed: number;
  detectedColumns: Record<string, unknown>;
} {
  const keySet = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) keySet.add(k);
  }
  const keys = [...keySet];

  const priceCol = findPriceColumn(keys, rows);
  const codeCols = resolveEffectiveCodeColumns(keys, priceCol);
  const partNumberCol = codeCols[0] ?? null;
  const brandCol = findCol(keys, 'brand', 'manufacturer', 'make', 'марка', 'бренд');
  const descriptionCol = findCol(keys, 'description', 'desc', 'productname', 'name', 'title', 'наименование', 'описание');
  const categoryCol = findCol(keys, 'category', 'type', 'group', 'категория');
  const stockCols = findBestStockColumns(keys, rows);
  const cooCol = findCol(keys, 'coo', 'country', 'origin', 'страна');

  const knownColsSet = new Set([
    brandCol, descriptionCol, categoryCol, priceCol, cooCol,
    ...stockCols,
    ...codeCols,
  ].filter(Boolean) as string[]);

  let skippedEmpty = 0;
  let fallbackUsed = 0;

  const records = rows
    .map(row => {
      let partNum = pickPartNumber(row, codeCols, priceCol);
      if (!partNum) {
        partNum = pickFallbackIdentifier(row, keys, knownColsSet, priceCol);
        if (partNum) fallbackUsed++;
      }
      if (!partNum) {
        skippedEmpty++;
        return null;
      }

      const extra: Record<string, unknown> = {};
      for (const col of codeCols) {
        const v = cellToString(row[col]);
        if (v && v !== partNum) extra[col] = v;
      }
      for (const key of keys) {
        if (!knownColsSet.has(key)) {
          const s = cellToString(row[key]);
          if (s && s !== partNum && !looksLikePriceValue(s)) extra[key] = s;
        } else if (isCodeColumnKey(key) && !codeCols.includes(key)) {
          const s = cellToString(row[key]);
          if (s && s !== partNum) extra[key] = s;
        }
      }

      const price = priceCol ? parsePriceValue(row[priceCol]) : null;

      let stock: number | null = null;
      for (const col of stockCols) {
        const parsed = parseStockValue(row[col]);
        if (parsed !== null) {
          stock = parsed;
          break;
        }
      }

      const coo = cooCol ? cellToString(row[cooCol]) || null : null;

      return {
        part_number: partNum,
        brand: brandCol ? String(row[brandCol] ?? '').trim() : '',
        description: descriptionCol ? String(row[descriptionCol] ?? '').trim() : '',
        category: categoryCol ? String(row[categoryCol] ?? '').trim() : '',
        price,
        stock,
        coo,
        extra: Object.keys(extra).length > 0 ? extra : {},
        source_file: filename,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return {
    records,
    skippedEmpty,
    fallbackUsed,
    detectedColumns: {
      partNumberCol,
      codeColumns: codeCols,
      brandCol,
      descriptionCol,
      categoryCol,
      priceCol,
      stockCol: stockCols[0] ?? null,
      cooCol,
    },
  };
}

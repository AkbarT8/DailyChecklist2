import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 500;

/** Normalize a string for fuzzy column matching */
function norm(s: string) {
  return s.toLowerCase().replace(/[\s_\-\.\/\\()\[\]]/g, "");
}

/**
 * Find the first key in `keys` whose normalized form contains any of the
 * normalized candidates, OR whose normalized form is contained by any candidate.
 * Candidate list is searched in priority order.
 */
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
  if (val == null || val === "") return null;
  if (typeof val === "number" && !isNaN(val) && isFinite(val) && val >= 0) {
    return +Number(val).toFixed(4);
  }
  const raw = String(val).trim().replace(/[^0-9.,]/g, "").replace(",", ".");
  if (!raw) return null;
  const parsed = parseFloat(raw);
  if (isNaN(parsed) || parsed < 0) return null;
  return +parsed.toFixed(4);
}

function scorePriceColumnHeader(key: string): number {
  const nk = norm(key);
  if (!isPriceLikeKey(key)) return -1;
  let score = 10;
  const rules: [RegExp, number][] = [
    [/^unitprice$/, 100], [/^salesprice$/, 95], [/^price$/, 85],
    [/unitprice/, 80], [/price/, 70], [/cost/, 60], [/aed/, 45], [/цена/, 70],
  ];
  for (const [re, pts] of rules) {
    if (re.test(nk)) score = Math.max(score, pts);
  }
  return score;
}

function findPriceColumn(keys: string[], rows: Record<string, unknown>[], codeCols: string[]): string | null {
  const headerMatches = keys
    .map(k => ({ k, s: scorePriceColumnHeader(k) }))
    .filter(x => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  if (headerMatches.length > 0) return headerMatches[0].k;

  const byName = findCol(keys,
    "price", "unitprice", "unit_price", "salesprice", "listprice", "netprice",
    "sellingprice", "retail", "cost", "amount", "value", "rate", "aed",
    "цена", "стоимость", "прайс",
  );
  if (byName) return byName;

  const codeSet = new Set(codeCols);
  let best: { k: string; score: number } | null = null;
  for (const k of keys) {
    if (codeSet.has(k) || isStockLikeKey(k)) continue;
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

function looksLikePriceValue(s: string): boolean {
  const t = s.trim().replace(/,/g, ".");
  if (/[A-Za-z\-\/]/.test(s)) return false;
  if (!/^\d+(\.\d+)?$/.test(t)) return false;
  const n = parseFloat(t);
  if (isNaN(n) || n < 0) return false;
  if (Number.isInteger(n)) return n < 10000 && String(n).length <= 4;
  return true;
}

function isPriceLikeKey(key: string): boolean {
  const nk = norm(key);
  return /price|cost|amount|sum|total|unitprice|unit_price|salesprice|listprice|retail|netprice|gross|value|aed|usd|eur|цена|стоимость|прайс|сумма/.test(nk);
}

function isStockLikeKey(key: string): boolean {
  const nk = norm(key);
  if (isPriceLikeKey(key)) return false;
  // Exclude columns that look like flags/text, not quantities
  if (/description|remark|note|comment|status|name|brand|price|date|email|phone/.test(nk)) return false;
  return /stock|qty|quantity|qnt|quan|balance|onhand|onhand|inventory|available|avail|instock|instore|warehouse|supply|pieces|piece|units|count|stk|pcs|free|hand|остаток|наличие|количество|склад|вналичии|доступно|резерв|запас/.test(nk);
}

/** Score columns so the best stock/qty column is picked automatically */
function scoreStockColumn(key: string, sampleRows: Record<string, unknown>[]): number {
  if (!isStockLikeKey(key)) return -1;
  const nk = norm(key);
  let score = 0;
  const priority: [RegExp, number][] = [
    [/^stock$/, 80],
    [/^qty$/, 75],
    [/^quantity$/, 75],
    [/^available$/, 70],
    [/^availability$/, 65],
    [/^instock$/, 65],
    [/^onhand$/, 60],
    [/^balance$/, 55],
    [/^inventory$/, 50],
    [/stock/, 40],
    [/qty/, 35],
    [/quantity/, 35],
    [/available/, 30],
    [/наличие/, 40],
    [/остаток/, 40],
    [/количество/, 35],
  ];
  for (const [re, pts] of priority) {
    if (re.test(nk)) score += pts;
  }
  let numericHits = 0;
  for (const row of sampleRows.slice(0, 50)) {
    if (parseStockValue(row[key]) !== null) numericHits++;
  }
  score += numericHits * 3;
  return score;
}

function findBestStockColumns(keys: string[], sampleRows: Record<string, unknown>[]): string[] {
  const scored = keys
    .map(k => ({ k, s: scoreStockColumn(k, sampleRows) }))
    .filter(x => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  if (scored.length === 0) {
    const fallback = findCol(keys,
      "stock", "qty", "quantity", "available", "availability", "onhand", "on_hand",
      "balance", "inventory", "instock", "in_stock", "qoh", "freeqty", "free_qty",
      "availableqty", "availqty", "unitsavailable", "warehouse", "supply", "stk", "pcs",
      "остаток", "наличие", "количество", "склад", "вналичии", "доступно",
    );
    return fallback ? [fallback] : [];
  }
  return scored.map(x => x.k);
}

/** Normalize Excel cell to searchable string (handles numbers, scientific notation) */
function cellToString(val: unknown): string {
  if (val == null || val === "") return "";
  if (typeof val === "number") {
    if (!isNaN(val) && isFinite(val)) {
      if (Number.isInteger(val) || Math.abs(val - Math.round(val)) < 1e-9) {
        return String(Math.trunc(Math.round(val)));
      }
      if (Math.abs(val) >= 1e15) return val.toFixed(0);
      const rounded = Math.round(val * 100000) / 100000;
      const s = String(rounded);
      return s.replace(/\.?0+$/, "");
    }
    return String(val);
  }
  const s = String(val).trim();
  if (/^[\d.]+[eE][+-]?\d+$/.test(s)) {
    const n = Number(s);
    if (!isNaN(n) && isFinite(n) && (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-9)) {
      return String(Math.trunc(Math.round(n)));
    }
  }
  return s;
}

function isCodeColumnKey(key: string): boolean {
  const nk = norm(key);
  if (!nk || isPriceLikeKey(key) || isStockLikeKey(key)) return false;

  const hasCodeWord =
    /code|oem|partnumber|partno|partnum|itemcode|itemno|itemnumber|articleno|articlenumber|productcode|sku|referenceno|refno|barcode|crossref|alternat|original|замен|аналог|артикул|код|номер|деталь/.test(nk);
  const exactCode =
    nk === "code" || nk === "ref" || nk === "reference" || nk === "oem" || nk === "sku" || nk === "pn";

  if (hasCodeWord || exactCode) {
    if (/description|remark|note|comment|category|country|origin|coo|email|phone|date|price|cost|qty|quantity|stock|brand|manufacturer|название|описание|марка|категория|страна|цена|остаток|наличие/.test(nk)) {
      return /code|oem|part|item|sku|ref|артикул|код|номер|деталь|alternat|original/.test(nk);
    }
    return true;
  }
  return false;
}

const CODE_COLUMN_PRIORITY: string[] = [
  "partnumber", "partno", "partnum", "part",
  "itemcode", "itemnumber", "itemno", "item",
  "originalcode", "alternativecode", "altcode", "crossreference",
  "productcode", "sku", "oemnumber", "oemno", "oem",
  "articlenumber", "articleno", "article",
  "referenceno", "refno", "reference", "ref", "code",
  "barcode", "код", "артикул", "номер",
];

function codeColumnScore(key: string): number {
  const nk = norm(key);
  for (let i = 0; i < CODE_COLUMN_PRIORITY.length; i++) {
    const p = CODE_COLUMN_PRIORITY[i];
    if (nk === p || nk.includes(p) || p.includes(nk)) return CODE_COLUMN_PRIORITY.length - i;
  }
  return isCodeColumnKey(key) ? 1 : -1;
}

function findAllCodeColumns(keys: string[]): string[] {
  return keys
    .filter(k => isCodeColumnKey(k))
    .sort((a, b) => codeColumnScore(b) - codeColumnScore(a));
}

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
  return "";
}

function parseSheetWithSmartHeader(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: true,
  }) as unknown[][];
  if (aoa.length === 0) return [];

  let headerIdx = 0;
  let bestScore = 0;
  for (let r = 0; r < Math.min(aoa.length, 25); r++) {
    let score = 0;
    for (const cell of aoa[r] as unknown[]) {
      const label = String(cell ?? "").trim();
      if (!label) continue;
      if (isCodeColumnKey(label)) score += 4;
      if (/brand|desc|price|stock|qty|name|марка|цена|остаток/i.test(label)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      headerIdx = r;
    }
  }

  const headerCells = aoa[headerIdx] as unknown[];
  const seen = new Map<string, number>();
  const keys = headerCells.map((c, i) => {
    let name = String(c ?? "").trim() || `Column${i + 1}`;
    if (name.startsWith("__EMPTY")) name = `Column${i + 1}`;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name}_${count + 1}`;
  });

  const rows: Record<string, unknown>[] = [];
  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const line = aoa[r] as unknown[];
    if (!line || line.every(c => !String(c ?? "").trim())) continue;
    const obj: Record<string, unknown> = {};
    for (let c = 0; c < keys.length; c++) obj[keys[c]] = line[c] ?? "";
    rows.push(obj);
  }
  return rows;
}

/** Last resort: first non-empty cell that is not price/stock/metadata */
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
  return "";
}

function collectKeysFromAllRows(rows: Record<string, unknown>[]): string[] {
  const keySet = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) keySet.add(k);
  }
  return [...keySet];
}

/** Insert batch; on failure split and retry so valid rows are not lost */
async function insertRecordsResilient(
  db: ReturnType<typeof createClient>,
  records: Record<string, unknown>[],
  log: (msg: string) => void,
): Promise<{ inserted: number; failed: number }> {
  let inserted = 0;
  let failed = 0;

  async function insertChunk(chunk: Record<string, unknown>[]): Promise<void> {
    if (chunk.length === 0) return;
    const { error } = await db.from("parts_catalog").insert(chunk);
    if (!error) {
      inserted += chunk.length;
      return;
    }
    if (chunk.length === 1) {
      failed += 1;
      log(`Row insert failed: ${error.message} | part=${(chunk[0] as { part_number?: string }).part_number}`);
      return;
    }
    const mid = Math.floor(chunk.length / 2);
    await insertChunk(chunk.slice(0, mid));
    await insertChunk(chunk.slice(mid));
  }

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await insertChunk(batch);
    log(`Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} processed, inserted=${inserted}, failed=${failed}`);
  }

  return { inserted, failed };
}

function parseStockValue(val: unknown): number | null {
  if (val == null || val === "") return null;
  if (typeof val === "number" && !isNaN(val)) return Math.max(0, Math.floor(val));
  const s = String(val).trim();
  if (!s || /^n\/?a$/i.test(s) || /^no$/i.test(s)) return null;
  const m = s.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  if (isNaN(n) || n < 0) return null;
  return Math.floor(n);
}


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const debugLog: string[] = [];
  const log = (msg: string) => { console.log(msg); debugLog.push(msg); };

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    log(`ENV: URL=${SUPABASE_URL ? "ok" : "MISSING"}, SERVICE=${SERVICE_KEY ? "ok" : "MISSING"}, ANON=${ANON_KEY ? "ok" : "MISSING"}`);

    const authHeader = req.headers.get("Authorization") || "";
    log(`Auth header present: ${authHeader.length > 0}`);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    log(`Auth result: user=${user?.id ?? "null"}, error=${authError?.message ?? "none"}`);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", debug: debugLog }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data: profile, error: profileErr } = await db
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    log(`Profile: is_admin=${profile?.is_admin}, error=${profileErr?.message ?? "none"}`);

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Admin access required", debug: debugLog }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const replaceExisting = formData.get("replaceExisting") === "true";

    log(`File: ${file?.name ?? "null"}, size=${file?.size ?? 0}, replaceExisting=${replaceExisting}`);

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided", debug: debugLog }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const filename = file.name;

    const { data: uploadRecord, error: uploadErr } = await db
      .from("catalog_uploads")
      .insert({ admin_id: user.id, filename, status: "processing", row_count: 0 })
      .select("id")
      .maybeSingle();

    log(`Upload record: id=${uploadRecord?.id ?? "null"}, error=${uploadErr?.message ?? "none"}`);
    const uploadId = uploadRecord?.id ?? null;

    // Parse Excel/CSV
    const arrayBuffer = await file.arrayBuffer();
    log(`ArrayBuffer size: ${arrayBuffer.byteLength}`);

    let rows: Record<string, unknown>[] = [];
    try {
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array", cellDates: false });
      log(`Sheets: ${workbook.SheetNames.join(", ")}`);
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const sheetRows = parseSheetWithSmartHeader(sheet);
        log(`Sheet "${sheetName}": ${sheetRows.length} rows`);
        rows.push(...sheetRows);
      }
      log(`Total parsed rows (all sheets): ${rows.length}`);
      if (rows.length > 0) log(`Column keys: ${Object.keys(rows[0]).join(" | ")}`);
    } catch (parseErr) {
      log(`Parse error: ${parseErr}`);
      if (uploadId) await db.from("catalog_uploads").update({ status: "failed", error_message: "Failed to parse file" }).eq("id", uploadId);
      return new Response(JSON.stringify({ error: "Failed to parse file: " + String(parseErr), debug: debugLog }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rows.length === 0) {
      if (uploadId) await db.from("catalog_uploads").update({ status: "failed", error_message: "File is empty" }).eq("id", uploadId);
      return new Response(JSON.stringify({ error: "File is empty or has no data rows", debug: debugLog }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (replaceExisting) {
      await db.from("parts_catalog").delete().eq("source_file", filename);
    }

    // ── Column detection ──
    // Uses bidirectional fuzzy matching (normalized key ⊃ candidate OR candidate ⊃ key)
    // Candidates listed in priority order within each group.
    const keys = collectKeysFromAllRows(rows);

    let codeCols = findAllCodeColumns(keys);
    const fuzzyCodeCols = keys.filter(k => {
      if (k === priceCol || isPriceLikeKey(k)) return false;
      const nk = norm(k);
      return (
        nk.includes("itemcode") || nk.includes("originalcode") || nk.includes("alternativecode") ||
        nk.includes("partnumber") || nk.includes("partno") || nk === "oem" ||
        (nk.includes("code") && !isStockLikeKey(k))
      );
    });
    for (const c of fuzzyCodeCols) {
      if (!codeCols.includes(c)) codeCols.push(c);
    }
    codeCols = [...new Set(codeCols)].sort((a, b) => codeColumnScore(b) - codeColumnScore(a));
    if (codeCols.length === 0) {
      const single = findCol(keys, "itemcode", "partnumber", "originalcode", "alternativecode", "oem", "code", "sku");
      if (single) codeCols = [single];
    }

    const priceCol = findPriceColumn(keys, rows, codeCols);
    codeCols = codeCols.filter(k => k !== priceCol);

    const partNumberCol = codeCols[0] ?? null;
    log(`Code columns (${codeCols.length}): ${codeCols.join(" | ") || "none"}`);

    const brandCol = findCol(keys,
      "brand", "brandname", "manufacturer", "make", "vendor",
      "марка", "бренд", "производитель",
    );

    const descriptionCol = findCol(keys,
      "description", "descr", "desc", "productname", "product_name",
      "name", "title", "itemname", "item_name",
      "enginenumber", "engine_number", "engine", "motornumber",
      "наименование", "название", "описание", "двигатель",
    );

    const categoryCol = findCol(keys,
      "category", "cat", "type", "group", "section",
      "категория", "группа", "тип",
    );

    const stockCols = findBestStockColumns(keys, rows);
    const stockCol = stockCols[0] ?? null;
    log(`Stock columns ranked: ${stockCols.slice(0, 5).join(" | ") || "none"}`);

    const cooCol = findCol(keys,
      "coo", "countryoforigin", "country_of_origin", "country", "origin",
      "страна", "происхождение",
    );

    const effectiveCodeCols = codeCols;
    log(`Columns detected: codes=${effectiveCodeCols.join(",")}, brand=${brandCol}, desc=${descriptionCol}, cat=${categoryCol}, price=${priceCol}, stock=${stockCol}, coo=${cooCol}`);

    const knownColsSet = new Set([
      brandCol, descriptionCol, categoryCol, priceCol, cooCol,
      ...stockCols,
      ...effectiveCodeCols,
    ].filter(Boolean) as string[]);

    let skippedEmpty = 0;
    let fallbackUsed = 0;
    const records = rows
      .map(row => {
        let partNum = pickPartNumber(row, effectiveCodeCols, priceCol);
        if (!partNum) {
          partNum = pickFallbackIdentifier(row, keys, knownColsSet, priceCol);
          if (partNum) fallbackUsed++;
        }
        if (!partNum) {
          skippedEmpty++;
          return null;
        }

        const extra: Record<string, unknown> = {};
        for (const col of effectiveCodeCols) {
          const v = cellToString(row[col]);
          if (v && v !== partNum) extra[col] = v;
        }
        for (const key of keys) {
          if (!knownColsSet.has(key)) {
            const s = cellToString(row[key]);
            if (s && s !== partNum && !looksLikePriceValue(s)) extra[key] = s;
          } else if (isCodeColumnKey(key) && !effectiveCodeCols.includes(key)) {
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
          brand: brandCol ? String(row[brandCol] ?? "").trim() : "",
          description: descriptionCol ? String(row[descriptionCol] ?? "").trim() : "",
          category: categoryCol ? String(row[categoryCol] ?? "").trim() : "",
          price,
          stock,
          coo,
          extra: Object.keys(extra).length > 0 ? extra : {},
          source_file: filename,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    log(`Records to insert: ${records.length} (skipped ${skippedEmpty} empty, fallback ${fallbackUsed}, from ${rows.length} Excel rows)`);
    if (records.length > 0) log(`Sample record: ${JSON.stringify(records[0])}`);

    const { inserted, failed } = await insertRecordsResilient(db, records, log);
    const lastError = failed > 0 ? `${failed} rows failed to insert` : "";

    log(`Total inserted: ${inserted}, failed: ${failed}`);

    if (uploadId) {
      await db.from("catalog_uploads").update({
        row_count: inserted,
        status: inserted > 0 ? "completed" : "failed",
        error_message: inserted === 0 ? (lastError || "No rows inserted") : null,
      }).eq("id", uploadId);
    }

    return new Response(
      JSON.stringify({
        success: inserted > 0,
        filename,
        totalRows: rows.length,
        parsedRows: records.length,
        skippedEmpty,
        fallbackUsed,
        inserted,
        failed,
        detectedColumns: {
          partNumberCol: partNumberCol,
          codeColumns: effectiveCodeCols,
          brandCol,
          descriptionCol,
          categoryCol,
          priceCol,
          stockCol,
          stockColumnsDetected: stockCols,
          cooCol,
        },
        debug: debugLog,
        error: inserted === 0 ? (lastError || "No rows were inserted") : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const msg = String(err);
    console.error("process-excel fatal:", msg);
    return new Response(JSON.stringify({ error: msg, debug: debugLog }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Shared catalog search + cart stock helpers */

import { supabase } from './supabase';
import { looksLikePriceValue } from './excelCatalogParse';
import {
  clientCatalogSourcePattern,
  clientCatalogSourcePrefixForUser,
  isClientCatalogSource,
} from './clientPriceList';

export type CatalogSearchScope =
  | { mode: 'general' }
  | { mode: 'client'; userId: string };

function rowMatchesScope(sourceFile: string | null | undefined, scope: CatalogSearchScope): boolean {
  if (scope.mode === 'client') {
    return (sourceFile ?? '').startsWith(clientCatalogSourcePrefixForUser(scope.userId));
  }
  return !isClientCatalogSource(sourceFile);
}

function filterByScope(rows: CatalogSearchRow[], scope: CatalogSearchScope): CatalogSearchRow[] {
  return rows.filter(r => rowMatchesScope(r.source_file, scope));
}

export const MAX_STOCK_MESSAGE = (max: number) =>
  `Maximum stock: ${max}`;

export function normalizeSearchTerm(q: string): string {
  return q.trim().toLowerCase();
}

/** Escape term for PostgREST ilike patterns (fallback only) */
function escapeIlikeTerm(term: string): string {
  return term.trim().replace(/[%_,]/g, ' ').toLowerCase();
}

/** Supabase .or() filter — prefetch candidates (consecutive match applied after fetch) */
export function buildCatalogSearchOrFilter(term: string): string {
  const t = escapeIlikeTerm(term);
  if (!t || t.length < 2) return '';
  const pattern = `%${t}%`;
  return [
    `part_number.ilike.${pattern}`,
    `brand.ilike.${pattern}`,
    `description.ilike.${pattern}`,
    `category.ilike.${pattern}`,
  ].join(',');
}

export type CatalogSearchRow = {
  id: string;
  part_number: string;
  brand: string;
  description: string;
  category: string;
  price: number | null;
  stock: number | null;
  coo: string | null;
  extra: Record<string, unknown>;
  source_file?: string | null;
};

const CATALOG_SEARCH_SELECT =
  'id, part_number, brand, description, category, price, stock, coo, extra, search_text, source_file';

function normalizePartCode(value: string): string {
  return value.toLowerCase().replace(/[\s_\-./\\]/g, '');
}

/** Query appears as consecutive characters in field (e.g. "12" in "12345", "123" in "12345"). */
function fieldContainsQuery(field: string, query: string): boolean {
  const q = query.toLowerCase().trim();
  const text = field.trim();
  if (!q || !text) return false;
  const lower = text.toLowerCase();
  if (lower.includes(q)) return true;
  const normField = normalizePartCode(text);
  const normQuery = normalizePartCode(q);
  return normQuery.length > 0 && normField.includes(normQuery);
}

function catalogSearchFields(row: CatalogSearchRow): string[] {
  const fields: string[] = [];
  if (row.part_number?.trim()) fields.push(row.part_number.trim());
  if (row.brand?.trim()) fields.push(row.brand.trim());
  if (row.description?.trim()) fields.push(row.description.trim());
  if (row.category?.trim()) fields.push(row.category.trim());
  if (row.coo?.trim()) fields.push(row.coo.trim());

  const extra = row.extra;
  if (extra && typeof extra === 'object') {
    for (const val of Object.values(extra)) {
      const s = cellToSearchString(val);
      if (!s || looksLikePriceValue(s) || s.length > 120) continue;
      fields.push(s);
    }
  }
  return fields;
}

/** Match part number, brand, description, item/OEM columns — consecutive substring only */
export function catalogRowMatchesSearch(row: CatalogSearchRow, rawQuery: string): boolean {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return false;
  return catalogSearchFields(row).some(f => fieldContainsQuery(f, q));
}

function filterStrictMatches(rows: CatalogSearchRow[], query: string): CatalogSearchRow[] {
  const q = normalizeSearchTerm(query);
  if (!q) return [];
  return rows.filter(r => catalogRowMatchesSearch(r, q));
}

function cellToSearchString(val: unknown): string {
  if (val == null) return '';
  return String(val).trim();
}

/** Scan catalog in pages when RPC/ilike miss codes stored only in extra (Item Code, etc.). */
async function searchPartsCatalogDeep(
  q: string,
  limit: number,
  scope: CatalogSearchScope,
): Promise<CatalogSearchRow[]> {
  const matches: CatalogSearchRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (matches.length < limit) {
    let query = supabase
      .from('parts_catalog')
      .select(CATALOG_SEARCH_SELECT)
      .order('part_number')
      .range(from, from + pageSize - 1);

    if (scope.mode === 'client') {
      query = query.filter('source_file', 'ilike', clientCatalogSourcePattern(scope.userId));
    }

    const { data, error } = await query;

    if (error || !data?.length) break;

    for (const row of data as CatalogSearchRow[]) {
      if (!rowMatchesScope(row.source_file, scope)) continue;
      if (catalogRowMatchesSearch(row, q)) {
        matches.push(row);
        if (matches.length >= limit) break;
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
    if (from > 50000) break;
  }

  return matches;
}

/**
 * Search catalog via DB RPC (part_number, search_text, extra JSON codes: Item Code, OEM, etc.).
 * Falls back to PostgREST .or(), then full-catalog scan including extra JSON.
 */
export async function searchPartsCatalog(
  term: string,
  limit = 100,
  scope: CatalogSearchScope = { mode: 'general' },
): Promise<{ data: CatalogSearchRow[]; error: string | null }> {
  const q = normalizeSearchTerm(term);
  if (!q) return { data: [], error: null };

  const rpcArgs: {
    p_query: string;
    p_limit: number;
    p_client_user_id?: string | null;
  } = {
    p_query: q,
    p_limit: limit,
    p_client_user_id: scope.mode === 'client' ? scope.userId : null,
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc('search_parts_catalog', rpcArgs);
  if (!rpcError && rpcData) {
    const strict = filterStrictMatches(rpcData as CatalogSearchRow[], q);
    if (strict.length > 0) {
      return { data: strict.slice(0, limit), error: null };
    }
  }

  const orFilter = buildCatalogSearchOrFilter(q);
  let dbQuery = supabase
    .from('parts_catalog')
    .select(CATALOG_SEARCH_SELECT)
    .order('part_number')
    .limit(limit * 2);

  if (scope.mode === 'client') {
    dbQuery = dbQuery.filter('source_file', 'ilike', clientCatalogSourcePattern(scope.userId));
    const deep = filterStrictMatches(await searchPartsCatalogDeep(q, limit * 3, scope), q);
    if (deep.length > 0) return { data: deep.slice(0, limit), error: null };
    if (rpcError) return { data: [], error: rpcError.message };
    return { data: [], error: null };
  }

  if (orFilter) dbQuery = dbQuery.or(orFilter);

  const { data, error } = await dbQuery;
  if (!error && data && data.length > 0) {
    const scoped = filterStrictMatches(filterByScope(data as CatalogSearchRow[], scope), q).slice(0, limit);
    if (scoped.length > 0) {
      return { data: scoped, error: null };
    }
  }

  const deep = filterStrictMatches(await searchPartsCatalogDeep(q, limit * 3, scope), q);
  if (deep.length > 0) {
    return { data: deep.slice(0, limit), error: null };
  }

  if (rpcError && error) {
    return { data: [], error: `${rpcError.message}; ${error.message}` };
  }
  if (error) return { data: [], error: error.message };
  if (rpcError) return { data: [], error: rpcError.message };
  return { data: [], error: null };
}

export function getStockLimit(stock: number | null | undefined): number | null {
  if (stock == null || stock === undefined) return null;
  return Math.max(0, Math.floor(stock));
}

/** Max units allowed in cart; null stock = no limit */
export function getMaxCartQty(stock: number | null | undefined): number {
  const lim = getStockLimit(stock);
  return lim === null ? Infinity : lim;
}

export function clampQtyInput(
  raw: string,
  maxStock: number | null,
): { value: string; num: number; overStock: boolean } {
  let val = raw.replace(/[^0-9]/g, '');
  if (val === '') return { value: '', num: 1, overStock: false };
  let num = Math.max(1, parseInt(val, 10) || 1);
  const overStock = maxStock !== null && num > maxStock;
  if (maxStock !== null && num > maxStock) {
    num = maxStock;
    val = String(maxStock);
  }
  return { value: val, num, overStock };
}

export function computeAddQty(
  partStock: number | null | undefined,
  existingQty: number,
  addQty: number,
): { qty: number; blocked: boolean; atMax: boolean; max: number } {
  const max = getMaxCartQty(partStock);
  if (max === 0) return { qty: 0, blocked: true, atMax: true, max: 0 };
  if (max === Infinity) {
    const qty = Math.max(1, Math.floor(addQty));
    return { qty, blocked: false, atMax: false, max: Infinity };
  }
  const safeAdd = Math.max(1, Math.floor(addQty));
  const newQty = Math.min(existingQty + safeAdd, max);
  const blocked = existingQty >= max;
  const atMax = newQty >= max;
  return { qty: newQty, blocked, atMax, max };
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { CLIENT_CATALOG_SOURCE_PREFIX } from './clientPriceList';
import { buildRecordsFromRows, parseWorkbookRows } from './excelCatalogParse';

const BATCH_SIZE = 200;

export type ExcelImportResult = {
  success: boolean;
  filename: string;
  totalRows: number;
  parsedRows: number;
  skippedEmpty: number;
  fallbackUsed: number;
  inserted: number;
  failed: number;
  detectedColumns: Record<string, unknown>;
  error?: string;
  lastInsertError?: string;
};

function toInsertPayload(record: Record<string, unknown>, mode: 'full' | 'core'): Record<string, unknown> {
  const base: Record<string, unknown> = {
    part_number: record.part_number,
    brand: record.brand ?? '',
    description: record.description ?? '',
    category: record.category ?? '',
    source_file: record.source_file ?? '',
  };

  const extra = record.extra;
  if (extra && typeof extra === 'object' && Object.keys(extra as object).length > 0) {
    base.extra = extra;
  }

  if (mode === 'core') return base;

  if (record.price != null) base.price = record.price;
  if (record.stock != null) base.stock = record.stock;
  if (record.coo != null && record.coo !== '') base.coo = record.coo;
  return base;
}

export async function insertCatalogRecords(
  supabase: SupabaseClient,
  records: Record<string, unknown>[],
): Promise<{ inserted: number; failed: number; lastError: string | null }> {
  let inserted = 0;
  let failed = 0;
  let lastError: string | null = null;

  async function insertChunk(chunk: Record<string, unknown>[], mode: 'full' | 'core'): Promise<boolean> {
    if (chunk.length === 0) return true;
    const payload = chunk.map(r => toInsertPayload(r, mode));
    const { error } = await supabase.from('parts_catalog').insert(payload);
    if (!error) {
      inserted += chunk.length;
      return true;
    }
    lastError = error.message;
    return false;
  }

  async function insertChunkSplit(chunk: Record<string, unknown>[], mode: 'full' | 'core'): Promise<void> {
    if (chunk.length === 0) return;
    if (await insertChunk(chunk, mode)) return;
    if (chunk.length === 1) {
      if (mode === 'full') {
        await insertChunkSplit(chunk, 'core');
        return;
      }
      failed += 1;
      return;
    }
    const mid = Math.floor(chunk.length / 2);
    await insertChunkSplit(chunk.slice(0, mid), mode);
    await insertChunkSplit(chunk.slice(mid), mode);
  }

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    await insertChunkSplit(records.slice(i, i + BATCH_SIZE), 'full');
  }

  if (inserted === 0 && records.length > 0) {
    inserted = 0;
    failed = 0;
    lastError = null;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      await insertChunkSplit(records.slice(i, i + BATCH_SIZE), 'core');
    }
  }

  return { inserted, failed, lastError };
}

/** Import via Supabase Edge Function (service role). */
export async function importExcelViaEdge(
  file: File,
  replaceExisting: boolean,
  accessToken: string,
): Promise<ExcelImportResult & { via: 'edge' }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('replaceExisting', replaceExisting ? 'true' : 'false');

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const res = await fetch(`${supabaseUrl}/functions/v1/process-excel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
    body: formData,
  });

  const result = await res.json().catch(() => ({}));
  const inserted = result.inserted ?? 0;
  const parsedRows = result.parsedRows ?? inserted;

  return {
    via: 'edge',
    success: res.ok && inserted > 0 && !result.error,
    filename: file.name,
    totalRows: result.totalRows ?? 0,
    parsedRows,
    skippedEmpty: result.skippedEmpty ?? 0,
    fallbackUsed: result.fallbackUsed ?? 0,
    inserted,
    failed: result.failed ?? 0,
    detectedColumns: result.detectedColumns ?? {},
    error: result.error || (!res.ok ? `HTTP ${res.status}` : inserted === 0 ? 'No rows inserted' : undefined),
    lastInsertError: result.error,
  };
}

/** Import Excel into parts_catalog from the browser (admin RLS). */
export async function importExcelCatalog(
  supabase: SupabaseClient,
  file: File,
  adminId: string,
  replaceExisting: boolean,
  sourceFileKey?: string,
): Promise<ExcelImportResult & { via: 'client' }> {
  const filename = file.name;
  const catalogSource = sourceFileKey ?? filename;
  const isClientCatalogImport = catalogSource.startsWith(CLIENT_CATALOG_SOURCE_PREFIX);

  let uploadId: string | null = null;
  let uploadInsertErr: { message: string } | null = null;

  if (!isClientCatalogImport) {
    const { data: uploadRecord, error } = await supabase
      .from('catalog_uploads')
      .insert({ admin_id: adminId, filename, status: 'processing', row_count: 0 })
      .select('id')
      .maybeSingle();
    uploadId = uploadRecord?.id ?? null;
    uploadInsertErr = error;
  }

  try {
    const rows = await parseWorkbookRows(file);

    if (rows.length === 0) {
      if (uploadId) {
        await supabase.from('catalog_uploads').update({ status: 'failed', error_message: 'File is empty' }).eq('id', uploadId);
      }
      return {
        via: 'client',
        success: false,
        filename,
        totalRows: 0,
        parsedRows: 0,
        skippedEmpty: 0,
        fallbackUsed: 0,
        inserted: 0,
        failed: 0,
        detectedColumns: {},
        error: 'File is empty or has no data rows',
      };
    }

    if (replaceExisting) {
      await supabase.from('parts_catalog').delete().eq('source_file', catalogSource);
    }

    const { records, skippedEmpty, fallbackUsed, detectedColumns } =
      buildRecordsFromRows(rows, catalogSource);

    if (records.length === 0) {
      const msg = 'No rows with part codes found in file';
      if (uploadId) {
        await supabase.from('catalog_uploads').update({ status: 'failed', error_message: msg }).eq('id', uploadId);
      }
      return {
        via: 'client',
        success: false,
        filename,
        totalRows: rows.length,
        parsedRows: 0,
        skippedEmpty,
        fallbackUsed,
        inserted: 0,
        failed: 0,
        detectedColumns,
        error: msg,
      };
    }

    const { inserted, failed, lastError } = await insertCatalogRecords(supabase, records);

    if (uploadId) {
      await supabase.from('catalog_uploads').update({
        row_count: inserted,
        status: inserted > 0 ? 'completed' : 'failed',
        error_message: inserted === 0 ? (lastError || 'No rows inserted') : null,
      }).eq('id', uploadId);
    }

    let errorMsg: string | undefined;
    if (inserted === 0) {
      if (lastError?.includes('row-level security') || lastError?.includes('policy')) {
        errorMsg = 'Access denied: admin rights required to import catalog';
      } else {
        errorMsg = lastError || 'No rows inserted';
      }
    }

    return {
      via: 'client',
      success: inserted > 0,
      filename,
      totalRows: rows.length,
      parsedRows: records.length,
      skippedEmpty,
      fallbackUsed,
      inserted,
      failed,
      detectedColumns,
      error: errorMsg,
      lastInsertError: lastError ?? undefined,
    };
  } catch (err) {
    const msg = String(err);
    if (uploadId) {
      await supabase.from('catalog_uploads').update({ status: 'failed', error_message: msg }).eq('id', uploadId);
    }
    return {
      via: 'client',
      success: false,
      filename,
      totalRows: 0,
      parsedRows: 0,
      skippedEmpty: 0,
      fallbackUsed: 0,
      inserted: 0,
      failed: 0,
      detectedColumns: {},
      error: msg,
    };
  } finally {
    if (uploadInsertErr && !uploadId) {
      console.warn('[catalog_uploads]', uploadInsertErr.message);
    }
  }
}

/** Client import first (correct column mapping); edge only if client fails. */
export async function importExcelAuto(
  supabase: SupabaseClient,
  file: File,
  adminId: string,
  replaceExisting: boolean,
  accessToken: string,
): Promise<ExcelImportResult & { via: 'edge' | 'client' }> {
  const client = await importExcelCatalog(supabase, file, adminId, replaceExisting);
  if (client.success) return client;

  let edgeError: string | undefined;
  try {
    const edge = await importExcelViaEdge(file, replaceExisting, accessToken);
    if (edge.success) return edge;
    edgeError = edge.error;
  } catch (err) {
    edgeError = String(err);
  }

  return {
    ...client,
    error: client.error || edgeError || 'Import failed',
    lastInsertError: client.lastInsertError || edgeError,
  };
}

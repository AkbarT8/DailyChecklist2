import { supabase } from './supabase';
import { importExcelCatalog } from './excelCatalogImport';

export const CLIENT_CATALOG_SOURCE_PREFIX = 'client:';
export const CLIENT_CATALOG_STORAGE_PREFIX = 'client-catalog/';
export const CLIENT_CATALOG_MIME_TYPE = 'application/vnd.papco.client-catalog';

export function clientCatalogSourceKey(userId: string): string {
  return `${CLIENT_CATALOG_SOURCE_PREFIX}${userId}`;
}

export function clientCatalogSourcePrefixForUser(userId: string): string {
  return `${CLIENT_CATALOG_SOURCE_PREFIX}${userId}:`;
}

/** PostgREST ilike pattern — do not use .like() (breaks on `client:uuid` paths). */
export function clientCatalogSourcePattern(userId: string): string {
  return `${clientCatalogSourcePrefixForUser(userId)}%`;
}

export function buildClientCatalogSourceKey(userId: string, sourceToken: string): string {
  return `${clientCatalogSourcePrefixForUser(userId)}${sourceToken}`;
}

export function userIdFromCatalogSource(sourceFile: string | null | undefined): string | null {
  if (!sourceFile?.startsWith(CLIENT_CATALOG_SOURCE_PREFIX)) return null;
  const id = sourceFile.slice(CLIENT_CATALOG_SOURCE_PREFIX.length).split(':')[0];
  return id.length > 0 ? id : null;
}

export function isClientCatalogSource(sourceFile: string | null | undefined): boolean {
  return (sourceFile ?? '').startsWith(CLIENT_CATALOG_SOURCE_PREFIX);
}

export function isClientCatalogStoredFile(filePath: string | null | undefined): boolean {
  return (filePath ?? '').startsWith(CLIENT_CATALOG_STORAGE_PREFIX);
}

function filenameFromCatalogPath(filePath: string | null | undefined): string | null {
  if (!isClientCatalogStoredFile(filePath)) return null;
  const raw = (filePath ?? '').split('/').pop() ?? '';
  const encoded = raw.includes('__') ? raw.split('__').slice(1).join('__') : raw;
  if (!encoded) return null;
  return encoded.replace(/_/g, ' ');
}

function isPlaceholderCatalogFilename(filename: string | null | undefined): boolean {
  const lower = (filename ?? '').trim().toLowerCase();
  return lower === 'imported client catalog' || lower === 'client catalog';
}

export function isPriceListFile(filename: string, mimeType?: string | null): boolean {
  const lower = filename.toLowerCase();
  if (/\.(xlsx|xls|csv)$/.test(lower)) return true;
  const mime = (mimeType ?? '').toLowerCase();
  return mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\]/g, '_').replace(/\s+/g, '_');
}

export function clientCatalogStoragePath(userId: string, sourceToken: string, filename: string): string {
  return `${CLIENT_CATALOG_STORAGE_PREFIX}${userId}/${sourceToken}__${sanitizeFilename(filename)}`;
}

function sourceKeyFromPath(filePath: string, userId: string): string | null {
  if (!isClientCatalogStoredFile(filePath)) return null;
  const prefix = `${CLIENT_CATALOG_STORAGE_PREFIX}${userId}/`;
  if (!filePath.startsWith(prefix)) return null;
  const rest = filePath.slice(prefix.length);
  const token = rest.split('__')[0];
  if (!token) return null;
  return buildClientCatalogSourceKey(userId, token);
}

/** Client catalog is active when admin imported parts for this client. */
export async function clientHasActivePriceList(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('parts_catalog')
    .select('id')
    .filter('source_file', 'ilike', clientCatalogSourcePattern(userId))
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/** User IDs that currently have an imported client catalog. */
export async function listActiveClientCatalogUserIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('parts_catalog')
    .select('source_file')
    .like('source_file', `${CLIENT_CATALOG_SOURCE_PREFIX}%`);

  if (error || !data?.length) return [];

  const ids = new Set<string>();
  for (const row of data) {
    const id = userIdFromCatalogSource(row.source_file);
    if (id) ids.add(id);
  }
  return [...ids];
}

export type ClientCatalogStoredFile = {
  id: string;
  user_id: string;
  request_id: string | null;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  virtual?: boolean;
  profiles?: { full_name: string; company_name: string } | null;
};

type StorageCatalogFile = {
  id: string;
  user_id: string;
  request_id: string | null;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  virtual: true;
  profiles?: { full_name: string; company_name: string } | null;
};

function attachmentIsClientCatalog(
  file: { user_id: string; file_path: string; filename: string; mime_type?: string | null },
  activeUserIds: Set<string>,
): boolean {
  if (file.mime_type === CLIENT_CATALOG_MIME_TYPE) return true;
  if (isClientCatalogStoredFile(file.file_path)) return true;
  return activeUserIds.has(file.user_id) && isPriceListFile(file.filename, file.mime_type);
}

async function listCatalogFilesFromStorage(userId: string): Promise<StorageCatalogFile[]> {
  const folder = `${CLIENT_CATALOG_STORAGE_PREFIX}${userId}`;
  const { data, error } = await supabase.storage.from('admin-files').list(folder, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error || !data?.length) return [];

  return data
    .filter(item => item.name && !item.name.endsWith('/'))
    .map(item => {
      const filePath = `${folder}/${item.name}`;
      return {
        id: `storage-${userId}-${item.name}`,
        user_id: userId,
        request_id: null,
        filename: filenameFromCatalogPath(filePath) ?? item.name,
        file_path: filePath,
        file_size: item.metadata?.size ?? 0,
        mime_type: CLIENT_CATALOG_MIME_TYPE,
        uploaded_at: item.created_at ?? item.updated_at ?? new Date().toISOString(),
        virtual: true as const,
      };
    });
}

/** Rows for admin Stored Files (includes legacy uploads + catalog without file row). */
export async function fetchClientCatalogStoredFiles(): Promise<ClientCatalogStoredFile[]> {
  const activeUserIds = new Set(await listActiveClientCatalogUserIds());

  const { data: taggedFiles } = await supabase
    .from('file_attachments')
    .select('*, profiles(full_name, company_name)')
    .eq('mime_type', CLIENT_CATALOG_MIME_TYPE)
    .order('uploaded_at', { ascending: false });

  const { data: pathFiles } = await supabase
    .from('file_attachments')
    .select('*, profiles(full_name, company_name)')
    .like('file_path', `${CLIENT_CATALOG_STORAGE_PREFIX}%`)
    .order('uploaded_at', { ascending: false });

  const rows: ClientCatalogStoredFile[] = [
    ...((taggedFiles ?? []) as ClientCatalogStoredFile[]),
    ...((pathFiles ?? []) as ClientCatalogStoredFile[]),
  ].filter(r => attachmentIsClientCatalog(r, activeUserIds));

  const seen = new Set<string>();
  const uniqueRows: ClientCatalogStoredFile[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const normalizedFromPath = filenameFromCatalogPath(r.file_path);
    uniqueRows.push({
      ...r,
      filename: (isPlaceholderCatalogFilename(r.filename) && normalizedFromPath)
        ? normalizedFromPath
        : r.filename,
    });
  }

  const usersWithAnyRow = new Set(uniqueRows.map(r => r.user_id));
  for (const userId of activeUserIds) {
    if (!usersWithAnyRow.has(userId)) {
      const storageRows = await listCatalogFilesFromStorage(userId);
      if (storageRows.length > 0) {
        uniqueRows.push(...storageRows);
        continue;
      }
      uniqueRows.push({
        id: `catalog-active-${userId}`,
        user_id: userId,
        request_id: null,
        filename: 'Imported client catalog',
        file_path: '',
        file_size: 0,
        mime_type: CLIENT_CATALOG_MIME_TYPE,
        uploaded_at: new Date().toISOString(),
        virtual: true,
      });
    }
  }

  return uniqueRows.sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
  );
}

/** Remove catalog rows and all client-catalog file records for a client. */
export async function deleteClientPriceList(userId: string): Promise<void> {
  const { data: files } = await supabase
    .from('file_attachments')
    .select('id, file_path, filename, mime_type')
    .eq('user_id', userId);

  const toRemove = (files ?? []).filter(
    f =>
      f.mime_type === CLIENT_CATALOG_MIME_TYPE ||
      isClientCatalogStoredFile(f.file_path),
  );

  if (toRemove.length) {
    const paths = toRemove.map(f => f.file_path).filter(Boolean);
    if (paths.length) {
      await supabase.storage.from('admin-files').remove(paths);
    }
    await supabase.from('file_attachments').delete().in('id', toRemove.map(f => f.id));
  }

  await supabase
    .from('parts_catalog')
    .delete()
    .like('source_file', `${clientCatalogSourcePrefixForUser(userId)}%`);
}

export async function deleteClientPriceListFile(file: ClientCatalogStoredFile): Promise<void> {
  if (!file.virtual && file.id) {
    await supabase.from('file_attachments').delete().eq('id', file.id);
  }
  if (file.file_path) {
    await supabase.storage.from('admin-files').remove([file.file_path]);
  }
  const sourceKey = sourceKeyFromPath(file.file_path, file.user_id);
  if (sourceKey) {
    await supabase.from('parts_catalog').delete().eq('source_file', sourceKey);
    return;
  }
  if (file.id.startsWith('catalog-active-')) {
    await supabase
      .from('parts_catalog')
      .delete()
      .or(
        `source_file.eq.${clientCatalogSourceKey(file.user_id)},source_file.like.${clientCatalogSourcePrefixForUser(file.user_id)}%`,
      );
  }
}

export type UploadClientPriceListResult = {
  success: boolean;
  fileId?: string;
  inserted?: number;
  error?: string;
};

/** Import Excel into client catalog, then store file for admin Stored Files. */
export async function uploadClientPriceList(
  file: File,
  userId: string,
  adminId: string,
): Promise<UploadClientPriceListResult> {
  if (!isPriceListFile(file.name, file.type)) {
    return { success: false, error: 'Only Excel or CSV price lists are supported' };
  }

  const sourceToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sourceKey = buildClientCatalogSourceKey(userId, sourceToken);

  const imported = await importExcelCatalog(
    supabase,
    file,
    adminId,
    true,
    sourceKey,
  );

  if (!imported.success || imported.inserted === 0) {
    return {
      success: false,
      error: imported.error || 'Could not import price list into catalog',
    };
  }

  const path = clientCatalogStoragePath(userId, sourceToken, file.name);
  const { error: uploadError } = await supabase.storage.from('admin-files').upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  if (uploadError) {
    await supabase.from('parts_catalog').delete().eq('source_file', sourceKey);
    return { success: false, error: uploadError.message };
  }

  const { data: inserted, error: dbError } = await supabase
    .from('file_attachments')
    .insert({
      user_id: userId,
      request_id: null,
      filename: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: CLIENT_CATALOG_MIME_TYPE,
    })
    .select('id')
    .single();

  if (dbError) {
    await supabase.storage.from('admin-files').remove([path]);
    await supabase.from('parts_catalog').delete().eq('source_file', sourceKey);
    return { success: false, error: dbError.message };
  }

  return { success: true, fileId: inserted?.id, inserted: imported.inserted };
}

/** Hide catalog imports from My Requests — admin-sent files always stay visible. */
export function shouldHideFromClientRequests(
  file: { file_path: string; filename: string; mime_type?: string | null },
): boolean {
  if (isClientCatalogStoredFile(file.file_path)) return true;
  if ((file.mime_type ?? '') === CLIENT_CATALOG_MIME_TYPE) return true;
  return false;
}

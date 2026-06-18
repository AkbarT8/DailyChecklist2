import { supabase } from './supabase';

export interface ClientFileRef {
  id: string;
  filename: string;
  file_path: string;
  mime_type?: string;
}

export const FILE_MISSING_MSG =
  'File is missing on the server. Please remove this line and ask the administrator to send the file again.';

export function isFileMissingError(message: string): boolean {
  return /object not found|file.?missing|не найден|отсутствует/i.test(message);
}

function openBlob(blob: Blob, filename: string, mode: 'open' | 'download') {
  const url = URL.createObjectURL(blob);
  if (mode === 'open') {
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Use signed URL directly — avoids CORS fetch errors */
function openSignedUrl(url: string, filename: string, mode: 'open' | 'download') {
  if (mode === 'open') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Edge function signed URL (service role). Returns null if unavailable. */
async function getSignedUrlViaEdge(fileId: string): Promise<string | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!supabaseUrl || !anonKey) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/client-file-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ file_id: fileId }),
    });

    const payload = await res.json().catch(() => null) as {
      signedUrl?: string;
      error?: string;
    } | null;

    if (payload?.error === 'FILE_MISSING') {
      throw new Error(FILE_MISSING_MSG);
    }
    if (!res.ok || !payload?.signedUrl) return null;
    return payload.signedUrl;
  } catch (e) {
    if (e instanceof Error && isFileMissingError(e.message)) throw e;
    return null;
  }
}

/**
 * Open or download client price list from admin-files bucket.
 */
export async function accessClientFile(
  file: ClientFileRef,
  mode: 'open' | 'download',
): Promise<void> {
  const storagePath = file.file_path?.replace(/^\//, '').trim() ?? '';

  // 1) Server link (service role) — most reliable when deployed
  const edgeUrl = await getSignedUrlViaEdge(file.id);
  if (edgeUrl) {
    openSignedUrl(edgeUrl, file.filename, mode);
    return;
  }

  // 2) Direct download via Supabase API (RLS)
  if (storagePath) {
    const { data: blob, error: dlErr } = await supabase.storage
      .from('admin-files')
      .download(storagePath);

    if (!dlErr && blob && blob.size > 0) {
      openBlob(blob, file.filename, mode);
      return;
    }

    if (dlErr && isFileMissingError(dlErr.message)) {
      throw new Error(FILE_MISSING_MSG);
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from('admin-files')
      .createSignedUrl(storagePath, 3600);

    if (!signErr && signed?.signedUrl) {
      openSignedUrl(signed.signedUrl, file.filename, mode);
      return;
    }

    if (signErr && isFileMissingError(signErr.message)) {
      throw new Error(FILE_MISSING_MSG);
    }
  }

  throw new Error(FILE_MISSING_MSG);
}

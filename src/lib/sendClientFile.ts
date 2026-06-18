import { supabase } from './supabase';
import { sendPriceListEmail } from './sendPriceListEmail';

export type SendClientFileResult = {
  success: boolean;
  id?: string;
  file_path?: string;
  filename?: string;
  error?: string;
};

const SENT_FILE_STORAGE_PREFIX = 'sent/';

function makeStoragePath(filename: string): string {
  const safe = filename.replace(/[/\\]/g, '_').replace(/\s+/g, '_');
  return `${SENT_FILE_STORAGE_PREFIX}${Date.now()}_${safe}`;
}

/** My Requests row so the client sees admin deliveries after re-login. */
async function createAdminFileRequest(
  userId: string,
  filename: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_requests')
    .insert({
      user_id: userId,
      type: 'admin_file',
      query: filename,
      status: 'processed',
    })
    .select('id')
    .single();

  if (error || !data?.id) return null;
  return data.id;
}

/** Edge upload (optional — needs send-client-file deployed). Never throws. */
async function sendClientFileViaEdge(
  file: File,
  userId: string,
  requestId: string | null,
): Promise<SendClientFileResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!supabaseUrl || !anonKey) {
    return { success: false, error: 'Supabase not configured' };
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { success: false, error: 'Not authenticated' };
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('user_id', userId);
  if (requestId) formData.append('request_id', requestId);

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-client-file`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
      },
      body: formData,
    });

    const payload = await res.json().catch(() => null) as SendClientFileResult & { error?: string };
    if (!res.ok || !payload?.success) {
      return { success: false, error: payload?.error || `Server (${res.status})` };
    }
    void sendPriceListEmail(userId);
    return payload;
  } catch {
    return { success: false, error: 'Edge function unavailable' };
  }
}

/** Direct Storage upload + DB row (works without Edge deploy). */
async function sendClientFileDirect(
  file: File,
  userId: string,
  requestId: string | null,
): Promise<SendClientFileResult> {
  const path = makeStoragePath(file.name);

  const { error: uploadError } = await supabase.storage.from('admin-files').upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  const { data: verifyBlob, error: verifyErr } = await supabase.storage
    .from('admin-files')
    .download(path);

  if (verifyErr || !verifyBlob || verifyBlob.size < 1) {
    await supabase.storage.from('admin-files').remove([path]);
    return {
      success: false,
      error: verifyErr?.message || 'Файл не сохранился в Storage. Проверьте права администратора.',
    };
  }

  let linkedRequestId = requestId;
  if (!linkedRequestId) {
    linkedRequestId = await createAdminFileRequest(userId, file.name);
  }

  const { data: inserted, error: dbError } = await supabase
    .from('file_attachments')
    .insert({
      user_id: userId,
      request_id: linkedRequestId,
      filename: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
    })
    .select('id, file_path')
    .single();

  if (dbError) {
    await supabase.storage.from('admin-files').remove([path]);
    return { success: false, error: dbError.message };
  }

  if (requestId) {
    await supabase.from('user_requests').update({ status: 'processed' }).eq('id', requestId);
  }

  void sendPriceListEmail(userId);

  return {
    success: true,
    id: inserted?.id,
    file_path: path,
    filename: file.name,
  };
}

/**
 * Send price list to client: direct upload first, Edge fallback if direct fails.
 */
export async function sendClientFile(
  file: File,
  userId: string,
  requestId: string | null,
): Promise<SendClientFileResult> {
  const direct = await sendClientFileDirect(file, userId, requestId);
  if (direct.success) return direct;

  const edge = await sendClientFileViaEdge(file, userId, requestId);
  if (edge.success) return edge;

  return {
    success: false,
    error: direct.error || edge.error || 'Upload failed',
  };
}

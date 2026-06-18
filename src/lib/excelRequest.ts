import { supabase } from './supabase';
import { edgeFetch } from './edgeFetch';
import { notifyExcelRequest } from './notifyRequests';

export type SubmitExcelRequestInput = {
  userId: string;
  file: File;
  note: string;
  userFullName: string;
  userCompany: string;
  userEmail: string;
  userPhone: string;
};

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Direct upload + DB row (works without edge function). */
async function submitExcelRequestDirect(input: SubmitExcelRequestInput): Promise<void> {
  const path = `excel-requests/${input.userId}/${Date.now()}_${safeFileName(input.file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from('user-requests')
    .upload(path, input.file, {
      upsert: false,
      contentType: input.file.type || 'application/octet-stream',
    });

  if (uploadError) throw new Error(uploadError.message);

  const queryText = `File: ${input.file.name}${input.note ? ` | Note: ${input.note}` : ''}`;
  const { error: dbErr } = await supabase.from('user_requests').insert({
    user_id: input.userId,
    type: 'excel_request',
    query: queryText,
    file_url: path,
    status: 'pending',
  });
  if (dbErr) {
    await supabase.storage.from('user-requests').remove([path]);
    throw new Error(dbErr.message);
  }

  const { data: publicData } = supabase.storage.from('user-requests').getPublicUrl(path);
  const downloadUrl = publicData?.publicUrl || undefined;

  void notifyExcelRequest({
    userFullName: input.userFullName,
    userCompany: input.userCompany,
    userEmail: input.userEmail,
    userPhone: input.userPhone,
    fileName: input.file.name,
    fileNote: input.note,
    downloadUrl,
  });
}

/** Edge upload first, direct fallback if edge is unavailable. */
export async function submitExcelRequest(input: SubmitExcelRequestInput): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('note', input.note);
  formData.append('userFullName', input.userFullName);
  formData.append('userCompany', input.userCompany);
  formData.append('userEmail', input.userEmail);
  formData.append('userPhone', input.userPhone);

  try {
    const res = await edgeFetch('upload-excel-request', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const result = await res.json().catch(() => ({})) as { error?: string };
    if (res.ok) return;
    console.warn('upload-excel-request edge failed:', result.error || res.status);
  } catch (err) {
    console.warn('upload-excel-request edge unavailable:', err);
  }

  await submitExcelRequestDirect(input);
}

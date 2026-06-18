import { supabase } from './supabase';
import { clientCatalogSourceKey, deleteClientPriceList } from './clientPriceList';

export const DELETED_USER_EMAIL_PREFIX = '__deleted__';
export const DELETED_EMAIL_MARKER = 'original_email:';

type DeleteUserResult = { ok: boolean; error?: string };

export function isDeletedUserProfile(profile: { email?: string | null }): boolean {
  return (profile.email ?? '').startsWith(DELETED_USER_EMAIL_PREFIX);
}

/** Profile or auth row left behind after admin removed the client. */
export function isRemovedClientAccount(profile: {
  email?: string | null;
  rejection_reason?: string | null;
}): boolean {
  if (isDeletedUserProfile(profile)) return true;
  return (profile.rejection_reason ?? '').includes('Account deleted by administrator');
}

/** Block re-registration only for active (non-removed) accounts. */
export function blocksRegistration(profile: {
  email?: string | null;
  rejection_reason?: string | null;
} | null | undefined): boolean {
  if (!profile) return false;
  return !isRemovedClientAccount(profile);
}

export function deletedProfileOriginalEmail(rejectionReason: string | null | undefined): string | null {
  if (!rejectionReason?.includes(DELETED_EMAIL_MARKER)) return null;
  const part = rejectionReason.split(DELETED_EMAIL_MARKER)[1]?.split('|')[0]?.trim();
  return part || null;
}

export function buildDeletedRejectionReason(originalEmail: string): string {
  return `Account deleted by administrator|${DELETED_EMAIL_MARKER}${originalEmail.toLowerCase().trim()}`;
}

/** Free auth email after admin soft-delete so the client can register again. */
export async function reclaimDeletedEmail(email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return false;

  const tryRpc = async () => {
    const { data, error } = await supabase.rpc('reclaim_deleted_email', {
      p_email: normalized,
    });
    return !error && (data as { success?: boolean } | null)?.success === true;
  };

  if (await tryRpc()) return true;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!supabaseUrl || !anonKey) return false;

  try {
    const params = new URLSearchParams({ action: 'reclaim', email: normalized });
    const res = await fetch(`${supabaseUrl}/functions/v1/approve-user?${params.toString()}`, {
      headers: { Authorization: `Bearer ${anonKey}` },
    });
    const payload = await res.json().catch(() => null) as { success?: boolean } | null;
    if (res.ok && payload?.success === true) return true;
  } catch {
    // fall through to second RPC attempt
  }

  return tryRpc();
}

/** True when an active (non-removed) account still owns this email. */
export async function emailBlocksRegistration(email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return false;

  const { data, error } = await supabase.rpc('email_blocks_registration', {
    p_email: normalized,
  });
  if (error) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('email, rejection_reason')
      .eq('email', normalized)
      .maybeSingle();
    return blocksRegistration(existing);
  }

  return data === true;
}

function parseRpcResult(data: unknown): DeleteUserResult {
  const row = data as { success?: boolean; error?: string } | null;
  if (row?.success) return { ok: true };
  return { ok: false, error: row?.error || 'Delete failed' };
}

async function deleteUserViaEdge(userId: string): Promise<DeleteUserResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!supabaseUrl || !anonKey) {
    return { ok: false, error: 'Supabase not configured' };
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: 'Not authenticated' };
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    const payload = await res.json().catch(() => null) as { success?: boolean; error?: string } | null;
    if (!res.ok || !payload?.success) {
      return { ok: false, error: payload?.error || `Server error (${res.status})` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'edge_unavailable' };
  }
}

/** Works with admin RLS only — no SQL migration or edge deploy required. */
async function deleteUserDirect(userId: string): Promise<DeleteUserResult> {
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, is_admin, email')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr) return { ok: false, error: profileErr.message };
  if (!profile) return { ok: false, error: 'User not found' };
  if (profile.is_admin) return { ok: false, error: 'Cannot delete admin account' };
  if (isDeletedUserProfile(profile)) return { ok: true };

  const originalEmail = (profile.email ?? '').toLowerCase().trim();

  try {
    await deleteClientPriceList(userId);
  } catch {
    // continue — catalog cleanup is best-effort
  }

  await supabase.from('parts_catalog').delete().eq('source_file', clientCatalogSourceKey(userId));
  await supabase.from('unavailable_searches').delete().eq('user_id', userId);
  await supabase.from('user_requests').delete().eq('user_id', userId);

  const { data: files } = await supabase
    .from('file_attachments')
    .select('id, file_path')
    .eq('user_id', userId);

  const paths = (files ?? []).map(f => f.file_path).filter(Boolean);
  if (paths.length) {
    await supabase.storage.from('admin-files').remove(paths);
  }
  if (files?.length) {
    await supabase.from('file_attachments').delete().in('id', files.map(f => f.id));
  }

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({
      registration_status: 'rejected',
      rejection_reason: buildDeletedRejectionReason(originalEmail),
      full_name: '[Deleted user]',
      company_name: '',
      phone: '',
      country: '',
      city: '',
      address: '',
      email: `${DELETED_USER_EMAIL_PREFIX}${userId}@removed.local`,
    })
    .eq('id', userId);

  if (updateErr) return { ok: false, error: updateErr.message };

  await reclaimDeletedEmail(originalEmail);
  return { ok: true };
}

/** Delete client account: RPC → edge → direct admin cleanup. */
export async function deleteUserAccount(userId: string): Promise<DeleteUserResult> {
  const { data, error } = await supabase.rpc('admin_delete_user', {
    target_user_id: userId,
  });

  if (!error) {
    const rpc = parseRpcResult(data);
    if (rpc.ok) return rpc;
  }

  const missingRpc =
    error == null
    || error.code === 'PGRST202'
    || /could not find the function|admin_delete_user/i.test(error.message);

  if (!missingRpc && error) {
    return { ok: false, error: error.message };
  }

  const edge = await deleteUserViaEdge(userId);
  if (edge.ok) return edge;

  return deleteUserDirect(userId);
}

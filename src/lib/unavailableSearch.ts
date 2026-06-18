import { supabase } from './supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface UnavailableLogProfile {
  full_name?: string | null;
  company_name?: string | null;
  email?: string | null;
}

function formatClientName(
  fullName: string | null | undefined,
  companyName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = fullName?.trim();
  const company = companyName?.trim();
  if (name && company) return `${name} — ${company}`;
  if (name) return name;
  if (company) return company;
  if (email) return email;
  return 'Unknown client';
}

/** Save a failed catalog search for admin "Unavailable Parts". */
export async function logUnavailableSearch(
  user: SupabaseUser,
  profile: UnavailableLogProfile | null,
  searchQuery: string,
): Promise<{ ok: boolean; error?: string }> {
  const term = searchQuery.trim();
  if (!term) return { ok: false, error: 'empty query' };

  let fullName = profile?.full_name ?? null;
  let companyName = profile?.company_name ?? null;
  let email = profile?.email ?? user.email ?? null;

  if (!fullName?.trim()) {
    const { data: row } = await supabase
      .from('profiles')
      .select('full_name, company_name, email')
      .eq('id', user.id)
      .maybeSingle();
    if (row) {
      fullName = row.full_name;
      companyName = row.company_name ?? companyName;
      email = row.email ?? email;
    }
  }

  const clientName = formatClientName(fullName, companyName, email);

  const { error: rpcError } = await supabase.rpc('log_unavailable_search', {
    p_search_query: term,
    p_client_name: clientName,
  });
  if (!rpcError) return { ok: true };

  const attempts: Record<string, unknown>[] = [
    { user_id: user.id, search_query: term },
    { user_id: user.id, search_query: term, client_name: clientName },
    {
      user_id: user.id,
      search_query: term,
      searched_code: term,
      client_name: clientName,
      status: 'not_found',
    },
  ];

  let lastError = rpcError?.message ?? 'unknown';
  for (const payload of attempts) {
    const { error } = await supabase.from('unavailable_searches').insert(payload);
    if (!error) return { ok: true };
    lastError = error.message;
    if (!/column|schema cache/i.test(error.message)) break;
  }

  console.error('[unavailable_searches]', lastError);
  return { ok: false, error: lastError };
}

/** Resolve display name for admin table (DB snapshot + live profile fallback). */
export function resolveUnavailableClientName(
  storedName: string | null | undefined,
  profile?: { full_name?: string; company_name?: string; email?: string } | null,
): string {
  if (storedName?.trim()) return storedName.trim();
  if (profile) {
    return formatClientName(profile.full_name, profile.company_name, profile.email);
  }
  return '—';
}

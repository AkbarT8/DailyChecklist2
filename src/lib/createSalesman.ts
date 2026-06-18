import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { edgeFetch } from './edgeFetch';

export type CreateSalesmanInput = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  notes: string;
};

async function createSalesmanViaEdge(input: CreateSalesmanInput): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await edgeFetch('create-salesman', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });

  const result = await res.json().catch(() => ({})) as { error?: string; success?: boolean };
  if (!res.ok || result.error) {
    throw new Error(result.error || `Server error (${res.status})`);
  }
}

/** Isolated signUp + admin profile insert (no edge deploy required). */
async function createSalesmanDirect(input: CreateSalesmanInput): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const isolated = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: 'papco-salesman-create',
    },
  });

  const { data: authData, error: authError } = await isolated.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.full_name } },
  });

  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error('Failed to create salesman account');

  const { error: profileError } = await supabase.from('salesman_profiles').insert({
    id: authData.user.id,
    full_name: input.full_name,
    email: input.email,
    phone: input.phone,
    notes: input.notes,
    is_active: true,
  });

  if (profileError) {
    throw new Error(profileError.message);
  }
}

export async function createSalesmanAccount(input: CreateSalesmanInput): Promise<void> {
  try {
    await createSalesmanViaEdge(input);
    return;
  } catch (edgeErr) {
    console.warn('create-salesman edge failed, trying direct:', edgeErr);
  }

  await createSalesmanDirect(input);
}

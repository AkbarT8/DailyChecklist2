/** Supabase Edge Function fetch with required apikey header. */
export async function edgeFetch(
  functionName: string,
  init: RequestInit = {},
): Promise<Response> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase not configured');
  }

  const headers = new Headers(init.headers);
  headers.set('apikey', anonKey);
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${anonKey}`);
  }

  return fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    ...init,
    headers,
  });
}

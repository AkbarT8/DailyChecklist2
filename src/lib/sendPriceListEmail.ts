import { edgeFetch } from './edgeFetch';
import { supabase } from './supabase';

const SITE_URL = 'https://papco-online-platform.netlify.app';

/** Email client after admin sends a price list — never throws. */
export async function sendPriceListEmail(userId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await edgeFetch('send-price-list-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userId, siteUrl: SITE_URL }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { error?: string };
      console.error('sendPriceListEmail failed:', payload.error || res.status);
    }
  } catch (err) {
    console.error('sendPriceListEmail error:', err);
  }
}

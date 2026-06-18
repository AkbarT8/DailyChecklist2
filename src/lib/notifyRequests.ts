import { edgeFetch } from './edgeFetch';
import { supabase } from './supabase';

const WHATSAPP_PHONE = '971547713447';

type PriceListNotify = {
  userFullName: string;
  userCompany: string;
  userEmail: string;
  userPhone: string;
  brand: string;
  note: string;
};

type ExcelNotify = {
  userFullName: string;
  userCompany: string;
  userEmail: string;
  userPhone: string;
  fileName: string;
  fileNote: string;
  downloadUrl?: string;
};

async function callMeBot(message: string): Promise<void> {
  const apiKey = import.meta.env.VITE_CALLMEBOT_API_KEY as string | undefined;
  if (!apiKey) return;

  const url =
    `https://api.callmebot.com/whatsapp.php?phone=${WHATSAPP_PHONE}` +
    `&text=${encodeURIComponent(message)}` +
    `&apikey=${encodeURIComponent(apiKey)}`;

  try {
    await fetch(url);
  } catch (err) {
    console.warn('CallMeBot fallback failed:', err);
  }
}

function dubaiNow(): string {
  return new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai',
  });
}

/** Notify team about price list request — never throws. */
export async function notifyPriceListRequest(payload: PriceListNotify): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

  try {
    const res = await edgeFetch('notify-whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type: 'pricelist_request', ...payload }),
    });
    if (res.ok) return;
  } catch {
    // fall through to CallMeBot
  }

  const message = [
    '💰 PRICE LIST REQUEST BY BRAND',
    `📅 ${dubaiNow()}`,
    '',
    `👤 Client: ${payload.userFullName}`,
    `🏢 Company: ${payload.userCompany || '—'}`,
    `📧 Email: ${payload.userEmail}`,
    `📞 Phone: ${payload.userPhone || '—'}`,
    '',
    `🔖 Brand: ${payload.brand}`,
    payload.note ? `📝 Note: ${payload.note}` : '',
    '',
    'Please send the price list to the client.',
  ].filter(Boolean).join('\n');

  await callMeBot(message);
}

/** Notify team about excel request — never throws. */
export async function notifyExcelRequest(payload: ExcelNotify): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

  try {
    const res = await edgeFetch('notify-whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'excel_request',
        userFullName: payload.userFullName,
        userCompany: payload.userCompany,
        userEmail: payload.userEmail,
        userPhone: payload.userPhone,
        fileName: payload.fileName,
        fileNote: payload.fileNote,
      }),
    });
    if (res.ok) return;
  } catch {
    // fall through
  }

  const message = [
    '📋 NEW EXCEL INQUIRY',
    `📅 ${dubaiNow()}`,
    '',
    `👤 Client: ${payload.userFullName}`,
    `🏢 Company: ${payload.userCompany || '—'}`,
    `📧 Email: ${payload.userEmail}`,
    `📞 Phone: ${payload.userPhone || '—'}`,
    '',
    `📎 File: ${payload.fileName}`,
    payload.downloadUrl ? `🔗 Download: ${payload.downloadUrl}` : '',
    payload.fileNote ? `📝 Note: ${payload.fileNote}` : '',
    '',
    'Please process this parts list request.',
  ].filter(Boolean).join('\n');

  await callMeBot(message);
}

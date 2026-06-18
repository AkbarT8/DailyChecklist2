import { edgeFetch } from './edgeFetch';
import { supabase } from './supabase';
import { sendWhatsAppNotification } from './whatsappNotification';

export type RegistrationNotifyPayload = {
  userId: string;
  fullName: string;
  companyName: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  email: string;
  registeredAt: string;
};

/** Notify admin about a new registration (WhatsApp + email). Never throws. */
export async function notifyRegistrationRequest(payload: RegistrationNotifyPayload): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

  try {
    const res = await edgeFetch('send-registration-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return;
  } catch {
    // fall through
  }

  try {
    const res = await edgeFetch('notify-whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'registration',
        userFullName: payload.fullName,
        userCompany: payload.companyName,
        userEmail: payload.email,
        userPhone: payload.phone,
        registeredAt: payload.registeredAt,
      }),
    });
    if (res.ok) return;
  } catch {
    // fall through
  }

  await sendWhatsAppNotification({
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    registeredAt: payload.registeredAt,
  });
}

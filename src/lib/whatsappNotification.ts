const WHATSAPP_PHONE = '971547713447';

export type RegistrationWhatsAppPayload = {
  fullName: string;
  email: string;
  phone: string;
  registeredAt?: string;
};

/** Send registration alert via CallMeBot (non-blocking). */
export async function sendWhatsAppNotification(payload: RegistrationWhatsAppPayload): Promise<boolean> {
  const apiKey = import.meta.env.VITE_CALLMEBOT_API_KEY as string | undefined;
  if (!apiKey) {
    console.warn('VITE_CALLMEBOT_API_KEY not set — skipping WhatsApp registration alert');
    return false;
  }

  const when = payload.registeredAt
    ? new Date(payload.registeredAt).toLocaleString('ru-RU', { timeZone: 'Asia/Dubai' })
    : new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Dubai' });

  const text = [
    'Новая заявка на регистрацию!',
    `Имя: ${payload.fullName}`,
    `Email: ${payload.email}`,
    `Телефон: ${payload.phone || '—'}`,
    `Время: ${when}`,
  ].join('\n');

  const url =
    `https://api.callmebot.com/whatsapp.php?phone=${WHATSAPP_PHONE}` +
    `&text=${encodeURIComponent(text)}` +
    `&apikey=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url);
    const body = await res.text();
    return res.ok || /message queued|sent/i.test(body);
  } catch (err) {
    console.error('sendWhatsAppNotification failed:', err);
    return false;
  }
}

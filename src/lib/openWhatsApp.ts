const WHATSAPP_PHONE = '971547713447';

export function openWhatsApp(text?: string): void {
  const url = text
    ? `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(text)}`
    : `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}`;
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.assign(url);
}

export function partNotFoundWhatsAppMessage(code: string, qty: string | number): string {
  return `Hello PAPCO,\n\nI'm looking for the following part:\nCode: ${code}\nQuantity: ${qty || '1'}\n\nPlease let me know if it's available.`;
}

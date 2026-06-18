const REMINDER_TAG = "checklist-daily";

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function showDailyReminder({ dateStr, ayat, hadith }) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  const title = "Ежедневник · аят и хадис дня";
  const lines = [];
  if (ayat?.ru) lines.push(ayat.ru.slice(0, 120));
  if (hadith?.ru) lines.push(hadith.ru.slice(0, 120));
  const body = lines.join("\n\n") || "Откройте ежедневник и посмотрите аят дня.";
  try {
    new Notification(title, {
      body,
      tag: `${REMINDER_TAG}-${dateStr}`,
      silent: false,
    });
    return true;
  } catch {
    return false;
  }
}

export function registerReminderWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.()) return;
  const base = import.meta.env.BASE_URL || "./";
  const swPath = `${base}sw.js`.replace(/\/{2,}/g, "/");
  navigator.serviceWorker.register(swPath).catch(() => {});
}

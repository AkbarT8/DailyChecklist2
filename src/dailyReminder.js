// Daily reminder: uses Capacitor Local Notifications on Android, Web Notifications in browser.

async function getCapacitorNotifications() {
  try {
    // Dynamic import so the browser build doesn't crash
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    return LocalNotifications;
  } catch {
    return null;
  }
}

function isNative() {
  return typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
}

/** Request notification permission (works on both native and web). */
export async function requestNotificationPermission() {
  if (isNative()) {
    try {
      const LN = await getCapacitorNotifications();
      if (!LN) return "unsupported";
      const result = await LN.requestPermissions();
      return result.display === "granted" ? "granted" : "denied";
    } catch {
      return "denied";
    }
  }
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/**
 * Schedule a daily notification at 09:00.
 * On Android (Capacitor) — real scheduled notification that fires even when app is closed.
 * On web — a Notification fired immediately (best-effort).
 */
export async function scheduleDailyReminder(displayName) {
  const name = displayName || "пользователь";

  if (isNative()) {
    try {
      const LN = await getCapacitorNotifications();
      if (!LN) return;

      // Cancel previously scheduled
      const pending = await LN.getPending();
      const existing = pending.notifications.filter((n) => n.id === 1001);
      if (existing.length) await LN.cancel({ notifications: existing });

      // Schedule next 09:00
      const now = new Date();
      const next = new Date();
      next.setHours(9, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);

      await LN.schedule({
        notifications: [
          {
            id: 1001,
            title: `Привет, ${name}!`,
            body: "Пора проверить задачи на сегодня 📋",
            schedule: {
              at: next,
              repeats: true,
              every: "day",
            },
            smallIcon: "ic_launcher_foreground",
            sound: undefined,
          },
        ],
      });
    } catch (e) {
      console.warn("LocalNotifications schedule error:", e);
    }
    return;
  }

  // Web fallback — just show an immediate notification
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(`Привет, ${name}!`, {
      body: "Пора проверить задачи на сегодня 📋",
      tag: "checklist-daily",
    });
  } catch {
    /* ignore */
  }
}

/** Show banner/notification right now (called once per day when app opens). */
export function showDailyReminder({ dateStr, displayName }) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  const name = displayName || "пользователь";
  try {
    new Notification(`Привет, ${name}!`, {
      body: "Пора проверить задачи на сегодня 📋",
      tag: `checklist-daily-${dateStr}`,
      silent: false,
    });
    return true;
  } catch {
    return false;
  }
}

export function registerReminderWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (isNative()) return;
  const base = import.meta.env.BASE_URL || "./";
  const swPath = `${base}sw.js`.replace(/\/{2,}/g, "/");
  navigator.serviceWorker.register(swPath).catch(() => {});
}

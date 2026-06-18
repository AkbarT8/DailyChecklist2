self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes("/checklist") && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/checklist/");
    })
  );
});

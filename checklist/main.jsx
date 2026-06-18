import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import DailyChecklist from '../src/DailyChecklist.jsx';

import { requestNotificationPermission, registerReminderWorker } from '../src/dailyReminder.js';

if (!window.storage) {
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(key);
      return value !== null ? { value } : null;
    },
    async set(key, value) {
      localStorage.setItem(key, value);
    },
  };
}

registerReminderWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DailyChecklist />
  </StrictMode>
);

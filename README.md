# Ежедневник (Daily Checklist)

Мобильное приложение-ежедневник на React + Vite + Capacitor (Android APK).

## Основное приложение

- **Веб / PWA:** папка `checklist/`, точка входа `checklist/index.html`
- **Исходники UI:** `src/DailyChecklist.jsx`, `src/inspirationData.js`, `src/inspirationLogic.js`
- **Android:** папка `android/` (Capacitor)

## Быстрый старт

```bash
npm install
npm run dev:app
```

Откройте в браузере: http://localhost:5173/checklist/

## Сборка APK

### Локально (нужен Android Studio)

```bash
npm run build:app
npx cap sync android
npm run cap:open
```

В Android Studio: **Build → Build APK(s)**.

Или одной командой (если SDK установлен):

```bash
npm run apk
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`

### Через GitHub Actions

1. Загрузите репозиторий на GitHub.
2. **Actions → Build Android APK → Run workflow**.
3. Скачайте артефакт **Ezhednevniki-debug-apk**.

## Структура проекта

| Папка / файл | Назначение |
|---|---|
| `checklist/` | Entry point для мобильного приложения |
| `src/DailyChecklist.jsx` | Главный компонент |
| `src/inspirationData.js` | Аяты и хадисы |
| `scripts/build-apk.mjs` | Сборка APK |
| `capacitor.config.json` | Конфиг Capacitor |
| `android/` | Нативный Android-проект |

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните при необходимости (Supabase и др.).  
Файлы `.env` и `.env.secrets` **не загружайте** в GitHub — они в `.gitignore`.

## Загрузка на GitHub

```bash
git init
git add .
git commit -m "Initial commit: Ежедневник"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/ВАШ_РЕПО.git
git push -u origin main
```

Или создайте репозиторий на [github.com/new](https://github.com/new) и загрузите папку через веб-интерфейс (Upload files).

## Лицензия

Private / personal use.

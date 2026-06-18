#!/usr/bin/env node
/**
 * Build debug APK for Ежедневник (Capacitor + Android).
 * Requires: Node.js, Java JDK, Android SDK (Android Studio).
 *
 * Usage: node scripts/build-apk.mjs
 * Output: release/Ezhednevniki-debug.apk
 */
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const gradlew = isWin ? "gradlew.bat" : "./gradlew";

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: opts.cwd || root, env: { ...process.env, ...opts.env } });
}

function findAndroidSdk() {
  if (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME)) return process.env.ANDROID_HOME;
  if (process.env.ANDROID_SDK_ROOT && fs.existsSync(process.env.ANDROID_SDK_ROOT)) return process.env.ANDROID_SDK_ROOT;
  const local = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk")
    : path.join(process.env.HOME || "", "Android", "Sdk");
  if (fs.existsSync(local)) return local;
  const studio = "C:\\Program Files\\Android\\Android Studio";
  if (fs.existsSync(studio)) {
    const sdk = path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
    if (fs.existsSync(sdk)) return sdk;
  }
  return null;
}

// 1. Icons (optional)
try {
  run("node scripts/generate-icons.mjs");
} catch {
  console.warn("Icons: skipped (generate-icons failed, using defaults)");
}

// 2. Web build
run("npm run build:app");

// 3. Cap sync
run("npx cap sync android");

const sdk = findAndroidSdk();
if (!sdk) {
  console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  Android SDK не найден на этом компьютере.                       ║
║                                                                  ║
║  Чтобы собрать APK:                                              ║
║  1. Установите Android Studio:                                   ║
║     https://developer.android.com/studio                         ║
║  2. В Android Studio: File → Open → папка «android» в проекте    ║
║  3. Build → Build Bundle(s) / APK(s) → Build APK(s)               ║
║  4. APK будет в: android/app/build/outputs/apk/debug/            ║
║                                                                  ║
║  Или задайте ANDROID_HOME и запустите снова:                     ║
║     node scripts/build-apk.mjs                                   ║
╚══════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

process.env.ANDROID_HOME = sdk;
process.env.ANDROID_SDK_ROOT = sdk;

const androidDir = path.join(root, "android");
if (!fs.existsSync(androidDir)) {
  console.error("Папка android/ не найдена. Запустите: npx cap add android");
  process.exit(1);
}

// 4. Gradle assembleDebug
const gradle = spawnSync(gradlew, ["assembleDebug"], {
  cwd: androidDir,
  stdio: "inherit",
  shell: isWin,
  env: { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk },
});

if (gradle.status !== 0) {
  console.error("Сборка Gradle не удалась. Откройте проект в Android Studio для диагностики.");
  process.exit(gradle.status || 1);
}

const srcApk = path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const releaseDir = path.join(root, "release");
fs.mkdirSync(releaseDir, { recursive: true });
const destApk = path.join(releaseDir, "Ezhednevniki-debug.apk");
fs.copyFileSync(srcApk, destApk);

console.log(`
✓ APK готов:
  ${destApk}

Скопируйте файл на телефон и установите.
(Разрешите «Установку из неизвестных источников» в настройках Android.)
`);

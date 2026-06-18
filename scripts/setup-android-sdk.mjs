#!/usr/bin/env node
/**
 * Downloads Android command-line tools and required packages (one-time setup).
 * Usage: node scripts/setup-android-sdk.mjs
 */
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import { createWriteStream } from "node:fs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sdkRoot = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
const cmdlineZip = path.join(root, ".android-tools", "cmdline-tools.zip");
const cmdlineDir = path.join(sdkRoot, "cmdline-tools", "latest");

function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", reject);
  });
}

function unzip(zip, dest) {
  fs.mkdirSync(dest, { recursive: true });
  if (process.platform === "win32") {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zip.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force"`,
      { stdio: "inherit" }
    );
    const inner = path.join(dest, "cmdline-tools");
    if (fs.existsSync(inner)) {
      fs.mkdirSync(path.dirname(cmdlineDir), { recursive: true });
      if (fs.existsSync(cmdlineDir)) fs.rmSync(cmdlineDir, { recursive: true, force: true });
      fs.renameSync(inner, cmdlineDir);
    }
  } else {
    execSync(`unzip -qo "${zip}" -d "${dest}"`);
  }
}

const sdkmanager = path.join(cmdlineDir, "bin", process.platform === "win32" ? "sdkmanager.bat" : "sdkmanager");

async function main() {
  console.log("Android SDK root:", sdkRoot);
  fs.mkdirSync(sdkRoot, { recursive: true });

  if (!fs.existsSync(sdkmanager)) {
    console.log("Downloading Android command-line tools (~150 MB)...");
    const url = "https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip";
    await download(url, cmdlineZip);
    console.log("Extracting...");
    unzip(cmdlineZip, path.join(sdkRoot, "cmdline-tools-tmp"));
  }

  const env = { ...process.env, ANDROID_HOME: sdkRoot, ANDROID_SDK_ROOT: sdkRoot };
  const yes = process.platform === "win32" ? "cmd /c echo y | " : "yes | ";

  console.log("Installing SDK packages (platform-tools, build-tools, platform)...");
  const pkgs = [
    "platform-tools",
    "platforms;android-35",
    "build-tools;35.0.0",
  ];
  for (const pkg of pkgs) {
    const r = spawnSync(sdkmanager, ["--sdk_root=" + sdkRoot, pkg], {
      env,
      shell: true,
      stdio: "inherit",
      input: "y\ny\ny\ny\ny\n",
    });
    if (r.status !== 0) {
      console.warn(`Warning: sdkmanager ${pkg} exit ${r.status}`);
    }
  }

  console.log("\nSDK ready at:", sdkRoot);
  console.log("Set for this session:");
  console.log(`  set ANDROID_HOME=${sdkRoot}`);
  console.log("\nNow run: npm run apk");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

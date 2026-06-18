#!/usr/bin/env node
/** Generates app icons for PWA / Capacitor. Skips if icons already exist (CI/Linux). */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "checklist", "public");
fs.mkdirSync(dir, { recursive: true });

const iconPaths = [192, 512].map((size) => path.join(dir, `icon-${size}.png`));
if (iconPaths.every((p) => fs.existsSync(p))) {
  console.log("Icons already present in checklist/public/, skipping generation.");
  process.exit(0);
}

if (platform() !== "win32") {
  console.error(
    "Cannot generate icons on this OS. Commit icon-192.png and icon-512.png in checklist/public/.",
  );
  process.exit(1);
}

const ps = `
Add-Type -AssemblyName System.Drawing
function Save-Icon($size, $path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::FromArgb(255, 231, 223, 201))
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 47, 82, 51))
  $font = New-Object System.Drawing.Font('Segoe UI', [math]::Max(12, [int]($size * 0.22)), [System.Drawing.FontStyle]::Bold)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = 'Center'
  $sf.LineAlignment = 'Center'
  $rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
  $g.DrawString([char]0x0627 + [char]0x064A + [char]0x0629, $font, $brush, $rect, $sf)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
Save-Icon 192 '${dir.replace(/\\/g, "\\\\")}\\\\icon-192.png'
Save-Icon 512 '${dir.replace(/\\/g, "\\\\")}\\\\icon-512.png'
`;

execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"').replace(/\n/g, "; ")}"`, { stdio: "inherit" });
console.log("Icons written to checklist/public/");

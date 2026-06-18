import fs from "node:fs";
import path from "node:path";
import ayatCorpus from "./ayatCorpus.mjs";
import hadithCorpus from "./hadithCorpus.mjs";

const outPath = path.resolve("src/inspirationData.js");

const lines = [
  "// Аяты Корана и достоверные хадисы (Кутуб ас-Сitta: Бухари, Муслим, Абу Дауд, ат-Тирмizi, an-Nasa'i, Ibn Majah)",
  "export const QURAN_AYAT = [",
  ...ayatCorpus.map((a, i) => `  { id: "a${String(i + 1).padStart(3, "0")}", ar: ${JSON.stringify(a[0])}, ru: ${JSON.stringify(a[1])}, ref: ${JSON.stringify(a[2])} },`),
  "];",
  "",
  "export const HADITHS = [",
  ...hadithCorpus.map((h, i) => `  { id: "h${String(i + 1).padStart(3, "0")}", ar: ${JSON.stringify(h[0])}, ru: ${JSON.stringify(h[1])}, source: ${JSON.stringify(h[2])} },`),
  "];",
  "",
  `export const INSPIRATION_META = { ayatCount: ${ayatCorpus.length}, hadithCount: ${hadithCorpus.length}, books: ["Бухари", "Муслим", "Абу Дауд", "ат-Тирмizi", "an-Nasa'i", "Ibn Majah"] };`,
  "",
];

fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${ayatCorpus.length} ayat, ${hadithCorpus.length} hadiths`);

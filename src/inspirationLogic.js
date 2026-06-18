import { QURAN_AYAT, HADITHS } from "./inspirationData.js";

function dateSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function byId(arr, id) {
  return arr.find((x) => x.id === id) ?? arr[0];
}

function indexById(arr, id) {
  const i = arr.findIndex((x) => x.id === id);
  return i >= 0 ? i : 0;
}

/** Pick one item from pool #pool; reset pool when all were shown. */
export function pickUnseenId(arr, shownIds, seedKey) {
  const seen = new Set(Array.isArray(shownIds) ? shownIds : []);
  let pool = arr.filter((x) => !seen.has(x.id));
  let resetPool = false;
  if (!pool.length) {
    pool = arr;
    resetPool = true;
    seen.clear();
  }
  const idx = dateSeed(seedKey) % pool.length;
  const item = pool[idx];
  const nextShown = resetPool ? [item.id] : [...seen, item.id];
  return { id: item.id, shownIds: nextShown, resetPool };
}

export function pickNextUnseenId(arr, currentId, shownIds) {
  const seen = new Set(Array.isArray(shownIds) ? shownIds : []);
  if (currentId) seen.add(currentId);
  let pool = arr.filter((x) => !seen.has(x.id));
  if (!pool.length) {
    pool = arr.filter((x) => x.id !== currentId);
    if (!pool.length) pool = arr;
    const item = pool[0];
    return { id: item.id, shownIds: [item.id], resetPool: true };
  }
  const currentIdx = currentId ? indexById(arr, currentId) : -1;
  let start = (currentIdx + 1) % arr.length;
  for (let n = 0; n < arr.length; n++) {
    const candidate = arr[(start + n) % arr.length];
    if (!seen.has(candidate.id)) {
      return { id: candidate.id, shownIds: [...seen, candidate.id], resetPool: false };
    }
  }
  const item = pool[0];
  return { id: item.id, shownIds: [item.id], resetPool: true };
}

export function defaultInspireState(dateStr) {
  const ayat = pickUnseenId(QURAN_AYAT, [], `${dateStr}:ayat:daily`);
  const hadith = pickUnseenId(HADITHS, [], `${dateStr}:hadith:daily`);
  return {
    day: dateStr,
    ayatId: ayat.id,
    hadithId: hadith.id,
    shownAyatIds: ayat.shownIds,
    shownHadithIds: hadith.shownIds,
  };
}

export function normalizeInspireState(raw, dateStr) {
  const base = {
    day: dateStr,
    ayatId: QURAN_AYAT[0]?.id,
    hadithId: HADITHS[0]?.id,
    shownAyatIds: [],
    shownHadithIds: [],
  };

  if (!raw || typeof raw !== "object") {
    return defaultInspireState(dateStr);
  }

  // Migrate old index-based state
  if (Number.isInteger(raw.ayatIdx) && !raw.ayatId) {
    raw.ayatId = QURAN_AYAT[raw.ayatIdx % QURAN_AYAT.length]?.id;
  }
  if (Number.isInteger(raw.hadithIdx) && !raw.hadithId) {
    raw.hadithId = HADITHS[raw.hadithIdx % HADITHS.length]?.id;
  }

  const shownAyatIds = Array.isArray(raw.shownAyatIds) ? raw.shownAyatIds : [];
  const shownHadithIds = Array.isArray(raw.shownHadithIds) ? raw.shownHadithIds : [];

  if (raw.day === dateStr && raw.ayatId && raw.hadithId) {
    return {
      day: dateStr,
      ayatId: raw.ayatId,
      hadithId: raw.hadithId,
      shownAyatIds,
      shownHadithIds,
    };
  }

  // New day — pick fresh unseen ayat/hadith
  const ayat = pickUnseenId(QURAN_AYAT, shownAyatIds, `${dateStr}:ayat:daily`);
  const hadith = pickUnseenId(HADITHS, shownHadithIds, `${dateStr}:hadith:daily`);
  return {
    day: dateStr,
    ayatId: ayat.id,
    hadithId: hadith.id,
    shownAyatIds: ayat.shownIds,
    shownHadithIds: hadith.shownIds,
  };
}

export function inspireItemKey(type, id) {
  return `${type}:${id}`;
}

export function getCurrentAyat(state) {
  return byId(QURAN_AYAT, state?.ayatId);
}

export function getCurrentHadith(state) {
  return byId(HADITHS, state?.hadithId);
}

export function advanceAyat(state) {
  const next = pickNextUnseenId(QURAN_AYAT, state.ayatId, state.shownAyatIds);
  return { ...state, ayatId: next.id, shownAyatIds: next.shownIds };
}

export function advanceHadith(state) {
  const next = pickNextUnseenId(HADITHS, state.hadithId, state.shownHadithIds);
  return { ...state, hadithId: next.id, shownHadithIds: next.shownIds };
}

export function welcomeAyatForDay(dateStr) {
  const { id } = pickUnseenId(QURAN_AYAT, [], `${dateStr}:welcome`);
  return byId(QURAN_AYAT, id);
}

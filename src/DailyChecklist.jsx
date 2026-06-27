import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Plus, Check, X, FolderPlus, Clock, Trash2, Pencil, ChevronLeft, ChevronRight,
  AlertTriangle, ListChecks, TrendingUp, SkipForward, RotateCcw, ChevronDown,
  Folder, CheckSquare, Square, Search, CheckCheck, MoveRight, Bookmark, ChevronRight as ChevronNext,
  Camera, Users, UserCheck, Star
} from "lucide-react";
import { QURAN_AYAT, HADITHS, INSPIRATION_META } from "./inspirationData.js";
import {
  defaultInspireState,
  normalizeInspireState,
  getCurrentAyat,
  getCurrentHadith,
  advanceAyat,
  advanceHadith,
  welcomeAyatForDay,
  inspireItemKey,
} from "./inspirationLogic.js";
import { requestNotificationPermission, showDailyReminder, scheduleDailyReminder, registerReminderWorker } from "./dailyReminder.js";

const USER_PROFILE_KEY = "checklist-user-profile";
const AVATAR_KEY = "checklist-avatar";

const pad = (n) => String(n).padStart(2, "0");
const formatLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => formatLocal(new Date());
const parseUTC = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const addDaysStr = (s, days) => {
  const dt = parseUTC(s);
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
};
const diffDaysStr = (a, b) => Math.round((parseUTC(b) - parseUTC(a)) / 86400000);
const weekdayOf = (s) => parseUTC(s).getUTCDay();
const formatDisplay = (s) => {
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
};

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_SHORT = { 0: "Вс", 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб" };
const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DEFAULT_FOLDER = "Без папки";
const WELCOME_KEY = "checklist-welcome-entered";

function visibleFolders(folders) {
  return folders.filter((f) => f !== DEFAULT_FOLDER);
}

function displayFolder(name) {
  return name === DEFAULT_FOLDER ? null : name;
}

function dateSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function DailyInspiration({ ayat, hadith, ayatSaved, hadithSaved, onNextAyat, onNextHadith, onSaveAyat, onSaveHadith, meta }) {
  if (!ayat || !hadith) return null;
  return (
    <section className="dc-inspire">
      <div className="dc-inspire-card dc-inspire-ayat">
        <div className="dc-inspire-head">
          <div className="dc-inspire-tag">Аят дня</div>
          <div className="dc-inspire-actions">
            <button type="button" className={`dc-inspire-btn ${ayatSaved ? "saved" : ""}`} title={ayatSaved ? "Убрать из сохранённых" : "Сохранить"} onClick={onSaveAyat}>
              <Bookmark size={14} fill={ayatSaved ? "currentColor" : "none"} />
            </button>
            <button type="button" className="dc-inspire-btn" title="Следующий аят" onClick={onNextAyat}><ChevronNext size={14} /></button>
          </div>
        </div>
        <div className="dc-inspire-ar">{ayat.ar}</div>
        <div className="dc-inspire-text">{ayat.ru}</div>
        <div className="dc-inspire-ref">{ayat.ref}</div>
      </div>
      <div className="dc-inspire-card dc-inspire-hadith">
        <div className="dc-inspire-head">
          <div className="dc-inspire-tag">Хадис дня</div>
          <div className="dc-inspire-actions">
            <button type="button" className={`dc-inspire-btn ${hadithSaved ? "saved" : ""}`} title={hadithSaved ? "Убрать из сохранённых" : "Сохранить"} onClick={onSaveHadith}>
              <Bookmark size={14} fill={hadithSaved ? "currentColor" : "none"} />
            </button>
            <button type="button" className="dc-inspire-btn" title="Следующий хадис" onClick={onNextHadith}><ChevronNext size={14} /></button>
          </div>
        </div>
        <div className="dc-inspire-ar dc-inspire-hadith-ar">{hadith.ar}</div>
        <div className="dc-inspire-text">{hadith.ru}</div>
        <div className="dc-inspire-ref">{hadith.source}</div>
      </div>
      <div className="dc-inspire-meta">База: {meta.ayatCount} аятов · {meta.hadithCount} хадисов (Бухари, Муслим и др.)</div>
    </section>
  );
}

function SavedInspirationList({ items, selectMode, selectedKeys, onToggleSelect, onRemove }) {
  if (!items.length) {
    return <div className="dc-empty"><p>Здесь будут сохранённые аяты и хадисы. Нажмите закладку на карточке аята или хадиса.</p></div>;
  }
  const ayatItems = items.filter((i) => i.type === "ayat");
  const hadithItems = items.filter((i) => i.type === "hadith");
  const renderCard = (item) => (
    <div className={`dc-saved-card ${item.type === "ayat" ? "dc-inspire-ayat" : "dc-inspire-hadith"} ${selectMode && selectedKeys.has(item.key) ? "dc-row-selected" : ""}`} key={item.key}>
      {selectMode && (
        <button type="button" className={`dc-select-box ${selectedKeys.has(item.key) ? "checked" : ""}`} onClick={() => onToggleSelect(item.key)} aria-label="Выбрать">
          {selectedKeys.has(item.key) && <Check size={13} />}
        </button>
      )}
      <div className="dc-saved-card-body">
        <div className="dc-inspire-ar">{item.ar}</div>
        <div className="dc-inspire-text">{item.ru || item.text}</div>
        <div className="dc-saved-foot">
          <span className="dc-inspire-ref">{item.type === "ayat" ? item.ref : item.source}</span>
          {!selectMode && (
            <button type="button" className="dc-inspire-btn" title="Удалить из сохранённых" onClick={() => onRemove(item.key)}><Trash2 size={13} /></button>
          )}
        </div>
      </div>
    </div>
  );
  return (
    <div className="dc-saved-wrap">
      {ayatItems.length > 0 && (
        <div className="dc-saved-group">
          <h3 className="dc-saved-title">Аяты ({ayatItems.length})</h3>
          {ayatItems.map(renderCard)}
        </div>
      )}
      {hadithItems.length > 0 && (
        <div className="dc-saved-group">
          <h3 className="dc-saved-title">Хадисы ({hadithItems.length})</h3>
          {hadithItems.map(renderCard)}
        </div>
      )}
    </div>
  );
}

function FolderSheet({ open, onClose, title, folders, selected, onSelect, showCounts, folderTaskCount, allowManage, folderDraft, setFolderDraft, folderDraftOpen, setFolderDraftOpen, onAddFolder, onNewFolder, onDeleteFolder, onDeleteAllFolders }) {
  if (!open) return null;
  return (
    <>
      <div className="dc-sheet-backdrop" onClick={onClose} />
      <div className="dc-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="dc-sheet-head">
          <h3 className="dc-sheet-title">{title}</h3>
          <button type="button" className="dc-icon-ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dc-sheet-body">
          {onSelect && (
            <button type="button" className={`dc-sheet-item ${!selected ? "selected" : ""}`} onClick={() => { onSelect(null); onClose(); }}>
              <Folder size={16} />
              <span>{title === "Выберите папку" ? "Без папки" : "Все папки"}</span>
            </button>
          )}
          {folders.map((f) => (
            <div key={f} className="dc-sheet-row">
              <button type="button" className={`dc-sheet-item ${selected === f ? "selected" : ""}`} onClick={() => { onSelect?.(f); onClose(); }}>
                <span className="dc-dot" style={{ background: folderColor(f) }} />
                <span className="dc-sheet-item-label">{f}</span>
                {showCounts && folderTaskCount && <span className="dc-dropdown-meta">{folderTaskCount(f)}</span>}
              </button>
              {allowManage && onDeleteFolder && (
                <button type="button" className="dc-dropdown-del" title="Удалить папку" onClick={() => onDeleteFolder(f)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {allowManage && (onAddFolder || onNewFolder) && (
            <>
              <div className="dc-dropdown-divider" />
              {onNewFolder ? (
                <button type="button" className="dc-sheet-item dc-dropdown-add" onClick={() => { onNewFolder(); onClose(); }}>
                  <FolderPlus size={16} /> Новая папка
                </button>
              ) : !folderDraftOpen ? (
                <button type="button" className="dc-sheet-item dc-dropdown-add" onClick={() => setFolderDraftOpen(true)}>
                  <FolderPlus size={16} /> Новая папка
                </button>
              ) : (
                <div className="dc-dropdown-draft">
                  <input className="dc-dropdown-input" autoFocus placeholder="Название папки" value={folderDraft}
                    onChange={(e) => setFolderDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") onAddFolder(folderDraft); if (e.key === "Escape") { setFolderDraft(""); setFolderDraftOpen(false); } }} />
                  <button type="button" className="dc-icon-ghost" onClick={() => onAddFolder(folderDraft)}><Check size={16} /></button>
                  <button type="button" className="dc-icon-ghost" onClick={() => { setFolderDraft(""); setFolderDraftOpen(false); }}><X size={16} /></button>
                </div>
              )}
              {onDeleteAllFolders && folders.length > 0 && (
                <button type="button" className="dc-sheet-item dc-dropdown-danger" onClick={() => { onDeleteAllFolders(); onClose(); }}>
                  <Trash2 size={14} /> Удалить все папки
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Username uniqueness check via Supabase REST ─────────────────────────────
const SB_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

async function checkUsernameAvailable(username) {
  if (!SB_URL || !SB_KEY) return true; // No backend — skip check
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/checklist_users?username=eq.${encodeURIComponent(username)}&select=username&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    const data = await res.json();
    return !Array.isArray(data) || data.length === 0;
  } catch {
    return true; // Network error — allow locally
  }
}

async function registerUsername(username, displayName) {
  if (!SB_URL || !SB_KEY) return;
  try {
    await fetch(`${SB_URL}/rest/v1/checklist_users`, {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ username, display_name: displayName }),
    });
  } catch {
    /* ignore — stored locally anyway */
  }
}

// ─── Sync today's/yesterday's stats to Supabase so friends can see them ─────
async function syncStatsToSupabase(username, todayDate, done, total) {
  if (!SB_URL || !SB_KEY || !username) return;
  // Compute yesterday string
  const d = new Date(todayDate);
  d.setDate(d.getDate() - 1);
  const yDate = d.toISOString().slice(0, 10);

  // Read what we saved yesterday from localStorage
  let yDone = 0, yTotal = 0;
  try {
    const cached = JSON.parse(localStorage.getItem("checklist-sync-cache") || "{}");
    // If we saved a yesterday cache entry, use it
    if (cached.date === yDate) { yDone = cached.done || 0; yTotal = cached.total || 0; }
    // Save today's snapshot to cache
    localStorage.setItem("checklist-sync-cache", JSON.stringify({ date: todayDate, done, total }));
  } catch { /* ignore */ }

  try {
    await fetch(`${SB_URL}/rest/v1/checklist_users?username=eq.${encodeURIComponent(username)}`, {
      method: "PATCH",
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({
        today_date: todayDate, today_done: done, today_total: total,
        yesterday_date: yDate, yesterday_done: yDone, yesterday_total: yTotal,
        last_seen: new Date().toISOString(),
      }),
    });
  } catch { /* offline – ignore */ }
}

// ─── Small avatar circle (used in header) ───────────────────────────────────
function AvatarCircle({ displayName, size = 36, onClick }) {
  const [avatarData] = useState(() => localStorage.getItem(AVATAR_KEY));
  const initials = (displayName || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <button
      className="dc-avatar-btn"
      style={{ width: size, height: size }}
      onClick={onClick}
      aria-label="Профиль"
    >
      {avatarData
        ? <img src={avatarData} alt="avatar" className="dc-avatar-img" style={{ width: size, height: size }} />
        : <span className="dc-avatar-initials" style={{ fontSize: size * 0.36 }}>{initials}</span>
      }
    </button>
  );
}

// ─── Friend card ─────────────────────────────────────────────────────────────
function FriendCard({ friend, today }) {
  const d = new Date(today);
  d.setDate(d.getDate() - 1);
  const yesterday = d.toISOString().slice(0, 10);

  const isToday = friend.today_date === today;
  const todayPct = isToday && (friend.today_total || 0) > 0
    ? Math.round((friend.today_done / friend.today_total) * 100) : null;

  const isYesterday = friend.yesterday_date === yesterday;
  const yestPct = isYesterday && (friend.yesterday_total || 0) > 0
    ? Math.round((friend.yesterday_done / friend.yesterday_total) * 100) : null;

  const ini = (friend.display_name || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const statusColor = todayPct === 100 ? "var(--accent)" : todayPct !== null ? "var(--gold)" : "var(--ink-faint)";

  // Format last_seen nicely
  let lastSeenStr = "";
  if (friend.last_seen) {
    const ls = new Date(friend.last_seen);
    const diffMin = Math.floor((Date.now() - ls.getTime()) / 60000);
    if (diffMin < 2) lastSeenStr = "только что";
    else if (diffMin < 60) lastSeenStr = `${diffMin} мин. назад`;
    else if (diffMin < 1440) lastSeenStr = `${Math.floor(diffMin / 60)} ч. назад`;
    else lastSeenStr = `${Math.floor(diffMin / 1440)} дн. назад`;
  }

  return (
    <div className="dc-friend-card">
      <div className="dc-avatar-medium">
        <span className="dc-avatar-ini-m">{ini}</span>
        <span className="dc-friend-status-dot" style={{ background: statusColor }} />
      </div>
      <div className="dc-friend-info">
        <div className="dc-friend-name">{friend.display_name}</div>
        <div className="dc-friend-un">@{friend.username}{lastSeenStr && <span className="dc-friend-seen"> · {lastSeenStr}</span>}</div>

        {/* Today */}
        <div className="dc-friend-day-label">Сегодня</div>
        {todayPct !== null ? (
          <>
            <div className="dc-friend-bar-wrap">
              <div className="dc-friend-bar" style={{ width: `${todayPct}%`, background: statusColor }} />
            </div>
            <div className="dc-friend-pct" style={{ color: statusColor }}>
              {todayPct === 100 ? "✅ Все выполнено!" : `${todayPct}% · ${friend.today_done}/${friend.today_total} задач`}
            </div>
          </>
        ) : (
          <div className="dc-friend-pct" style={{ color: "var(--ink-soft)" }}>Нет данных</div>
        )}

        {/* Yesterday */}
        <div className="dc-friend-day-label" style={{ marginTop: 8 }}>Вчера</div>
        {yestPct !== null ? (
          <>
            <div className="dc-friend-bar-wrap">
              <div className="dc-friend-bar" style={{ width: `${yestPct}%`, background: yestPct === 100 ? "var(--accent)" : "var(--gold)", opacity: 0.7 }} />
            </div>
            <div className="dc-friend-pct" style={{ color: yestPct === 100 ? "var(--accent)" : "var(--gold)", opacity: 0.85 }}>
              {yestPct === 100 ? "✅ Все выполнено вчера!" : `${yestPct}% · ${friend.yesterday_done}/${friend.yesterday_total} задач`}
            </div>
          </>
        ) : (
          <div className="dc-friend-pct" style={{ color: "var(--ink-soft)" }}>Нет данных</div>
        )}
      </div>
    </div>
  );
}

// ─── Profile sheet ───────────────────────────────────────────────────────────
function ProfileSheet({ open, onClose, userProfile, todayStats, today }) {
  const [tab, setTab] = useState("profile");
  const [avatarData, setAvatarData] = useState(() => localStorage.getItem(AVATAR_KEY));
  const [friendInput, setFriendInput] = useState("");
  const [friend, setFriend] = useState(null);
  const [fLoading, setFLoading] = useState(false);
  const [fError, setFError] = useState("");

  const handleAvatarPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target.result;
      localStorage.setItem(AVATAR_KEY, data);
      setAvatarData(data);
    };
    reader.readAsDataURL(file);
  };

  const searchFriend = async () => {
    const un = friendInput.trim().toLowerCase().replace(/^@/, "");
    if (!un) return;
    if (un === userProfile?.username) { setFError("Это вы 😄"); return; }
    if (!SB_URL || !SB_KEY) {
      setFError("Supabase не настроен — функция друзей недоступна");
      return;
    }
    setFLoading(true); setFError(""); setFriend(null);
    try {
      // Use select=* so it works whether or not the new columns exist
      const url = `${SB_URL}/rest/v1/checklist_users?username=eq.${encodeURIComponent(un)}&select=*&limit=1`;
      const res = await fetch(url, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        let msg = `Ошибка сервера ${res.status}`;
        try { const e = await res.json(); msg = e.message || msg; } catch { /* ignore */ }
        setFError(msg);
        setFLoading(false);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) setFriend(data[0]);
      else setFError("Пользователь не найден — возможно, он ещё не открывал приложение");
    } catch (e) {
      if (e?.name === "TimeoutError") setFError("Сервер не ответил (таймаут). Попробуйте позже.");
      else setFError("Не удалось подключиться к серверу. Проверьте, что Supabase настроен в .env");
    }
    setFLoading(false);
  };

  if (!open) return null;

  const initials = (userProfile?.displayName || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const pct = todayStats.total > 0 ? Math.round((todayStats.done / todayStats.total) * 100) : 0;

  return (
    <>
      <div className="dc-sheet-backdrop" onClick={onClose} />
      <div className="dc-sheet dc-profile-sheet">
        <div className="dc-sheet-handle" />
        <div className="dc-profile-tabs">
          <button className={`dc-ptab ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>
            <Star size={14} /> Профиль
          </button>
          <button className={`dc-ptab ${tab === "friends" ? "active" : ""}`} onClick={() => setTab("friends")}>
            <Users size={14} /> Друзья
          </button>
        </div>

        {tab === "profile" && (
          <div className="dc-profile-body">
            <label className="dc-avatar-big" htmlFor="dc-avatar-file">
              {avatarData
                ? <img src={avatarData} alt="avatar" className="dc-avatar-img-big" />
                : <span className="dc-avatar-ini-b">{initials}</span>
              }
              <div className="dc-avatar-edit"><Camera size={18} /></div>
            </label>
            <input id="dc-avatar-file" type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarPick} />
            <div className="dc-profile-name">{userProfile?.displayName}</div>
            <div className="dc-profile-un">@{userProfile?.username}</div>
            <div className="dc-profile-stats-row">
              <div className="dc-pstat">
                <div className="dc-pstat-val">{pct}%</div>
                <div className="dc-pstat-lbl">Сегодня</div>
              </div>
              <div className="dc-pstat-div" />
              <div className="dc-pstat">
                <div className="dc-pstat-val">{todayStats.done}/{todayStats.total}</div>
                <div className="dc-pstat-lbl">Задач</div>
              </div>
            </div>
            {pct > 0 && (
              <div className="dc-profile-bar-wrap">
                <div className="dc-profile-bar" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        )}

        {tab === "friends" && (
          <div className="dc-friends-body">
            <p className="dc-friends-hint">Введите юзернейм друга, чтобы увидеть его прогресс сегодня</p>
            <div className="dc-friends-search-row">
              <div className="dc-search-wrap" style={{ flex: 1 }}>
                <span style={{ color: "var(--ink-soft)", marginRight: 2, fontSize: 15 }}>@</span>
                <input className="dc-search" placeholder="username" value={friendInput}
                  onChange={(e) => setFriendInput(e.target.value.toLowerCase().replace(/^@/, ""))}
                  onKeyDown={(e) => e.key === "Enter" && searchFriend()} />
              </div>
              <button className="dc-btn-primary" onClick={searchFriend} disabled={fLoading} style={{ minWidth: 44, padding: "0 14px" }}>
                {fLoading ? "…" : <Search size={16} />}
              </button>
            </div>
            {fError && <div className="dc-setup-error">{fError}</div>}
            {friend && <FriendCard friend={friend} today={today} />}
          </div>
        )}
      </div>
    </>
  );
}

// ─── All-tasks-done celebration modal ────────────────────────────────────────
function CompletionModal({ onClose, displayName }) {
  return (
    <div className="dc-completion-overlay" onClick={onClose}>
      <div className="dc-completion-box" onClick={(e) => e.stopPropagation()}>
        <div className="dc-completion-stars">✨🌟✨</div>
        <div className="dc-completion-ar">بَارَكَ اللَّهُ فِيكَ</div>
        <div className="dc-completion-title">МашаАллах, {displayName}!</div>
        <div className="dc-completion-text">
          Да благословит вас Аллах за все задачи, и пусть все ваши деяния примутся. Ин Ша Аллах.
        </div>
        <button className="dc-btn-primary dc-completion-btn" onClick={onClose}>
          Альхамдулиллах 🤲
        </button>
      </div>
    </div>
  );
}

function UserSetupScreen({ onComplete }) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sanitize = (v) => v.toLowerCase().replace(/[^a-z0-9_.]/g, "");

  const handleSubmit = async () => {
    const dn = displayName.trim();
    const un = sanitize(username.trim());
    if (!dn) { setError("Введите ваше имя"); return; }
    if (!un || un.length < 3) { setError("Юзернейм — минимум 3 символа (латиница, цифры, _ .)"); return; }
    if (un.length > 24) { setError("Юзернейм — максимум 24 символа"); return; }
    setLoading(true);
    setError("");
    try {
      const available = await checkUsernameAvailable(un);
      if (!available) { setError("Этот юзернейм уже занят — выберите другой"); setLoading(false); return; }
      await registerUsername(un, dn);
      onComplete({ displayName: dn, username: un });
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
    }
    setLoading(false);
  };

  return (
    <div className="dc-setup-screen">
      <style>{STYLES}</style>
      <div className="dc-setup-card">
        <div className="dc-setup-emoji">📖</div>
        <h1 className="dc-setup-title">Ежедневник</h1>
        <p className="dc-setup-desc">Введите своё имя и уникальный юзернейм</p>

        <div className="dc-setup-fields">
          <div className="dc-field">
            <label>Ваше имя</label>
            <input className="dc-input" placeholder="" value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
          </div>
          <div className="dc-field">
            <label>Юзернейм (латиница, уникальный)</label>
            <div className="dc-username-wrap">
              <span className="dc-username-at">@</span>
              <input className="dc-input dc-username-input" placeholder="" value={username}
                onChange={(e) => setUsername(sanitize(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                maxLength={24} />
            </div>
          </div>
          {error && <div className="dc-setup-error">{error}</div>}
          <button type="button" className="dc-btn-primary dc-setup-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? "Проверяем…" : "Начать →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function isScheduledOn(task, dateStr) {
  if (dateStr < task.startDate) return false;
  switch (task.repeat) {
    case "once": return dateStr === task.startDate;
    case "daily": return true;
    case "everyOther": return diffDaysStr(task.startDate, dateStr) % 2 === 0;
    case "weekly": return Array.isArray(task.weekdays) && task.weekdays.includes(weekdayOf(dateStr));
    default: return false;
  }
}

function repeatLabel(task) {
  switch (task.repeat) {
    case "daily": return "Ежедневно";
    case "everyOther": return "Через день";
    case "weekly":
      return (task.weekdays || []).slice().sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b)).map((w) => WEEKDAY_SHORT[w]).join(", ");
    case "once": return formatDisplay(task.startDate);
    default: return "";
  }
}

function hexToRgb(hex) {
  const v = hex.replace("#", "");
  const num = parseInt(v, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
function lerpColor(hexA, hexB, t) {
  const tt = Math.max(0, Math.min(1, t));
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * tt)}, ${Math.round(a[1] + (b[1] - a[1]) * tt)}, ${Math.round(a[2] + (b[2] - a[2]) * tt)})`;
}
function folderColor(name) {
  const palette = ["#2F5233", "#B8862E", "#5B7B9A", "#8B4A62", "#6B6552", "#3E6E6B"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function emptyData() {
  const day = todayStr();
  return {
    tasks: [],
    folders: [DEFAULT_FOLDER],
    savedInspiration: [],
    inspireState: defaultInspireState(day),
    reminderLastDate: null,
  };
}

function seedData() {
  const today = todayStr();
  const folders = [DEFAULT_FOLDER, "Здоровье", "Учёба"];
  const tasks = [
    { id: uid(), title: "Утренняя зарядка", folder: "Здоровье", repeat: "daily", weekdays: [], time: "07:30", startDate: addDaysStr(today, -5), benefit: "Заряжает энергией на весь день", completions: {}, dismissed: {} },
    { id: uid(), title: "Прочитать 10 страниц", folder: "Учёба", repeat: "everyOther", weekdays: [], time: "21:00", startDate: addDaysStr(today, -6), benefit: "Развивает кругозор", completions: {}, dismissed: {} },
    { id: uid(), title: "Позвонить родителям", folder: DEFAULT_FOLDER, repeat: "weekly", weekdays: [0, 3], time: "19:00", startDate: addDaysStr(today, -10), benefit: "Близкие люди важнее дел", completions: {}, dismissed: {} },
  ];
  return { tasks, folders };
}

const EMPTY_FORM = {
  id: null, title: "", folder: DEFAULT_FOLDER, isNewFolder: false, newFolderName: "",
  repeat: "daily", weekdays: [], time: "", startDate: todayStr(), benefit: "",
};

async function persistData(data) {
  const json = JSON.stringify(data);
  try { await window.storage.set("checklist-data", json); } catch { /* ignore */ }
  try { localStorage.setItem("checklist-data", json); } catch { /* ignore */ }
}

export default function DailyChecklist() {
  const [tasks, setTasks] = useState([]);
  const [folders, setFolders] = useState([DEFAULT_FOLDER]);
  const [savedInspiration, setSavedInspiration] = useState([]);
  const [inspireState, setInspireState] = useState(() => defaultInspireState(todayStr()));
  const [reminderLastDate, setReminderLastDate] = useState(null);
  const [dailyBannerOpen, setDailyBannerOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [userProfile, setUserProfile] = useState(null); // { displayName, username }
  const [profileOpen, setProfileOpen] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const prevAllDoneRef = useRef(false);

  const [view, setView] = useState("checklist");
  const [listFilter, setListFilter] = useState("all");
  const [folderFilter, setFolderFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [savedSelectMode, setSavedSelectMode] = useState(false);
  const [selectedSavedKeys, setSelectedSavedKeys] = useState(() => new Set());
  const [showOthers, setShowOthers] = useState(false);

  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmReset, setConfirmReset] = useState(false);

  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");
  const [folderDraftOpen, setFolderDraftOpen] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);

  const [period, setPeriod] = useState("week");
  const [monthCursor, setMonthCursor] = useState(() => todayStr().slice(0, 7));
  const [entered, setEntered] = useState(() => {
    try { return sessionStorage.getItem(WELCOME_KEY) === "1"; } catch { return false; }
  });
  const [confirmModal, setConfirmModal] = useState(null);
  const [pendingForm, setPendingForm] = useState(null);

  const folderMenuRef = useRef(null);
  const today = todayStr();

  useEffect(() => {
    (async () => {
      // Load user profile
      try {
        const raw = localStorage.getItem(USER_PROFILE_KEY);
        if (raw) setUserProfile(JSON.parse(raw));
      } catch { /* ignore */ }

      try {
        const res = await window.storage.get("checklist-data");
        if (res?.value) {
          const parsed = JSON.parse(res.value);
          const day = todayStr();
          setTasks(parsed.tasks || []);
          setFolders(parsed.folders?.length ? parsed.folders : [DEFAULT_FOLDER]);
          setSavedInspiration(Array.isArray(parsed.savedInspiration) ? parsed.savedInspiration : []);
          setInspireState(normalizeInspireState(parsed.inspireState, day));
          setReminderLastDate(parsed.reminderLastDate ?? null);
        } else {
          const seed = seedData();
          setTasks(seed.tasks);
          setFolders(seed.folders);
        }
      } catch {
        const seed = seedData();
        setTasks(seed.tasks);
        setFolders(seed.folders);
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    persistData({ tasks, folders, savedInspiration, inspireState, reminderLastDate });
  }, [tasks, folders, savedInspiration, inspireState, reminderLastDate, loaded]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target)) {
        setMoveMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const overdueList = useMemo(() => {
    const lookbackStart = addDaysStr(today, -90);
    const list = [];
    tasks.forEach((task) => {
      if (folderFilter && task.folder !== folderFilter) return;
      let from = task.startDate > lookbackStart ? task.startDate : lookbackStart;
      let d = from;
      let guard = 0;
      while (d < today && guard < 95) {
        if (isScheduledOn(task, d) && !task.completions[d] && !task.dismissed?.[d]) {
          list.push({ task, date: d });
        }
        d = addDaysStr(d, 1);
        guard++;
      }
    });
    list.sort((a, b) => (a.date < b.date ? 1 : -1));
    return list;
  }, [tasks, today, folderFilter]);

  const toggleCompletion = useCallback((taskId, date) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const completions = { ...t.completions };
      if (completions[date]) delete completions[date]; else completions[date] = true;
      return { ...t, completions };
    }));
  }, []);

  const dismissOverdue = useCallback((taskId, date) => {
    setTasks((prev) => prev.map((t) => t.id !== taskId ? t : { ...t, dismissed: { ...t.dismissed, [date]: true } }));
  }, []);

  const nextAyat = useCallback(() => {
    setInspireState((s) => ({ ...advanceAyat({ ...s, day: today }), day: today }));
  }, [today]);

  const nextHadith = useCallback(() => {
    setInspireState((s) => ({ ...advanceHadith({ ...s, day: today }), day: today }));
  }, [today]);

  const toggleSaveAyat = useCallback(() => {
    const a = getCurrentAyat(inspireState);
    if (!a) return;
    const key = inspireItemKey("ayat", a.id);
    setSavedInspiration((prev) => {
      if (prev.some((x) => x.key === key)) return prev.filter((x) => x.key !== key);
      return [{ key, type: "ayat", savedAt: today, id: a.id, ar: a.ar, ru: a.ru, ref: a.ref }, ...prev];
    });
  }, [inspireState, today]);

  const toggleSaveHadith = useCallback(() => {
    const h = getCurrentHadith(inspireState);
    if (!h) return;
    const key = inspireItemKey("hadith", h.id);
    setSavedInspiration((prev) => {
      if (prev.some((x) => x.key === key)) return prev.filter((x) => x.key !== key);
      return [{ key, type: "hadith", savedAt: today, id: h.id, ar: h.ar, ru: h.ru, source: h.source }, ...prev];
    });
  }, [inspireState, today]);

  const removeSavedInspiration = useCallback((key) => {
    setSavedInspiration((prev) => prev.filter((x) => x.key !== key));
    setSelectedSavedKeys((prev) => { const n = new Set(prev); n.delete(key); return n; });
  }, []);

  const removeSavedBulk = useCallback((keys) => {
    const keySet = new Set(keys);
    setSavedInspiration((prev) => prev.filter((x) => !keySet.has(x.key)));
    setSelectedSavedKeys(new Set());
    setSavedSelectMode(false);
  }, []);

  const exitSavedSelectMode = () => {
    setSavedSelectMode(false);
    setSelectedSavedKeys(new Set());
  };

  const toggleSavedSelect = (key) => {
    setSelectedSavedKeys((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const requestDeleteSavedBulk = (keys) => {
    const keyArr = [...keys];
    if (!keyArr.length) return;
    openConfirm({
      title: keyArr.length === 1 ? "Удалить из сохранённых?" : `Удалить ${keyArr.length} элементов?`,
      rows: [{ label: "Действие", value: "Убрать из сохранённых" }],
      confirmLabel: "Удалить",
      danger: true,
      onConfirm: () => { removeSavedBulk(keyArr); closeConfirm(); },
    });
  };

  const enterApp = () => {
    try { sessionStorage.setItem(WELCOME_KEY, "1"); } catch { /* ignore */ }
    setEntered(true); // enter immediately — don't block on notification permission
    setTimeout(() => {
      try { registerReminderWorker(); } catch { /* ignore */ }
      requestNotificationPermission().catch(() => {});
    }, 500);
  };

  const closeConfirm = () => setConfirmModal(null);

  const openConfirm = (modal) => setConfirmModal(modal);

  const deleteTask = useCallback((taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(taskId); return n; });
  }, []);

  const deleteTasks = useCallback((ids) => {
    const idSet = new Set(ids);
    setTasks((prev) => prev.filter((t) => !idSet.has(t.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
  }, []);

  const markTasksDone = useCallback((ids, date) => {
    const idSet = new Set(ids);
    setTasks((prev) => prev.map((t) => idSet.has(t.id) ? { ...t, completions: { ...t.completions, [date]: true } } : t));
  }, []);

  const moveTasksToFolder = useCallback((ids, folderName) => {
    const idSet = new Set(ids);
    setTasks((prev) => prev.map((t) => idSet.has(t.id) ? { ...t, folder: folderName } : t));
    setMoveMenuOpen(false);
  }, []);

  const addFolder = (name) => {
    const n = name.trim();
    if (!n || n === DEFAULT_FOLDER) return;
    setFolders((prev) => prev.includes(n) ? prev : [...prev, n]);
    setFolderFilter(n);
    setFolderDraft("");
    setFolderDraftOpen(false);
  };

  const deleteFolder = (name) => {
    if (name === DEFAULT_FOLDER) return;
    setFolders((prev) => prev.filter((f) => f !== name));
    setTasks((prev) => prev.map((t) => t.folder === name ? { ...t, folder: DEFAULT_FOLDER } : t));
    if (folderFilter === name) setFolderFilter(null);
  };

  const deleteAllFolders = () => {
    setFolders([DEFAULT_FOLDER]);
    setTasks((prev) => prev.map((t) => ({ ...t, folder: DEFAULT_FOLDER })));
    setFolderFilter(null);
  };

  const resetAllData = async () => {
    const empty = emptyData();
    setTasks([]);
    setFolders([DEFAULT_FOLDER]);
    setSavedInspiration([]);
    setInspireState(defaultInspireState(today));
    setReminderLastDate(null);
    setListFilter("all");
    setFolderFilter(null);
    setSelectedIds(new Set());
    setSelectMode(false);
    setSavedSelectMode(false);
    setSelectedSavedKeys(new Set());
    setSearchQuery("");
    setConfirmReset(false);
    await persistData(empty);
  };

  const requestDeleteTask = (task) => {
    openConfirm({
      title: "Удалить задачу?",
      rows: [
        { label: "Задача", value: task.title },
        { label: "Папка", value: displayFolder(task.folder) || "—" },
        { label: "Повтор", value: repeatLabel(task) },
      ],
      confirmLabel: "Удалить",
      danger: true,
      onConfirm: () => { deleteTask(task.id); closeConfirm(); },
    });
  };

  const requestDeleteTasks = (ids) => {
    const items = tasks.filter((t) => ids.includes(t.id));
    openConfirm({
      title: `Удалить ${items.length} задач?`,
      rows: items.slice(0, 8).map((t) => ({ label: t.title, value: displayFolder(t.folder) || "—" })),
      extra: items.length > 8 ? `…и ещё ${items.length - 8}` : null,
      confirmLabel: "Удалить все",
      danger: true,
      onConfirm: () => { deleteTasks(ids); closeConfirm(); },
    });
  };

  const requestMoveTasks = (ids, folderName) => {
    const items = tasks.filter((t) => ids.includes(t.id));
    openConfirm({
      title: "Переместить задачи?",
      rows: [
        { label: "Куда", value: folderName },
        ...items.slice(0, 6).map((t) => ({ label: t.title, value: `${displayFolder(t.folder) || "—"} → ${folderName}` })),
      ],
      extra: items.length > 6 ? `…и ещё ${items.length - 6}` : null,
      confirmLabel: "Переместить",
      onConfirm: () => { moveTasksToFolder(ids, folderName); closeConfirm(); },
    });
  };

  const requestDeleteFolder = (name) => {
    const count = tasks.filter((t) => t.folder === name).length;
    openConfirm({
      title: "Удалить папку?",
      rows: [
        { label: "Папка", value: name },
        { label: "Задач в папке", value: String(count) },
        { label: "Действие", value: "Задачи останутся без папки" },
      ],
      confirmLabel: "Удалить папку",
      danger: true,
      onConfirm: () => { deleteFolder(name); closeConfirm(); },
    });
  };

  const requestDeleteAllFolders = () => {
    openConfirm({
      title: "Удалить все папки?",
      rows: visibleFolders(folders).map((f) => ({
        label: f,
        value: `${tasks.filter((t) => t.folder === f).length} задач`,
      })),
      confirmLabel: "Удалить все",
      danger: true,
      onConfirm: () => { deleteAllFolders(); closeConfirm(); },
    });
  };

  const requestSaveTask = () => {
    const title = form.title.trim();
    if (!title) return;
    if (form.repeat === "weekly" && form.weekdays.length === 0) return;
    let folderName = form.folder;
    if (form.isNewFolder) {
      const nn = form.newFolderName.trim();
      if (!nn) return;
      folderName = nn;
    }
    const rows = [
      { label: "Название", value: title },
      { label: "Папка", value: displayFolder(folderName) || folderName },
      { label: "Повтор", value: form.repeat === "daily" ? "Ежедневно" : form.repeat === "everyOther" ? "Через день" : form.repeat === "weekly" ? "По дням" : "Один раз" },
      { label: "Начало", value: formatDisplay(form.startDate) },
    ];
    if (form.time) rows.push({ label: "Время", value: form.time });
    if (form.id) {
      const old = tasks.find((t) => t.id === form.id);
      if (old) rows.unshift({ label: "Было", value: old.title });
    }
    setPendingForm({ ...form, folderName });
    openConfirm({
      title: form.id ? "Сохранить изменения?" : "Создать задачу?",
      rows,
      confirmLabel: form.id ? "Сохранить" : "Создать",
      onConfirm: () => { applySaveTask(); closeConfirm(); },
    });
  };

  const applySaveTask = () => {
    const f = pendingForm || form;
    const title = f.title.trim();
    let folderName = f.folderName || f.folder;
    if (f.isNewFolder) {
      const nn = f.newFolderName.trim();
      folderName = nn;
      setFolders((prev) => prev.includes(nn) ? prev : [...prev, nn]);
    }
    if (f.id) {
      setTasks((prev) => prev.map((t) => t.id === f.id ? {
        ...t, title, folder: folderName, repeat: f.repeat, weekdays: f.weekdays,
        time: f.time, startDate: f.startDate, benefit: (f.benefit || "").trim(),
      } : t));
    } else {
      setTasks((prev) => [...prev, {
        id: uid(), title, folder: folderName, repeat: f.repeat, weekdays: f.weekdays,
        time: f.time, startDate: f.startDate, benefit: (f.benefit || "").trim(),
        completions: {}, dismissed: {},
      }]);
    }
    setPendingForm(null);
    setPanelOpen(false);
  };

  const requestDismissOverdue = (task, date) => {
    openConfirm({
      title: "Пропустить просроченную?",
      rows: [
        { label: "Задача", value: task.title },
        { label: "Дата", value: formatDisplay(date) },
      ],
      confirmLabel: "Пропустить",
      onConfirm: () => { dismissOverdue(task.id, date); closeConfirm(); },
    });
  };

  const openAddPanel = () => {
    const vis = visibleFolders(folders);
    setForm({ ...EMPTY_FORM, folder: folderFilter || vis[0] || DEFAULT_FOLDER });
    setPanelOpen(true);
  };

  const openEditPanel = (task) => {
    setForm({
      id: task.id, title: task.title, folder: task.folder, isNewFolder: false, newFolderName: "",
      repeat: task.repeat, weekdays: task.weekdays || [], time: task.time || "",
      startDate: task.startDate, benefit: task.benefit || "",
    });
    setPanelOpen(true);
  };

  const saveTask = () => {
    const title = form.title.trim();
    if (!title) return;
    if (form.repeat === "weekly" && form.weekdays.length === 0) return;
    if (form.id) {
      requestSaveTask();
    } else {
      let folderName = form.folder;
      if (form.isNewFolder) {
        const nn = form.newFolderName.trim();
        if (!nn || nn === DEFAULT_FOLDER) return;
        folderName = nn;
        setFolders((prev) => prev.includes(nn) ? prev : [...prev, nn]);
      }
      setPendingForm({ ...form, folderName });
      applySaveTaskDirect({ ...form, folderName });
    }
  };

  const applySaveTaskDirect = (f) => {
    const title = f.title.trim();
    const folderName = f.folderName || f.folder;
    setTasks((prev) => [...prev, {
      id: uid(), title, folder: folderName, repeat: f.repeat, weekdays: f.weekdays,
      time: f.time, startDate: f.startDate, benefit: (f.benefit || "").trim(),
      completions: {}, dismissed: {},
    }]);
    setPanelOpen(false);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setMoveMenuOpen(false);
  };

  const allSavedSelected = savedInspiration.length > 0 && savedInspiration.every((x) => selectedSavedKeys.has(x.key));

  const baseTasks = useMemo(() => {
    let list = tasks;
    if (folderFilter) list = list.filter((t) => t.folder === folderFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.benefit?.toLowerCase().includes(q) ||
        t.folder.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tasks, folderFilter, searchQuery]);

  const todayTasks = useMemo(() => {
    let list = baseTasks.filter((t) => isScheduledOn(t, today))
      .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    if (listFilter === "incomplete") list = list.filter((t) => !t.completions[today]);
    return list;
  }, [baseTasks, today, listFilter]);

  const otherTasks = useMemo(
    () => baseTasks.filter((t) => !isScheduledOn(t, today)).sort((a, b) => a.title.localeCompare(b.title)),
    [baseTasks, today]
  );

  const todayStats = useMemo(() => {
    const all = tasks.filter((t) => isScheduledOn(t, today));
    const done = all.filter((t) => t.completions[today]).length;
    const incomplete = all.length - done;
    return { total: all.length, done, incomplete };
  }, [tasks, today]);

  const folderTaskCount = (name) => tasks.filter((t) => t.folder === name).length;
  const selectableTodayIds = todayTasks.map((t) => t.id);
  const allSelected = selectableTodayIds.length > 0 && selectableTodayIds.every((id) => selectedIds.has(id));

  const currentAyat = getCurrentAyat(inspireState);
  const currentHadith = getCurrentHadith(inspireState);
  const ayatSaved = savedInspiration.some((x) => x.key === inspireItemKey("ayat", currentAyat?.id));
  const hadithSaved = savedInspiration.some((x) => x.key === inspireItemKey("hadith", currentHadith?.id));
  const welcomeAyat = useMemo(() => welcomeAyatForDay(today), [today]);

  // Daily banner/notification
  useEffect(() => {
    if (!loaded || !entered || !userProfile) return;
    if (reminderLastDate === today) return;
    const granted = typeof Notification !== "undefined" && Notification.permission === "granted";
    if (granted && showDailyReminder({ dateStr: today, displayName: userProfile.displayName })) {
      setReminderLastDate(today);
      return;
    }
    setDailyBannerOpen(true);
    setReminderLastDate(today);
  }, [loaded, entered, userProfile, today, reminderLastDate]);

  // Detect all tasks done → celebration modal
  useEffect(() => {
    if (!loaded || !entered || !userProfile) return;
    const allDone = todayStats.total > 0 && todayStats.done === todayStats.total;
    if (allDone && !prevAllDoneRef.current) {
      setShowCompletionModal(true);
    }
    prevAllDoneRef.current = allDone;
  }, [todayStats.done, todayStats.total, loaded, entered, userProfile]);

  // Sync stats to Supabase (debounced 3s) so friends can see
  useEffect(() => {
    if (!loaded || !userProfile?.username) return;
    const t = setTimeout(() => {
      syncStatsToSupabase(userProfile.username, today, todayStats.done, todayStats.total);
    }, 3000);
    return () => clearTimeout(t);
  }, [todayStats.done, todayStats.total, loaded, userProfile, today]);

  const handleUserSetupComplete = async (profile) => {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    setUserProfile(profile);
    // Request permission & schedule daily notification
    const perm = await requestNotificationPermission();
    if (perm === "granted") {
      await scheduleDailyReminder(profile.displayName);
    }
  };

  if (!loaded) {
    return <div className="dc-loading">Загрузка…</div>;
  }

  // First-time setup: ask for name + username
  if (!userProfile) {
    return <UserSetupScreen onComplete={handleUserSetupComplete} />;
  }

  if (!entered) {
    return (
      <div className="dc-welcome">
        <style>{STYLES}</style>
        <div className="dc-welcome-card">
          <div className="dc-welcome-user">Привет, {userProfile.displayName}! 👋</div>
          <div className="dc-welcome-label">Аят из Корана</div>
          <div className="dc-welcome-ar">{welcomeAyat?.ar}</div>
          <div className="dc-welcome-ru">{welcomeAyat?.ru}</div>
          <div className="dc-welcome-ref">{welcomeAyat?.ref}</div>
          <button className="dc-btn-primary dc-welcome-btn" onClick={enterApp}>Войти</button>
        </div>
      </div>
    );
  }

  const userFolders = visibleFolders(folders);

  return (
    <div className="dc-app">
      <style>{STYLES}</style>

      <header className="dc-header">
        <div className="dc-header-top-row">
          <div className="dc-header-left">
            <h1 className="dc-title">Ежедневник</h1>
            <div className="dc-subtitle">{formatDisplay(today)} · {todayStats.done}/{todayStats.total} сегодня</div>
          </div>
          <AvatarCircle displayName={userProfile?.displayName} onClick={() => setProfileOpen(true)} />
        </div>
        <div className="dc-header-actions">
          <div className="dc-segmented">
            <button className={`dc-seg-btn ${view === "checklist" ? "active" : ""}`} onClick={() => { setView("checklist"); exitSelectMode(); }}>
              <ListChecks size={15} /> Список
            </button>
            <button className={`dc-seg-btn ${view === "progress" ? "active" : ""}`} onClick={() => { setView("progress"); exitSelectMode(); }}>
              <TrendingUp size={15} /> Прогресс
            </button>
          </div>
          <button className="dc-btn-primary" onClick={openAddPanel}><Plus size={16} /> Задача</button>
          <button className="dc-icon-ghost" title="Очистить всё" onClick={() => setConfirmReset(true)}><RotateCcw size={15} /></button>
        </div>
      </header>

      {confirmReset && (
        <div className="dc-banner dc-banner-warn">
          <span>Удалить все задачи и сбросить папки? Данные нельзя восстановить.</span>
          <div className="dc-banner-actions">
            <button className="dc-btn-small dc-btn-danger" onClick={resetAllData}>Да, очистить</button>
            <button className="dc-btn-small" onClick={() => setConfirmReset(false)}>Отмена</button>
          </div>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal modal={confirmModal} onCancel={closeConfirm} />
      )}

      {view === "checklist" && (
        <>
          {dailyBannerOpen && (
            <div className="dc-daily-banner">
              <div className="dc-daily-banner-body">
                <div className="dc-daily-banner-title">Добрый день, {userProfile?.displayName}!</div>
                <div className="dc-daily-banner-text">Не забудьте проверить ваши задачи на сегодня.</div>
              </div>
              <button type="button" className="dc-icon-ghost" title="Закрыть" onClick={() => setDailyBannerOpen(false)}><X size={15} /></button>
            </div>
          )}
          <div className="dc-toolbar">
            <div className="dc-filter-row">
              <button className={`dc-filter-btn ${listFilter === "all" ? "active" : ""}`} onClick={() => { setListFilter("all"); exitSavedSelectMode(); }}>
                Все
                {todayStats.total > 0 && <span className="dc-badge">{todayStats.total}</span>}
              </button>
              <button className={`dc-filter-btn ${listFilter === "incomplete" ? "active" : ""}`} onClick={() => { setListFilter("incomplete"); exitSavedSelectMode(); }}>
                Невыполненные
                {todayStats.incomplete > 0 && <span className="dc-badge dc-badge-warn">{todayStats.incomplete}</span>}
              </button>
              <button className={`dc-filter-btn dc-filter-overdue ${listFilter === "overdue" ? "active" : ""}`} onClick={() => { setListFilter("overdue"); exitSelectMode(); exitSavedSelectMode(); }}>
                <AlertTriangle size={13} /> Просроченные
                {overdueList.length > 0 && <span className="dc-badge dc-badge-warn">{overdueList.length}</span>}
              </button>
            </div>

            <div className="dc-toolbar-right">
              <div className="dc-search-wrap">
                <Search size={14} />
                <input className="dc-search" placeholder="Поиск…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                {searchQuery && <button className="dc-search-clear" onClick={() => setSearchQuery("")}><X size={12} /></button>}
              </div>

              <button type="button" className={`dc-menu-btn ${folderFilter ? "active" : ""}`} onClick={() => setFolderMenuOpen(true)}>
                <Folder size={14} />
                {folderFilter || "Папки"}
                <ChevronDown size={13} />
              </button>

              <button type="button" className={`dc-menu-btn ${selectMode ? "active" : ""}`} onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}>
                {selectMode ? <X size={14} /> : <CheckSquare size={14} />}
                {selectMode ? "Отмена" : "Выбрать"}
              </button>
            </div>
          </div>


          {listFilter !== "saved" && selectMode && (
            <div className="dc-bulk-bar">
              <span className="dc-bulk-count">Выбрано: {selectedIds.size}</span>
              <div className="dc-bulk-actions">
                <button className="dc-btn-small" onClick={() => setSelectedIds(new Set(allSelected ? [] : selectableTodayIds))}>
                  {allSelected ? "Снять всё" : "Выбрать все"}
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <button className="dc-btn-small" onClick={() => markTasksDone([...selectedIds], today)}>
                      <CheckCheck size={13} /> Выполнить
                    </button>
                    <div className="dc-menu-wrap">
                      <button className="dc-btn-small" onClick={() => setMoveMenuOpen((v) => !v)}>
                        <MoveRight size={13} /> Переместить
                      </button>
                      {moveMenuOpen && (
                        <div className="dc-dropdown dc-dropdown-up">
                          {userFolders.map((f) => (
                            <button key={f} className="dc-dropdown-item" onClick={() => { setMoveMenuOpen(false); requestMoveTasks([...selectedIds], f); }}>
                              <span className="dc-dot" style={{ background: folderColor(f) }} /> {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button className="dc-btn-small dc-btn-danger" onClick={() => requestDeleteTasks([...selectedIds])}>
                      <Trash2 size={13} /> Удалить
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="dc-content">
            {listFilter === "overdue" ? (
              <section className="dc-section dc-section-overdue">
                <div className="dc-section-head">
                  <h2 className="dc-section-title"><AlertTriangle size={14} /> Просроченные задачи</h2>
                </div>
                {overdueList.length === 0 ? (
                  <div className="dc-empty"><p>Просроченных задач нет.</p></div>
                ) : (
                  <div className="dc-paper">
                    {overdueList.map(({ task, date }) => (
                      <div className="dc-overdue-row" key={task.id + date}>
                        <div className="dc-overdue-info">
                          <div className="dc-overdue-title">{task.title}</div>
                          <div className="dc-overdue-meta">
                            {displayFolder(task.folder) && (
                              <>
                                <span className="dc-dot" style={{ background: folderColor(task.folder) }} />
                                {task.folder} ·
                              </>
                            )}
                            {formatDisplay(date)}
                          </div>
                        </div>
                        <div className="dc-overdue-actions">
                          <button className="dc-icon-ghost" title="Выполнить" onClick={() => toggleCompletion(task.id, date)}><Check size={15} /></button>
                          <button className="dc-icon-ghost" title="Пропустить" onClick={() => requestDismissOverdue(task, date)}><SkipForward size={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <>
            <section className="dc-section">
              <div className="dc-section-head">
                <h2 className="dc-section-title">Сегодня</h2>
                {todayTasks.length > 0 && !selectMode && todayStats.incomplete > 0 && (
                  <button className="dc-link-btn" onClick={() => markTasksDone(todayTasks.filter((t) => !t.completions[today]).map((t) => t.id), today)}>
                    Выполнить все
                  </button>
                )}
              </div>
              {todayTasks.length === 0 ? (
                <div className="dc-empty">
                  <p>{listFilter === "incomplete" ? "Все задачи на сегодня выполнены! 🎉" : "Сегодня задач нет."}</p>
                  <button className="dc-btn-primary" onClick={openAddPanel}><Plus size={16} /> Добавить</button>
                </div>
              ) : (
                <div className="dc-section-items">
                  {todayTasks.map((t, i) => (
                    <TaskRow key={t.id} task={t} date={today} checked={!!t.completions[today]}
                      onToggle={() => toggleCompletion(t.id, today)} onEdit={() => openEditPanel(t)}
                      onDelete={() => requestDeleteTask(t)}
                      showFolder={!folderFilter} selectMode={selectMode} selected={selectedIds.has(t.id)}
                      onSelectToggle={() => toggleSelect(t.id)} index={i} />
                  ))}
                </div>
              )}
            </section>

            {otherTasks.length > 0 && listFilter === "all" && (
              <section className="dc-section">
                <button className="dc-section-head dc-section-toggle" onClick={() => setShowOthers((v) => !v)}>
                  <h2 className="dc-section-title">Не на сегодня <span className="dc-badge">{otherTasks.length}</span></h2>
                  <ChevronDown size={14} style={{ transform: showOthers ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                </button>
                {showOthers && (
                  <div className="dc-section-items">
                    {otherTasks.map((t, i) => (
                      <TaskRow key={t.id} task={t} date={today} inactive checked={false} onToggle={() => {}}
                        onEdit={() => openEditPanel(t)} onDelete={() => requestDeleteTask(t)}
                        showFolder={!folderFilter} selectMode={false} selected={false} onSelectToggle={() => {}} index={i} />
                    ))}
                  </div>
                )}
              </section>
            )}
              </>
            )}
          </div>
        </>
      )}

      {view === "progress" && (
        <ProgressView tasks={tasks} today={today} overdueCount={overdueList.length}
          period={period} setPeriod={setPeriod} monthCursor={monthCursor} setMonthCursor={setMonthCursor} />
      )}

      {profileOpen && (
        <ProfileSheet
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          userProfile={userProfile}
          todayStats={todayStats}
          today={today}
        />
      )}

      {showCompletionModal && (
        <CompletionModal
          onClose={() => setShowCompletionModal(false)}
          displayName={userProfile?.displayName}
        />
      )}

      {panelOpen && (
        <AddTaskPanel form={form} setForm={setForm} folders={userFolders} onClose={() => setPanelOpen(false)} onSave={saveTask} />
      )}

      <FolderSheet
        open={folderMenuOpen}
        onClose={() => { setFolderMenuOpen(false); setFolderDraftOpen(false); setFolderDraft(""); }}
        title="Папки"
        folders={userFolders}
        selected={folderFilter}
        onSelect={(f) => setFolderFilter(f)}
        showCounts
        folderTaskCount={folderTaskCount}
        allowManage
        folderDraft={folderDraft}
        setFolderDraft={setFolderDraft}
        folderDraftOpen={folderDraftOpen}
        setFolderDraftOpen={setFolderDraftOpen}
        onAddFolder={(name) => { addFolder(name); setFolderMenuOpen(false); }}
        onDeleteFolder={(name) => requestDeleteFolder(name)}
        onDeleteAllFolders={() => requestDeleteAllFolders()}
      />
    </div>
  );
}

function ConfirmModal({ modal, onCancel }) {
  return (
    <div className="dc-confirm-overlay" onClick={onCancel}>
      <div className="dc-confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="dc-confirm-title">{modal.title}</h3>
        <table className="dc-confirm-table">
          <tbody>
            {modal.rows.map((row, i) => (
              <tr key={i}>
                <td className="dc-confirm-label">{row.label}</td>
                <td className="dc-confirm-value">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {modal.extra && <div className="dc-confirm-extra">{modal.extra}</div>}
        <div className="dc-confirm-foot">
          <button className="dc-btn-ghost" onClick={onCancel}>Отмена</button>
          <button className={`dc-btn-primary ${modal.danger ? "dc-btn-danger-fill" : ""}`} onClick={modal.onConfirm}>
            {modal.confirmLabel || "Подтвердить"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task, checked, onToggle, onEdit, onDelete, showFolder, inactive, selectMode, selected, onSelectToggle, index = 0 }) {
  return (
    <div
      className={`dc-row ${inactive ? "dc-row-inactive" : ""} ${selected ? "dc-row-selected" : ""}`}
      style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
    >
      {selectMode ? (
        <button className={`dc-select-box ${selected ? "checked" : ""}`} onClick={onSelectToggle} aria-label="Выбрать">
          {selected && <Check size={13} />}
        </button>
      ) : (
        <button className={`dc-checkbox ${checked ? "checked" : ""}`} onClick={onToggle} disabled={inactive} aria-label="Отметить">
          {checked && <span className="dc-checkmark">✓</span>}
        </button>
      )}
      <div className="dc-row-body">
        <span className={`dc-row-title ${checked ? "done" : ""}`}>{task.title}</span>
        <div className="dc-row-meta">
          <span className="dc-badge-repeat">{repeatLabel(task)}</span>
          {task.time && <span className="dc-badge-mono"><Clock size={10} /> {task.time}</span>}
          {showFolder && displayFolder(task.folder) && (
            <span className="dc-badge-folder" style={{ background: folderColor(task.folder) + "22", color: folderColor(task.folder) }}>
              <span className="dc-dot" style={{ background: folderColor(task.folder) }} /> {task.folder}
            </span>
          )}
        </div>
        {task.benefit && <div className="dc-row-benefit">{task.benefit}</div>}
      </div>
      {!selectMode && (
        <div className="dc-row-actions">
          <button className="dc-icon-ghost" onClick={onEdit} title="Редактировать"><Pencil size={14} /></button>
          <button className="dc-icon-ghost" onClick={onDelete} title="Удалить"><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  );
}

function AddTaskPanel({ form, setForm, folders, onClose, onSave }) {
  const [folderSheetOpen, setFolderSheetOpen] = useState(false);
  const [newFolderDraft, setNewFolderDraft] = useState("");
  const [newFolderDraftOpen, setNewFolderDraftOpen] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const folderLabel = form.isNewFolder
    ? (form.newFolderName.trim() || "Новая папка…")
    : (displayFolder(form.folder) || form.folder || DEFAULT_FOLDER);

  const pickFolder = (name) => {
    if (!name) set({ folder: DEFAULT_FOLDER, isNewFolder: false, newFolderName: "" });
    else set({ folder: name, isNewFolder: false, newFolderName: "" });
  };

  return (
    <>
    <div className="dc-overlay" onClick={onClose}>
      <div className="dc-card" onClick={(e) => e.stopPropagation()}>
        <div className="dc-card-head">
          <h2>{form.id ? "Редактировать" : "Новая задача"}</h2>
          <button type="button" className="dc-icon-ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dc-field">
          <label>Название</label>
          <input className="dc-input" value={form.title} autoFocus placeholder="Например: Полить цветы"
            onChange={(e) => set({ title: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") onSave(); }} />
        </div>
        <div className="dc-field">
          <label>Папка</label>
          {form.isNewFolder ? (
            <div className="dc-folder-new">
              <input className="dc-input" placeholder="Название новой папки" value={form.newFolderName}
                onChange={(e) => set({ newFolderName: e.target.value })} autoFocus />
              <button type="button" className="dc-btn-small" onClick={() => set({ isNewFolder: false, newFolderName: "" })}>К списку</button>
            </div>
          ) : (
            <button type="button" className="dc-input dc-picker-btn" onClick={() => setFolderSheetOpen(true)}>
              <span className="dc-picker-label">{folderLabel}</span>
              <ChevronDown size={16} />
            </button>
          )}
        </div>
        <div className="dc-field">
          <label>Повторение</label>
          <div className="dc-repeat-options">
            {[["daily", "Ежедневно"], ["everyOther", "Через день"], ["weekly", "По дням"], ["once", "Один раз"]].map(([val, lbl]) => (
              <button type="button" key={val} className={`dc-pill ${form.repeat === val ? "active" : ""}`} onClick={() => set({ repeat: val })}>{lbl}</button>
            ))}
          </div>
        </div>
        {form.repeat === "weekly" && (
          <div className="dc-field">
            <label>Дни недели</label>
            <div className="dc-weekday-row">
              {WEEKDAY_ORDER.map((w) => (
                <button type="button" key={w} className={`dc-weekday ${form.weekdays.includes(w) ? "active" : ""}`}
                  onClick={() => set({ weekdays: form.weekdays.includes(w) ? form.weekdays.filter((x) => x !== w) : [...form.weekdays, w] })}>
                  {WEEKDAY_SHORT[w]}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="dc-field-row">
          <div className="dc-field">
            <label>{form.repeat === "once" ? "Дата" : "Начать с"}</label>
            <input className="dc-input" type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </div>
          <div className="dc-field">
            <label>Время</label>
            <input className="dc-input" type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} />
          </div>
        </div>
        <div className="dc-field">
          <label>Польза</label>
          <textarea className="dc-input dc-textarea" rows={2} placeholder="Почему это важно?"
            value={form.benefit} onChange={(e) => set({ benefit: e.target.value })} />
        </div>
        <div className="dc-card-foot">
          <button type="button" className="dc-btn-ghost" onClick={onClose}>Отмена</button>
          <button type="button" className="dc-btn-primary" onClick={onSave}>Сохранить</button>
        </div>
      </div>
    </div>
    <FolderSheet
      open={folderSheetOpen}
      onClose={() => { setFolderSheetOpen(false); setNewFolderDraftOpen(false); setNewFolderDraft(""); }}
      title="Выберите папку"
      folders={folders}
      selected={form.folder === DEFAULT_FOLDER ? null : form.folder}
      onSelect={pickFolder}
      allowManage
      folderDraft={newFolderDraft}
      setFolderDraft={setNewFolderDraft}
      folderDraftOpen={newFolderDraftOpen}
      setFolderDraftOpen={setNewFolderDraftOpen}
      onNewFolder={() => set({ isNewFolder: true, newFolderName: "" })}
    />
    </>
  );
}

function RingProgress({ pct, size = 72, stroke = 6, label, value, danger }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ;
  const color = danger ? "var(--red)" : pct >= 100 ? "var(--accent)" : pct >= 50 ? "var(--gold)" : "var(--red)";
  return (
    <div className="dc-ring-wrap">
      <svg width={size} height={size} className="dc-ring-svg">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink-faint)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} className="dc-ring-fill" />
        <text x="50%" y="46%" textAnchor="middle" className="dc-ring-value">{value}</text>
        <text x="50%" y="62%" textAnchor="middle" className="dc-ring-pct">{typeof pct === "number" ? `${pct}%` : ""}</text>
      </svg>
      <div className="dc-ring-label">{label}</div>
    </div>
  );
}

function ProgressView({ tasks, today, overdueCount, period, setPeriod, monthCursor, setMonthCursor }) {
  const todayTotal = tasks.filter((t) => isScheduledOn(t, today)).length;
  const todayDone = tasks.filter((t) => isScheduledOn(t, today) && t.completions[today]).length;
  const todayPct = todayTotal ? Math.round((todayDone / todayTotal) * 100) : 0;

  const monday = (() => {
    const wd = weekdayOf(today);
    return addDaysStr(today, wd === 0 ? -6 : 1 - wd);
  })();
  const weekDates = [0, 1, 2, 3, 4, 5, 6].map((i) => addDaysStr(monday, i));

  let periodTotal = 0, periodDone = 0;
  weekDates.forEach((d) => {
    if (d > today) return;
    tasks.forEach((t) => { if (isScheduledOn(t, d)) { periodTotal++; if (t.completions[d]) periodDone++; } });
  });

  const [yStr, mStr] = monthCursor.split("-");
  const year = Number(yStr), month = Number(mStr) - 1;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDateStr = `${yStr}-${mStr}-01`;
  const leadingBlanks = weekdayOf(firstDateStr) === 0 ? 6 : weekdayOf(firstDateStr) - 1;
  const monthDates = [];
  for (let i = 0; i < leadingBlanks; i++) monthDates.push(null);
  for (let day = 1; day <= daysInMonth; day++) monthDates.push(`${yStr}-${mStr}-${pad(day)}`);

  let monthTotal = 0, monthDone = 0;
  monthDates.forEach((d) => {
    if (!d || d > today) return;
    tasks.forEach((t) => { if (isScheduledOn(t, d)) { monthTotal++; if (t.completions[d]) monthDone++; } });
  });

  const isWeek = period === "week";
  const pTotal = isWeek ? periodTotal : monthTotal;
  const pDone = isWeek ? periodDone : monthDone;
  const pPct = pTotal ? Math.round((pDone / pTotal) * 100) : 0;

  const shiftMonth = (delta) => {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setMonthCursor(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  };

  return (
    <div className="dc-progress">
      <div className="dc-rings-row">
        <RingProgress label="Сегодня" value={`${todayDone}/${todayTotal}`} pct={todayPct} />
        <RingProgress label={isWeek ? "Неделя" : "Месяц"} value={`${pDone}/${pTotal}`} pct={pPct} />
        <RingProgress label="Просрочено" value={String(overdueCount)} pct={overdueCount > 0 ? 100 : 0} danger={overdueCount > 0} />
      </div>
      <div className="dc-segmented dc-progress-seg">
        <button className={`dc-seg-btn ${isWeek ? "active" : ""}`} onClick={() => setPeriod("week")}>Неделя</button>
        <button className={`dc-seg-btn ${!isWeek ? "active" : ""}`} onClick={() => setPeriod("month")}>Месяц</button>
      </div>
      {isWeek ? (
        <WeekTable tasks={tasks} weekDates={weekDates} today={today} />
      ) : (
        <MonthCalendar tasks={tasks} monthDates={monthDates} today={today}
          label={`${MONTH_NAMES[month]} ${year}`} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} />
      )}
    </div>
  );
}

function WeekTable({ tasks, weekDates, today }) {
  if (tasks.length === 0) return <div className="dc-empty"><p>Нет задач.</p></div>;
  return (
    <div className="dc-week-wrap">
      <table className="dc-week-table">
        <thead>
          <tr>
            <th className="dc-week-task-col">Задача</th>
            {weekDates.map((d) => (
              <th key={d} className={d === today ? "dc-week-today" : ""}>
                {WEEKDAY_SHORT[weekdayOf(d)]}<br /><span className="dc-week-daynum">{d.slice(8, 10)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td className="dc-week-task-col">
                <span className="dc-dot" style={{ background: folderColor(t.folder) }} /> {t.title}
              </td>
              {weekDates.map((d) => {
                const scheduled = isScheduledOn(t, d);
                let cell = "—", cls = "dc-week-none";
                if (scheduled) {
                  if (t.completions[d]) { cell = "✓"; cls = "dc-week-done"; }
                  else if (d < today) { cell = "✕"; cls = "dc-week-missed"; }
                  else if (d === today) { cell = "○"; cls = "dc-week-pending"; }
                  else { cell = "·"; cls = "dc-week-upcoming"; }
                }
                return <td key={d} className={`dc-week-cell ${cls} ${d === today ? "dc-week-today" : ""}`}>{cell}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthCalendar({ tasks, monthDates, today, label, onPrev, onNext }) {
  return (
    <div className="dc-month-wrap">
      <div className="dc-month-head">
        <button className="dc-icon-ghost" onClick={onPrev}><ChevronLeft size={16} /></button>
        <span className="dc-month-label">{label}</span>
        <button className="dc-icon-ghost" onClick={onNext}><ChevronRight size={16} /></button>
      </div>
      <div className="dc-month-grid dc-month-grid-head">
        {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map((d) => <div key={d} className="dc-month-headcell">{d}</div>)}
      </div>
      <div className="dc-month-grid">
        {monthDates.map((d, i) => {
          if (!d) return <div key={"b" + i} className="dc-month-cell dc-month-cell-blank" />;
          const future = d > today;
          let scheduled = 0, done = 0;
          tasks.forEach((t) => { if (isScheduledOn(t, d)) { scheduled++; if (t.completions[d]) done++; } });
          const pct = scheduled ? Math.round((done / scheduled) * 100) : 0;
          const size = 28, stroke = 3, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
          const offset = circ - (pct / 100) * circ;
          return (
            <div key={d} className={`dc-month-cell ${d === today ? "dc-month-today" : ""} ${future ? "dc-month-future" : ""}`}>
              <span className="dc-month-daynum">{Number(d.slice(8, 10))}</span>
              {!future && scheduled > 0 && (
                <svg width={size} height={size} className="dc-month-ring">
                  <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink-faint)" strokeWidth={stroke} />
                  <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={pct === 100 ? "var(--accent)" : pct > 0 ? "var(--gold)" : "var(--red)"}
                    strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`} />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
:root{
  --paper:#E7DFC9; --paper-light:#F6F1E4; --paper-dark:#DAD0B4;
  --ink:#2B2A25; --ink-soft:#6B6552; --ink-faint:rgba(43,42,37,0.14);
  --accent:#2F5233; --accent-light:#DCE6D2;
  --gold:#B8862E; --gold-light:#F1E2BC;
  --red:#A23B2E; --red-light:#F3DCD3;
  --font-display:'Fraunces',serif; --font-body:'Inter',sans-serif; --font-mono:'JetBrains Mono',monospace;
}
/* ── Animations ── */
@keyframes dc-fade-in{from{opacity:0}to{opacity:1}}
@keyframes dc-slide-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes dc-slide-up{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes dc-check-pop{0%{transform:scale(0.5)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes dc-fade-scale{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
@keyframes dc-bounce-in{0%{opacity:0;transform:scale(0.8)}60%{opacity:1;transform:scale(1.05)}100%{transform:scale(1)}}

*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html{width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%;text-size-adjust:100%;}
body{margin:0;width:100%;overflow-x:hidden;overscroll-behavior-x:none;}
#root{width:100%;overflow-x:hidden;}
.dc-loading{font-family:var(--font-body);padding:40px;color:var(--ink-soft);animation:dc-fade-in .3s ease;}
/* ── Setup screen ── */
.dc-setup-screen{min-height:100dvh;display:flex;align-items:center;justify-content:center;background:var(--paper);padding:max(20px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));font-family:var(--font-body);}
.dc-setup-card{background:var(--paper-light);border:1px solid var(--ink-faint);border-radius:20px;padding:28px 20px;width:100%;max-width:400px;display:flex;flex-direction:column;gap:14px;align-items:center;text-align:center;box-shadow:0 4px 24px rgba(43,42,37,0.12);animation:dc-bounce-in .45s cubic-bezier(0.22,1,0.36,1) both;}
.dc-setup-emoji{font-size:44px;line-height:1;}
.dc-setup-title{font-family:var(--font-display);font-size:22px;font-weight:700;margin:0;color:var(--ink);}
.dc-setup-desc{font-size:13px;color:var(--ink-soft);margin:0;line-height:1.5;}
.dc-setup-fields{display:flex;flex-direction:column;gap:10px;width:100%;text-align:left;}
.dc-field{display:flex;flex-direction:column;gap:4px;}
.dc-field label{font-family:var(--font-mono);font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-soft);}
.dc-username-wrap{display:flex;align-items:center;border:1.5px solid var(--ink-faint);border-radius:8px;overflow:hidden;background:var(--paper);}
.dc-username-at{padding:0 8px;font-size:15px;color:var(--ink-soft);background:var(--paper-light);border-right:1px solid var(--ink-faint);height:44px;display:flex;align-items:center;}
.dc-username-input{border:none!important;border-radius:0!important;flex:1;}
.dc-setup-error{background:#fdf1f0;border:1px solid #e8a09a;color:#b94a48;border-radius:8px;padding:8px 10px;font-size:13px;width:100%;}
.dc-setup-btn{width:100%;justify-content:center;font-size:15px;min-height:48px;margin-top:4px;}
/* ── Welcome screen ── */
.dc-welcome{min-height:100dvh;display:flex;align-items:center;justify-content:center;background:var(--paper);padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));font-family:var(--font-body);}
.dc-welcome-card{background:var(--paper-light);border:1px solid var(--ink-faint);border-radius:20px;padding:28px 20px;text-align:center;max-width:420px;width:100%;box-shadow:0 4px 24px rgba(43,42,37,0.12);animation:dc-bounce-in .45s cubic-bezier(0.22,1,0.36,1) both;}
.dc-welcome-user{font-size:16px;font-weight:600;color:var(--ink);margin-bottom:14px;}
.dc-welcome-label{font-family:var(--font-mono);font-size:10px;letter-spacing:1.5px;color:var(--ink-soft);text-transform:uppercase;margin-bottom:16px;}
.dc-welcome-ar{font-family:var(--font-display);font-size:clamp(22px,6vw,30px);line-height:1.65;color:var(--accent);margin-bottom:14px;direction:rtl;text-align:center;}
.dc-welcome-ru{font-size:14px;line-height:1.5;color:var(--ink);margin-bottom:10px;}
.dc-welcome-ref{font-family:var(--font-mono);font-size:10px;color:var(--ink-soft);margin-bottom:22px;}
.dc-welcome-btn{margin:0 auto;padding:12px 36px;font-size:15px;min-height:44px;width:100%;max-width:280px;justify-content:center;}
.dc-subtitle-user{opacity:.65;}
.dc-daily-banner{display:flex;align-items:flex-start;gap:10px;background:var(--accent-light);border:1.5px solid var(--accent);border-radius:14px;padding:12px 14px;margin-bottom:12px;animation:dc-slide-in .3s cubic-bezier(0.22,1,0.36,1) both;}
.dc-daily-banner-body{flex:1;min-width:0;}
.dc-daily-banner-title{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--accent);margin-bottom:4px;}
.dc-daily-banner-text{font-size:13px;line-height:1.4;color:var(--ink);}
.dc-confirm-overlay{position:fixed;inset:0;background:rgba(43,42,37,0.5);display:flex;align-items:center;justify-content:center;z-index:400;padding:16px;animation:dc-fade-in .2s ease both;}
.dc-confirm-box{background:var(--paper-light);border:1px solid var(--ink-faint);border-radius:18px;padding:22px;max-width:420px;width:100%;box-shadow:0 12px 48px rgba(0,0,0,0.18);animation:dc-fade-scale .25s cubic-bezier(0.22,1,0.36,1) both;}
.dc-confirm-title{font-family:var(--font-display);font-size:18px;margin:0 0 14px;}
.dc-confirm-table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px;}
.dc-confirm-table td{padding:7px 8px;border-bottom:1px solid var(--ink-faint);vertical-align:top;}
.dc-confirm-label{font-family:var(--font-mono);font-size:11px;color:var(--ink-soft);width:38%;white-space:nowrap;}
.dc-confirm-value{font-weight:500;color:var(--ink);}
.dc-confirm-extra{font-size:12px;color:var(--ink-soft);margin-bottom:12px;}
.dc-confirm-foot{display:flex;justify-content:flex-end;gap:8px;}
.dc-btn-danger-fill{background:var(--red)!important;}
.dc-filter-overdue.active{background:var(--red)!important;border-color:var(--red)!important;}
.dc-filter-saved.active{background:var(--accent)!important;border-color:var(--accent)!important;}
.dc-inspire{display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:10px;width:100%;max-width:100%;overflow:hidden;}
.dc-inspire-card{background:var(--paper-light);border:1px solid var(--ink-faint);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;min-width:0;max-width:100%;overflow:hidden;}
.dc-inspire-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.dc-inspire-actions{display:flex;align-items:center;gap:4px;}
.dc-inspire-btn{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:1px solid var(--ink-faint);border-radius:5px;background:var(--paper);color:var(--ink-soft);cursor:pointer;padding:0;}
.dc-inspire-btn:hover{color:var(--ink);border-color:var(--ink-soft);}
.dc-inspire-btn.saved{color:var(--accent);border-color:var(--accent);background:rgba(47,82,51,0.08);}
.dc-inspire-meta{grid-column:1/-1;font-family:var(--font-mono);font-size:10px;color:var(--ink-soft);text-align:center;padding-top:2px;}
.dc-saved-wrap{display:flex;flex-direction:column;gap:14px;}
.dc-saved-group{display:flex;flex-direction:column;gap:8px;}
.dc-saved-title{font-family:var(--font-mono);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-soft);margin:0;}
.dc-saved-card{background:var(--paper-light);border:1px solid var(--ink-faint);border-radius:8px;padding:10px 12px;display:flex;flex-direction:row;align-items:flex-start;gap:8px;min-width:0;}
.dc-saved-card-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;}
.dc-saved-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;}
.dc-inspire-ayat{border-top:3px solid var(--accent);}
.dc-inspire-hadith{border-top:3px solid var(--gold);}
.dc-inspire-tag{font-family:var(--font-mono);font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--ink-soft);}
.dc-inspire-ar{font-family:var(--font-display);font-size:clamp(16px,4.8vw,20px);line-height:1.55;color:var(--accent);direction:rtl;text-align:right;word-break:break-word;overflow-wrap:anywhere;}
.dc-inspire-text{font-size:12px;line-height:1.45;color:var(--ink);overflow-wrap:anywhere;}
.dc-inspire-ref{font-family:var(--font-mono);font-size:10px;color:var(--ink-soft);margin-top:auto;padding-top:4px;}
.dc-app{font-family:var(--font-body);background:var(--paper);color:var(--ink);min-height:100dvh;width:100%;max-width:100vw;overflow-x:hidden;padding:max(14px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(14px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));margin:0;}
.dc-header{display:flex;flex-direction:column;align-items:stretch;gap:12px;margin-bottom:12px;width:100%;max-width:100%;animation:dc-fade-in .3s ease both;}
.dc-header-left{min-width:0;}
.dc-title{font-family:var(--font-display);font-weight:700;font-size:clamp(22px,6vw,26px);margin:0;line-height:1.2;letter-spacing:-.3px;}
.dc-subtitle{font-family:var(--font-mono);font-size:10.5px;color:var(--ink-soft);margin-top:3px;}
.dc-header-actions{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;width:100%;max-width:100%;}
.dc-segmented{display:grid;grid-template-columns:1fr 1fr;grid-column:1/-1;background:var(--paper-light);border:1.5px solid var(--ink-faint);border-radius:12px;padding:3px;width:100%;}
.dc-seg-btn{display:flex;align-items:center;justify-content:center;gap:5px;border:none;background:transparent;padding:9px 8px;font-family:var(--font-body);font-size:12.5px;font-weight:500;color:var(--ink-soft);border-radius:8px;cursor:pointer;min-height:40px;touch-action:manipulation;transition:background .18s ease,color .18s ease,transform .12s ease;}
.dc-seg-btn.active{background:var(--ink);color:var(--paper-light);box-shadow:0 1px 4px rgba(43,42,37,0.2);}
.dc-seg-btn:active{transform:scale(0.95);}
.dc-btn-primary{display:flex;align-items:center;justify-content:center;gap:5px;background:var(--accent);color:#fff;border:none;padding:10px 14px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-body);min-height:44px;touch-action:manipulation;white-space:nowrap;transition:background .15s ease,transform .12s ease,box-shadow .15s ease;box-shadow:0 2px 8px rgba(47,82,51,0.3);}
.dc-btn-primary:active{background:#1f3a22;transform:scale(0.96);box-shadow:none;}
.dc-btn-ghost{background:var(--paper-light);border:1.5px solid var(--ink-faint);color:var(--ink-soft);padding:10px 14px;border-radius:12px;font-size:12px;cursor:pointer;font-family:var(--font-body);min-height:44px;touch-action:manipulation;transition:all .15s ease;}
.dc-btn-ghost:active{background:var(--paper-dark);transform:scale(0.97);}
.dc-icon-ghost{background:transparent;border:none;color:var(--ink-soft);cursor:pointer;padding:8px;border-radius:10px;display:flex;align-items:center;justify-content:center;min-width:40px;min-height:40px;touch-action:manipulation;flex-shrink:0;transition:background .15s ease,color .15s ease,transform .12s ease;}
.dc-icon-ghost:active{background:var(--paper-dark);color:var(--ink);transform:scale(0.9);}
.dc-btn-small{background:var(--paper-light);border:1px solid var(--ink-faint);padding:6px 11px;border-radius:8px;font-size:12px;cursor:pointer;font-family:var(--font-body);color:var(--ink);display:inline-flex;align-items:center;gap:4px;min-height:36px;transition:all .14s ease;}
.dc-btn-small:active{background:var(--paper-dark);transform:scale(0.97);}
.dc-btn-danger{background:var(--red);color:#fff;border-color:var(--red);}
.dc-banner{display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--gold-light);border:1px solid var(--gold);border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:12.5px;flex-wrap:wrap;}
.dc-banner-actions{display:flex;gap:6px;}
.dc-toolbar{display:flex;flex-direction:column;align-items:stretch;gap:8px;margin-bottom:12px;padding:10px;background:var(--paper-light);border:1.5px solid var(--ink-faint);border-radius:16px;width:100%;max-width:100%;overflow:visible;position:relative;z-index:10;box-shadow:0 1px 3px rgba(43,42,37,0.06);}
.dc-filter-row{display:flex;gap:4px;overflow-x:auto;flex-wrap:nowrap;width:100%;max-width:100%;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px;}
.dc-filter-row::-webkit-scrollbar{display:none;}
.dc-filter-btn{display:flex;align-items:center;gap:4px;border:1.5px solid transparent;background:var(--paper-dark);padding:7px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-body);color:var(--ink-soft);white-space:nowrap;flex-shrink:0;min-height:36px;touch-action:manipulation;transition:all .18s cubic-bezier(0.22,1,0.36,1);}
.dc-filter-btn.active{background:var(--accent);color:#fff;border-color:var(--accent);box-shadow:0 2px 8px rgba(47,82,51,0.25);}
.dc-filter-btn:active{transform:scale(0.94);}
.dc-badge{font-family:var(--font-mono);font-size:10px;padding:1px 6px;border-radius:8px;background:rgba(255,255,255,0.25);}
.dc-filter-btn:not(.active) .dc-badge{background:var(--ink-faint);color:var(--ink);}
.dc-badge-warn{background:var(--red)!important;color:#fff!important;}
.dc-toolbar-right{display:flex;align-items:center;gap:6px;width:100%;max-width:100%;}
.dc-search-wrap{display:flex;align-items:center;gap:4px;background:#fff;border:1px solid var(--ink-faint);border-radius:8px;padding:4px 8px;flex:1;min-width:0;min-height:36px;}
.dc-search{border:none;outline:none;font-size:13px;font-family:var(--font-body);width:100%;min-width:0;background:transparent;}
.dc-search-clear{background:none;border:none;cursor:pointer;color:var(--ink-soft);padding:0;display:flex;}
.dc-menu-wrap{position:relative;}
.dc-menu-btn{display:flex;align-items:center;gap:4px;border:1px solid var(--ink-faint);background:var(--paper-dark);padding:6px 8px;border-radius:8px;font-size:11.5px;cursor:pointer;font-family:var(--font-body);color:var(--ink-soft);min-height:36px;touch-action:manipulation;white-space:nowrap;flex-shrink:0;max-width:42vw;overflow:hidden;text-overflow:ellipsis;}
.dc-menu-btn.active{background:var(--accent-light);border-color:var(--accent);color:var(--accent);}
.dc-dropdown{position:absolute;top:calc(100% + 4px);right:0;min-width:220px;background:#fff;border:1px solid var(--ink-faint);border-radius:8px;padding:4px;z-index:40;box-shadow:0 8px 24px rgba(0,0,0,0.1);}
.dc-dropdown-up{top:auto;bottom:calc(100% + 4px);}
.dc-dropdown-item{display:flex;align-items:center;gap:8px;width:100%;border:none;background:transparent;padding:8px 10px;border-radius:5px;font-size:12.5px;cursor:pointer;font-family:var(--font-body);color:var(--ink);text-align:left;}
.dc-dropdown-item:hover{background:var(--paper-light);}
.dc-dropdown-item.selected{background:var(--accent-light);font-weight:600;}
.dc-dropdown-meta{margin-left:auto;font-family:var(--font-mono);font-size:10px;color:var(--ink-soft);}
.dc-dropdown-divider{height:1px;background:var(--ink-faint);margin:4px 0;}
.dc-dropdown-row{display:flex;align-items:center;gap:2px;}
.dc-dropdown-row .dc-dropdown-item{flex:1;}
.dc-dropdown-del{border:none;background:transparent;color:var(--ink-soft);cursor:pointer;padding:4px;border-radius:4px;display:flex;}
.dc-dropdown-del:hover{color:var(--red);background:var(--red-light);}
.dc-dropdown-add{color:var(--accent);}
.dc-dropdown-danger{color:var(--red);}
.dc-dropdown-draft{display:flex;gap:4px;padding:4px;}
.dc-dropdown-input{flex:1;border:1px solid var(--ink-faint);border-radius:4px;padding:6px 8px;font-size:12.5px;font-family:var(--font-body);}
.dc-dropdown-footer{display:flex;align-items:center;gap:6px;padding:8px;font-size:12px;color:var(--red);}
.dc-dropdown-confirm{display:flex;gap:4px;padding:0 4px;}
.dc-bulk-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 12px;background:var(--accent-light);border:1px solid var(--accent);border-radius:8px;margin-bottom:10px;flex-wrap:wrap;}
.dc-bulk-count{font-size:12.5px;font-weight:600;color:var(--accent);}
.dc-bulk-actions{display:flex;gap:5px;flex-wrap:wrap;align-items:center;}
.dc-content{display:flex;flex-direction:column;gap:8px;width:100%;max-width:100%;overflow:hidden;}
.dc-section{width:100%;}
.dc-section-overdue .dc-section-head{color:var(--red);}
.dc-section-head{display:flex;justify-content:space-between;align-items:center;padding:6px 4px 8px;}
.dc-section-toggle{width:100%;border:none;background:transparent;cursor:pointer;font-family:inherit;padding:0;}
.dc-section-title{font-size:11.5px;font-weight:700;margin:0;display:flex;align-items:center;gap:6px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.6px;color:var(--ink-soft);}
.dc-section-items{display:flex;flex-direction:column;gap:8px;}
.dc-link-btn{border:none;background:transparent;color:var(--accent);font-size:12px;cursor:pointer;font-family:var(--font-body);font-weight:600;}
.dc-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0;}
.dc-paper{background:repeating-linear-gradient(var(--paper-light) 0px,var(--paper-light) 40px,var(--ink-faint) 40px,var(--ink-faint) 41px);}
.dc-paper-muted{opacity:0.7;}
.dc-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:48px 16px;color:var(--ink-soft);font-size:13px;animation:dc-fade-in .35s ease both;}

/* ── Task cards ── */
.dc-row{
  display:flex;align-items:flex-start;gap:12px;padding:14px 12px 14px 14px;
  background:var(--paper-light);
  border-radius:14px;
  box-shadow:0 1px 3px rgba(43,42,37,0.09),0 0 0 1px rgba(43,42,37,0.06);
  width:100%;
  animation:dc-slide-in .28s cubic-bezier(0.22,1,0.36,1) both;
  transition:transform .14s ease,box-shadow .14s ease,opacity .2s ease;
  position:relative;
  overflow:hidden;
}
.dc-row:active{transform:scale(0.985);box-shadow:0 0 0 1px rgba(43,42,37,0.1);}
.dc-row-inactive{opacity:0.55;}
.dc-row-selected{box-shadow:0 0 0 2px var(--accent),0 2px 8px rgba(47,82,51,0.15);}

/* Circular iOS-style checkbox */
.dc-checkbox{
  width:24px;height:24px;border-radius:50%;
  border:2px solid var(--ink-faint);
  background:transparent;
  cursor:pointer;flex-shrink:0;margin-top:1px;
  display:flex;align-items:center;justify-content:center;padding:0;
  transition:background .18s ease,border-color .18s ease,transform .18s cubic-bezier(0.34,1.56,0.64,1);
  touch-action:manipulation;
}
.dc-checkbox:hover{border-color:var(--accent);transform:scale(1.1);}
.dc-checkbox.checked{
  background:var(--accent);border-color:var(--accent);
  animation:dc-check-pop .28s cubic-bezier(0.34,1.56,0.64,1) both;
}
.dc-checkbox:disabled{cursor:default;opacity:0.35;}
.dc-checkmark{color:#fff;font-weight:800;font-size:12px;line-height:1;}

.dc-select-box{
  width:24px;height:24px;border-radius:7px;
  border:2px solid var(--ink-faint);background:transparent;
  cursor:pointer;flex-shrink:0;margin-top:1px;
  display:flex;align-items:center;justify-content:center;padding:0;
  transition:all .18s ease;
}
.dc-select-box.checked{background:var(--accent);border-color:var(--accent);color:#fff;}

.dc-row-body{flex:1;min-width:0;}
.dc-row-top{display:flex;align-items:flex-start;gap:6px;flex-wrap:wrap;margin-bottom:4px;}
.dc-row-title{font-size:14px;font-weight:600;overflow-wrap:anywhere;word-break:break-word;line-height:1.4;color:var(--ink);}
.dc-row-title.done{text-decoration:line-through;opacity:0.45;font-weight:400;}

/* Meta badges */
.dc-row-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:3px;}
.dc-badge-mono{display:inline-flex;align-items:center;gap:3px;font-family:var(--font-mono);font-size:10px;color:var(--gold);background:var(--gold-light);padding:2px 6px;border-radius:20px;font-weight:600;}
.dc-badge-repeat{display:inline-flex;align-items:center;font-family:var(--font-mono);font-size:10px;color:var(--ink-soft);background:var(--paper-dark);padding:2px 7px;border-radius:20px;}
.dc-badge-folder{display:inline-flex;align-items:center;gap:3px;font-family:var(--font-mono);font-size:10px;padding:2px 7px;border-radius:20px;font-weight:500;}

.dc-row-benefit{font-size:11.5px;color:var(--ink-soft);font-style:italic;margin-top:4px;line-height:1.4;}
.dc-row-actions{display:flex;gap:0;flex-shrink:0;margin-top:-2px;}

.dc-overdue-row{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--paper-light);border-radius:10px;box-shadow:0 1px 3px rgba(43,42,37,0.07);}
.dc-overdue-info{flex:1;min-width:0;}
.dc-overdue-title{font-size:13px;font-weight:600;}
.dc-overdue-meta{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--ink-soft);margin-top:2px;}
.dc-overdue-actions{display:flex;gap:2px;}
.dc-overdue-more{padding:8px 12px;font-size:11px;color:var(--ink-soft);text-align:center;}
.dc-overlay{position:fixed;inset:0;background:rgba(43,42,37,0.5);display:flex;align-items:flex-end;justify-content:center;z-index:250;padding:0;animation:dc-fade-in .2s ease both;}
.dc-card{width:100%;max-width:100vw;height:auto;max-height:92dvh;background:var(--paper-light);padding:16px 16px max(16px,env(safe-area-inset-bottom));overflow-x:hidden;overflow-y:auto;border-radius:18px 18px 0 0;box-sizing:border-box;animation:dc-slide-up .32s cubic-bezier(0.22,1,0.36,1) both;}
.dc-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;}
.dc-card-head h2{font-family:var(--font-display);font-size:17px;margin:0;}
.dc-field{margin-bottom:12px;width:100%;max-width:100%;min-width:0;}
.dc-field label{display:block;font-size:10px;font-family:var(--font-mono);color:var(--ink-soft);margin-bottom:4px;}
.dc-input{width:100%;max-width:100%;min-width:0;border:1px solid var(--ink-faint);background:#fff;border-radius:8px;padding:10px;font-size:16px;font-family:var(--font-body);color:var(--ink);box-sizing:border-box;}
.dc-input:focus{outline:2px solid var(--accent);outline-offset:1px;}
.dc-textarea{resize:vertical;min-height:64px;}
.dc-field-row{display:flex;flex-direction:column;gap:0;width:100%;max-width:100%;}
.dc-field-row .dc-field{flex:1;width:100%;}
.dc-inline-row{display:flex;gap:6px;width:100%;max-width:100%;align-items:center;}
.dc-inline-row .dc-input{flex:1;min-width:0;}
.dc-repeat-options{display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%;}
.dc-pill{background:#fff;border:1px solid var(--ink-faint);padding:8px 6px;border-radius:10px;font-size:11px;cursor:pointer;color:var(--ink-soft);font-family:var(--font-body);text-align:center;min-height:36px;touch-action:manipulation;}
.dc-pill.active{background:var(--accent);color:#fff;border-color:var(--accent);}
.dc-weekday-row{display:flex;gap:4px;flex-wrap:wrap;justify-content:space-between;}
.dc-weekday{flex:1;min-width:36px;max-width:44px;height:36px;border:1px solid var(--ink-faint);background:#fff;border-radius:6px;font-size:11px;font-family:var(--font-mono);cursor:pointer;color:var(--ink-soft);touch-action:manipulation;}
.dc-weekday.active{background:var(--accent);color:#fff;border-color:var(--accent);}
.dc-card-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--ink-faint);}
.dc-progress{padding-top:4px;}
.dc-rings-row{display:flex;justify-content:center;gap:24px;margin-bottom:16px;flex-wrap:wrap;}
.dc-ring-wrap{display:flex;flex-direction:column;align-items:center;gap:6px;}
.dc-ring-svg{display:block;}
.dc-ring-fill{transition:stroke-dashoffset .5s ease;}
.dc-ring-value{font-family:var(--font-display);font-size:13px;font-weight:700;fill:var(--ink);}
.dc-ring-pct{font-family:var(--font-mono);font-size:9px;fill:var(--ink-soft);}
.dc-ring-label{font-family:var(--font-mono);font-size:10px;letter-spacing:0.5px;color:var(--ink-soft);text-transform:uppercase;}
.dc-progress-seg{margin-bottom:14px;}
.dc-week-wrap{overflow-x:auto;border:1px solid var(--ink-faint);border-radius:8px;background:var(--paper-light);}
.dc-week-table{width:100%;border-collapse:collapse;font-size:12.5px;}
.dc-week-table th,.dc-week-table td{padding:7px 8px;text-align:center;border-bottom:1px solid var(--ink-faint);}
.dc-week-table th{font-family:var(--font-mono);font-size:10.5px;color:var(--ink-soft);font-weight:500;}
.dc-week-daynum{font-size:12px;color:var(--ink);}
.dc-week-task-col{text-align:left!important;white-space:nowrap;font-size:12.5px;font-weight:500;}
.dc-week-today{background:var(--gold-light);}
.dc-week-cell{font-family:var(--font-mono);font-weight:600;font-size:12px;}
.dc-week-done{color:var(--accent);}
.dc-week-missed{color:var(--red);}
.dc-week-pending{color:var(--gold);}
.dc-week-upcoming,.dc-week-none{color:var(--ink-faint);}
.dc-month-wrap{border:1px solid var(--ink-faint);border-radius:8px;background:var(--paper-light);padding:12px;}
.dc-month-head{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px;}
.dc-month-label{font-family:var(--font-display);font-weight:600;font-size:15px;min-width:130px;text-align:center;}
.dc-month-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
.dc-month-grid-head{margin-bottom:3px;}
.dc-month-headcell{text-align:center;font-family:var(--font-mono);font-size:10px;color:var(--ink-soft);padding:3px 0;}
.dc-month-cell{aspect-ratio:1;border-radius:5px;border:1px solid var(--ink-faint);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3px;min-height:44px;position:relative;}
.dc-month-cell-blank{border:none;}
.dc-month-today{outline:2px solid var(--gold);outline-offset:-2px;}
.dc-month-daynum{font-family:var(--font-mono);font-size:10px;position:absolute;top:3px;left:3px;}
.dc-month-ring{margin-top:8px;}
.dc-month-future{opacity:0.45;}
.dc-inspire-hadith-ar{font-size:clamp(15px,4.2vw,18px);color:var(--gold);}
.dc-inspire-btn{width:36px;height:36px;}
.dc-badge-repeat,.dc-badge-folder{font-size:10px;}
.dc-section-head{padding:8px 10px;}
.dc-paper{overflow-x:hidden;}
.dc-confirm-overlay{padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));}
.dc-confirm-box{max-width:100%;}
.dc-dropdown{left:0;right:0;min-width:0;max-width:100vw;}
.dc-sheet-backdrop{position:fixed;inset:0;background:rgba(43,42,37,0.5);z-index:280;animation:dc-fade-in .2s ease both;}
.dc-sheet{position:fixed;left:0;right:0;bottom:0;max-height:78dvh;background:var(--paper-light);border-radius:18px 18px 0 0;z-index:281;overflow-y:auto;padding-bottom:max(14px,env(safe-area-inset-bottom));box-shadow:0 -8px 40px rgba(0,0,0,0.2);animation:dc-slide-up .32s cubic-bezier(0.22,1,0.36,1) both;}
.dc-sheet-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--ink-faint);position:sticky;top:0;background:var(--paper-light);z-index:1;}
.dc-sheet-title{font-family:var(--font-display);font-size:18px;margin:0;font-weight:600;}
.dc-sheet-body{padding:10px 12px 14px;display:flex;flex-direction:column;gap:4px;}
.dc-sheet-row{display:flex;align-items:center;gap:4px;}
.dc-sheet-item{display:flex;align-items:center;gap:12px;width:100%;border:none;background:transparent;padding:13px 10px;border-radius:10px;font-size:14.5px;font-family:var(--font-body);color:var(--ink);text-align:left;cursor:pointer;min-height:48px;touch-action:manipulation;transition:background .15s ease,transform .12s ease;}
.dc-sheet-item:active{background:var(--paper-dark);transform:scale(0.98);}
.dc-sheet-item.selected{background:var(--accent-light);font-weight:600;color:var(--accent);}
.dc-sheet-item-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dc-picker-btn{display:flex!important;align-items:center;justify-content:space-between;gap:8px;text-align:left;cursor:pointer;appearance:none;-webkit-appearance:none;}
.dc-picker-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dc-folder-new{display:flex;flex-direction:column;gap:8px;width:100%;}

/* ── Header top row with avatar ── */
.dc-header-top-row{display:flex;align-items:center;justify-content:space-between;gap:10px;}

/* ── Avatar button (header) ── */
.dc-avatar-btn{
  border:none;padding:0;cursor:pointer;
  border-radius:50%;overflow:hidden;
  background:var(--accent);
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;
  box-shadow:0 2px 8px rgba(47,82,51,0.3);
  transition:transform .18s cubic-bezier(0.34,1.56,0.64,1),box-shadow .18s ease;
  touch-action:manipulation;
}
.dc-avatar-btn:active{transform:scale(0.9);}
.dc-avatar-img{border-radius:50%;object-fit:cover;display:block;}
.dc-avatar-initials{color:#fff;font-weight:700;font-family:var(--font-display);display:block;line-height:1;}

/* ── Profile sheet ── */
.dc-profile-sheet{max-height:88dvh;}
.dc-sheet-handle{width:36px;height:4px;background:var(--ink-faint);border-radius:2px;margin:10px auto 0;}
.dc-profile-tabs{display:flex;gap:0;padding:12px 16px 0;border-bottom:1.5px solid var(--ink-faint);}
.dc-ptab{flex:1;border:none;background:transparent;padding:10px;font-family:var(--font-body);font-size:13.5px;font-weight:600;color:var(--ink-soft);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;border-bottom:2.5px solid transparent;margin-bottom:-1.5px;transition:color .18s,border-color .18s;}
.dc-ptab.active{color:var(--accent);border-bottom-color:var(--accent);}
.dc-profile-body{display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px 16px 24px;}
.dc-avatar-big{
  width:88px;height:88px;border-radius:50%;overflow:hidden;
  background:var(--accent);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;position:relative;
  box-shadow:0 4px 16px rgba(47,82,51,0.25);
  flex-shrink:0;
  transition:transform .18s ease;
}
.dc-avatar-big:active{transform:scale(0.95);}
.dc-avatar-img-big{width:88px;height:88px;object-fit:cover;border-radius:50%;display:block;}
.dc-avatar-ini-b{color:#fff;font-size:30px;font-weight:700;font-family:var(--font-display);display:block;}
.dc-avatar-edit{position:absolute;bottom:0;right:0;width:28px;height:28px;background:var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);}
.dc-profile-name{font-family:var(--font-display);font-size:20px;font-weight:700;color:var(--ink);margin-top:4px;}
.dc-profile-un{font-family:var(--font-mono);font-size:12px;color:var(--ink-soft);}
.dc-profile-stats-row{display:flex;align-items:center;gap:0;background:var(--paper-dark);border-radius:14px;padding:14px 24px;width:100%;max-width:280px;justify-content:center;margin-top:6px;}
.dc-pstat{display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;}
.dc-pstat-val{font-family:var(--font-display);font-size:22px;font-weight:700;color:var(--ink);}
.dc-pstat-lbl{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;color:var(--ink-soft);}
.dc-pstat-div{width:1.5px;height:36px;background:var(--ink-faint);margin:0 10px;}
.dc-profile-bar-wrap{width:100%;max-width:280px;height:6px;background:var(--ink-faint);border-radius:3px;overflow:hidden;}
.dc-profile-bar{height:100%;background:var(--accent);border-radius:3px;transition:width .5s cubic-bezier(0.22,1,0.36,1);}

/* ── Friends tab ── */
.dc-friends-body{display:flex;flex-direction:column;gap:12px;padding:14px 16px 20px;}
.dc-friends-hint{font-size:13px;color:var(--ink-soft);margin:0;text-align:center;line-height:1.5;}
.dc-friends-search-row{display:flex;gap:8px;align-items:center;}
.dc-avatar-medium{width:52px;height:52px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;}
.dc-avatar-ini-m{color:#fff;font-weight:700;font-family:var(--font-display);font-size:18px;}
.dc-friend-status-dot{width:13px;height:13px;border-radius:50%;border:2.5px solid var(--paper-light);position:absolute;bottom:1px;right:1px;}
.dc-friend-card{display:flex;gap:14px;align-items:center;background:var(--paper-dark);border-radius:14px;padding:14px;animation:dc-slide-in .25s cubic-bezier(0.22,1,0.36,1) both;}
.dc-friend-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}
.dc-friend-name{font-size:15px;font-weight:700;color:var(--ink);}
.dc-friend-un{font-family:var(--font-mono);font-size:11px;color:var(--ink-soft);}
.dc-friend-bar-wrap{width:100%;height:5px;background:var(--ink-faint);border-radius:3px;overflow:hidden;margin-top:2px;}
.dc-friend-bar{height:100%;border-radius:3px;transition:width .6s cubic-bezier(0.22,1,0.36,1);}
.dc-friend-pct{font-size:12px;font-weight:600;}
.dc-friend-seen{font-size:10px;color:var(--ink-soft);font-weight:400;}
.dc-friend-day-label{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-soft);margin-top:4px;}

/* ── Completion modal ── */
.dc-completion-overlay{position:fixed;inset:0;background:rgba(43,42,37,0.65);display:flex;align-items:center;justify-content:center;z-index:500;padding:20px;animation:dc-fade-in .2s ease both;}
.dc-completion-box{background:var(--paper-light);border-radius:22px;padding:28px 22px;max-width:360px;width:100%;text-align:center;display:flex;flex-direction:column;gap:10px;align-items:center;box-shadow:0 16px 56px rgba(0,0,0,0.25);animation:dc-bounce-in .45s cubic-bezier(0.22,1,0.36,1) both;}
.dc-completion-stars{font-size:36px;line-height:1;animation:dc-check-pop .5s cubic-bezier(0.34,1.56,0.64,1) both;}
.dc-completion-ar{font-family:var(--font-display);font-size:22px;color:var(--accent);direction:rtl;line-height:1.5;margin:4px 0;}
.dc-completion-title{font-family:var(--font-display);font-size:20px;font-weight:700;color:var(--ink);}
.dc-completion-text{font-size:14px;color:var(--ink-soft);line-height:1.6;max-width:280px;}
.dc-completion-btn{width:100%;justify-content:center;font-size:15px;min-height:50px;margin-top:6px;border-radius:14px;}
`;
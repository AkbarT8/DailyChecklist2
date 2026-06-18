import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Plus, Check, X, FolderPlus, Clock, Trash2, Pencil, ChevronLeft, ChevronRight,
  AlertTriangle, ListChecks, TrendingUp, SkipForward, RotateCcw, ChevronDown,
  Folder, CheckSquare, Square, Search, CheckCheck, MoveRight, Bookmark, ChevronRight as ChevronNext
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
import { requestNotificationPermission, showDailyReminder, registerReminderWorker } from "./dailyReminder.js";

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

function SavedInspirationList({ items, onRemove }) {
  if (!items.length) {
    return <div className="dc-empty"><p>Здесь будут сохранённые аяты и хадисы. Нажмите закладку на карточке аята или хадиса.</p></div>;
  }
  const ayatItems = items.filter((i) => i.type === "ayat");
  const hadithItems = items.filter((i) => i.type === "hadith");
  return (
    <div className="dc-saved-wrap">
      {ayatItems.length > 0 && (
        <div className="dc-saved-group">
          <h3 className="dc-saved-title">Аяты ({ayatItems.length})</h3>
          {ayatItems.map((item) => (
            <div className="dc-saved-card dc-inspire-ayat" key={item.key}>
              <div className="dc-inspire-ar">{item.ar}</div>
              <div className="dc-inspire-text">{item.ru}</div>
              <div className="dc-saved-foot">
                <span className="dc-inspire-ref">{item.ref}</span>
                <button type="button" className="dc-inspire-btn" title="Удалить из сохранённых" onClick={() => onRemove(item.key)}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {hadithItems.length > 0 && (
        <div className="dc-saved-group">
          <h3 className="dc-saved-title">Хадисы ({hadithItems.length})</h3>
          {hadithItems.map((item) => (
            <div className="dc-saved-card dc-inspire-hadith" key={item.key}>
              <div className="dc-inspire-ar dc-inspire-hadith-ar">{item.ar}</div>
              <div className="dc-inspire-text">{item.ru || item.text}</div>
              <div className="dc-saved-foot">
                <span className="dc-inspire-ref">{item.source}</span>
                <button type="button" className="dc-inspire-btn" title="Удалить из сохранённых" onClick={() => onRemove(item.key)}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
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

  const [view, setView] = useState("checklist");
  const [listFilter, setListFilter] = useState("all");
  const [folderFilter, setFolderFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
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
        setFolderMenuOpen(false);
        setFolderDraftOpen(false);
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
  }, []);

  const enterApp = async () => {
    try { sessionStorage.setItem(WELCOME_KEY, "1"); } catch { /* ignore */ }
    registerReminderWorker();
    await requestNotificationPermission();
    setEntered(true);
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

  useEffect(() => {
    if (!loaded || !entered) return;
    if (reminderLastDate === today) return;
    const granted = typeof Notification !== "undefined" && Notification.permission === "granted";
    if (granted && showDailyReminder({ dateStr: today, ayat: currentAyat, hadith: currentHadith })) {
      setReminderLastDate(today);
      return;
    }
    setDailyBannerOpen(true);
    setReminderLastDate(today);
  }, [loaded, entered, today, reminderLastDate, currentAyat, currentHadith]);

  if (!loaded) {
    return <div className="dc-loading">Загрузка…</div>;
  }

  if (!entered) {
    return (
      <div className="dc-welcome">
        <style>{STYLES}</style>
        <div className="dc-welcome-card">
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
        <div className="dc-header-left">
          <h1 className="dc-title">Ежедневник</h1>
          <div className="dc-subtitle">{formatDisplay(today)} · {todayStats.done}/{todayStats.total} сегодня</div>
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
                <div className="dc-daily-banner-title">Напоминание дня</div>
                <div className="dc-daily-banner-text">{currentAyat?.ru}</div>
              </div>
              <button type="button" className="dc-icon-ghost" title="Закрыть" onClick={() => setDailyBannerOpen(false)}><X size={15} /></button>
            </div>
          )}
          {listFilter !== "saved" && (
            <DailyInspiration
              ayat={currentAyat}
              hadith={currentHadith}
              ayatSaved={ayatSaved}
              hadithSaved={hadithSaved}
              onNextAyat={nextAyat}
              onNextHadith={nextHadith}
              onSaveAyat={toggleSaveAyat}
              onSaveHadith={toggleSaveHadith}
              meta={INSPIRATION_META}
            />
          )}
          <div className="dc-toolbar">
            <div className="dc-filter-row">
              <button className={`dc-filter-btn ${listFilter === "all" ? "active" : ""}`} onClick={() => setListFilter("all")}>
                Все
                {todayStats.total > 0 && <span className="dc-badge">{todayStats.total}</span>}
              </button>
              <button className={`dc-filter-btn ${listFilter === "incomplete" ? "active" : ""}`} onClick={() => setListFilter("incomplete")}>
                Невыполненные
                {todayStats.incomplete > 0 && <span className="dc-badge dc-badge-warn">{todayStats.incomplete}</span>}
              </button>
              <button className={`dc-filter-btn dc-filter-overdue ${listFilter === "overdue" ? "active" : ""}`} onClick={() => { setListFilter("overdue"); exitSelectMode(); }}>
                <AlertTriangle size={13} /> Просроченные
                {overdueList.length > 0 && <span className="dc-badge dc-badge-warn">{overdueList.length}</span>}
              </button>
              <button className={`dc-filter-btn dc-filter-saved ${listFilter === "saved" ? "active" : ""}`} onClick={() => { setListFilter("saved"); exitSelectMode(); }}>
                <Bookmark size={13} /> Сохранённые
                {savedInspiration.length > 0 && <span className="dc-badge">{savedInspiration.length}</span>}
              </button>
            </div>

            <div className="dc-toolbar-right">
              <div className="dc-search-wrap">
                <Search size={14} />
                <input className="dc-search" placeholder="Поиск…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                {searchQuery && <button className="dc-search-clear" onClick={() => setSearchQuery("")}><X size={12} /></button>}
              </div>

              <div className="dc-menu-wrap" ref={folderMenuRef}>
                <button className={`dc-menu-btn ${folderFilter ? "active" : ""}`} onClick={() => setFolderMenuOpen((v) => !v)}>
                  <Folder size={14} />
                  {folderFilter || "Папки"}
                  <ChevronDown size={13} />
                </button>
                {folderMenuOpen && (
                  <div className="dc-dropdown">
                    <button className={`dc-dropdown-item ${!folderFilter ? "selected" : ""}`} onClick={() => { setFolderFilter(null); setFolderMenuOpen(false); }}>
                      <span>Все папки</span>
                      <span className="dc-dropdown-meta">{tasks.length}</span>
                    </button>
                    <div className="dc-dropdown-divider" />
                    {userFolders.map((f) => (
                      <div key={f} className="dc-dropdown-row">
                        <button className={`dc-dropdown-item ${folderFilter === f ? "selected" : ""}`} onClick={() => { setFolderFilter(f); setFolderMenuOpen(false); }}>
                          <span className="dc-dot" style={{ background: folderColor(f) }} />
                          <span>{f}</span>
                          <span className="dc-dropdown-meta">{folderTaskCount(f)}</span>
                        </button>
                        <button className="dc-dropdown-del" title="Удалить папку" onClick={() => { setFolderMenuOpen(false); requestDeleteFolder(f); }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <div className="dc-dropdown-divider" />
                    {!folderDraftOpen ? (
                      <button className="dc-dropdown-item dc-dropdown-add" onClick={() => setFolderDraftOpen(true)}>
                        <FolderPlus size={14} /> Новая папка
                      </button>
                    ) : (
                      <div className="dc-dropdown-draft">
                        <input className="dc-dropdown-input" autoFocus placeholder="Название" value={folderDraft}
                          onChange={(e) => setFolderDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") addFolder(folderDraft); if (e.key === "Escape") { setFolderDraft(""); setFolderDraftOpen(false); } }} />
                        <button className="dc-icon-ghost" onClick={() => addFolder(folderDraft)}><Check size={14} /></button>
                        <button className="dc-icon-ghost" onClick={() => { setFolderDraft(""); setFolderDraftOpen(false); }}><X size={14} /></button>
                      </div>
                    )}
                    {userFolders.length > 0 && (
                      <button className="dc-dropdown-item dc-dropdown-danger" onClick={() => { setFolderMenuOpen(false); requestDeleteAllFolders(); }}>
                        <Trash2 size={13} /> Удалить все папки
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button className={`dc-menu-btn ${selectMode ? "active" : ""}`} onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}>
                {selectMode ? <X size={14} /> : <CheckSquare size={14} />}
                {selectMode ? "Отмена" : "Выбрать"}
              </button>
            </div>
          </div>

          {selectMode && (
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
            ) : listFilter === "saved" ? (
              <section className="dc-section dc-section-saved">
                <div className="dc-section-head">
                  <h2 className="dc-section-title"><Bookmark size={14} /> Сохранённые</h2>
                </div>
                <SavedInspirationList items={savedInspiration} onRemove={removeSavedInspiration} />
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
                  <p>{listFilter === "incomplete" ? "Все задачи на сегодня выполнены!" : "Сегодня задач нет."}</p>
                  <button className="dc-btn-primary" onClick={openAddPanel}><Plus size={16} /> Добавить</button>
                </div>
              ) : (
                <div className="dc-paper">
                  {todayTasks.map((t) => (
                    <TaskRow key={t.id} task={t} date={today} checked={!!t.completions[today]}
                      onToggle={() => toggleCompletion(t.id, today)} onEdit={() => openEditPanel(t)}
                      onDelete={() => requestDeleteTask(t)}
                      showFolder={!folderFilter} selectMode={selectMode} selected={selectedIds.has(t.id)}
                      onSelectToggle={() => toggleSelect(t.id)} />
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
                  <div className="dc-paper dc-paper-muted">
                    {otherTasks.map((t) => (
                      <TaskRow key={t.id} task={t} date={today} inactive checked={false} onToggle={() => {}}
                        onEdit={() => openEditPanel(t)} onDelete={() => requestDeleteTask(t)}
                        showFolder={!folderFilter} selectMode={false} selected={false} onSelectToggle={() => {}} />
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

      {panelOpen && (
        <AddTaskPanel form={form} setForm={setForm} folders={userFolders} onClose={() => setPanelOpen(false)} onSave={saveTask} />
      )}
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

function TaskRow({ task, checked, onToggle, onEdit, onDelete, showFolder, inactive, selectMode, selected, onSelectToggle }) {
  return (
    <div className={`dc-row ${inactive ? "dc-row-inactive" : ""} ${selected ? "dc-row-selected" : ""}`}>
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
        <div className="dc-row-top">
          <span className={`dc-row-title ${checked ? "done" : ""}`}>{task.title}</span>
          {task.time && <span className="dc-badge-mono"><Clock size={11} /> {task.time}</span>}
          <span className="dc-badge-repeat">{repeatLabel(task)}</span>
          {showFolder && displayFolder(task.folder) && (
            <span className="dc-badge-folder">
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
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  return (
    <div className="dc-overlay" onClick={onClose}>
      <div className="dc-card" onClick={(e) => e.stopPropagation()}>
        <div className="dc-card-head">
          <h2>{form.id ? "Редактировать" : "Новая задача"}</h2>
          <button className="dc-icon-ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dc-field">
          <label>Название</label>
          <input className="dc-input" value={form.title} autoFocus placeholder="Например: Полить цветы"
            onChange={(e) => set({ title: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") onSave(); }} />
        </div>
        <div className="dc-field">
          <label>Папка</label>
          {!form.isNewFolder ? (
            <select className="dc-input" value={form.folder === DEFAULT_FOLDER ? (folders[0] || "__new__") : form.folder} onChange={(e) => {
              if (e.target.value === "__new__") set({ isNewFolder: true, newFolderName: "" });
              else set({ folder: e.target.value });
            }}>
              {folders.map((f) => <option key={f} value={f}>{f}</option>)}
              <option value="__new__">+ Новая папка…</option>
            </select>
          ) : (
            <div className="dc-inline-row">
              <input className="dc-input" placeholder="Название папки" value={form.newFolderName}
                onChange={(e) => set({ newFolderName: e.target.value })} autoFocus />
              <button className="dc-btn-small" onClick={() => set({ isNewFolder: false })}>Отмена</button>
            </div>
          )}
        </div>
        <div className="dc-field">
          <label>Повторение</label>
          <div className="dc-repeat-options">
            {[["daily", "Ежедневно"], ["everyOther", "Через день"], ["weekly", "По дням"], ["once", "Один раз"]].map(([val, lbl]) => (
              <button key={val} className={`dc-pill ${form.repeat === val ? "active" : ""}`} onClick={() => set({ repeat: val })}>{lbl}</button>
            ))}
          </div>
        </div>
        {form.repeat === "weekly" && (
          <div className="dc-field">
            <label>Дни недели</label>
            <div className="dc-weekday-row">
              {WEEKDAY_ORDER.map((w) => (
                <button key={w} className={`dc-weekday ${form.weekdays.includes(w) ? "active" : ""}`}
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
          <button className="dc-btn-ghost" onClick={onClose}>Отмена</button>
          <button className="dc-btn-primary" onClick={onSave}>Сохранить</button>
        </div>
      </div>
    </div>
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
*{box-sizing:border-box;}
html{width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%;text-size-adjust:100%;}
body{margin:0;width:100%;overflow-x:hidden;overscroll-behavior-x:none;}
#root{width:100%;overflow-x:hidden;}
.dc-loading{font-family:var(--font-body);padding:40px;color:var(--ink-soft);}
.dc-welcome{min-height:100dvh;display:flex;align-items:center;justify-content:center;background:var(--paper);padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));font-family:var(--font-body);}
.dc-welcome-card{background:var(--paper-light);border:1px solid var(--ink-faint);border-radius:12px;padding:28px 20px;text-align:center;max-width:420px;width:100%;}
.dc-welcome-label{font-family:var(--font-mono);font-size:10px;letter-spacing:1.5px;color:var(--ink-soft);text-transform:uppercase;margin-bottom:16px;}
.dc-welcome-ar{font-family:var(--font-display);font-size:clamp(22px,6vw,30px);line-height:1.65;color:var(--accent);margin-bottom:14px;direction:rtl;text-align:center;}
.dc-welcome-ru{font-size:14px;line-height:1.5;color:var(--ink);margin-bottom:10px;}
.dc-welcome-ref{font-family:var(--font-mono);font-size:10px;color:var(--ink-soft);margin-bottom:22px;}
.dc-welcome-btn{margin:0 auto;padding:12px 36px;font-size:15px;min-height:44px;width:100%;max-width:280px;justify-content:center;}
.dc-daily-banner{display:flex;align-items:flex-start;gap:10px;background:var(--accent-light);border:1px solid var(--accent);border-radius:8px;padding:10px 12px;margin-bottom:10px;}
.dc-daily-banner-body{flex:1;min-width:0;}
.dc-daily-banner-title{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--accent);margin-bottom:4px;}
.dc-daily-banner-text{font-size:13px;line-height:1.4;color:var(--ink);}
.dc-confirm-overlay{position:fixed;inset:0;background:rgba(43,42,37,0.5);display:flex;align-items:center;justify-content:center;z-index:60;padding:16px;}
.dc-confirm-box{background:var(--paper-light);border:1px solid var(--ink-faint);border-radius:10px;padding:20px;max-width:420px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,0.15);}
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
.dc-saved-card{background:var(--paper-light);border:1px solid var(--ink-faint);border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;}
.dc-saved-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;}
.dc-inspire-ayat{border-top:3px solid var(--accent);}
.dc-inspire-hadith{border-top:3px solid var(--gold);}
.dc-inspire-tag{font-family:var(--font-mono);font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--ink-soft);}
.dc-inspire-ar{font-family:var(--font-display);font-size:clamp(16px,4.8vw,20px);line-height:1.55;color:var(--accent);direction:rtl;text-align:right;word-break:break-word;overflow-wrap:anywhere;}
.dc-inspire-text{font-size:12px;line-height:1.45;color:var(--ink);overflow-wrap:anywhere;}
.dc-inspire-ref{font-family:var(--font-mono);font-size:10px;color:var(--ink-soft);margin-top:auto;padding-top:4px;}
.dc-app{font-family:var(--font-body);background:var(--paper);color:var(--ink);min-height:100dvh;width:100%;max-width:100vw;overflow-x:hidden;padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));margin:0;}
.dc-header{display:flex;flex-direction:column;align-items:stretch;gap:10px;margin-bottom:10px;width:100%;max-width:100%;}
.dc-header-left{min-width:0;}
.dc-title{font-family:var(--font-display);font-weight:700;font-size:clamp(20px,5.5vw,24px);margin:0;line-height:1.2;}
.dc-subtitle{font-family:var(--font-mono);font-size:10px;color:var(--ink-soft);margin-top:2px;}
.dc-header-actions{display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;width:100%;max-width:100%;}
.dc-segmented{display:grid;grid-template-columns:1fr 1fr;grid-column:1/-1;background:var(--paper-light);border:1px solid var(--ink-faint);border-radius:8px;padding:2px;width:100%;}
.dc-seg-btn{display:flex;align-items:center;justify-content:center;gap:4px;border:none;background:transparent;padding:8px 6px;font-family:var(--font-body);font-size:12px;font-weight:500;color:var(--ink-soft);border-radius:6px;cursor:pointer;min-height:40px;touch-action:manipulation;}
.dc-seg-btn.active{background:var(--ink);color:var(--paper-light);}
.dc-btn-primary{display:flex;align-items:center;justify-content:center;gap:4px;background:var(--accent);color:var(--paper-light);border:none;padding:8px 10px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-body);min-height:40px;touch-action:manipulation;white-space:nowrap;}
.dc-btn-primary:hover{background:#264529;}
.dc-btn-ghost{background:transparent;border:1px solid var(--ink-faint);color:var(--ink-soft);padding:8px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-family:var(--font-body);min-height:40px;touch-action:manipulation;}
.dc-icon-ghost{background:transparent;border:none;color:var(--ink-soft);cursor:pointer;padding:8px;border-radius:8px;display:flex;align-items:center;justify-content:center;min-width:40px;min-height:40px;touch-action:manipulation;flex-shrink:0;}
.dc-icon-ghost:hover{background:var(--paper-dark);color:var(--ink);}
.dc-btn-small{background:var(--paper-light);border:1px solid var(--ink-faint);padding:4px 9px;border-radius:5px;font-size:11.5px;cursor:pointer;font-family:var(--font-body);color:var(--ink);display:inline-flex;align-items:center;gap:4px;}
.dc-btn-danger{background:var(--red);color:#fff;border-color:var(--red);}
.dc-banner{display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--gold-light);border:1px solid var(--gold);border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:12.5px;flex-wrap:wrap;}
.dc-banner-actions{display:flex;gap:6px;}
.dc-toolbar{display:flex;flex-direction:column;align-items:stretch;gap:8px;margin-bottom:10px;padding:8px;background:var(--paper-light);border:1px solid var(--ink-faint);border-radius:8px;width:100%;max-width:100%;overflow:hidden;}
.dc-filter-row{display:flex;gap:4px;overflow-x:auto;flex-wrap:nowrap;width:100%;max-width:100%;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px;}
.dc-filter-row::-webkit-scrollbar{display:none;}
.dc-filter-btn{display:flex;align-items:center;gap:4px;border:1px solid transparent;background:transparent;padding:7px 10px;border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:var(--font-body);color:var(--ink-soft);white-space:nowrap;flex-shrink:0;min-height:36px;touch-action:manipulation;}
.dc-filter-btn.active{background:var(--accent);color:#fff;border-color:var(--accent);}
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
.dc-section{background:var(--paper-light);border:1px solid var(--ink-faint);border-radius:8px;overflow:hidden;width:100%;max-width:100%;}
.dc-section-overdue{border-color:var(--red-light);}
.dc-section-head{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--paper-dark);border-bottom:1px solid var(--ink-faint);}
.dc-section-toggle{width:100%;border:none;background:var(--paper-dark);cursor:pointer;font-family:inherit;}
.dc-section-title{font-size:13px;font-weight:600;margin:0;display:flex;align-items:center;gap:6px;}
.dc-link-btn{border:none;background:transparent;color:var(--accent);font-size:12px;cursor:pointer;font-family:var(--font-body);font-weight:600;}
.dc-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0;}
.dc-paper{background:repeating-linear-gradient(var(--paper-light) 0px,var(--paper-light) 40px,var(--ink-faint) 40px,var(--ink-faint) 41px);}
.dc-paper-muted{opacity:0.7;}
.dc-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:32px 16px;color:var(--ink-soft);font-size:13px;}
.dc-row{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;min-height:44px;width:100%;max-width:100%;}
.dc-row-inactive{opacity:0.6;}
.dc-row-selected{background:var(--accent-light);}
.dc-checkbox,.dc-select-box{width:20px;height:20px;border:2px solid var(--ink);border-radius:4px;background:var(--paper-light);cursor:pointer;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;padding:0;}
.dc-checkbox:disabled{cursor:default;opacity:0.4;}
.dc-checkbox.checked,.dc-select-box.checked{background:var(--accent);border-color:var(--accent);color:#fff;}
.dc-checkmark{color:var(--paper-light);font-weight:700;font-size:13px;}
.dc-row-body{flex:1;min-width:0;}
.dc-row-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.dc-row-title{font-size:13px;font-weight:600;overflow-wrap:anywhere;word-break:break-word;}
.dc-row-title.done{text-decoration:line-through;opacity:0.55;}
.dc-badge-mono{display:flex;align-items:center;gap:3px;font-family:var(--font-mono);font-size:10.5px;color:var(--gold);background:var(--gold-light);padding:1px 5px;border-radius:3px;}
.dc-badge-repeat{font-size:10.5px;color:var(--ink-soft);font-family:var(--font-mono);}
.dc-badge-folder{display:flex;align-items:center;gap:4px;font-size:10.5px;color:var(--ink-soft);}
.dc-row-benefit{font-size:11.5px;color:var(--ink-soft);font-style:italic;margin-top:2px;}
.dc-row-actions{display:flex;gap:2px;flex-shrink:0;}
.dc-overdue-row{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--ink-faint);}
.dc-overdue-info{flex:1;min-width:0;}
.dc-overdue-title{font-size:13px;font-weight:600;}
.dc-overdue-meta{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--ink-soft);margin-top:1px;}
.dc-overdue-actions{display:flex;gap:2px;}
.dc-overdue-more{padding:8px 12px;font-size:11px;color:var(--ink-soft);text-align:center;}
.dc-overlay{position:fixed;inset:0;background:rgba(43,42,37,0.45);display:flex;align-items:flex-end;justify-content:center;z-index:50;padding:0;}
.dc-card{width:100%;max-width:100vw;height:auto;max-height:92dvh;background:var(--paper-light);padding:14px 14px max(14px,env(safe-area-inset-bottom));overflow-x:hidden;overflow-y:auto;border-radius:14px 14px 0 0;box-sizing:border-box;}
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
`;
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Cloud,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Flame,
  LogOut,
  Plus,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  X,
  BookOpen,
  Droplets,
  Brain,
  Newspaper,
  Headphones,
  Video,
  Smartphone,
  Moon,
  Pencil,
  Trash2,
  RotateCcw,
  CalendarPlus,
  LoaderCircle,
} from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDaysInMonth,
  isSameDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  loadState,
  saveState,
  saveStatus,
  deleteHabitRemote,
  logoutAccount,
  getCurrentUser,
} from "./lib/api";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ICONS = {
  BookOpen,
  Droplets,
  Brain,
  Newspaper,
  Headphones,
  Video,
  Smartphone,
  Moon,
  Activity,
  Target,
  Sparkles,
};
const iconNames = Object.keys(ICONS),
  colors = [
    "amber",
    "sky",
    "violet",
    "emerald",
    "indigo",
    "rose",
    "orange",
    "blue",
  ];
const labels = { done: "Done", missed: "Missed", pending: "Pending" };
const dkey = (d) => format(d, "yyyy-MM-dd"),
  mkey = (d) => format(d, "yyyy-MM"),
  ekey = (id, d) => `${id}_${dkey(d)}`;
const statusOf = (entries, id, d) => entries[ekey(id, d)] || "pending",
  pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

export default function App() {
  const [state, setState] = useState({ habits: [], entries: {}, months: [] }),
    [activeTab, setActiveTab] = useState("matrix");
  const [selectedMonth, setSelectedMonth] = useState(new Date()),
    [selectedDay, setSelectedDay] = useState(new Date());
  const [search, setSearch] = useState(""),
    [modal, setModal] = useState(""),
    [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    category: "Learning",
    icon: "BookOpen",
    target: "Daily",
  });
  const [monthForm, setMonthForm] = useState({
    month: format(addMonths(new Date(), 1), "MMMM"),
    year: String(addMonths(new Date(), 1).getFullYear()),
    copy: true,
  });
  const [toast, setToast] = useState(""),
    [busy, setBusy] = useState(true),
    [saving, setSaving] = useState(false),
    [connected, setConnected] = useState(false);
  const saveTimer = useRef(null),
    latestState = useRef(state);
  const user = getCurrentUser();
  const notify = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3000);
  };
  useEffect(() => {
    loadState()
      .then((d) => {
        setState({
          habits: d.habits || [],
          entries: d.entries || {},
          months: d.months || [],
        });
        setConnected(true);
      })
      .catch((e) => notify(e.message))
      .finally(() => setBusy(false));
  }, []);
  const persist = useCallback((next) => {
    latestState.current = next;
    setState(next); // Update the interface immediately; Google Sheets saves in the background.
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveState(latestState.current);
        setConnected(true);
      } catch (e) {
        notify(`Save failed: ${e.message}`);
      } finally {
        setSaving(false);
      }
    }, 450); // Combine quick clicks into one Sheets request.
  }, []);
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(selectedMonth),
        end: endOfMonth(selectedMonth),
      }),
    [selectedMonth],
  );
  const visible = useMemo(
    () =>
      state.habits.filter((h) =>
        h.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [state.habits, search],
  );
  const stats = useMemo(() => {
    let completedDays = 0,
      pendingDays = 0,
      missedDays = 0,
      doneCells = 0;
    const total = state.habits.length * days.length;
    days.forEach((d) => {
      const ss = state.habits.map((h) => statusOf(state.entries, h.id, d));
      if (ss.length && ss.every((s) => s === "done")) completedDays++;
      else if (ss.length && ss.every((s) => s === "missed")) missedDays++;
      else pendingDays++;
      doneCells += ss.filter((s) => s === "done").length;
    });
    return {
      completedDays,
      pendingDays,
      missedDays,
      doneCells,
      total,
      overall: pct(doneCells, total),
    };
  }, [state, days]);
  const dayStats = useMemo(() => {
    const s = state.habits.map((h) =>
      statusOf(state.entries, h.id, selectedDay),
    );
    return {
      done: s.filter((x) => x === "done").length,
      missed: s.filter((x) => x === "missed").length,
      pending: s.filter((x) => x === "pending").length,
    };
  }, [state, selectedDay]);
  const habitStats = useMemo(
    () =>
      state.habits
        .map((h) => {
          const done = days.filter(
            (d) => statusOf(state.entries, h.id, d) === "done",
          ).length;
          let streak = 0;
          for (let i = days.length - 1; i >= 0; i--) {
            if (statusOf(state.entries, h.id, days[i]) === "done") streak++;
            else if (streak) break;
          }
          return { ...h, done, percent: pct(done, days.length), streak };
        })
        .sort((a, b) => b.percent - a.percent),
    [state, days],
  );
  const changeMonth = (delta) => {
    const d =
      delta > 0
        ? addMonths(selectedMonth, delta)
        : subMonths(selectedMonth, -delta);
    setSelectedMonth(d);
    setSelectedDay(startOfMonth(d));
  };
  const setStatus = (h, d, s) => {
    const entries = { ...state.entries };
    const key = ekey(h.id, d);
    if (s === "pending")
      delete entries[key]; // Pending is not stored; its sheet row is deleted.
    else entries[key] = s;
    setState({ ...state, entries }); // Instant visual update.
    setSaving(true);
    saveStatus({ habitId: h.id, habitName: h.name, date: dkey(d), status: s })
      .then(() => setConnected(true))
      .catch((e) => notify(`Status save failed: ${e.message}`))
      .finally(() => setSaving(false));
  };
  const saveHabit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const habits = editing
      ? state.habits.map((h) =>
          h.id === editing.id ? { ...h, ...form, name: form.name.trim() } : h,
        )
      : [
          ...state.habits,
          {
            ...form,
            name: form.name.trim(),
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
          },
        ];
    persist({ ...state, habits });
    setModal("");
    setEditing(null);
    notify(editing ? "Habit updated." : "Habit added.");
  };
  const editHabit = (h) => {
    setEditing(h);
    setForm({
      name: h.name,
      category: h.category || "Learning",
      icon: h.icon || "BookOpen",
      target: h.target || "Daily",
    });
    setModal("habit");
  };
  const deleteHabit = async (h) => {
    if (!confirm(`Delete "${h.name}" and its history?`)) return;
    try {
      await deleteHabitRemote(h.id);
      setState((s) => ({
        ...s,
        habits: s.habits.filter((x) => x.id !== h.id),
        entries: Object.fromEntries(
          Object.entries(s.entries).filter(([k]) => !k.startsWith(h.id + "_")),
        ),
      }));
      notify("Habit deleted.");
    } catch (e) {
      notify(e.message);
    }
  };
  const createMonth = (e) => {
    e.preventDefault();
    const d = new Date(
        Number(monthForm.year),
        new Date(`${monthForm.month} 1, 2026`).getMonth(),
        1,
      ),
      key = mkey(d);
    if (state.months.includes(key)) return notify("Month already exists.");
    const next = { ...state, months: [...state.months, key] };
    persist(next);
    setSelectedMonth(d);
    setSelectedDay(d);
    setModal("");
    notify("Month created.");
  };
  const markAll = () => {
    const entries = { ...state.entries };
    state.habits.forEach((h) => (entries[ekey(h.id, selectedDay)] = "done"));
    persist({ ...state, entries });
    notify("All habits marked done.");
  };
  const exportRows = () =>
    days.flatMap((d) =>
      state.habits.map((h) => ({
        Date: dkey(d),
        "Habit ID": h.id,
        "Habit Name": h.name,
        Category: h.category,
        Target: h.target,
        Status: labels[statusOf(state.entries, h.id, d)],
        "User Email": user?.email || "",
      })),
    );
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(exportRows()),
      "Habit History",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        habitStats.map((h) => ({
          ID: h.id,
          Habit: h.name,
          Category: h.category,
          Target: h.target,
          "Completed Days": h.done,
          "Completion %": h.percent,
          "Current Streak": h.streak,
        })),
      ),
      "Habit Summary",
    );
    XLSX.writeFile(wb, `habit-tracker-${mkey(selectedMonth)}.xlsx`);
  };
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(17);
    doc.text("Habit Tracker Report", 14, 16);
    doc.setFontSize(10);
    doc.text(
      `${format(selectedMonth, "MMMM yyyy")} | Completion ${stats.overall}%`,
      14,
      23,
    );
    autoTable(doc, {
      startY: 29,
      head: [
        ["Date", "Habit ID", "Habit Name", "Category", "Target", "Status"],
      ],
      body: exportRows().map((r) => [
        r.Date,
        r["Habit ID"],
        r["Habit Name"],
        r.Category,
        r.Target,
        r.Status,
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [5, 150, 105] },
    });
    doc.save(`habit-tracker-${mkey(selectedMonth)}.pdf`);
  };
  const Icon = ({ name, size = 16 }) => {
    const C = ICONS[name] || Sparkles;
    return <C size={size} />;
  };
  const HabitIcon = ({ h }) => (
    <span
      className={`habit-icon ${colors[state.habits.findIndex((x) => x.id === h.id) % colors.length]}`}
    >
      <Icon name={h.icon} />
    </span>
  );
  const Stat = ({ title, value, sub, tone }) => (
    <div className={`stat ${tone || ""}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
  const Cell = ({ h, d }) => {
    const s = statusOf(state.entries, h.id, d);
    return (
      <button
        className={`cell ${s}`}
        title={`${h.name} ${dkey(d)}: ${s}`}
        onClick={() =>
          setStatus(
            h,
            d,
            s === "done" ? "missed" : s === "missed" ? "pending" : "done",
          )
        }
      >
        {s === "done" ? (
          <Check size={12} />
        ) : s === "missed" ? (
          <X size={12} />
        ) : null}
      </button>
    );
  };
  const MonthControls = () => (
    <div className="month-controls">
      <div className="month-pills">
        <button onClick={() => changeMonth(-1)}>
          <CalendarDays size={13} />
          {format(subMonths(selectedMonth, 1), "MMMM yyyy")}
        </button>
        <button onClick={() => changeMonth(1)}>
          <CalendarDays size={13} />
          {format(addMonths(selectedMonth, 1), "MMMM yyyy")}
        </button>
      </div>
      <button
        className="btn outline"
        onClick={() => {
          setMonthForm({
            month: format(addMonths(selectedMonth, 1), "MMMM"),
            year: String(addMonths(selectedMonth, 1).getFullYear()),
            copy: true,
          });
          setModal("month");
        }}
      >
        <CalendarPlus size={14} /> Add Month
      </button>
      <button
        className="btn primary"
        onClick={() => {
          setEditing(null);
          setForm({
            name: "",
            category: "Learning",
            icon: "BookOpen",
            target: "Daily",
          });
          setModal("habit");
        }}
      >
        <Plus size={15} /> Add Habit
      </button>
    </div>
  );
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={22} />
          </div>
          <div>
            <div className="brand-title">
              Enker. <span>2026 Edition</span>
            </div>
            <p>
              Discipline today, a better tomorrow ·{" "}
              <b>Small Habits, Big Changes</b>
            </p>
          </div>
        </div>
        <div className="header-actions">
          <MonthControls />
          <button
            className="btn outline"
            onClick={async () => {
              try {
                await logoutAccount();
              } catch (e) {
                notify(e.message);
              }
            }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>
      <nav className="nav">
        <div className="tabs">
          {[
            ["matrix", "Calendar Matrix", CalendarDays],
            ["focus", "Daily Focus", Activity],
            ["insights", "Insights & Streaks", BarChart3],
            ["export", "Export", Download],
          ].map(([id, label, I]) => (
            <button
              key={id}
              className={activeTab === id ? "active" : ""}
              onClick={() => setActiveTab(id)}
            >
              <I size={14} />
              {label}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search habit..."
          />
        </label>
      </nav>
      <main>
        {!connected && (
          <div className="notice">
            <Cloud size={15} /> Loading Google Sheets data. If this persists,
            sign out and sign in again.
          </div>
        )}
        <section className="stats">
          <Stat
            title="TOTAL HABITS"
            value={state.habits.length}
            tone="purple"
          />
          <Stat
            title="COMPLETED DAYS"
            value={stats.completedDays}
            sub={`${stats.completedDays} of ${days.length} days`}
            tone="green"
          />
          <Stat title="PENDING DAYS" value={stats.pendingDays} tone="orange" />
          <Stat title="MISSED DAYS" value={stats.missedDays} tone="red" />
          <Stat
            title="OVERALL COMPLETION"
            value={`${stats.overall}%`}
            tone="overall"
          />
        </section>
        {activeTab === "matrix" && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>
                  Daily Habit Matrix{" "}
                  <span className="tag">
                    {format(selectedMonth, "MMMM yyyy")}
                  </span>
                </h2>
                <p>
                  Click any cell to toggle: <b>Done → Missed → Pending</b>
                </p>
              </div>
              <div className="legend">
                <span>🟢 Done</span>
                <span>❌ Missed</span>
                <span>◻ Pending</span>
              </div>
            </div>
            <div className="matrix-wrap">
              <table className="matrix">
                <thead>
                  <tr>
                    <th>#</th>
                    <th className="habit-col">HABIT NAME</th>
                    <th>TARGET</th>
                    <th>SCORE & DAYS</th>
                    {days.map((d) => (
                      <th
                        key={dkey(d)}
                        onClick={() => setSelectedDay(d)}
                        className={isSameDay(d, selectedDay) ? "selected" : ""}
                      >
                        <span>{format(d, "EEE")}</span>
                        <b>{format(d, "d")}</b>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((h, i) => {
                    const s = habitStats.find((x) => x.id === h.id) || {
                      percent: 0,
                      done: 0,
                    };
                    return (
                      <tr key={h.id}>
                        <td>{i + 1}</td>
                        <td className="habit-col">
                          <div className="habit-name">
                            <HabitIcon h={h} />
                            <span>{h.name}</span>
                            <button title="Edit" onClick={() => editHabit(h)}>
                              <Pencil size={12} />
                            </button>
                            <button
                              title="Delete"
                              onClick={() => deleteHabit(h)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                        <td>
                          <span className="target">{h.target}</span>
                        </td>
                        <td>
                          <b>{s.percent}%</b>
                          <small className="score">
                            {s.done}/{days.length}d
                          </small>
                          <div className="progress">
                            <i style={{ width: `${s.percent}%` }} />
                          </div>
                        </td>
                        {days.map((d) => (
                          <td
                            key={dkey(d)}
                            className={
                              isSameDay(d, selectedDay) ? "selected-col" : ""
                            }
                          >
                            <Cell h={h} d={d} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="panel-foot">
              {state.habits.length} active habits tracked{" "}
              <span>Tip: Use Daily Focus to update a selected date.</span>
            </div>
          </section>
        )}
        {activeTab === "focus" && (
          <section>
            <div className="panel day-strip">
              <div className="section-head">
                <h2>Select Day for {format(selectedMonth, "MMMM yyyy")}</h2>
                <div>
                  <button
                    className="btn outline"
                    onClick={() =>
                      setSelectedDay(
                        (d) =>
                          new Date(
                            Math.max(
                              startOfMonth(selectedMonth).getTime(),
                              d.getTime() - 86400000,
                            ),
                          ),
                      )
                    }
                  >
                    ‹
                  </button>{" "}
                  <button
                    className="btn outline"
                    onClick={() =>
                      setSelectedDay(
                        (d) =>
                          new Date(
                            Math.min(
                              endOfMonth(selectedMonth).getTime(),
                              d.getTime() + 86400000,
                            ),
                          ),
                      )
                    }
                  >
                    ›
                  </button>
                </div>
              </div>
              <div className="days">
                {days.map((d) => (
                  <button
                    key={dkey(d)}
                    className={`day ${isSameDay(d, selectedDay) ? "selected" : ""}`}
                    onClick={() => setSelectedDay(d)}
                  >
                    <span>{format(d, "EEE")}</span>
                    <b>{format(d, "d")}</b>
                  </button>
                ))}
              </div>
            </div>
            <div className="focus-banner">
              <div>
                <small>
                  {dkey(selectedDay)} ({format(selectedDay, "EEE")})
                </small>
                <h2>Daily Habit Checklist</h2>
                <p>
                  Completed {dayStats.done} of {state.habits.length} habits (
                  {pct(dayStats.done, state.habits.length)}%)
                </p>
              </div>
              <button className="btn white" onClick={markAll}>
                <Check size={14} /> Mark All as Completed
              </button>
            </div>
            <div className="cards">
              {visible.map((h) => {
                const s = statusOf(state.entries, h.id, selectedDay),
                  hs = habitStats.find((x) => x.id === h.id) || {
                    percent: 0,
                    done: 0,
                  };
                return (
                  <article className="habit-card" key={h.id}>
                    <div className="card-head">
                      <HabitIcon h={h} />
                      <div>
                        <b>{h.name}</b>
                        <small>
                          {h.target} · Score {hs.percent}%
                        </small>
                      </div>
                      <span className={`badge ${s}`}>{labels[s]}</span>
                    </div>
                    <div className="card-actions">
                      <button
                        className="done"
                        onClick={() => setStatus(h, selectedDay, "done")}
                      >
                        ✓ Done
                      </button>
                      <button
                        className="missed"
                        onClick={() => setStatus(h, selectedDay, "missed")}
                      >
                        × Missed
                      </button>
                      <button
                        onClick={() => setStatus(h, selectedDay, "pending")}
                      >
                        ↻ Reset
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
        {activeTab === "insights" && (
          <section>
            <div className="insight-grid">
              <article className="panel insight-panel">
                <h2>
                  <BarChart3 size={15} /> Habit Performance Breakdown
                </h2>
                <p>Completion for {format(selectedMonth, "MMMM yyyy")}</p>
                {habitStats.map((h) => (
                  <div className="performance" key={h.id}>
                    <div>
                      <span>{h.name}</span>
                      <b>{h.percent}%</b>
                    </div>
                    <div className="progress wide">
                      <i style={{ width: `${h.percent}%` }} />
                    </div>
                  </div>
                ))}
              </article>
              <article className="panel insight-panel">
                <h2>
                  <Target size={15} /> Monthly Days Breakdown
                </h2>
                {[
                  ["Completed Days", stats.completedDays, "green"],
                  ["Pending Days", stats.pendingDays, "orange"],
                  ["Missed Days", stats.missedDays, "red"],
                ].map(([n, v, c]) => (
                  <div className={`breakdown ${c}`} key={n}>
                    <span>{n}</span>
                    <b>{v}</b>
                  </div>
                ))}
                <p className="center">
                  Overall monthly completion: <b>{stats.overall}%</b>
                </p>
              </article>
            </div>
            <div className="insight-grid lists">
              {[
                [
                  "Top Performing Habits",
                  habitStats.filter((h) => h.percent >= 85),
                ],
                ["Need Improvements", habitStats.filter((h) => h.percent < 50)],
                [
                  "Habit Streaks",
                  [...habitStats].sort((a, b) => b.streak - a.streak),
                ],
              ].map(([title, items]) => (
                <article className="panel insight-panel" key={title}>
                  <h3>{title}</h3>
                  {items.length ? (
                    items.map((h) => (
                      <div className="insight-row" key={h.id}>
                        <span>{h.name}</span>
                        <b>
                          {title === "Habit Streaks"
                            ? `${h.streak} days`
                            : `${h.percent}%`}
                        </b>
                      </div>
                    ))
                  ) : (
                    <p>No habits in this group yet.</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
        {activeTab === "export" && (
          <section className="panel export">
            <div className="export-head">
              <div className="brand-mark">
                <Download size={21} />
              </div>
              <div>
                <h2>Export your habit data</h2>
                <p>
                  Download reports for {format(selectedMonth, "MMMM yyyy")}.
                </p>
              </div>
            </div>
            <div className="export-stats">
              <div>
                Habits tracked <b>{state.habits.length}</b>
              </div>
              <div>
                Days <b>{days.length}</b>
              </div>
              <div>
                Completion <b>{stats.overall}%</b>
              </div>
            </div>
            <div className="export-options">
              <article>
                <FileSpreadsheet size={28} />
                <h3>Excel Workbook (.xlsx)</h3>
                <p>
                  History and summary sheets, including habit IDs and
                  timestamps.
                </p>
                <button className="btn primary" onClick={exportExcel}>
                  <Download size={14} /> Download Excel
                </button>
              </article>
              <article>
                <FileText size={28} />
                <h3>PDF Report (.pdf)</h3>
                <p>Printable monthly habit history and capture timestamps.</p>
                <button className="btn outline" onClick={exportPDF}>
                  <Download size={14} /> Download PDF
                </button>
              </article>
            </div>
          </section>
        )}
      </main>
      <footer>
        Habit Tracker · Small Habits, Big Changes{" "}
        <span>
          {saving ? (
            <>
              <LoaderCircle size={12} className="spin" /> Saving…
            </>
          ) : connected ? (
            <>
              <CheckCircle2 size={12} /> Synced with Google Sheets
            </>
          ) : null}{" "}
          
        </span>
      </footer>
      {modal === "habit" && (
        <div className="overlay">
          <form className="modal" onSubmit={saveHabit}>
            <div className="modal-head">
              <div>
                <h2>{editing ? "Edit Habit" : "Add New Habit"}</h2>
                <p>Create a habit to track consistently</p>
              </div>
              <button type="button" onClick={() => setModal("")}>
                <X size={18} />
              </button>
            </div>
            <label>
              Habit name
              <input
                required
                maxLength={80}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Morning walk"
              />
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {[
                  "Learning",
                  "Health",
                  "Fitness",
                  "Wellness",
                  "Productivity",
                  "Personal",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Icon
              <div className="icon-picker">
                {iconNames.map((name) => (
                  <button
                    type="button"
                    key={name}
                    title={name}
                    aria-label={name}
                    className={`icon-picker-btn ${
                      form.icon === name ? "chosen" : ""
                    }`}
                    onClick={() => setForm({ ...form, icon: name })}
                  >
                    <Icon name={name} size={18} />
                  </button>
                ))}
              </div>
            </label>
            <label>
              Goal / Target
              <select
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
              >
                {["Daily", "Weekdays", "Weekly", "Weekends"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="btn outline"
                onClick={() => setModal("")}
              >
                Cancel
              </button>
              <button className="btn primary" type="submit">
                Save Habit
              </button>
            </div>
          </form>
        </div>
      )}
      {modal === "month" && (
        <div className="overlay">
          <form className="modal" onSubmit={createMonth}>
            <div className="modal-head">
              <h2>Add New Month</h2>
              <button type="button" onClick={() => setModal("")}>
                <X size={18} />
              </button>
            </div>
            <div className="two-fields">
              <label>
                Month
                <select
                  value={monthForm.month}
                  onChange={(e) =>
                    setMonthForm({ ...monthForm, month: e.target.value })
                  }
                >
                  {Array.from({ length: 12 }, (_, i) =>
                    format(new Date(2026, i, 1), "MMMM"),
                  ).map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                Year
                <input
                  type="number"
                  min="2020"
                  max="2100"
                  value={monthForm.year}
                  onChange={(e) =>
                    setMonthForm({ ...monthForm, year: e.target.value })
                  }
                />
              </label>
            </div>
            <p className="month-preview">
              Total days:{" "}
              {getDaysInMonth(
                new Date(
                  Number(monthForm.year),
                  new Date(`${monthForm.month} 1, 2026`).getMonth(),
                  1,
                ),
              )}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn outline"
                onClick={() => setModal("")}
              >
                Cancel
              </button>
              <button className="btn primary" type="submit">
                Create Month
              </button>
            </div>
          </form>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
      {busy && (
        <div className="loading">
          <Sparkles size={25} />
          <span>Loading your habits…</span>
        </div>
      )}
    </div>
  );
}

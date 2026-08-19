// =====================================================================
// TeacherDashboard.jsx — Pengajar: unggah materi, buat tugas, beri nilai.
// =====================================================================
import { useEffect, useState, Fragment } from "react";
import { createPortal } from "react-dom";
import { api } from "../api";
import ChatPanel from "../components/ChatPanel.jsx";
import AnnouncementsBanner from "../components/AnnouncementsBanner.jsx";
import Comments from "../components/Comments.jsx";
import { RichText, RichTextEditor } from "../components/RichText.jsx";
import FilePreview from "../components/FilePreview.jsx";

const MATERIAL_TYPES = [
  { key: "text", label: "Teks" },
  { key: "bahanajar", label: "Bahan Ajar (Kurikulum)" },
  { key: "image", label: "Gambar" },
  { key: "video", label: "Video" },
  { key: "presentation", label: "Presentasi" },
  { key: "document", label: "Dokumen" },
  { key: "link", label: "Tautan" },
];
const FILE_TYPES = ["image", "video", "presentation", "document"];

const TEACHER_TABS = [
  { key: "stats", label: "Dashboard", icon: "📊" },
  { key: "attendance", label: "Kehadiran", icon: "✅" },
  { key: "materials", label: "Materi", icon: "📄" },
  { key: "selflearning", label: "Belajar Mandiri", icon: "🎯" },
  { key: "assignments", label: "Tugas", icon: "📝" },
  { key: "quizzes", label: "Kuis", icon: "🧩" },
  { key: "gradebook", label: "Rekap Nilai", icon: "🧮" },
  { key: "discussion", label: "Obrolan", icon: "💬" },
];

export default function TeacherDashboard() {
  const [subjects, setSubjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [tab, setTab] = useState("stats");
  // Kelas perwalian (wali kelas) + mode tampilan.
  const [homeroom, setHomeroom] = useState([]);
  const [mode, setMode] = useState("subject"); // "subject" | "homeroom"
  const [homeroomClassId, setHomeroomClassId] = useState(null);
  // Periode (tahun akademik + semester) yang sedang dilihat.
  const [periodKey, setPeriodKey] = useState("");
  // Target navigasi dari lonceng notifikasi: {subjectId, tab}.
  const [navTarget, setNavTarget] = useState(null);

  useEffect(() => {
    api.listSubjects().then(setSubjects);
    api.homeroom().then(setHomeroom).catch(() => setHomeroom([]));
  }, []);

  // Banner sambutan hanya tampil di menu Dashboard (sembunyikan di tab lain, khusus HP).
  useEffect(() => {
    const cls = "hide-welcome-banner";
    document.body.classList.toggle(cls, tab !== "stats");
    return () => document.body.classList.remove(cls);
  }, [tab]);

  // Terima permintaan navigasi dari lonceng notifikasi (event + sessionStorage).
  useEffect(() => {
    const apply = (detail) => {
      if (detail && detail.subjectId) setNavTarget(detail);
    };
    try {
      const raw = sessionStorage.getItem("edud_notif_target");
      if (raw) {
        sessionStorage.removeItem("edud_notif_target");
        apply(JSON.parse(raw));
      }
    } catch {
      /* abaikan */
    }
    const onNav = (e) => {
      try {
        sessionStorage.removeItem("edud_notif_target");
      } catch {
        /* abaikan */
      }
      apply(e.detail);
    };
    window.addEventListener("edud:notif-nav", onNav);
    return () => window.removeEventListener("edud:notif-nav", onNav);
  }, []);

  // Daftar periode unik yang dimiliki pengajar (mapel + perwalian).
  const periods = [];
  const seenPeriods = new Set();
  [...subjects, ...homeroom].forEach((x) => {
    if (!x.academicYearId) return;
    const key = `${x.academicYearId}|${x.semester}`;
    if (seenPeriods.has(key)) return;
    seenPeriods.add(key);
    periods.push({
      key,
      academicYearName: x.academicYearName,
      semester: x.semester,
      periodActive: x.periodActive,
    });
  });
  periods.sort((a, b) => {
    if (a.periodActive !== b.periodActive) return a.periodActive ? -1 : 1;
    return (
      (b.academicYearName || "").localeCompare(a.academicYearName || "") ||
      (b.semester || "").localeCompare(a.semester || "")
    );
  });

  // Default periode = yang aktif (atau paling baru).
  useEffect(() => {
    if (periodKey || periods.length === 0) return;
    const active = periods.find((p) => p.periodActive) || periods[0];
    setPeriodKey(active.key);
  }, [periods, periodKey]);

  const visibleSubjects = subjects.filter(
    (s) => `${s.academicYearId}|${s.semester}` === periodKey
  );
  const visibleHomeroom = homeroom.filter(
    (h) => `${h.academicYearId}|${h.semester}` === periodKey
  );

  // Saat periode berganti, pilih mapel/kelas pertama pada periode itu.
  useEffect(() => {
    if (!periodKey) return;
    const vs = subjects.filter(
      (s) => `${s.academicYearId}|${s.semester}` === periodKey
    );
    const vh = homeroom.filter(
      (h) => `${h.academicYearId}|${h.semester}` === periodKey
    );
    // Pertahankan pilihan saat ini bila masih valid pada periode ini (mis. saat
    // navigasi dari notifikasi memilih mapel tertentu).
    if (mode === "subject" && vs.some((s) => s.id === activeId)) return;
    if (mode === "homeroom" && vh.some((h) => h.classId === homeroomClassId))
      return;
    if (vs.length) {
      setMode("subject");
      setActiveId(vs[0].id);
      return;
    }
    if (vh.length) {
      setMode("homeroom");
      setHomeroomClassId(vh[0].classId);
    } else {
      setActiveId(null);
    }
  }, [periodKey, subjects, homeroom]);

  // Navigasi notifikasi: pilih periode, mapel, & tab sesuai target.
  useEffect(() => {
    if (!navTarget || !navTarget.subjectId) return;
    const subj = subjects.find((s) => s.id === navTarget.subjectId);
    if (!subj) return;
    setPeriodKey(`${subj.academicYearId}|${subj.semester}`);
    setMode("subject");
    setActiveId(navTarget.subjectId);
    if (navTarget.tab) setTab(navTarget.tab);
    setNavTarget(null);
  }, [navTarget, subjects]);

  const active = visibleSubjects.find((s) => s.id === activeId);
  const activeHomeroom = visibleHomeroom.find(
    (h) => h.classId === homeroomClassId
  );

  return (
    <div>
      {tab === "stats" && <AnnouncementsBanner />}
      {subjects.length === 0 && homeroom.length === 0 && (
        <p className="muted">
          Anda belum ditugaskan ke mata pelajaran mana pun. Hubungi admin.
        </p>
      )}
      {(subjects.length > 0 || homeroom.length > 0) && (
        <>
          {periods.length > 0 && (
            <div className="period-picker">
              <label className="muted tiny">Periode</label>
              <select
                value={periodKey}
                onChange={(e) => setPeriodKey(e.target.value)}
              >
                {periods.map((p) => (
                  <option key={p.key} value={p.key}>
                    TA {p.academicYearName} ·{" "}
                    {p.semester
                      ? p.semester.charAt(0).toUpperCase() + p.semester.slice(1)
                      : "—"}
                    {p.periodActive ? " (aktif)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="class-tabs">
            {visibleSubjects.length > 0 && (
              <div className="subject-select-wrap">
                <label className="subject-select-label">Mata Pelajaran</label>
                <select
                  className="subject-select"
                  value={mode === "subject" ? activeId || "" : ""}
                  onChange={(e) => {
                    setMode("subject");
                    setActiveId(e.target.value);
                  }}
                >
                  {mode !== "subject" && (
                    <option value="" disabled>
                      Pilih mata pelajaran…
                    </option>
                  )}
                  {visibleSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.className} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {visibleHomeroom.map((h) => (
              <button
                key={h.classId}
                className={`class-tab class-tab-homeroom ${
                  mode === "homeroom" && h.classId === homeroomClassId
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  setMode("homeroom");
                  setHomeroomClassId(h.classId);
                }}
              >
                👨‍🏫 Wali Kelas: {h.className}
              </button>
            ))}
          </div>

          {visibleSubjects.length === 0 && visibleHomeroom.length === 0 && (
            <p className="muted">Tidak ada kelas pada periode ini.</p>
          )}

          {mode === "homeroom" ? (
            <HomeroomPanel
              data={activeHomeroom || visibleHomeroom[0]}
            />
          ) : (
            active && (
            <>
              <div className="row-between">
                <p className="muted">
                  {active.className} · {active.name}
                  {active.description ? ` · ${active.description}` : ""}
                </p>
              </div>
              <div className="admin-tabs-top tabs-float">
                {TEACHER_TABS.map((t) => (
                  <button
                    key={t.key}
                    className={`tab tab-top ${tab === t.key ? "active" : ""}`}
                    onClick={() => setTab(t.key)}
                  >
                    <span className="tab-ico">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
              {tab === "materials" && <MaterialsPanel subjectId={active.id} />}
              {tab === "selflearning" && (
                <LearningMonitorPanel subjectId={active.id} />
              )}
              {tab === "assignments" && (
                <AssignmentsPanel subjectId={active.id} />
              )}
              {tab === "quizzes" && <QuizPanel subjectId={active.id} />}
              {tab === "gradebook" && <GradebookPanel subjectId={active.id} />}
              {tab === "discussion" && <ChatPanel subjectId={active.id} />}
              {tab === "attendance" && (
                <AttendancePanel subjectId={active.id} />
              )}
              {tab === "stats" && <StatsPanel subjectId={active.id} />}
            </>
            )
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- Wali Kelas (perwalian) ---------------- */
const ATT_COLORS = {
  hadir: "#16a34a",
  izin: "#2563eb",
  sakit: "#d97706",
  alfa: "#dc2626",
};
const ATT_LABELS_H = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
  alfa: "Alfa",
};

function BarChart({ title, items, max, unit }) {
  const top = max || Math.max(1, ...items.map((i) => Number(i.value) || 0));
  return (
    <div className="hbar-chart">
      <div className="hbar-title">{title}</div>
      <div className="hbar-bars">
        {items.map((it, idx) => (
          <div className="hbar-row" key={idx}>
            <span className="hbar-label" title={it.label}>
              {it.label}
            </span>
            <div className="hbar-track">
              <div
                className="hbar-fill"
                style={{
                  width: `${
                    top ? Math.round(((Number(it.value) || 0) / top) * 100) : 0
                  }%`,
                  background: it.color || "#6366f1",
                }}
              />
            </div>
            <span className="hbar-value">
              {it.value == null ? "—" : it.value}
              {unit || ""}
            </span>
          </div>
        ))}
        {items.length === 0 && <p className="muted tiny m0">Belum ada data.</p>}
      </div>
    </div>
  );
}

function HomeroomStats({ stats, studentCount }) {
  const att = stats.attendanceTotals;
  const attTotal = att.hadir + att.izin + att.sakit + att.alfa;
  const attItems = Object.keys(ATT_LABELS_H).map((k) => ({
    label: ATT_LABELS_H[k],
    value: att[k],
    color: ATT_COLORS[k],
  }));
  const gradeItems = stats.gradeBuckets.map((b) => ({
    label: b.label,
    value: b.count,
    color: "#6366f1",
  }));
  const subjectItems = stats.subjectAverages.map((s) => ({
    label: s.subjectName,
    value: s.average,
    color: "#0ea5e9",
  }));

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{studentCount}</div>
          <div className="stat-label">Murid</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {stats.classAvgGrade == null ? "—" : stats.classAvgGrade}
          </div>
          <div className="stat-label">Rata-rata nilai kelas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{attTotal}</div>
          <div className="stat-label">Catatan kehadiran</div>
        </div>
      </div>
      <div className="chart-grid">
        <div className="card">
          <BarChart title="Kehadiran (jumlah)" items={attItems} />
        </div>
        <div className="card">
          <BarChart
            title="Distribusi Nilai (jumlah murid)"
            items={gradeItems}
          />
        </div>
        <div className="card">
          <BarChart
            title="Rata-rata Nilai per Mapel"
            items={subjectItems}
            max={100}
          />
        </div>
      </div>
    </>
  );
}

function StudentGradesModal({ studentId, name, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .homeroomStudent(studentId)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [studentId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3 className="m0">Nilai — {name}</h3>
          <button className="btn btn-sm" onClick={onClose}>
            Tutup
          </button>
        </div>
        {error && <div className="alert">{error}</div>}
        {!data && !error && <p className="muted">Memuat…</p>}
        {data && (
          <div className="stack">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">
                  {data.overallAverage == null ? "—" : data.overallAverage}
                </div>
                <div className="stat-label">Rata-rata keseluruhan</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{data.attendance.hadir}</div>
                <div className="stat-label">Hadir</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {data.attendance.izin +
                    data.attendance.sakit +
                    data.attendance.alfa}
                </div>
                <div className="stat-label">Izin/Sakit/Alfa</div>
              </div>
            </div>
            {data.subjects.map((s) => (
              <div className="card" key={s.subjectId}>
                <div className="row-between">
                  <b>{s.subjectName}</b>
                  <span className="badge grade-badge">
                    Rata: {s.average == null ? "—" : s.average}
                  </span>
                </div>
                {s.teacherNames && (
                  <div className="muted tiny">{s.teacherNames}</div>
                )}
                <table className="table">
                  <tbody>
                    {s.items.map((it, i) => (
                      <tr key={i}>
                        <td className="tiny">
                          {it.kind === "quiz" ? "🧩 " : "📝 "}
                          {it.title}
                        </td>
                        <td className="tiny" style={{ textAlign: "right" }}>
                          {it.display}
                        </td>
                      </tr>
                    ))}
                    {s.items.length === 0 && (
                      <tr>
                        <td className="tiny">
                          <span className="muted">Belum ada tugas/kuis.</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
            {data.subjects.length === 0 && (
              <p className="muted">Belum ada mata pelajaran.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PromotionPanel({ data }) {
  const { classId, className, students, nextClassName } = data;
  const [decisions, setDecisions] = useState({});
  const [applied, setApplied] = useState({});
  const [status, setStatus] = useState({});

  useEffect(() => {
    const d = {};
    const ap = {};
    students.forEach((s) => {
      d[s.id] = s.promotion || "";
      ap[s.id] = !!s.promotionApplied;
    });
    setDecisions(d);
    setApplied(ap);
    setStatus({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const change = async (studentId, decision) => {
    setDecisions((p) => ({ ...p, [studentId]: decision }));
    setStatus((p) => ({ ...p, [studentId]: "saving" }));
    try {
      await api.setPromotion(classId, studentId, decision);
      setStatus((p) => ({ ...p, [studentId]: "ok" }));
    } catch (e) {
      setStatus((p) => ({ ...p, [studentId]: "err" }));
    }
  };

  const decidedCount = students.filter((s) => decisions[s.id]).length;

  return (
    <details className="card">
      <summary className="material-summary">
        <h3 className="m0">Kenaikan Kelas</h3>
      </summary>
      <p className="muted tiny">
        Tentukan siswa naik atau tinggal kelas. Keputusan disimpan dan{" "}
        <b>otomatis diterapkan</b> saat tahun ajaran baru (semester ganjil)
        diaktifkan oleh admin.{" "}
        {nextClassName
          ? `Siswa yang naik akan pindah ke ${nextClassName}.`
          : "Ini tingkat tertinggi — siswa yang naik tidak dipindahkan."}
      </p>
      <p className="muted tiny">
        {decidedCount}/{students.length} siswa sudah ditentukan.
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>NISN</th>
              <th>Keputusan</th>
              <th>Kelas Berikutnya</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const dec = decisions[s.id] || "";
              const isApplied = applied[s.id];
              const st = status[s.id];
              return (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.nisn || <span className="muted tiny">—</span>}</td>
                  <td>
                    <select
                      className="gb-select"
                      value={dec}
                      disabled={isApplied}
                      onChange={(e) => change(s.id, e.target.value)}
                    >
                      <option value="">Belum ditentukan</option>
                      <option value="naik">Naik kelas</option>
                      <option value="tinggal">Tinggal kelas</option>
                    </select>
                  </td>
                  <td className="tiny">
                    {dec === "naik" ? (
                      nextClassName || (
                        <span className="muted">— (tetap)</span>
                      )
                    ) : dec === "tinggal" ? (
                      className
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="tiny">
                    {isApplied ? (
                      <span className="badge badge-done">Diterapkan</span>
                    ) : st === "saving" ? (
                      <span className="muted">Menyimpan…</span>
                    ) : st === "ok" ? (
                      <span className="grade-status ok">✓ Tersimpan</span>
                    ) : st === "err" ? (
                      <span className="grade-status err">Gagal</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <span className="muted">Belum ada murid.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function HomeroomPanel({ data }) {
  const [viewStudent, setViewStudent] = useState(null);
  if (!data) return <p className="muted">Belum ada kelas perwalian.</p>;
  const { className, students, stats } = data;
  const subjectCols = stats.subjectAverages || [];

  return (
    <div className="stack">
      <div className="card">
        <h3 className="m0">Kelas Perwalian — {className}</h3>
        <p className="muted tiny m0">{students.length} murid</p>
      </div>

      <HomeroomStats stats={stats} studentCount={students.length} />

      <details className="card">
        <summary className="material-summary">
          <h3 className="m0">Rekap Nilai Mata Pelajaran</h3>
        </summary>
        <div className="table-wrap">
          <table className="table gradebook-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>NISN</th>
                {subjectCols.map((s) => (
                  <th key={s.subjectId} className="gb-sum ta-c">
                    {s.subjectName}
                  </th>
                ))}
                <th className="gb-sum ta-c">Rata Nilai</th>
                <th>Kehadiran (H/I/S/A)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.nisn || <span className="muted tiny">—</span>}</td>
                  {subjectCols.map((sub) => {
                    const v = (s.subjectGrades || {})[sub.subjectId];
                    return (
                      <td key={sub.subjectId} className="gb-sum ta-c">
                        {v == null ? (
                          <span className="muted">—</span>
                        ) : (
                          <span className="badge grade-badge">{v}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="gb-sum ta-c">
                    {s.avgGrade == null ? (
                      <span className="muted">—</span>
                    ) : (
                      <span className="badge grade-badge">{s.avgGrade}</span>
                    )}
                  </td>
                  <td className="tiny">
                    {s.attendance.hadir}/{s.attendance.izin}/
                    {s.attendance.sakit}/{s.attendance.alfa}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setViewStudent(s)}
                    >
                      Lihat Nilai
                    </button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={5 + subjectCols.length}>
                    <span className="muted">Belum ada murid di kelas ini.</span>
                  </td>
                </tr>
              )}
              {students.length > 0 && subjectCols.length > 0 && (
                <tr className="gb-avg-row">
                  <td colSpan={2}>
                    <b>Rata-rata kelas</b>
                  </td>
                  {subjectCols.map((sub) => (
                    <td key={sub.subjectId} className="gb-sum ta-c">
                      {sub.average == null ? (
                        <span className="muted">—</span>
                      ) : (
                        <b>{sub.average}</b>
                      )}
                    </td>
                  ))}
                  <td className="gb-sum ta-c">
                    {stats.classAvgGrade == null ? (
                      <span className="muted">—</span>
                    ) : (
                      <b>{stats.classAvgGrade}</b>
                    )}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {subjectCols.length === 0 && (
          <p className="muted tiny">
            Belum ada mata pelajaran pada kelas ini.
          </p>
        )}
      </details>

      {data.canPromote && <PromotionPanel data={data} />}

      {!data.canPromote && data.isGraduating && data.semester === "genap" && (
        <div className="card">
          <h3 className="m0">Kelas Akhir Jenjang</h3>
          <p className="muted tiny">
            Ini adalah tingkat tertinggi jenjang, sehingga wali kelas tidak
            menetapkan kenaikan kelas. Status siswa pada akhir semester genap
            adalah <b>kelulusan</b>, yang ditentukan oleh admin.
          </p>
        </div>
      )}

      {viewStudent && (
        <StudentGradesModal
          studentId={viewStudent.id}
          name={viewStudent.name}
          onClose={() => setViewStudent(null)}
        />
      )}
    </div>
  );
}

/* ---------------- Materi ---------------- */
function capSemester(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/* ---------------- Kurikulum (acuan pembelajaran) ---------------- */
function CurriculumPanel({ subject }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ pertemuan: 1, topic: "", description: "" });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    api.listCurriculum(subject.id).then(setItems).catch(() => {});
  useEffect(() => {
    load();
  }, [subject.id]);

  function openAdd() {
    const next = items.length ? (items[items.length - 1].pertemuan || 0) + 1 : 1;
    setForm({ pertemuan: next, topic: "", description: "" });
    setEditingId(null);
    setError("");
    setShowForm(true);
  }
  function openEdit(it) {
    setForm({
      pertemuan: it.pertemuan,
      topic: it.topic,
      description: it.description || "",
    });
    setEditingId(it.id);
    setError("");
    setShowForm(true);
  }
  async function save(e) {
    e.preventDefault();
    setError("");
    try {
      if (editingId) await api.updateCurriculum(editingId, form);
      else await api.createCurriculum({ subjectId: subject.id, ...form });
      setShowForm(false);
      setEditingId(null);
      setForm({ pertemuan: 1, topic: "", description: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function del(id) {
    if (!confirm("Hapus butir kurikulum ini?")) return;
    await api.deleteCurriculum(id);
    load();
  }

  return (
    <div className={showForm ? "grid-2" : ""}>
      {showForm && (
        <div className="card">
          <div className="row-between">
            <h3>{editingId ? "Ubah Kurikulum" : "Tambah Kurikulum"}</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              Tutup
            </button>
          </div>
          {error && <div className="alert">{error}</div>}
          <form onSubmit={save} className="form">
            <label>Pembelajaran ke-</label>
            <input
              type="number"
              min="1"
              value={form.pertemuan}
              onChange={(e) => setForm({ ...form, pertemuan: e.target.value })}
            />
            <label>Topik / Materi pokok</label>
            <input
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              required
            />
            <label>Kompetensi / Tujuan pembelajaran</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <button className="btn btn-primary">
              {editingId ? "Simpan Perubahan" : "Tambah"}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="row-between">
          <div>
            <h3>Kurikulum ({items.length})</h3>
            <div className="muted tiny">
              {subject.name} · {subject.className}
              {subject.academicYearName ? ` · TA ${subject.academicYearName}` : ""}
              {subject.semester ? ` · ${capSemester(subject.semester)}` : ""}
            </div>
          </div>
          {!showForm && (
            <button className="btn btn-primary btn-sm" onClick={openAdd}>
              + Tambah Kurikulum
            </button>
          )}
        </div>
        <div className="stack">
          {items.map((it) => (
            <div className="list-item column" key={it.id}>
              <div className="row-between">
                <b>
                  <span className="badge">Pembelajaran {it.pertemuan}</span>{" "}
                  {it.topic}
                </b>
                <div className="btn-group">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => openEdit(it)}
                  >
                    Ubah
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => del(it.id)}
                  >
                    Hapus
                  </button>
                </div>
              </div>
              {it.description && <p className="pre m0">{it.description}</p>}
            </div>
          ))}
          {items.length === 0 && (
            <p className="muted">
              Belum ada kurikulum. Tambahkan acuan pembelajaran per pembelajaran.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Kelompokkan daftar indikator kurikulum berdasarkan grup, urutan dipertahankan.
function groupIndicators(indicators) {
  const map = new Map();
  (indicators || []).forEach((ind) => {
    const g = ind.group || "Indikator";
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(ind);
  });
  return Array.from(map.entries());
}

// Kelompokkan indikator terpilih (label datar) berdasarkan grup asalnya di
// kurikulum aktif → [ [judulGrup, [label,...]], ... ], mengikuti urutan
// indikator kurikulum aktif (Tujuan Pembelajaran dahulu, lalu tiap Elemen).
// Prefiks "Elemen: " dirapikan agar tampil "Pemahaman Konsep",
// "Keterampilan Proses", dst.
export function categorizeObjectives(labels, activeIndicators) {
  const selected = new Set(labels || []);
  const pretty = (g) =>
    g && g.startsWith("Elemen: ") ? g.slice("Elemen: ".length) : g || "Indikator";
  const order = [];
  const buckets = new Map();
  (activeIndicators || []).forEach((ind) => {
    if (!ind || !ind.label || !selected.has(ind.label)) return;
    const g = pretty(ind.group);
    if (!buckets.has(g)) {
      buckets.set(g, []);
      order.push(g);
    }
    if (!buckets.get(g).includes(ind.label)) buckets.get(g).push(ind.label);
  });
  // Label yang tak ditemukan di kurikulum aktif → tetap ditampilkan.
  const matched = new Set([].concat(...Array.from(buckets.values())));
  const leftovers = (labels || []).filter((l) => l && !matched.has(l));
  if (leftovers.length) {
    const g = "Indikator / Tujuan Pembelajaran";
    if (!buckets.has(g)) {
      buckets.set(g, []);
      order.push(g);
    }
    buckets.get(g).push(...leftovers);
  }
  return order.map((g) => [g, buckets.get(g)]);
}

// Tampilan indikator terpilih yang sudah dikelompokkan per judul grup.
function ObjectiveGroups({ groups }) {
  if (!groups || groups.length === 0) return null;
  return (
    <>
      {groups.map(([g, labels]) => (
        <div className="obj-group" key={g}>
          <div className="obj-group-label">{g}</div>
          <ul className="indicator-list">
            {labels.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}


// Pemilih daftar (checkbox) tersendiri untuk Materi Pokok / Tema Projek.
// Dipakai di form pemetaan acuan kurikulum agar terpisah dari indikator umum.
function ChoicePicker({ title, hint, options, selected, field, onToggle, onSetAll, jpMap }) {
  const opts = options || [];
  const sel = selected || [];
  const allOn = opts.length > 0 && opts.every((o) => sel.includes(o));
  const jpOf = (o) => (jpMap && jpMap[o] ? jpMap[o] : 0);
  return (
    <div className="choice-picker">
      <div className="indicator-head">
        <div className="label-strong">{title}</div>
        <span className="indicator-count">
          {sel.length}/{opts.length} dipilih
        </span>
      </div>
      {hint && <div className="muted tiny">{hint}</div>}
      <div className="indicator-group-head">
        <span className="indicator-group-title">Pilih dari kurikulum aktif</span>
        <button
          type="button"
          className="linklike"
          onClick={() => onSetAll(field, opts, !allOn)}
        >
          {allOn ? "Kosongkan" : "Pilih semua"}
        </button>
      </div>
      <div className="indicator-picker">
        <div className="indicator-check-grid">
          {opts.map((o) => (
            <label
              className={`indicator-check${
                sel.includes(o) ? " is-checked" : ""
              }`}
              key={o}
            >
              <input
                type="checkbox"
                checked={sel.includes(o)}
                onChange={() => onToggle(field, o)}
              />
              <span>
                {o}
                {jpOf(o) > 0 && <span className="choice-jp">{jpOf(o)} JP</span>}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// Kotak rujukan kurikulum yang ditampilkan di atas panel Materi, Tugas, dan
// Kuis. Menampilkan indikator kurikulum AKTIF (sesuai jenis kurikulum kelas)
// yang sudah dipetakan guru per pertemuan, plus tombol untuk mengelolanya.
function CurriculumReference({ subjectId, withMaterials = false, onManage }) {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [managing, setManaging] = useState(false);

  function load() {
    api
      .listCurriculum(subjectId)
      .then(setItems)
      .catch(() => setItems([]));
    api
      .activeCurriculum(subjectId)
      .then(setActive)
      .catch(() => setActive(null));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  return (
    <details className="curriculum-ref">
      <summary>
        📋 Acuan Kurikulum
        {active?.curriculumLabel ? ` · ${active.curriculumLabel}` : ""}
        {items.length ? ` (${items.length} pertemuan)` : ""}
      </summary>
      <div className="curriculum-ref-body">
        {active && !active.curriculumType && (
          <div className="alert alert-warn tiny">
            Kelas ini belum diatur jenis kurikulumnya. Minta admin memilih
            kurikulum kelas agar indikator muncul.
          </div>
        )}
        {active && active.curriculumType && !active.matched && (
          <div className="alert alert-warn tiny">
            Katalog indikator {active.curriculumLabel} untuk mapel ini
            (kelas {active.kelas ?? "?"} · {capSemester(active.semester)})
            belum tersedia. Minta admin melengkapinya di menu Katalog Kurikulum.
          </div>
        )}
        {items.length > 0 ? (
          <div className="curriculum-ref-list">
            {items.map((it) => (
              <div className="curriculum-ref-item" key={it.id}>
                <b>Pertemuan {it.pertemuan}:</b> {it.topic}
                {it.description && (
                  <div className="muted tiny">{it.description}</div>
                )}
                {(it.tema || []).length > 0 && (
                  <div className="ref-tags">
                    <span className="ref-tags-label">Tema Projek:</span>
                    {it.tema.map((t, i) => (
                      <span className="ref-tag ref-tag-tema" key={i}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {(it.submateri || []).length > 0 && (
                  <div className="ref-tags">
                    <span className="ref-tags-label">Sub-Materi:</span>
                    {it.submateri.map((s, i) => (
                      <span className="ref-tag ref-tag-sub" key={i}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {(it.indicators || []).length > 0 && (
                  <ul className="indicator-list">
                    {it.indicators.map((ind, i) => (
                      <li key={i}>{ind}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted tiny">
            Belum ada pemetaan indikator ke pertemuan.
          </p>
        )}
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => (onManage ? onManage() : setManaging(true))}
        >
          {withMaterials
            ? "✎ Kelola acuan, indikator & materi"
            : "✎ Kelola acuan & indikator"}
        </button>
      </div>
      {!onManage && managing && (
        <CurriculumMapper
          subjectId={subjectId}
          active={active}
          withMaterials={withMaterials}
          onClose={() => {
            setManaging(false);
            load();
          }}
        />
      )}
    </details>
  );
}

// Modal pemetaan indikator kurikulum aktif ke tiap pertemuan.
function CurriculumMapper({ subjectId, active, onClose, withMaterials = false, initialMateri = null, closeOnAdd = false, editItem = null }) {
  const emptyForm = {
    pertemuan: 1,
    topic: "",
    description: "",
    indicators: [],
    materiPokok: [],
    submateri: [],
    tema: [],
  };
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [materials, setMaterials] = useState([]);
  const indicators = active?.indicators || [];

  function loadMaterials() {
    if (!withMaterials) return;
    api
      .listMaterials(subjectId)
      .then(setMaterials)
      .catch(() => setMaterials([]));
  }
  const materialsFor = (p) =>
    materials.filter(
      (m) => Math.max(1, parseInt(m.pertemuan, 10) || 1) === Number(p)
    );

  function load() {
    api
      .listCurriculum(subjectId)
      .then((list) => {
        setItems(list);
        setEditingId((cur) => {
          if (cur) return cur;
          // Mode edit: langsung muat pembelajaran yang dipilih.
          if (editItem) {
            setForm({
              pertemuan: editItem.pertemuan,
              topic: editItem.topic || "",
              description: editItem.description || "",
              indicators: editItem.indicators || [],
              materiPokok: editItem.materiPokok || [],
              submateri: editItem.submateri || [],
              tema: editItem.tema || [],
            });
            return editItem.id;
          }
          const next = list.length
            ? Math.max(...list.map((i) => i.pertemuan || 0)) + 1
            : 1;
          setForm({
            ...emptyForm,
            pertemuan: next,
            materiPokok: initialMateri ? [...initialMateri] : [],
          });
          return null;
        });
      })
      .catch(() => setItems([]));
  }
  useEffect(() => {
    load();
    loadMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  function resetForm() {
    const next = items.length
      ? Math.max(...items.map((i) => i.pertemuan || 0)) + 1
      : 1;
    setForm({ ...emptyForm, pertemuan: next });
    setEditingId(null);
  }
  // Siapkan form untuk menambah pertemuan baru pada materi pokok tertentu:
  // isi nomor pertemuan berikutnya & materi pokoknya dipilih otomatis.
  function addToMateri(materiArr) {
    const next = items.length
      ? Math.max(...items.map((i) => i.pertemuan || 0)) + 1
      : 1;
    setForm({
      ...emptyForm,
      pertemuan: next,
      materiPokok: [...(materiArr || [])],
    });
    setEditingId(null);
  }
  function toggleIndicator(label) {
    setForm((f) => ({
      ...f,
      indicators: f.indicators.includes(label)
        ? f.indicators.filter((x) => x !== label)
        : [...f.indicators, label],
    }));
  }
  function setAllIndicators(labels, checked) {
    setForm((f) => {
      const set = new Set(f.indicators);
      labels.forEach((l) => (checked ? set.add(l) : set.delete(l)));
      return { ...f, indicators: Array.from(set) };
    });
  }
  function toggleField(field, value) {
    setForm((f) => {
      const arr = f[field] || [];
      return {
        ...f,
        [field]: arr.includes(value)
          ? arr.filter((x) => x !== value)
          : [...arr, value],
      };
    });
  }
  function setAllField(field, values, checked) {
    setForm((f) => {
      const set = new Set(f[field] || []);
      values.forEach((v) => (checked ? set.add(v) : set.delete(v)));
      return { ...f, [field]: Array.from(set) };
    });
  }
  function openEdit(it) {
    setForm({
      pertemuan: it.pertemuan,
      topic: it.topic,
      description: it.description || "",
      indicators: it.indicators || [],
      materiPokok: it.materiPokok || [],
      submateri: it.submateri || [],
      tema: it.tema || [],
    });
    setEditingId(it.id);
  }
  async function save(e) {
    e.preventDefault();
    setError("");
    const hasMateri = (active?.materiPokok || []).length > 0;
    const payload = { ...form };
    if (hasMateri) {
      // Topik pertemuan otomatis mengikuti materi pokok yang dipilih.
      payload.topic = (form.materiPokok || []).join(", ");
      if (!payload.topic) {
        setError("Pilih minimal satu materi pokok untuk pertemuan ini.");
        return;
      }
      // Buang submateri yang tidak lagi termasuk materi pokok terpilih.
      const validSub = new Set(
        materiDetail
          .filter((m) => (form.materiPokok || []).includes(m.nama))
          .flatMap((m) => (m.submateri || []).map((s) => s.nama))
      );
      payload.submateri = (form.submateri || []).filter((s) => validSub.has(s));
    }
    try {
      if (editingId) await api.updateCurriculum(editingId, payload);
      else await api.createCurriculum({ subjectId, ...payload });
      // Tutup pop-up setelah menambah/mengubah pembelajaran bila diminta.
      if (closeOnAdd) {
        onClose();
        return;
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function del(id) {
    if (!confirm("Hapus pemetaan pertemuan ini?")) return;
    await api.deleteCurriculum(id);
    if (editingId === id) resetForm();
    load();
  }

  // Tujuan pembelajaran (indikator) yang relevan dengan materi pokok terpilih.
  // Sebuah indikator tampil bila menyebut salah satu materi pokok yang dipilih.
  // Indikator umum yang tidak terikat pada materi pokok mana pun (mis. capaian
  // tiap Elemen pada Kurikulum Merdeka) tetap selalu tampil. Bila belum ada
  // materi pokok yang dipilih, seluruh indikator ditampilkan seperti biasa.
  const allMateriNames = (active?.materiPokok || [])
    .map((m) => String(m).trim().toLowerCase())
    .filter(Boolean);
  const selectedMateriNames = (form.materiPokok || [])
    .map((m) => String(m).trim().toLowerCase())
    .filter(Boolean);
  const indicatorInSelectedMateri = (label) => {
    if (selectedMateriNames.length === 0) return true;
    const low = String(label || "").toLowerCase();
    if (selectedMateriNames.some((n) => low.includes(n))) return true;
    // Indikator umum (tak menyebut materi pokok mana pun) → tetap tampil.
    return !allMateriNames.some((n) => low.includes(n));
  };
  const materiFilterActive =
    selectedMateriNames.length > 0 && allMateriNames.length > 0;
  const filteredIndicators = indicators.filter(
    (i) =>
      indicatorInSelectedMateri(i.label) &&
      i.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  // Rincian materi pokok (nama + JP + submateri) dari kurikulum aktif.
  const materiDetail = active?.materiDetail || [];
  // Peta JP per materi pokok dan per submateri untuk ditampilkan di pemilih.
  const materiJpMap = {};
  const subJpMap = {};
  // Peta bahan ajar (materi bacaan kurikulum) per nama submateri.
  const subBahanMap = {};
  materiDetail.forEach((m) => {
    materiJpMap[m.nama] = m.jp;
    (m.submateri || []).forEach((s) => {
      subJpMap[s.nama] = s.jp;
      if (s.bahanAjar) subBahanMap[s.nama] = s.bahanAjar;
    });
  });
  // Submateri yang tersedia = milik materi pokok yang sedang dipilih.
  const submateriOptions = materiDetail
    .filter((m) => (form.materiPokok || []).includes(m.nama))
    .flatMap((m) => (m.submateri || []).map((s) => s.nama));
  // Total JP dari materi pokok yang dipilih (acuan beban pertemuan).
  const selectedMateriJP = materiDetail
    .filter((m) => (form.materiPokok || []).includes(m.nama))
    .reduce((a, m) => a + (Number(m.jp) || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-mapper"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3 className="m0">
            Acuan Kurikulum
            {active?.curriculumLabel ? ` · ${active.curriculumLabel}` : ""}
          </h3>
          <button className="btn btn-sm" onClick={onClose}>
            Tutup
          </button>
        </div>
        {error && <div className="alert">{error}</div>}
        <p className="muted tiny">
          {withMaterials
            ? "Petakan indikator kurikulum aktif ke tiap pembelajaran, lalu tambahkan materinya langsung di pembelajaran yang sama."
            : "Petakan indikator kurikulum aktif ke tiap pembelajaran. Indikator inilah yang menjadi acuan saat membuat Materi, Tugas, dan Kuis."}
        </p>
        <div className="grid-2">
          <form onSubmit={save} className="stack">
            <label>
              Pembelajaran ke-
              <input
                type="number"
                min="1"
                value={form.pertemuan}
                onChange={(e) =>
                  setForm({ ...form, pertemuan: e.target.value })
                }
                required
              />
            </label>
            {(active?.materiPokok || []).length === 0 && (
              <label>
                Topik / Materi pokok
                <input
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  placeholder="mis. Teks Deskripsi"
                  required
                />
              </label>
            )}
            <label>
              Catatan (opsional)
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            {(active?.materiPokok || []).length > 0 && (
              <ChoicePicker
                title="Materi Pokok"
                hint={
                  selectedMateriJP > 0
                    ? `Materi pokok terpilih otomatis menjadi topik pembelajaran ini · Total ${selectedMateriJP} JP.`
                    : "Materi pokok terpilih otomatis menjadi topik/judul pembelajaran ini."
                }
                field="materiPokok"
                options={active.materiPokok}
                selected={form.materiPokok}
                onToggle={toggleField}
                onSetAll={setAllField}
                jpMap={materiJpMap}
              />
            )}
            {submateriOptions.length > 0 && (
              <ChoicePicker
                title="Sub-Materi"
                hint="Rincian submateri yang dibahas pada pembelajaran ini (dari materi pokok terpilih)."
                field="submateri"
                options={submateriOptions}
                selected={form.submateri}
                onToggle={toggleField}
                onSetAll={setAllField}
                jpMap={subJpMap}
              />
            )}
            <div>
              <div className="indicator-head">
                <div className="label-strong">
                  Indikator{" "}
                  {active?.curriculumLabel
                    ? `(${active.curriculumLabel})`
                    : ""}
                </div>
                {indicators.length > 0 && (
                  <span className="indicator-count">
                    {form.indicators.length}/{indicators.length} dipilih
                  </span>
                )}
              </div>
              {materiFilterActive && (
                <div className="muted tiny">
                  Hanya menampilkan tujuan pembelajaran yang termasuk dalam
                  materi pokok terpilih.
                </div>
              )}
              {indicators.length === 0 ? (
                <div className="muted tiny">
                  Tidak ada indikator dari kurikulum aktif. Lengkapi katalog
                  kurikulum melalui admin terlebih dahulu.
                </div>
              ) : (
                <>
                  <div className="indicator-tools">
                    <input
                      className="indicator-search"
                      type="search"
                      placeholder="🔍 Cari tujuan pembelajaran…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="btn-group">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setAllIndicators(
                            filteredIndicators.map((i) => i.label),
                            true
                          )
                        }
                      >
                        Pilih semua
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setAllIndicators(
                            filteredIndicators.map((i) => i.label),
                            false
                          )
                        }
                      >
                        Kosongkan
                      </button>
                    </div>
                  </div>
                  {filteredIndicators.length === 0 ? (
                    <div className="muted tiny">
                      {materiFilterActive && !search.trim()
                        ? "Tidak ada tujuan pembelajaran khusus untuk materi pokok terpilih."
                        : "Tidak ada tujuan yang cocok dengan pencarian."}
                    </div>
                  ) : (
                    <div className="indicator-picker">
                      {groupIndicators(filteredIndicators).map(([g, list]) => {
                        const allOn = list.every((i) =>
                          form.indicators.includes(i.label)
                        );
                        return (
                          <div className="indicator-group" key={g}>
                            <div className="indicator-group-head">
                              <span className="indicator-group-title">
                                {g}
                              </span>
                              <button
                                type="button"
                                className="linklike"
                                onClick={() =>
                                  setAllIndicators(
                                    list.map((i) => i.label),
                                    !allOn
                                  )
                                }
                              >
                                {allOn ? "Batal semua" : "Pilih semua"}
                              </button>
                            </div>
                            <div className="indicator-check-grid">
                              {list.map((ind) => (
                                <label
                                  className={`indicator-check${
                                    form.indicators.includes(ind.label)
                                      ? " is-checked"
                                      : ""
                                  }`}
                                  key={ind.label}
                                >
                                  <input
                                    type="checkbox"
                                    checked={form.indicators.includes(
                                      ind.label
                                    )}
                                    onChange={() => toggleIndicator(ind.label)}
                                  />
                                  <span>{ind.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="btn-group">
              <button className="btn btn-primary" type="submit">
                {editingId ? "Simpan perubahan" : "Tambah pembelajaran"}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={resetForm}
                >
                  Batal edit
                </button>
              )}
            </div>
          </form>
          <div className="stack">
            {items.length === 0 && (
              <p className="muted">Belum ada pertemuan yang dipetakan.</p>
            )}
            {groupCurriculumByMateri(items).map((g) => (
              <div className="materi-group" key={g.key || "__no-materi__"}>
                <div className="materi-group-head">
                  <span className="materi-group-title">
                    {g.label ? `📚 ${g.label}` : "Tanpa Materi Pokok"}
                  </span>
                  <div className="materi-group-actions">
                    <span className="materi-count">
                      {g.items.length} pertemuan
                    </span>
                    {g.materi.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => addToMateri(g.materi)}
                        title="Tambah pertemuan baru pada materi pokok ini"
                      >
                        + Pertemuan
                      </button>
                    )}
                  </div>
                </div>
                {g.items.map((it) => (
                  <div
                    className={`list-item column${
                      editingId === it.id ? " is-editing" : ""
                    }`}
                    key={it.id}
                  >
                    <div className="row-between">
                      <b>
                        <span className="badge">Pertemuan {it.pertemuan}</span>
                        {it.topic && it.topic !== g.key && <> {it.topic}</>}
                      </b>
                      <div className="btn-group">
                        <button
                          className="btn btn-sm"
                          onClick={() => openEdit(it)}
                        >
                          Ubah
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => del(it.id)}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                    {(it.submateri || []).length > 0 && (
                      <div className="ref-tags">
                        <span className="ref-tags-label">Sub-Materi:</span>
                        {it.submateri.map((s, i) => (
                          <span className="ref-tag ref-tag-sub" key={i}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <ObjectiveGroups
                      groups={categorizeObjectives(it.indicators, indicators)}
                    />
                    {withMaterials && (
                      <MaterialManager
                        subjectId={subjectId}
                        pertemuan={it.pertemuan}
                        materials={materialsFor(it.pertemuan)}
                        onChange={loadMaterials}
                        submateriOptions={
                          it.submateri && it.submateri.length
                            ? it.submateri
                            : materiDetail
                                .filter((m) =>
                                  (it.materiPokok || []).includes(m.nama)
                                )
                                .flatMap((m) =>
                                  (m.submateri || []).map((s) => s.nama)
                                )
                        }
                        subJpMap={subJpMap}
                        subBahanMap={subBahanMap}
                      />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Pengelola materi untuk SATU pertemuan, ditampilkan langsung di dalam modal
// acuan kurikulum. Guru menambah / mengubah / mengaktifkan / menyelesaikan
// materi tanpa keluar dari pemetaan pertemuan.
function MaterialManager({
  subjectId,
  pertemuan,
  materials,
  onChange,
  submateriOptions = [],
  subBahanMap = {},
  hideHead = false,
  autoCreate = 0,
  formAsModal = false,
}) {
  const [type, setType] = useState("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [bahanSub, setBahanSub] = useState("");
  // Cek Pemahaman (kuis mini) + refleksi belajar mandiri.
  const [checkQuestions, setCheckQuestions] = useState([]);
  const [askReflection, setAskReflection] = useState(false);
  const [reflectionPrompt, setReflectionPrompt] = useState("");
  const [pertemuanKe, setPertemuanKe] = useState(1);
  // Submateri pertemuan ini yang memiliki bahan ajar dari kurikulum.
  const bahanOptions = (submateriOptions || []).filter((n) => subBahanMap[n]);

  function resetForm() {
    setEditingId(null);
    setType("text");
    setTitle("");
    setContent("");
    setFile(null);
    setBahanSub("");
    setCheckQuestions([]);
    setAskReflection(false);
    setReflectionPrompt("");
    // Nomor "Pertemuan ke-" berikutnya untuk pembelajaran ini.
    setPertemuanKe(
      materials.length
        ? Math.max(...materials.map((m) => Number(m.pertemuanKe) || 1)) + 1
        : 1
    );
    setError("");
  }
  function openCreate() {
    resetForm();
    setShowForm(true);
  }
  function openEdit(m) {
    setEditingId(m.id);
    setType(m.type);
    setTitle(m.title);
    setContent(m.content || "");
    setFile(null);
    setBahanSub("");
    setCheckQuestions(
      Array.isArray(m.checkQuestions)
        ? m.checkQuestions.map((q) => ({
            question: q.question || "",
            options: Array.isArray(q.options) ? [...q.options] : ["", ""],
            correct: Number.isInteger(q.correct) ? q.correct : 0,
          }))
        : []
    );
    setAskReflection(!!m.askReflection);
    setReflectionPrompt(m.reflectionPrompt || "");
    setPertemuanKe(Number(m.pertemuanKe) || 1);
    setError("");
    setShowForm(true);
  }
  // Pilih submateri → isi otomatis judul & konten dari bahan ajar kurikulum.
  function pickBahan(nama) {
    setBahanSub(nama);
    if (!nama) return;
    setContent(subBahanMap[nama] || "");
    if (!title.trim()) setTitle(`Bahan Ajar: ${nama}`);
  }
  // --- Editor Cek Pemahaman (kuis mini) ---
  function addQuestion() {
    setCheckQuestions((qs) => [
      ...qs,
      { question: "", options: ["", ""], correct: 0 },
    ]);
  }
  function removeQuestion(i) {
    setCheckQuestions((qs) => qs.filter((_, idx) => idx !== i));
  }
  function setQuestionText(i, val) {
    setCheckQuestions((qs) =>
      qs.map((q, idx) => (idx === i ? { ...q, question: val } : q))
    );
  }
  function setOptionText(i, oi, val) {
    setCheckQuestions((qs) =>
      qs.map((q, idx) =>
        idx === i
          ? { ...q, options: q.options.map((o, j) => (j === oi ? val : o)) }
          : q
      )
    );
  }
  function addOption(i) {
    setCheckQuestions((qs) =>
      qs.map((q, idx) =>
        idx === i && q.options.length < 5
          ? { ...q, options: [...q.options, ""] }
          : q
      )
    );
  }
  function removeOption(i, oi) {
    setCheckQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== i || q.options.length <= 2) return q;
        const options = q.options.filter((_, j) => j !== oi);
        let correct = q.correct;
        if (oi === correct) correct = 0;
        else if (oi < correct) correct -= 1;
        return { ...q, options, correct };
      })
    );
  }
  function setCorrect(i, oi) {
    setCheckQuestions((qs) =>
      qs.map((q, idx) => (idx === i ? { ...q, correct: oi } : q))
    );
  }
  async function save(e) {
    e.preventDefault();
    setError("");
    // Validasi ringan soal cek pemahaman.
    const cleanQuestions = checkQuestions
      .map((q) => ({
        question: (q.question || "").trim(),
        options: q.options.map((o) => (o || "").trim()).filter(Boolean),
        correct: q.correct,
      }))
      .filter((q) => q.question || q.options.length);
    for (const q of cleanQuestions) {
      if (!q.question) return setError("Setiap soal cek pemahaman wajib berisi pertanyaan.");
      if (q.options.length < 2)
        return setError("Setiap soal minimal punya 2 pilihan jawaban.");
      if (q.correct < 0 || q.correct >= q.options.length)
        return setError("Tandai satu kunci jawaban yang benar pada tiap soal.");
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("subjectId", subjectId);
      fd.append("title", title);
      fd.append("type", type);
      fd.append("content", content);
      fd.append("pertemuan", pertemuan);
      fd.append("pertemuanKe", pertemuanKe);
      fd.append("submateri", JSON.stringify(submateriOptions || []));
      fd.append("checkQuestions", JSON.stringify(cleanQuestions));
      fd.append("askReflection", askReflection ? "true" : "false");
      fd.append("reflectionPrompt", reflectionPrompt || "");
      if (FILE_TYPES.includes(type) && file) fd.append("file", file);
      if (editingId) await api.updateMaterial(editingId, fd);
      else await api.createMaterial(fd);
      resetForm();
      setShowForm(false);
      onChange && onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function del(id) {
    if (!confirm("Hapus materi ini?")) return;
    await api.deleteMaterial(id);
    onChange && onChange();
  }
  async function toggleActive(m) {
    await api.setMaterialActive(m.id, m.active === false);
    onChange && onChange();
  }
  async function toggleSelfLearn(m) {
    await api.setMaterialSelfLearn(m.id, m.selfLearn === false);
    onChange && onChange();
  }
  async function toggleComplete(m) {
    await api.setMaterialCompleted(m.id, !m.completed);
    onChange && onChange();
  }

  // Buka form tambah materi otomatis saat dipicu dari luar (tombol + Materi).
  useEffect(() => {
    if (autoCreate) openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreate]);

  const needsFile = FILE_TYPES.includes(type);
  const needsLink = type === "link";
  const isVideo = type === "video";

  return (
    <div className="pert-materials">
      {!hideHead && (
        <div className="pert-materials-head">
          <span className="label-strong">📎 Materi ({materials.length})</span>
          {!showForm && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openCreate}
            >
              + Tambah materi
            </button>
          )}
        </div>
      )}
      {materials.length === 0 && !showForm && (
        <p className="muted tiny m0">Belum ada materi untuk pembelajaran ini.</p>
      )}
      {[...materials]
        .sort(
          (a, b) => (Number(a.pertemuanKe) || 1) - (Number(b.pertemuanKe) || 1)
        )
        .map((m, idx, arr) => {
          const ke = Number(m.pertemuanKe) || 1;
          const showKe =
            idx === 0 || (Number(arr[idx - 1].pertemuanKe) || 1) !== ke;
          return (
            <Fragment key={m.id}>
              {showKe && <div className="pert-ke-head">Pertemuan {ke}</div>}
              <div className="pert-material-item">
                <div className="row-between">
            <span className="pert-material-title">
              <span className={`badge type-${m.type}`}>{m.type}</span> {m.title}
              {m.active === false && (
                <span className="badge badge-off">Belum dibagikan</span>
              )}
              {m.selfLearn === false && (
                <span className="badge badge-off" title="Disembunyikan dari Belajar Mandiri">
                  🚫 Belajar Mandiri
                </span>
              )}
              {m.completed && (
                <span className="badge badge-done">✓ Selesai</span>
              )}
              {Array.isArray(m.checkQuestions) && m.checkQuestions.length > 0 && (
                <span className="badge badge-check" title="Ada cek pemahaman">
                  🧠 {m.checkQuestions.length} soal
                </span>
              )}
            </span>
            <div className="btn-group btn-group-icons">
              <button
                type="button"
                className={`btn btn-sm btn-icon ${
                  m.active === false ? "btn-primary" : "btn-ghost"
                }`}
                onClick={() => toggleActive(m)}
                title={
                  m.active === false
                    ? "Bagikan ke siswa"
                    : "Sembunyikan dari siswa"
                }
              >
                {m.active === false ? "📢" : "🔕"}
              </button>
              <button
                type="button"
                className={`btn btn-sm btn-icon ${
                  m.selfLearn === false ? "btn-primary" : "btn-ghost"
                }`}
                onClick={() => toggleSelfLearn(m)}
                title={
                  m.selfLearn === false
                    ? "Tampilkan di Belajar Mandiri"
                    : "Sembunyikan dari Belajar Mandiri"
                }
              >
                🎯
              </button>
              <button
                type="button"
                className={`btn btn-sm btn-icon ${
                  m.completed ? "btn-ghost" : "btn-primary"
                }`}
                onClick={() => toggleComplete(m)}
                title={m.completed ? "Batalkan selesai" : "Tandai selesai"}
              >
                {m.completed ? "↺" : "✓"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => openEdit(m)}
                title="Ubah materi"
              >
                ✏️
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm btn-icon"
                title="Hapus materi"
              >
                🗑️
              </button>
            </div>
          </div>
              </div>
            </Fragment>
          );
        })}
      {showForm && (
        <div className={formAsModal ? "modal-overlay" : "pert-material-form-wrap"}>
        <form
          onSubmit={save}
          className={`form pert-material-form${
            formAsModal ? " modal modal-form" : ""
          }`}
        >
          {formAsModal && (
            <div className="modal-head">
              <h3 className="m0">{editingId ? "Ubah Materi" : "Tambah Materi"}</h3>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Tutup
              </button>
            </div>
          )}
          {error && <div className="alert">{error}</div>}
          <label>Pertemuan ke-</label>
          <input
            type="number"
            min="1"
            value={pertemuanKe}
            onChange={(e) => setPertemuanKe(e.target.value)}
            required
          />
          <label>Jenis materi</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {MATERIAL_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <label>Judul</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          {type === "bahanajar" && (
            <>
              <label>Ambil bahan ajar dari kurikulum</label>
              {bahanOptions.length === 0 ? (
                <p className="tiny muted m0">
                  Belum ada bahan ajar kurikulum untuk submateri pertemuan ini.
                </p>
              ) : (
                <>
                  <select value={bahanSub} onChange={(e) => pickBahan(e.target.value)}>
                    <option value="">— Pilih submateri —</option>
                    {bahanOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <p className="tiny muted m0">
                    Materi bacaan otomatis terisi dari kurikulum. Anda tetap bisa
                    menyuntingnya di bawah sebelum menyimpan.
                  </p>
                </>
              )}
              <label>Isi bahan ajar</label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                enableMedia
                placeholder="Pilih submateri di atas atau tulis bahan ajar…"
              />
            </>
          )}
          {type === "text" && (
            <>
              <label>Isi teks</label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                enableMedia
                placeholder="Tulis isi materi…"
              />
            </>
          )}
          {needsLink && (
            <>
              <label>URL</label>
              <input
                type="url"
                placeholder="https://…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </>
          )}
          {isVideo && (
            <>
              <label>Tautan video (opsional)</label>
              <input
                type="url"
                placeholder="https://youtu.be/… atau https://drive.google.com/…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <p className="tiny muted m0">
                Tempel tautan YouTube/Google Drive (hemat penyimpanan) atau
                unggah berkas video di bawah.
              </p>
            </>
          )}
          {needsFile && (
            <>
              <label>
                {isVideo ? "Berkas video (opsional)" : `Berkas (${type})`}
                {editingId ? " — kosongkan bila tak diganti" : ""}
              </label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
              {!isVideo && (
                <>
                  <label>Keterangan (opsional)</label>
                  <input
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </>
              )}
            </>
          )}
          <div className="ce-block">
            <div className="row-between">
              <span className="label-strong">🧠 Cek Pemahaman (opsional)</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={addQuestion}
              >
                + Soal
              </button>
            </div>
            <p className="tiny muted m0">
              Kuis mini pilihan ganda untuk mengukur pemahaman siswa saat belajar
              mandiri. Siswa dianggap paham bila skornya ≥ 70%.
            </p>
            {checkQuestions.map((q, i) => (
              <div className="ce-question" key={i}>
                <div className="row-between">
                  <span className="tiny label-strong">Soal {i + 1}</span>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeQuestion(i)}
                  >
                    Hapus
                  </button>
                </div>
                <input
                  placeholder="Tulis pertanyaan…"
                  value={q.question}
                  onChange={(e) => setQuestionText(i, e.target.value)}
                />
                {q.options.map((opt, oi) => (
                  <div className="ce-option" key={oi}>
                    <input
                      type="radio"
                      name={`correct-${pertemuan}-${i}`}
                      checked={q.correct === oi}
                      onChange={() => setCorrect(i, oi)}
                      title="Tandai sbg kunci jawaban"
                    />
                    <input
                      placeholder={`Pilihan ${oi + 1}`}
                      value={opt}
                      onChange={(e) => setOptionText(i, oi, e.target.value)}
                    />
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeOption(i, oi)}
                        title="Hapus pilihan"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {q.options.length < 5 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => addOption(i)}
                  >
                    + Pilihan
                  </button>
                )}
              </div>
            ))}
            <label className="ce-reflect-toggle">
              <input
                type="checkbox"
                checked={askReflection}
                onChange={(e) => setAskReflection(e.target.checked)}
              />{" "}
              Minta refleksi singkat dari siswa
            </label>
            {askReflection && (
              <input
                placeholder="Pertanyaan refleksi (mis. Apa yang sudah kamu pahami?)"
                value={reflectionPrompt}
                onChange={(e) => setReflectionPrompt(e.target.value)}
              />
            )}
          </div>
          <div className="btn-group">
            <button className="btn btn-primary btn-sm" disabled={busy}>
              {busy ? "Menyimpan…" : editingId ? "Simpan" : "Tambah"}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              Batal
            </button>
          </div>
        </form>
        </div>
      )}
    </div>
  );
}

// Panel acuan Tujuan Pembelajaran yang tampil di dalam form pembuatan
// Materi/Tugas/Kuis. Menampilkan indikator yang sudah dipetakan ke pertemuan
// terpilih agar guru mudah mengacunya tanpa membuka modal terpisah.
// - Materi: `pertemuan` dikendalikan input form (withSelector=false).
// - Tugas/Kuis: withSelector=true → panel punya dropdown pertemuan sendiri.
function LessonObjectives({ subjectId, pertemuan, withSelector = false }) {
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    api
      .listCurriculum(subjectId)
      .then((list) => {
        setItems(list);
        setSel((cur) =>
          cur == null && list.length ? list[0].pertemuan : cur
        );
      })
      .catch(() => setItems([]));
  }, [subjectId]);

  const activePertemuan = withSelector ? sel : Number(pertemuan);
  const match = items.find(
    (it) => Number(it.pertemuan) === Number(activePertemuan)
  );
  const objectives = match?.indicators || [];
  const materiPokok = match?.materiPokok || [];
  const submateri = match?.submateri || [];
  const tema = match?.tema || [];
  const hasAny =
    objectives.length > 0 ||
    materiPokok.length > 0 ||
    submateri.length > 0 ||
    tema.length > 0;

  return (
    <div className="lesson-obj">
      <div className="lesson-obj-head">
        <span className="lesson-obj-label">🎯 Tujuan Pembelajaran</span>
        {withSelector && items.length > 0 && (
          <select
            className="lesson-obj-select"
            value={sel ?? ""}
            onChange={(e) => setSel(Number(e.target.value))}
          >
            {items.map((it) => (
              <option key={it.id} value={it.pertemuan}>
                Pertemuan {it.pertemuan}
                {it.topic ? ` — ${it.topic}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>
      {items.length === 0 ? (
        <div className="muted tiny">
          Belum ada pemetaan. Buka “Acuan Kurikulum” di atas untuk memetakan
          tujuan pembelajaran ke tiap pertemuan.
        </div>
      ) : !match ? (
        <div className="muted tiny">
          Pertemuan {activePertemuan || "?"} belum dipetakan. Petakan lewat
          “Acuan Kurikulum” di atas.
        </div>
      ) : !hasAny ? (
        <div className="muted tiny">
          Pertemuan {match.pertemuan}
          {match.topic ? ` (${match.topic})` : ""} belum memiliki tujuan
          pembelajaran terpilih.
        </div>
      ) : (
        <>
          {match.topic && (
            <div className="lesson-obj-topic">
              Pertemuan {match.pertemuan}: {match.topic}
            </div>
          )}
          {tema.length > 0 && (
            <div className="ref-tags">
              <span className="ref-tags-label">Tema Projek:</span>
              {tema.map((t, i) => (
                <span className="ref-tag ref-tag-tema" key={i}>
                  {t}
                </span>
              ))}
            </div>
          )}
          {submateri.length > 0 && (
            <div className="ref-tags">
              <span className="ref-tags-label">Sub-Materi:</span>
              {submateri.map((s, i) => (
                <span className="ref-tag ref-tag-sub" key={i}>
                  {s}
                </span>
              ))}
            </div>
          )}
          {objectives.length > 0 && (
            <ul className="lesson-obj-list">
              {objectives.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function groupMaterialsByPertemuan(materials) {
  const map = new Map();
  for (const m of materials) {
    const p = Math.max(1, parseInt(m.pertemuan, 10) || 1);
    if (!map.has(p)) map.set(p, []);
    map.get(p).push(m);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

// Kelompokkan entri kurikulum (tiap entri = satu pertemuan) berdasarkan
// Materi Pokok. Mengembalikan array { key, label, materi, items } terurut
// pertemuan; grup tanpa materi pokok diletakkan paling akhir. Untuk kurikulum
// tanpa katalog materi pokok, label memakai topik pertemuan.
export function groupCurriculumByMateri(items) {
  const groups = new Map();
  const sorted = [...items].sort(
    (a, b) => (a.pertemuan || 0) - (b.pertemuan || 0)
  );
  for (const it of sorted) {
    const materi = (it.materiPokok || []).filter(Boolean);
    const label = materi.length ? materi.join(" · ") : it.topic || "";
    const key = label;
    if (!groups.has(key)) groups.set(key, { key, label, materi, items: [] });
    groups.get(key).items.push(it);
  }
  const arr = [...groups.values()];
  arr.sort((a, b) => {
    if (!a.key) return 1;
    if (!b.key) return -1;
    return (a.items[0]?.pertemuan || 0) - (b.items[0]?.pertemuan || 0);
  });
  return arr;
}

// Kelompokkan daftar materi (yang sudah dikelompokkan per pertemuan)
// berdasarkan Materi Pokok pada acuan kurikulum tiap pertemuan.
export function groupMaterialsByMateri(materials, curriculum) {
  const curByP = new Map();
  for (const c of curriculum || []) curByP.set(Number(c.pertemuan), c);
  const byP = groupMaterialsByPertemuan(materials);
  const groups = new Map();
  for (const [p, items] of byP) {
    const cur = curByP.get(Number(p));
    const materi = (cur?.materiPokok || []).filter(Boolean);
    const label = materi.length ? materi.join(" · ") : cur?.topic || "";
    const key = label;
    if (!groups.has(key)) groups.set(key, { key, label, materi, pertemuan: [] });
    groups.get(key).pertemuan.push([p, items]);
  }
  const arr = [...groups.values()];
  arr.sort((a, b) => {
    if (!a.key) return 1;
    if (!b.key) return -1;
    return a.pertemuan[0][0] - b.pertemuan[0][0];
  });
  return arr;
}

// Format tanggal & waktu ke bahasa Indonesia. Aman bila nilai kosong.
export function fmtDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d)) return "-";
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Kotak acuan kurikulum (topik/materi pokok, tema projek, indikator/tujuan)
// yang ditempelkan pada tiap pembelajaran di daftar materi — guru & siswa.
export function AcuanBox({ item, indicators, hideSubmateri, hideHeading = false }) {
  if (!item) return null;
  const objectives = item.indicators || [];
  const tema = (item.tema || []).filter(Boolean);
  const submateri = hideSubmateri
    ? []
    : (item.submateri || []).filter(Boolean);
  const hasAny =
    objectives.length > 0 ||
    tema.length > 0 ||
    submateri.length > 0 ||
    item.description;
  if (!hasAny) return null;
  const objGroups = categorizeObjectives(objectives, indicators);
  return (
    <div className="lesson-obj lesson-obj-inline">
      {!hideHeading && (
        <div className="lesson-obj-head">
          <span className="lesson-obj-label">📋 Acuan Kurikulum</span>
        </div>
      )}
      {item.description && (
        <div className="muted tiny">{item.description}</div>
      )}
      {tema.length > 0 && (
        <div className="ref-tags">
          <span className="ref-tags-label">Tema Projek:</span>
          {tema.map((t, i) => (
            <span className="ref-tag ref-tag-tema" key={i}>
              {t}
            </span>
          ))}
        </div>
      )}
      {submateri.length > 0 && (
        <div className="ref-tags">
          <span className="ref-tags-label">Sub-Materi:</span>
          {submateri.map((s, i) => (
            <span className="ref-tag ref-tag-sub" key={i}>
              {s}
            </span>
          ))}
        </div>
      )}
      {objGroups.length > 0 && <ObjectiveGroups groups={objGroups} />}
    </div>
  );
}

// Label Materi (pokok) & Sub-Materi dari pemetaan kurikulum sebuah pertemuan.
// Dipakai pada daftar Tugas/Kuis yang sudah dibuat.
export function MateriSubMateriTags({ item }) {
  if (!item) return null;
  const materi = (item.materiPokok || []).filter(Boolean);
  const submateri = (item.submateri || []).filter(Boolean);
  if (materi.length === 0 && submateri.length === 0) return null;
  return (
    <div className="materi-sub-tags">
      {materi.length > 0 && (
        <div className="ref-tags">
          <span className="ref-tags-label">Materi:</span>
          {materi.map((m, i) => (
            <span className="ref-tag ref-tag-materi" key={i}>
              {m}
            </span>
          ))}
        </div>
      )}
      {submateri.length > 0 && (
        <div className="ref-tags">
          <span className="ref-tags-label">Sub-Materi:</span>
          {submateri.map((s, i) => (
            <span className="ref-tag ref-tag-sub" key={i}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LearningMonitorPanel({ subjectId }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [openStudent, setOpenStudent] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr(false);
    api
      .learningProgress(subjectId)
      .then((d) => alive && setData(d))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [subjectId]);

  if (err) return <p className="muted">Gagal memuat data belajar mandiri.</p>;
  if (!data) return <p className="muted">Memuat…</p>;

  async function rateRec(materialId, studentId, rating) {
    // Optimistis: perbarui state lokal lalu simpan ke server.
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        students: prev.students.map((s) =>
          s.studentId !== studentId
            ? s
            : {
                ...s,
                records: (s.records || []).map((r) =>
                  r.materialId === materialId ? { ...r, rating } : r
                ),
              }
        ),
      };
    });
    try {
      await api.rateComprehension(materialId, studentId, rating);
    } catch (e) {
      alert(e.message || "Gagal menyimpan penilaian.");
    }
  }

  const { materials, students, materialsTotal } = data;
  const active = students.filter((s) => s.done > 0).length;
  const avg =
    students.length > 0
      ? Math.round(
          students.reduce((a, s) => a + s.percent, 0) / students.length
        )
      : 0;
  const fmt = (iso) => {
    if (!iso) return "—";
    try {
      return fmtDateTime(iso);
    } catch {
      return "—";
    }
  };

  return (
    <div className="stack">
      <div className="card lm-summary">
        <div>
          <h3 className="m0">Pantau Belajar Mandiri</h3>
          <span className="muted tiny">
            {data.className} · {data.subjectName}
          </span>
        </div>
        <div className="lm-summary-stats">
          <div className="lm-stat">
            <span className="lm-stat-num">{active}</span>
            <span className="muted tiny">dari {students.length} siswa aktif</span>
          </div>
          <div className="lm-stat">
            <span className="lm-stat-num">{avg}%</span>
            <span className="muted tiny">rata-rata pemahaman</span>
          </div>
          <div className="lm-stat">
            <span className="lm-stat-num">{materialsTotal}</span>
            <span className="muted tiny">materi aktif</span>
          </div>
        </div>
      </div>

      {materialsTotal === 0 ? (
        <p className="muted">Belum ada materi aktif pada mata pelajaran ini.</p>
      ) : students.length === 0 ? (
        <p className="muted">Belum ada siswa pada kelas ini.</p>
      ) : (
        <div className="card lm-table-wrap">
          <table className="lm-table">
            <thead>
              <tr>
                <th>Siswa</th>
                <th>Progres</th>
                <th className="lm-col-num">Dipahami</th>
                <th>Terakhir belajar</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <Fragment key={s.studentId}>
                  <tr>
                    <td>{s.name}</td>
                    <td className="lm-col-bar">
                      <div className="progress-track lm-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${s.percent}%` }}
                        />
                      </div>
                      <span className="lm-pct">{s.percent}%</span>
                    </td>
                    <td className="lm-col-num">
                      {s.done}/{s.total}
                    </td>
                    <td className="muted tiny">{fmt(s.lastReadAt)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setOpenStudent(
                            openStudent === s.studentId ? null : s.studentId
                          )
                        }
                      >
                        {openStudent === s.studentId ? "Tutup" : "Rincian"}
                      </button>
                    </td>
                  </tr>
                  {openStudent === s.studentId && (
                    <tr className="lm-detail-row">
                      <td colSpan={5}>
                        <ul className="lm-detail-list">
                          {materials.map((m) => {
                            const read = s.readMaterialIds.includes(m.id);
                            const rec = (s.records || []).find(
                              (r) => r.materialId === m.id
                            );
                            return (
                              <li key={m.id} className={read ? "read" : ""}>
                                <span className="lm-check">
                                  {read ? "✓" : "○"}
                                </span>
                                <span className="muted tiny">
                                  P{m.pertemuan}
                                </span>{" "}
                                {m.title}
                                {rec && rec.total > 0 && (
                                  <span
                                    className={`badge ${
                                      rec.passed ? "badge-done" : "badge-off"
                                    }`}
                                  >
                                    {rec.score}/{rec.total}
                                  </span>
                                )}
                                {m.hasCheck && (
                                  <span className="muted tiny">
                                    {" "}
                                    · rata {m.avgScorePct == null
                                      ? "—"
                                      : `${m.avgScorePct}%`}
                                  </span>
                                )}
                                {rec && rec.reflection && (
                                  <div className="lm-reflection">
                                    💬 {rec.reflection}
                                  </div>
                                )}
                                {rec && (
                                  <div className="lm-rate">
                                    <span className="muted tiny">
                                      Nilai pemahaman:
                                    </span>
                                    {[
                                      { v: "sangat", label: "Sangat Paham" },
                                      { v: "paham", label: "Paham" },
                                      { v: "belum", label: "Belum Paham" },
                                    ].map((opt) => (
                                      <button
                                        key={opt.v}
                                        type="button"
                                        className={`lm-rate-btn ${
                                          rec.rating === opt.v ? "active" : ""
                                        }`}
                                        onClick={() =>
                                          rateRec(
                                            m.id,
                                            s.studentId,
                                            rec.rating === opt.v ? "" : opt.v
                                          )
                                        }
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h4 className="m0" style={{ marginBottom: "0.6rem" }}>
          Materi yang paling banyak dipahami
        </h4>
        <div className="stack">
          {materials.map((m) => (
            <div className="lm-material-row" key={m.id}>
              <span className="lm-material-title">
                <span className="muted tiny">P{m.pertemuan}</span> {m.title}
              </span>
              <div className="progress-track lm-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${
                      students.length
                        ? Math.round((m.readCount / students.length) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
              <span className="lm-material-count muted tiny">
                {m.readCount}/{students.length}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Satu grup "Pembelajaran" pada daftar Materi Kelas guru: judul dapat diklik
// untuk buka/tutup, sub-materi tampil di samping judul. Default tertutup.
function TeacherLessonGroup({
  p,
  items,
  cur,
  indicators,
  subjectId,
  subBahanMap = {},
  onChange,
  onEditLesson,
  onDeleteLesson,
}) {
  const [open, setOpen] = useState(false);
  const [autoCreate, setAutoCreate] = useState(0);
  const submateri = (cur?.submateri || []).filter(Boolean);
  const done = items.length > 0 && items.every((m) => m.completed);
  return (
    <div className="pertemuan-group">
      <div className="pertemuan-head">
        <button
          type="button"
          className="pertemuan-head-btn"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="pertemuan-caret">{open ? "▾" : "▸"}</span>
          <span className="pertemuan-title">Pembelajaran {p}</span>
          {done && (
            <span className="badge badge-done pertemuan-done">✓ Selesai</span>
          )}
          {submateri.length > 0 && (
            <span className="pertemuan-sub">
              {submateri.map((s, i) => (
                <span className="ref-tag ref-tag-sub" key={i}>
                  {s}
                </span>
              ))}
            </span>
          )}
        </button>
        <span className="pertemuan-actions btn-group">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setOpen(true);
              setAutoCreate((c) => c + 1);
            }}
            title="Tambah materi pada pembelajaran ini"
          >
            + Materi
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => onEditLesson && onEditLesson(cur)}
            title="Ubah pembelajaran ini"
            aria-label="Ubah pembelajaran ini"
          >
            ✏️
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm btn-icon"
            onClick={() => onDeleteLesson && onDeleteLesson(p, cur, items)}
            title="Hapus pembelajaran ini"
            aria-label="Hapus pembelajaran ini"
          >
            🗑
          </button>
        </span>
      </div>
      {open && (
        <>
          <AcuanBox item={cur} indicators={indicators} hideSubmateri hideHeading />
          <MaterialManager
            subjectId={subjectId}
            pertemuan={p}
            materials={items}
            onChange={onChange}
            submateriOptions={submateri}
            subBahanMap={subBahanMap}
            hideHead
            autoCreate={autoCreate}
            formAsModal
          />
        </>
      )}
    </div>
  );
}

// Modal pemilih Materi Pokok (dari kurikulum aktif) untuk membuat grup materi.
// Materi Pokok baru dibuat lewat Master Kurikulum (admin); di sini hanya memilih.
function MateriPokokPicker({ options, selected, onClose, onSave }) {
  const [chosen, setChosen] = useState(() => new Set(selected || []));
  const [busy, setBusy] = useState(false);
  const list = (options || []).filter(Boolean);
  const toggle = (name) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  async function save() {
    setBusy(true);
    try {
      await onSave([...chosen]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3 className="m0">Tambah Materi Pokok</h3>
          <button className="btn btn-sm" onClick={onClose}>
            Tutup
          </button>
        </div>
        <p className="muted tiny">
          Pilih Materi Pokok dari kurikulum aktif. Materi Pokok baru ditambahkan
          lewat Master Kurikulum (admin).
        </p>
        {list.length === 0 ? (
          <p className="muted">
            Belum ada Materi Pokok pada kurikulum aktif kelas ini.
          </p>
        ) : (
          <div className="indicator-check-grid">
            {list.map((name) => (
              <label
                className={`indicator-check${
                  chosen.has(name) ? " is-checked" : ""
                }`}
                key={name}
              >
                <input
                  type="checkbox"
                  checked={chosen.has(name)}
                  onChange={() => toggle(name)}
                />
                <span>{name}</span>
              </label>
            ))}
          </div>
        )}
        <div className="btn-group" style={{ marginTop: "0.8rem" }}>
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={busy || list.length === 0}
          >
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

function MaterialsPanel({ subjectId }) {
  const [materials, setMaterials] = useState([]);
  const [lessonStates, setLessonStates] = useState([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageMateri, setManageMateri] = useState(null);
  const [manageEditItem, setManageEditItem] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savedMateri, setSavedMateri] = useState([]);
  const [active, setActive] = useState(null);
  const [curriculum, setCurriculum] = useState([]);

  const load = () => api.listMaterials(subjectId).then(setMaterials).catch(() => {});
  const loadStates = () =>
    api.listLessonStates(subjectId).then(setLessonStates).catch(() => {});
  const loadActive = () =>
    api.activeCurriculum(subjectId).then(setActive).catch(() => setActive(null));
  const loadCurriculum = () =>
    api.listCurriculum(subjectId).then(setCurriculum).catch(() => setCurriculum([]));
  const loadSavedMateri = () =>
    api
      .getSubject(subjectId)
      .then((s) => setSavedMateri(Array.isArray(s.materiPokok) ? s.materiPokok : []))
      .catch(() => setSavedMateri([]));
  useEffect(() => {
    load();
    loadStates();
    loadActive();
    loadCurriculum();
    loadSavedMateri();
  }, [subjectId]);

  const curFor = (p) =>
    curriculum.find((c) => Number(c.pertemuan) === Number(p));

  // Pembelajaran aktif secara default; hanya yang bercatat active===false nonaktif.
  const isLessonActive = (p) => {
    const st = lessonStates.find((s) => Number(s.pertemuan) === Number(p));
    return st ? st.active !== false : true;
  };
  async function toggleLesson(p) {
    const next = !isLessonActive(p);
    await api.setLessonState(subjectId, p, next);
    loadStates();
  }
  // Pengajar menandai materi telah selesai.
  async function toggleComplete(m) {
    await api.setMaterialCompleted(m.id, !m.completed);
    load();
  }
  // Pengajar mengaktifkan / menonaktifkan sebuah materi.
  async function toggleActive(m) {
    await api.setMaterialActive(m.id, m.active === false);
    load();
  }
  // Pengajar menampilkan / menyembunyikan materi dari menu Belajar Mandiri.
  async function toggleSelfLearn(m) {
    await api.setMaterialSelfLearn(m.id, m.selfLearn === false);
    load();
  }
  async function del(id) {
    if (!confirm("Hapus materi ini?")) return;
    await api.deleteMaterial(id);
    load();
  }

  // Buka form tambah pertemuan untuk sebuah Materi Pokok (materi pokok terpilih).
  function addPertemuan(g) {
    setManageEditItem(null);
    setManageMateri(g.materi && g.materi.length ? g.materi : [g.label]);
    setManageOpen(true);
  }
  // Buka form untuk mengubah sebuah pembelajaran (pertemuan) tertentu.
  function editLesson(cur) {
    if (!cur) return;
    setManageMateri(null);
    setManageEditItem(cur);
    setManageOpen(true);
  }
  // Hapus sebuah pembelajaran (pertemuan) beserta materinya.
  async function deleteLesson(p, cur, items) {
    if (!confirm(`Hapus Pembelajaran ${p} beserta materinya?`)) return;
    for (const m of items || []) {
      await api.deleteMaterial(m.id).catch(() => {});
    }
    if (cur) await api.deleteCurriculum(cur.id).catch(() => {});
    load();
    loadCurriculum();
    loadStates();
  }
  // Hapus sebuah Materi Pokok beserta seluruh pertemuan & materinya.
  async function deleteMateriPokok(g) {
    const hasPertemuan = g.pertemuan.length > 0;
    const msg = hasPertemuan
      ? `Hapus Materi Pokok "${g.label}" beserta ${g.pertemuan.length} pertemuan & materinya?`
      : `Hapus Materi Pokok "${g.label}"?`;
    if (!confirm(msg)) return;
    // Hapus materi & pemetaan kurikulum tiap pertemuan pada grup ini.
    for (const [p] of g.pertemuan) {
      for (const m of materials.filter(
        (m) => Number(m.pertemuan) === Number(p)
      )) {
        await api.deleteMaterial(m.id).catch(() => {});
      }
      const cur = curFor(p);
      if (cur) await api.deleteCurriculum(cur.id).catch(() => {});
    }
    // Keluarkan dari daftar Materi Pokok mapel.
    const names = new Set(g.materi && g.materi.length ? g.materi : [g.label]);
    const next = savedMateri.filter((n) => !names.has(n));
    await api.setSubjectMateriPokok(subjectId, next).catch(() => {});
    load();
    loadCurriculum();
    loadStates();
    loadSavedMateri();
  }

  // Grup dibangun dari kurikulum (tiap pertemuan) + Materi Pokok pilihan guru.
  // Materi dilampirkan ke pertemuannya. Grup tanpa Materi Pokok tak ditampilkan.
  const materialsByP = new Map();
  for (const [p, items] of groupMaterialsByPertemuan(materials))
    materialsByP.set(Number(p), items);
  const groupsMap = new Map();
  for (const c of curriculum) {
    const materi = (c.materiPokok || []).filter(Boolean);
    const label = materi.length ? materi.join(" · ") : c.topic || "";
    if (!label) continue;
    if (!groupsMap.has(label))
      groupsMap.set(label, { key: label, label, materi, pertemuan: [] });
    groupsMap
      .get(label)
      .pertemuan.push([c.pertemuan, materialsByP.get(Number(c.pertemuan)) || []]);
  }
  for (const name of savedMateri) {
    if (name && !groupsMap.has(name))
      groupsMap.set(name, { key: name, label: name, materi: [name], pertemuan: [] });
  }
  const mergedGroups = [...groupsMap.values()]
    .map((g) => ({
      ...g,
      pertemuan: [...g.pertemuan].sort((a, b) => a[0] - b[0]),
    }))
    .sort((a, b) => {
      const pa = a.pertemuan[0]?.[0] ?? Infinity;
      const pb = b.pertemuan[0]?.[0] ?? Infinity;
      return pa - pb;
    });
  // Jumlah materi yang benar-benar tampil (di bawah grup Materi Pokok).
  const visibleMaterialCount = mergedGroups.reduce(
    (sum, g) =>
      sum + g.pertemuan.reduce((s, [, items]) => s + items.length, 0),
    0
  );
  // Peta submateri → bahan ajar (untuk isi otomatis saat menambah materi).
  const subBahanMap = {};
  (active?.materiDetail || []).forEach((m) =>
    (m.submateri || []).forEach((s) => {
      if (s && s.nama && s.bahanAjar) subBahanMap[s.nama] = s.bahanAjar;
    })
  );

  return (
    <>
      <div className="card">
        <div className="row-between">
          <h3>Materi Kelas ({visibleMaterialCount})</h3>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setPickerOpen(true)}
          >
            + Tambah Materi Pokok
          </button>
        </div>
        <p className="muted tiny">
          Pilih Materi Pokok dari kurikulum lewat tombol di atas untuk membuat
          grup. Tambah pembelajaran dengan tombol “+ Pembelajaran”, atau hapus
          Materi Pokok dengan tombol “🗑 Hapus” pada masing-masing grup.
        </p>
        <div className="stack">
          {mergedGroups.map((g) => (
            <div className="materi-group" key={g.key || "__no-materi__"}>
              <div className="materi-group-head">
                <span className="materi-group-title">
                  {g.label ? `📚 ${g.label}` : "Tanpa Materi Pokok"}
                </span>
                <span className="materi-group-actions">
                  <span className="materi-count">
                    {g.pertemuan.length} pembelajaran
                  </span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => addPertemuan(g)}
                    title="Tambah pembelajaran pada Materi Pokok ini"
                  >
                    + Pembelajaran
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteMateriPokok(g)}
                    title="Hapus Materi Pokok ini"
                  >
                    🗑 Hapus
                  </button>
                </span>
              </div>
              {g.pertemuan.length === 0 && (
                <p className="muted tiny materi-group-empty">
                  Belum ada pembelajaran. Klik “+ Pembelajaran” untuk menambah.
                </p>
              )}
              {g.pertemuan.map(([p, items]) => (
                <TeacherLessonGroup
                  key={p}
                  p={p}
                  items={items}
                  cur={curFor(p)}
                  indicators={active?.indicators}
                  subjectId={subjectId}
                  subBahanMap={subBahanMap}
                  onChange={() => {
                    load();
                    loadCurriculum();
                  }}
                  onEditLesson={editLesson}
                  onDeleteLesson={deleteLesson}
                />
              ))}
            </div>
          ))}
          {mergedGroups.length === 0 && (
            <p className="muted">
              Belum ada Materi Pokok. Klik “+ Tambah Materi Pokok”.
            </p>
          )}
        </div>
      </div>
      {pickerOpen && (
        <MateriPokokPicker
          options={active?.materiPokok || []}
          selected={savedMateri}
          onClose={() => setPickerOpen(false)}
          onSave={async (list) => {
            await api.setSubjectMateriPokok(subjectId, list);
            setPickerOpen(false);
            loadSavedMateri();
          }}
        />
      )}
      {manageOpen && (
        <CurriculumMapper
          subjectId={subjectId}
          active={active}
          initialMateri={manageMateri}
          editItem={manageEditItem}
          closeOnAdd
          onClose={() => {
            setManageOpen(false);
            setManageMateri(null);
            setManageEditItem(null);
            load();
            loadStates();
            loadCurriculum();
          }}
        />
      )}
    </>
  );
}

export function MaterialBody({ m }) {
  if (m.type === "text" || m.type === "bahanajar")
    return <RichText html={m.content} />;
  if (m.type === "link")
    return (
      <a href={m.content} target="_blank" rel="noreferrer">
        {m.content}
      </a>
    );
  if (m.type === "image" && m.fileUrl)
    return <MaterialImage src={m.fileUrl} alt={m.title} />;
  if (m.type === "video") {
    if (m.fileUrl)
      return <video className="material-img" src={m.fileUrl} controls />;
    if (m.content) return <VideoEmbed url={m.content} />;
    return null;
  }
  if (m.fileUrl)
    return (
      <div>
        {m.content && <p>{m.content}</p>}
        <FilePreview url={m.fileUrl} name={m.fileName || "Berkas"} />
      </div>
    );
  return m.content ? <p>{m.content}</p> : null;
}

function VideoEmbed({ url }) {
  const src = (url || "").trim();
  if (!src) return null;
  // Berkas video langsung (.mp4/.webm/.ogg) → putar dengan <video>.
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i.test(src))
    return <video className="material-img" src={src} controls />;
  const embed = toVideoEmbedUrl(src);
  if (embed)
    return (
      <div className="video-embed-wrap">
        <iframe
          className="video-embed"
          src={embed}
          title="Video pembelajaran"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  // Tidak dikenali → tampilkan sebagai tautan.
  return (
    <a href={src} target="_blank" rel="noreferrer">
      {src}
    </a>
  );
}

// Ubah URL YouTube/Google Drive menjadi URL embed. Mengembalikan null bila
// tidak dikenali.
function toVideoEmbedUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    // YouTube
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname.startsWith("/embed/")) return url;
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith("/shorts/"))
        return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
      return null;
    }
    // Google Drive
    if (host === "drive.google.com") {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      const id = m ? m[1] : u.searchParams.get("id");
      return id ? `https://drive.google.com/file/d/${id}/preview` : null;
    }
    // Vimeo
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

function MaterialImage({ src, alt }) {
  const [zoom, setZoom] = useState(false);
  return (
    <div className="material-img-wrap">
      <img
        className="material-img material-img-thumb"
        src={src}
        alt={alt}
        onClick={() => setZoom(true)}
        title="Klik untuk memperbesar"
      />
      <div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setZoom(true)}
        >
          🔍 Perbesar
        </button>
      </div>
      {zoom &&
        createPortal(
          <div className="lightbox-overlay" onClick={() => setZoom(false)}>
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setZoom(false)}
              aria-label="Tutup"
            >
              ✕
            </button>
            <img
              className="lightbox-img"
              src={src}
              alt={alt}
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </div>
  );
}

/* ---------------- Tugas & Nilai ---------------- */
// Pilihan jenis tugas yang dapat dipilih pengajar saat membuat tugas.
const ASSIGNMENT_TYPES = [
  "Soal Essay",
  "Pilihan Ganda",
  "Proyek",
  "Pemecahan Masalah",
  "Praktik",
  "Presentasi",
  "Diskusi",
  "Laporan",
  "Lainnya",
];

function AssignmentsPanel({ subjectId }) {
  const [assignments, setAssignments] = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [form, setForm] = useState({
    title: "",
    type: "",
    description: "",
    dueDate: "",
    pertemuan: 1,
    materialId: "",
    stages: [],
  });
  const [openId, setOpenId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    api.listAssignments(subjectId).then(setAssignments).catch(() => {});
  useEffect(() => {
    load();
    api.listCurriculum(subjectId).then(setCurriculum).catch(() => setCurriculum([]));
    api.listMaterials(subjectId).then(setMaterials).catch(() => setMaterials([]));
  }, [subjectId]);
  const curFor = (p) =>
    curriculum.find((c) => Number(c.pertemuan) === Number(p));
  const materialById = (id) => materials.find((m) => m.id === id);

  function resetForm() {
    setEditingId(null);
    setForm({ title: "", type: "", description: "", dueDate: "", pertemuan: 1, materialId: "", stages: [] });
    setError("");
  }
  function openCreate() {
    resetForm();
    setShowForm(true);
  }
  function openEdit(a) {
    setEditingId(a.id);
    setForm({
      title: a.title || "",
      type: a.type || "",
      description: a.description || "",
      dueDate: a.dueDate || "",
      pertemuan: a.pertemuan || 1,
      materialId: a.materialId || "",
      stages: Array.isArray(a.stages) ? a.stages : [],
    });
    setError("");
    setShowForm(true);
  }

  // Pengelolaan tahapan untuk tugas jenis Proyek.
  function addStage() {
    setForm((f) => ({
      ...f,
      stages: [
        ...(f.stages || []),
        {
          id: `s${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
          title: "",
          description: "",
        },
      ],
    }));
  }
  function updateStage(i, key, val) {
    setForm((f) => {
      const stages = [...(f.stages || [])];
      stages[i] = { ...stages[i], [key]: val };
      return { ...f, stages };
    });
  }
  function removeStage(i) {
    setForm((f) => ({
      ...f,
      stages: (f.stages || []).filter((_, idx) => idx !== i),
    }));
  }

  async function add(e) {
    e.preventDefault();
    setError("");
    try {
      if (editingId) await api.updateAssignment(editingId, form);
      else await api.createAssignment({ subjectId, ...form });
      resetForm();
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function del(id) {
    if (!confirm("Hapus tugas & semua pengumpulannya?")) return;
    await api.deleteAssignment(id);
    load();
  }
  async function toggleActive(a) {
    await api.setAssignmentActive(a.id, a.active === false);
    load();
  }
  async function toggleComplete(a) {
    await api.setAssignmentCompleted(a.id, !a.completed);
    load();
  }

  return (
    <>
    <div className={showForm ? "grid-2" : ""}>
      {showForm && (
      <div className="card">
        <div className="row-between">
          <h3>{editingId ? "Ubah Tugas" : "Buat Tugas"}</h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              resetForm();
              setShowForm(false);
            }}
          >
            Tutup
          </button>
        </div>
        {error && <div className="alert">{error}</div>}
        <form onSubmit={add} className="form">
          <label>Tugas ke-</label>
          <input
            type="number"
            min="1"
            value={form.pertemuan}
            onChange={(e) =>
              setForm({ ...form, pertemuan: e.target.value })
            }
            required
          />
          <LessonObjectives subjectId={subjectId} pertemuan={form.pertemuan} />
          <label>Judul</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <label>Jenis tugas</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="">— pilih jenis —</option>
            {ASSIGNMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label>Materi terkait</label>
          <select
            value={form.materialId}
            onChange={(e) => setForm({ ...form, materialId: e.target.value })}
          >
            <option value="">— tanpa materi —</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.pertemuan ? `Pertemuan ${m.pertemuan} · ` : ""}
                {m.title}
              </option>
            ))}
          </select>
          {materials.length === 0 && (
            <p className="muted tiny m0">
              Belum ada materi pada mata pelajaran ini.
            </p>
          )}
          <label>Deskripsi / tautan proyek</label>
          <RichTextEditor
            value={form.description}
            onChange={(html) => setForm((f) => ({ ...f, description: html }))}
            placeholder="Tulis instruksi tugas… gunakan tombol format di atas."
          />
          {form.type === "Proyek" && (
            <div className="stages-editor">
              <div className="row-between">
                <label className="m0">Tahapan proyek</label>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={addStage}
                >
                  + Tambah tahapan
                </button>
              </div>
              <p className="muted tiny m0">
                Langkah-langkah yang wajib diselesaikan siswa secara berurutan.
              </p>
              {(form.stages || []).length === 0 && (
                <p className="stages-empty tiny muted m0">
                  Belum ada tahapan. Klik "+ Tambah tahapan" untuk menambah
                  langkah yang wajib diselesaikan siswa.
                </p>
              )}
              {(form.stages || []).map((s, i) => (
                <div className="stage-row" key={s.id || i}>
                  <div className="stage-num">{i + 1}</div>
                  <div className="stage-fields">
                    <input
                      className="stage-title-input"
                      placeholder={`Judul tahapan ${i + 1}`}
                      value={s.title}
                      onChange={(e) => updateStage(i, "title", e.target.value)}
                    />
                    <textarea
                      rows={2}
                      placeholder="Keterangan (opsional)"
                      value={s.description}
                      onChange={(e) =>
                        updateStage(i, "description", e.target.value)
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm stage-del"
                    onClick={() => removeStage(i)}
                    title="Hapus tahapan"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <label>Batas waktu</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
          <button className="btn btn-primary">
            {editingId ? "Simpan Perubahan" : "Buat Tugas"}
          </button>
        </form>
      </div>
      )}

      <div className="card">
        <div className="row-between">
          <h3>Tugas ({assignments.length})</h3>
          {!showForm && (
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              + Buat Tugas
            </button>
          )}
        </div>
        <div className="stack">
          {groupMaterialsByPertemuan(assignments).map(([p, items]) => (
            <div className="pertemuan-group" key={p}>
              <div className="pertemuan-group-head">Tugas {p}</div>
              <MateriSubMateriTags item={curFor(p)} />
              {items.map((a) => (
                <details className="card material asg-item" key={a.id}>
                  <summary className="material-summary">
                    <b>{a.title}</b>
                    <span className="asg-meta">
                      {a.active === false && (
                        <span className="badge badge-off">Belum dibagikan</span>
                      )}
                      {a.completed && (
                        <span className="badge badge-done">✓ Selesai</span>
                      )}
                      {a.type && <span className="asg-chip">🏷️ {a.type}</span>}
                      {a.materialId && materialById(a.materialId) && (
                        <span className="asg-chip">
                          📚 {materialById(a.materialId).title}
                        </span>
                      )}
                      <span className="asg-chip">
                        📅 {a.dueDate ? `Batas ${a.dueDate}` : "Tanpa batas"}
                      </span>
                    </span>
                  </summary>
                  <div className="asg-head">
                    <div className="asg-title-wrap">
                      <div className="asg-meta">
                        <span className="asg-chip">
                          🕐 Dibuat {fmtDateTime(a.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="btn-group btn-group-icons asg-actions">
                      <button
                        className={`btn btn-sm btn-icon ${
                          a.active === false ? "btn-primary" : "btn-ghost"
                        }`}
                        onClick={() => toggleActive(a)}
                        title={
                          a.active === false
                            ? "Bagikan tugas ini ke siswa"
                            : "Sembunyikan tugas ini dari siswa"
                        }
                      >
                        {a.active === false ? "📢" : "🔕"}
                      </button>
                      <button
                        className={`btn btn-sm btn-icon ${
                          a.completed ? "btn-ghost" : "btn-primary"
                        }`}
                        onClick={() => toggleComplete(a)}
                        title={a.completed ? "Batalkan selesai" : "Tandai selesai"}
                      >
                        {a.completed ? "↺" : "✓"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => openEdit(a)}
                        title="Ubah tugas"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-danger btn-sm btn-icon"
                        onClick={() => del(a.id)}
                        title="Hapus tugas"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  {a.description && <RichText html={a.description} />}
                  {a.type === "Proyek" &&
                    Array.isArray(a.stages) &&
                    a.stages.length > 0 && (
                      <div className="stage-checklist">
                        <label className="m0">
                          Tahapan proyek ({a.stages.length})
                        </label>
                        {a.stages.map((s, i) => (
                          <div className="stage-check" key={s.id || i}>
                            <span className="stage-num">{i + 1}</span>
                            <span className="stage-check-body">
                              <b>{s.title}</b>
                              {s.description && (
                                <span className="tiny muted">
                                  {s.description}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  <button
                    type="button"
                    className={`btn btn-sm asg-subs-toggle ${
                      openId === a.id ? "btn-ghost" : "btn-primary"
                    }`}
                    onClick={() => setOpenId(openId === a.id ? null : a.id)}
                  >
                    {openId === a.id
                      ? "▲ Tutup Pengumpulan"
                      : "📥 Lihat Pengumpulan Tugas"}
                  </button>
                  {openId === a.id && (
                    <Submissions assignmentId={a.id} assignment={a} />
                  )}
                  <Comments targetType="assignment" targetId={a.id} />
                </details>
              ))}
            </div>
          ))}
          {assignments.length === 0 && (
            <p className="muted">Belum ada tugas.</p>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

function Submissions({ assignmentId, assignment }) {
  const [subs, setSubs] = useState([]);
  const load = () =>
    api.listSubmissions(assignmentId).then(setSubs).catch(() => {});
  useEffect(() => {
    load();
  }, [assignmentId]);

  async function saveGrade(id, grade, feedback) {
    await api.grade(id, grade, feedback);
    load();
  }

  async function verifyStage(id, stageId, verified) {
    await api.verifyStage(id, stageId, verified);
    load();
  }

  return (
    <div className="subs">
      {subs.length === 0 && <p className="muted tiny">Belum ada pengumpulan.</p>}
      {subs.map((s) => (
        <SubmissionRow
          key={s.id}
          s={s}
          onSave={saveGrade}
          onVerify={verifyStage}
          assignment={assignment}
        />
      ))}
    </div>
  );
}

function SubmissionRow({ s, onSave, onVerify, assignment }) {
  const [grade, setGrade] = useState(s.grade ?? "");
  const [feedback, setFeedback] = useState(s.feedback ?? "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const stages =
    assignment && Array.isArray(assignment.stages) ? assignment.stages : [];
  const done = Array.isArray(s.stagesDone) ? s.stagesDone.map(String) : [];
  const verify = s.stageVerify || {};
  const [vBusy, setVBusy] = useState("");

  async function handleSave() {
    setBusy(true);
    setStatus("");
    try {
      await onSave(s.id, grade, feedback);
      setStatus("ok");
    } catch (err) {
      setStatus(err?.message || "Gagal menyimpan nilai.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleVerify(stageId, next) {
    setVBusy(String(stageId));
    try {
      await onVerify(s.id, stageId, next);
    } catch {
      /* diabaikan */
    } finally {
      setVBusy("");
    }
  }

  return (
    <div className="sub-row">
      <div className="row-between">
        <b>{s.studentName}</b>
        <span className="muted tiny">
          {new Date(s.submittedAt).toLocaleString("id-ID")}
        </span>
      </div>
      {s.text && <p className="pre m0">{s.text}</p>}
      {assignment && assignment.materialId && (
        <div className="stage-progress tiny">
          <div
            className={`stage-progress-item ${
              done.includes("__material__") ? "done" : ""
            }`}
          >
            <div className="stage-progress-head">
              {done.includes("__material__") ? "✓" : "○"}{" "}
              <b>Memahami materi</b>
            </div>
          </div>
        </div>
      )}
      {stages.length > 0 && (
        <div className="stage-progress tiny">
          <b>
            Tahapan: {stages.filter((st) => verify[String(st.id)]).length}/
            {stages.length} diverifikasi
          </b>
          <div className="stage-progress-list">
            {stages.map((st, i) => {
              const sid = String(st.id);
              const isDone = done.includes(sid);
              const isVerified = !!verify[sid];
              const sd =
                s.stageData && s.stageData[sid] ? s.stageData[sid] : null;
              return (
                <div
                  key={st.id || i}
                  className={`stage-progress-item ${
                    isVerified ? "verified" : isDone ? "done" : ""
                  }`}
                >
                  <div className="stage-progress-head">
                    {isVerified ? "✓" : isDone ? "⏳" : "○"} <b>{st.title}</b>
                  </div>
                  {sd && sd.text && <p className="pre m0">{sd.text}</p>}
                  {sd && sd.fileUrl && (
                    <FilePreview url={sd.fileUrl} name={sd.fileName} />
                  )}
                  <div className="stage-verify-row">
                    {isVerified ? (
                      <>
                        <span className="stage-badge verified">
                          ✓ Terverifikasi
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={vBusy === sid}
                          onClick={() => toggleVerify(sid, false)}
                        >
                          Batalkan
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={vBusy === sid || !isDone}
                        onClick={() => toggleVerify(sid, true)}
                        title={
                          isDone
                            ? "Verifikasi tahapan ini"
                            : "Siswa belum menyelesaikan tahapan ini"
                        }
                      >
                        {isDone ? "Verifikasi tahapan" : "Belum dikerjakan"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {s.fileUrl && (
        <FilePreview url={s.fileUrl} name={s.fileName || "Berkas"} />
      )}
      <div className="grade-row">
        <input
          className="grade-input"
          placeholder="Nilai"
          value={grade}
          onChange={(e) => {
            setGrade(e.target.value);
            setStatus("");
          }}
        />
        <input
          className="feedback-input"
          placeholder="Umpan balik"
          value={feedback}
          onChange={(e) => {
            setFeedback(e.target.value);
            setStatus("");
          }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={busy}
        >
          {busy ? "Menyimpan…" : "Simpan Nilai"}
        </button>
      </div>
      {status === "ok" && (
        <p className="grade-status ok tiny m0">✓ Nilai tersimpan.</p>
      )}
      {status && status !== "ok" && (
        <p className="grade-status err tiny m0">{status}</p>
      )}
    </div>
  );
}

/* ---------------- Kuis ---------------- */
function emptyQuestion() {
  return { text: "", options: ["", ""], correctIndex: 0 };
}

function QuizPanel({ subjectId }) {
  const [quizzes, setQuizzes] = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [pertemuan, setPertemuan] = useState(1);
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = () => api.listQuizzes(subjectId).then(setQuizzes).catch(() => {});
  useEffect(() => {
    load();
    api.listCurriculum(subjectId).then(setCurriculum).catch(() => setCurriculum([]));
  }, [subjectId]);
  const curFor = (p) =>
    curriculum.find((c) => Number(c.pertemuan) === Number(p));

  function setQ(i, patch) {
    setQuestions((qs) => qs.map((q, j) => (i === j ? { ...q, ...patch } : q)));
  }
  function setOpt(qi, oi, value) {
    setQuestions((qs) =>
      qs.map((q, j) =>
        j === qi
          ? { ...q, options: q.options.map((o, k) => (k === oi ? value : o)) }
          : q
      )
    );
  }
  function addOption(qi) {
    setQuestions((qs) =>
      qs.map((q, j) => (j === qi ? { ...q, options: [...q.options, ""] } : q))
    );
  }
  function removeOption(qi, oi) {
    setQuestions((qs) =>
      qs.map((q, j) => {
        if (j !== qi) return q;
        const options = q.options.filter((_, k) => k !== oi);
        const correctIndex = Math.min(q.correctIndex, options.length - 1);
        return { ...q, options, correctIndex };
      })
    );
  }

  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      const payload = { title, description, durationMinutes, pertemuan, questions };
      if (editingId) await api.updateQuiz(editingId, payload);
      else await api.createQuiz({ subjectId, ...payload });
      resetForm();
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }
  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setDurationMinutes(0);
    setPertemuan(1);
    setQuestions([emptyQuestion()]);
    setError("");
  }
  function openCreate() {
    resetForm();
    setShowForm(true);
  }
  function openEdit(q) {
    setEditingId(q.id);
    setTitle(q.title || "");
    setDescription(q.description || "");
    setDurationMinutes(q.durationMinutes || 0);
    setPertemuan(q.pertemuan || 1);
    setQuestions(
      (q.questions || []).map((it) => ({
        id: it.id,
        text: it.text || "",
        options: [...(it.options || ["", ""])],
        correctIndex: it.correctIndex ?? 0,
      }))
    );
    setError("");
    setShowForm(true);
  }
  async function del(id) {
    if (!confirm("Hapus kuis & semua hasilnya?")) return;
    await api.deleteQuiz(id);
    load();
  }
  async function toggleActive(q) {
    await api.setQuizActive(q.id, q.active === false);
    load();
  }
  async function toggleComplete(q) {
    await api.setQuizCompleted(q.id, !q.completed);
    load();
  }

  return (
    <>
    <div className={showForm ? "grid-2" : ""}>
      {showForm && (
      <div className="card">
        <div className="row-between">
          <h3>{editingId ? "Ubah Kuis" : "Buat Kuis"}</h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              resetForm();
              setShowForm(false);
            }}
          >
            Tutup
          </button>
        </div>
        {error && <div className="alert">{error}</div>}
        <form onSubmit={create} className="form">
          <label>Kuis ke-</label>
          <input
            type="number"
            min="1"
            value={pertemuan}
            onChange={(e) => setPertemuan(e.target.value)}
            required
          />
          <LessonObjectives subjectId={subjectId} pertemuan={pertemuan} />
          <label>Judul</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          <label>Deskripsi</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label>Batas waktu (menit, 0 = tanpa batas)</label>
          <input
            type="number"
            min="0"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />

          {questions.map((q, qi) => (
            <div className="qbuilder" key={qi}>
              <div className="row-between">
                <b>Soal {qi + 1}</b>
                {questions.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      setQuestions((qs) => qs.filter((_, j) => j !== qi))
                    }
                  >
                    Hapus soal
                  </button>
                )}
              </div>
              <input
                placeholder="Tulis pertanyaan"
                value={q.text}
                onChange={(e) => setQ(qi, { text: e.target.value })}
                required
              />
              <div className="muted tiny opt-hint">
                Pilih tombol <b>Kunci</b> pada jawaban yang benar:
              </div>
              {q.options.map((o, oi) => {
                const isKey = q.correctIndex === oi;
                return (
                  <div
                    className={`opt-row ${isKey ? "opt-correct" : ""}`}
                    key={oi}
                  >
                    <label
                      className="opt-key"
                      title="Tandai sebagai kunci jawaban"
                    >
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={isKey}
                        onChange={() => setQ(qi, { correctIndex: oi })}
                      />
                      {isKey ? "✓ Kunci" : "Kunci"}
                    </label>
                    <input
                      placeholder={`Pilihan ${oi + 1}`}
                      value={o}
                      onChange={(e) => setOpt(qi, oi, e.target.value)}
                      required
                    />
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeOption(qi, oi)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => addOption(qi)}
              >
                + Pilihan
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}
          >
            + Tambah Soal
          </button>
          <div className="muted tiny">
            Tandai satu <b>Kunci</b> jawaban di tiap soal. Kuis akan dinilai
            otomatis saat pelajar mengerjakan.
          </div>
          <button className="btn btn-primary">
            {editingId ? "Simpan Perubahan" : "Simpan Kuis"}
          </button>
        </form>
      </div>
      )}

      <div className="card">
        <div className="row-between">
          <h3>Daftar Kuis ({quizzes.length})</h3>
          {!showForm && (
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              + Buat Kuis
            </button>
          )}
        </div>
        <div className="stack">
          {groupMaterialsByPertemuan(quizzes).map(([p, items]) => (
            <div className="pertemuan-group" key={p}>
              <div className="pertemuan-group-head">Kuis {p}</div>
              <MateriSubMateriTags item={curFor(p)} />
              {items.map((q) => (
                <details className="card material" key={q.id}>
                  <summary className="material-summary">
                    <b>{q.title}</b>
                    <span className="asg-meta">
                      {q.active === false && (
                        <span className="badge badge-off">Belum dibagikan</span>
                      )}
                      {q.completed && (
                        <span className="badge badge-done">✓ Selesai</span>
                      )}
                      <span className="asg-chip">
                        {q.questions.length} soal
                        {q.durationMinutes ? ` · ${q.durationMinutes} mnt` : ""}
                      </span>
                    </span>
                  </summary>
                  <div className="row-between">
                    <div className="muted tiny">
                      dibuat {fmtDateTime(q.createdAt)}
                    </div>
                    <div className="btn-group btn-group-icons">
                      <button
                        className={`btn btn-sm btn-icon ${
                          q.active === false ? "btn-primary" : "btn-ghost"
                        }`}
                        onClick={() => toggleActive(q)}
                        title={
                          q.active === false
                            ? "Bagikan kuis ini ke siswa"
                            : "Sembunyikan kuis ini dari siswa"
                        }
                      >
                        {q.active === false ? "📢" : "🔕"}
                      </button>
                      <button
                        className={`btn btn-sm btn-icon ${
                          q.completed ? "btn-ghost" : "btn-primary"
                        }`}
                        onClick={() => toggleComplete(q)}
                        title={q.completed ? "Batalkan selesai" : "Tandai selesai"}
                      >
                        {q.completed ? "↺" : "✓"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => openEdit(q)}
                        title="Ubah kuis"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => setOpenId(openId === q.id ? null : q.id)}
                        title={openId === q.id ? "Tutup hasil" : "Lihat hasil"}
                      >
                        👁️
                      </button>
                      <button
                        className="btn btn-danger btn-sm btn-icon"
                        onClick={() => del(q.id)}
                        title="Hapus kuis"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  {q.description && <p className="muted m0">{q.description}</p>}
                  {openId === q.id && (
                    <QuizResults quizId={q.id} total={q.questions.length} />
                  )}
                  <Comments targetType="quiz" targetId={q.id} />
                </details>
              ))}
            </div>
          ))}
          {quizzes.length === 0 && <p className="muted">Belum ada kuis.</p>}
        </div>
      </div>
    </div>
    </>
  );
}

function QuizResults({ quizId, total }) {
  const [results, setResults] = useState([]);
  const [busyId, setBusyId] = useState(null);
  useEffect(() => {
    api.listQuizResults(quizId).then(setResults).catch(() => {});
  }, [quizId]);
  async function allowRetake(studentId) {
    setBusyId(studentId);
    try {
      await api.allowQuizRetake(quizId, studentId);
      const list = await api.listQuizResults(quizId);
      setResults(list);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  }
  return (
    <div className="subs">
      {results.length === 0 && (
        <p className="muted tiny">Belum ada yang mengerjakan.</p>
      )}
      {results.map((r) => (
        <div className="sub-row" key={r.id}>
          <div className="row-between">
            <b>{r.studentName}</b>
            <span className="badge grade-badge">
              {r.score}/{r.total ?? total}
            </span>
          </div>
          <div className="row-between">
            <span className="muted tiny">
              {new Date(r.submittedAt).toLocaleString("id-ID")}
            </span>
            {r.retakeAllowed ? (
              <span className="badge tiny">🔓 Menunggu dikerjakan ulang</span>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                disabled={busyId === r.studentId}
                onClick={() => allowRetake(r.studentId)}
              >
                {busyId === r.studentId ? "…" : "Izinkan ulang"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Rekap Nilai ---------------- */
const SIKAP_OPTS = [
  { v: "", label: "—" },
  { v: "A", label: "A · Sangat Baik" },
  { v: "B", label: "B · Baik" },
  { v: "C", label: "C · Cukup" },
  { v: "D", label: "D · Kurang" },
];
const LULUS_OPTS = [
  { v: "", label: "—" },
  { v: "lulus", label: "Lulus" },
  { v: "tidak", label: "Tidak Lulus" },
];
const lulusLabel = (v) =>
  v === "lulus" ? "Lulus" : v === "tidak" ? "Tidak Lulus" : "";
const fmtAvg = (v) => (v === null || v === undefined ? "—" : v);

function GradebookPanel({ subjectId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .gradebook(subjectId)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [subjectId]);

  if (error) return <div className="alert">{error}</div>;
  if (!data) return <p className="muted">Memuat…</p>;

  async function updateAssessment(studentId, field, value) {
    setData((prev) => ({
      ...prev,
      rows: prev.rows.map((r) =>
        r.studentId === studentId ? { ...r, [field]: value } : r
      ),
    }));
    try {
      await api.saveAssessment(subjectId, { studentId, [field]: value });
    } catch (e) {
      setError(e.message);
    }
  }

  function exportCsv() {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = [
      "Pelajar",
      ...data.columns.map((c) => c.title),
      "Rata Tugas",
      "Rata Kuis",
      "Sikap",
      "Kelulusan",
    ];
    const lines = [header.map(esc).join(",")];
    data.rows.forEach((r) => {
      const row = [
        r.name,
        ...data.columns.map((c) => r.cells[c.id] || ""),
        fmtAvg(r.avgAssignment),
        fmtAvg(r.avgQuiz),
        r.sikap || "",
        lulusLabel(r.lulus),
      ];
      lines.push(row.map(esc).join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rekap-nilai.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card">
      <div className="row-between">
        <h3 className="m0">Rekap Nilai</h3>
        {data.rows.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>
            ⬇ Ekspor CSV
          </button>
        )}
      </div>
      {data.rows.length === 0 && <p className="muted">Belum ada pelajar.</p>}
      {data.rows.length > 0 && (
        <div className="table-scroll">
          <table className="table gradebook-table">
            <thead>
              <tr>
                <th>Pelajar</th>
                {data.columns.map((c) => (
                  <th key={c.id} className="gb-col">
                    {c.kind === "quiz" ? "🧩 " : "📝 "}
                    {c.title}
                  </th>
                ))}
                <th className="gb-sum">Σ Tugas</th>
                <th className="gb-sum">Σ Kuis</th>
                <th className="gb-sum">Sikap</th>
                <th className="gb-sum">Kelulusan</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.studentId}>
                  <td>{r.name}</td>
                  {data.columns.map((c) => (
                    <td key={c.id}>{r.cells[c.id] || "—"}</td>
                  ))}
                  <td className="gb-sum ta-c">
                    <b>{fmtAvg(r.avgAssignment)}</b>
                  </td>
                  <td className="gb-sum ta-c">
                    <b>{fmtAvg(r.avgQuiz)}</b>
                  </td>
                  <td className="gb-sum">
                    <select
                      className="gb-select"
                      value={r.sikap || ""}
                      onChange={(e) =>
                        updateAssessment(r.studentId, "sikap", e.target.value)
                      }
                    >
                      {SIKAP_OPTS.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="gb-sum">
                    <select
                      className={`gb-select lulus-${r.lulus || "none"}`}
                      value={r.lulus || ""}
                      onChange={(e) =>
                        updateAssessment(r.studentId, "lulus", e.target.value)
                      }
                    >
                      {LULUS_OPTS.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted tiny">
        Σ Tugas &amp; Σ Kuis = rata-rata otomatis (kuis diskalakan 0–100).
        Sikap &amp; Kelulusan disimpan otomatis saat diubah.
      </p>
    </div>
  );
}

/* ---------------- Kehadiran ---------------- */
const ATT_STATUS = [
  { key: "hadir", label: "Hadir" },
  { key: "izin", label: "Izin" },
  { key: "sakit", label: "Sakit" },
  { key: "alfa", label: "Alfa" },
];

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function AttendancePanel({ subjectId }) {
  const [date, setDate] = useState(todayStr());
  const [marks, setMarks] = useState({});
  const [students, setStudents] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getSubject(subjectId)
      .then((s) => setStudents(s.students || []))
      .catch(() => setStudents([]));
  }, [subjectId]);

  useEffect(() => {
    setMsg("");
    api
      .listAttendance(subjectId, date)
      .then((list) => {
        const m = {};
        list.forEach((a) => (m[a.studentId] = { status: a.status, note: a.note || "" }));
        setMarks(m);
      })
      .catch(() => setMarks({}));
  }, [subjectId, date]);

  function setStatus(sid, status) {
    setMarks((m) => ({ ...m, [sid]: { ...(m[sid] || {}), status } }));
  }
  function setNote(sid, note) {
    setMarks((m) => ({ ...m, [sid]: { ...(m[sid] || {}), note } }));
  }

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const entries = students.map((s) => ({
        studentId: s.id,
        status: (marks[s.id] && marks[s.id].status) || "alfa",
        note: (marks[s.id] && marks[s.id].note) || "",
      }));
      await api.saveAttendance(subjectId, date, entries);
      setMsg("Kehadiran tersimpan.");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="row-between">
        <h3 className="m0">Absensi</h3>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      {students.length === 0 && <p className="muted">Belum ada pelajar.</p>}
      {students.length > 0 && (
        <div className="stack">
          {students.map((s) => {
            const cur = (marks[s.id] && marks[s.id].status) || "";
            return (
              <div className="att-row" key={s.id}>
                <b className="att-name">{s.name}</b>
                <div className="att-opts">
                  {ATT_STATUS.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      className={`att-chip att-${o.key} ${
                        cur === o.key ? "active" : ""
                      }`}
                      onClick={() => setStatus(s.id, o.key)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <input
                  className="att-note"
                  placeholder="Catatan (opsional)"
                  value={(marks[s.id] && marks[s.id].note) || ""}
                  onChange={(e) => setNote(s.id, e.target.value)}
                />
              </div>
            );
          })}
          <div className="row-between">
            {msg && <span className="muted tiny">{msg}</span>}
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan Kehadiran"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Statistik ---------------- */
function StatsPanel({ subjectId }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState("");
  const [viewStudent, setViewStudent] = useState(null);
  useEffect(() => {
    api
      .classStats(subjectId)
      .then(setS)
      .catch((e) => setError(e.message));
  }, [subjectId]);

  if (error) return <div className="alert">{error}</div>;
  if (!s) return <p className="muted">Memuat…</p>;

  const cards = [
    { label: "Pelajar", value: s.studentCount },
    { label: "Tugas", value: s.assignmentCount },
    { label: "Kuis", value: s.quizCount },
    {
      label: "Pengumpulan tugas",
      value: `${s.submissionRate}%`,
    },
    {
      label: "Rata-rata nilai tugas",
      value: s.avgGrade == null ? "—" : s.avgGrade,
    },
    {
      label: "Rata-rata skor kuis",
      value: s.avgQuizPercent == null ? "—" : `${s.avgQuizPercent}%`,
    },
  ];

  const att = s.attendance || {};
  const attTotal =
    (att.hadir || 0) + (att.izin || 0) + (att.sakit || 0) + (att.alfa || 0);

  return (
    <div className="stack">
      <div className="stats-grid">
        {cards.map((c) => (
          <div className="stat-card" key={c.label}>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3 className="m0">Ringkasan Kehadiran ({s.attendanceDays} pembelajaran)</h3>
        {attTotal === 0 ? (
          <p className="muted">Belum ada data kehadiran.</p>
        ) : (
          <>
            <div className="chart">
              {[
                { key: "hadir", label: "Hadir" },
                { key: "izin", label: "Izin" },
                { key: "sakit", label: "Sakit" },
                { key: "alfa", label: "Alfa" },
              ].map((o) => {
                const val = att[o.key] || 0;
                const max = Math.max(
                  att.hadir || 0,
                  att.izin || 0,
                  att.sakit || 0,
                  att.alfa || 0,
                  1
                );
                return (
                  <div className="chart-bar" key={o.key}>
                    <span className="bar-val">{val}</span>
                    <div
                      className={`bar bar-${o.key}`}
                      style={{ height: `${(val / max) * 100}%` }}
                    />
                    <span className="bar-label">{o.label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3 className="m0">Daftar Murid</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>NISN</th>
              <th>Nilai</th>
              <th>Kehadiran (H/I/S/A)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(s.students || []).map((st) => (
              <tr key={st.id}>
                <td>{st.name}</td>
                <td>{st.nisn || <span className="muted tiny">—</span>}</td>
                <td>
                  {st.average == null ? (
                    <span className="muted">—</span>
                  ) : (
                    <span className="badge grade-badge">{st.average}</span>
                  )}
                </td>
                <td className="tiny">
                  {st.attendance.hadir}/{st.attendance.izin}/
                  {st.attendance.sakit}/{st.attendance.alfa}
                </td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setViewStudent(st)}
                  >
                    Lihat Nilai
                  </button>
                </td>
              </tr>
            ))}
            {(!s.students || s.students.length === 0) && (
              <tr>
                <td colSpan={5}>
                  <span className="muted">Belum ada murid di kelas ini.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewStudent && (
        <SubjectGradeModal
          student={viewStudent}
          onClose={() => setViewStudent(null)}
        />
      )}
    </div>
  );
}

function SubjectGradeModal({ student, onClose }) {
  const att = student.attendance || { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3 className="m0">Nilai — {student.name}</h3>
          <button className="btn btn-sm" onClick={onClose}>
            Tutup
          </button>
        </div>
        <div className="stack">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">
                {student.average == null ? "—" : student.average}
              </div>
              <div className="stat-label">Rata-rata mapel</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{att.hadir}</div>
              <div className="stat-label">Hadir</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {att.izin + att.sakit + att.alfa}
              </div>
              <div className="stat-label">Izin/Sakit/Alfa</div>
            </div>
          </div>
          <div className="card">
            <table className="table">
              <tbody>
                {(student.items || []).map((it, i) => (
                  <tr key={i}>
                    <td className="tiny">
                      {it.kind === "quiz" ? "🧩 " : "📝 "}
                      {it.title}
                    </td>
                    <td className="tiny" style={{ textAlign: "right" }}>
                      {it.display}
                    </td>
                  </tr>
                ))}
                {(!student.items || student.items.length === 0) && (
                  <tr>
                    <td className="tiny">
                      <span className="muted">Belum ada tugas/kuis.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


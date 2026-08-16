// =====================================================================
// StudentDashboard.jsx — Pelajar: lihat materi, kumpulkan tugas, jadwal.
// =====================================================================
import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../api";
import { MaterialBody, groupMaterialsByMateri, groupMaterialsByPertemuan, MateriSubMateriTags, fmtDateTime, AcuanBox } from "./TeacherDashboard.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import AnnouncementsBanner from "../components/AnnouncementsBanner.jsx";
import Comments from "../components/Comments.jsx";
import { RichText } from "../components/RichText.jsx";
import FilePreview from "../components/FilePreview.jsx";
import MaterialGate from "../components/MaterialGate.jsx";

const STUDENT_TABS = [
  { key: "beranda", label: "Beranda", icon: "🏠" },
  { key: "belajar", label: "Belajar Mandiri", icon: "🎯" },
  { key: "materials", label: "Materi", icon: "📄" },
  { key: "assignments", label: "Tugas", icon: "📝" },
  { key: "quizzes", label: "Kuis", icon: "🧩" },
  { key: "grades", label: "Nilai", icon: "📊" },
  { key: "attendance", label: "Kehadiran", icon: "✅" },
  { key: "discussion", label: "Obrolan", icon: "💬" },
];

export default function StudentDashboard() {
  const [classes, setClasses] = useState([]);
  const [periodKey, setPeriodKey] = useState("");
  const [activeClassId, setActiveClassId] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [tab, setTab] = useState("beranda");
  const [showSchedule, setShowSchedule] = useState(false);
  // Target navigasi dari lonceng notifikasi: {classId, subjectId, tab}.
  const [navTarget, setNavTarget] = useState(null);

  useEffect(() => {
    api.listClasses().then(setClasses);
  }, []);

  // Banner sambutan hanya tampil di menu Beranda (sembunyikan di tab lain).
  useEffect(() => {
    const cls = "hide-welcome-banner";
    document.body.classList.toggle(cls, tab !== "beranda");
    return () => document.body.classList.remove(cls);
  }, [tab]);

  // Terima permintaan navigasi dari lonceng notifikasi (event + sessionStorage).
  useEffect(() => {
    const apply = (detail) => {
      if (detail && detail.subjectId) setNavTarget(detail);
    };
    try {
      const raw = sessionStorage.getItem("edumuh_notif_target");
      if (raw) {
        sessionStorage.removeItem("edumuh_notif_target");
        apply(JSON.parse(raw));
      }
    } catch {
      /* abaikan */
    }
    const onNav = (e) => {
      try {
        sessionStorage.removeItem("edumuh_notif_target");
      } catch {
        /* abaikan */
      }
      apply(e.detail);
    };
    window.addEventListener("edumuh:notif-nav", onNav);
    return () => window.removeEventListener("edumuh:notif-nav", onNav);
  }, []);

  // Daftar periode unik yang dimiliki siswa (untuk pemilih riwayat).
  const periods = [];
  const seenPeriods = new Set();
  classes.forEach((c) => {
    const key = `${c.academicYearId}|${c.semester}`;
    if (seenPeriods.has(key)) return;
    seenPeriods.add(key);
    periods.push({
      key,
      academicYearName: c.academicYearName,
      semester: c.semester,
      periodActive: c.periodActive,
    });
  });
  periods.sort((a, b) => {
    if (a.periodActive !== b.periodActive) return a.periodActive ? -1 : 1;
    return (
      (b.academicYearName || "").localeCompare(a.academicYearName || "") ||
      (b.semester || "").localeCompare(a.semester || "")
    );
  });

  // Default periode = yang aktif (atau paling baru bila tak ada kelas aktif).
  useEffect(() => {
    if (periodKey || periods.length === 0) return;
    const active = periods.find((p) => p.periodActive) || periods[0];
    setPeriodKey(active.key);
  }, [periods, periodKey]);

  const visibleClasses = classes.filter(
    (c) => `${c.academicYearId}|${c.semester}` === periodKey
  );

  // Saat periode berganti, pilih kelas pertama pada periode tersebut.
  useEffect(() => {
    const vis = classes.filter(
      (c) => `${c.academicYearId}|${c.semester}` === periodKey
    );
    // Pertahankan kelas aktif bila masih valid pada periode ini (mis. saat
    // navigasi dari notifikasi memilih kelas tertentu).
    if (vis.some((c) => c.id === activeClassId)) return;
    setActiveClassId(vis.length ? vis[0].id : null);
  }, [periodKey, classes]);

  useEffect(() => {
    if (!activeClassId) {
      setSubjects([]);
      setActiveSubjectId(null);
      return;
    }
    api
      .listSubjects(activeClassId)
      .then((ss) => {
        setSubjects(ss);
        setActiveSubjectId(ss.length ? ss[0].id : null);
      })
      .catch(() => setSubjects([]));
  }, [activeClassId]);

  // Navigasi notifikasi (langkah 1): pilih periode & kelas sesuai target.
  useEffect(() => {
    if (!navTarget || !navTarget.classId || classes.length === 0) return;
    const cls = classes.find((c) => c.id === navTarget.classId);
    if (!cls) return;
    setPeriodKey(`${cls.academicYearId}|${cls.semester}`);
    setActiveClassId(navTarget.classId);
  }, [navTarget, classes]);

  // Navigasi notifikasi (langkah 2): setelah mapel kelas termuat, pilih mapel
  // & tab yang dimaksud, lalu bersihkan target.
  useEffect(() => {
    if (!navTarget || !navTarget.subjectId) return;
    if (!subjects.some((s) => s.id === navTarget.subjectId)) return;
    setActiveSubjectId(navTarget.subjectId);
    if (navTarget.tab) setTab(navTarget.tab);
    setNavTarget(null);
  }, [navTarget, subjects]);

  const activeClass = classes.find((c) => c.id === activeClassId);
  const activeSubject = subjects.find((s) => s.id === activeSubjectId);

  return (
    <div>
      {classes.length === 0 && (
        <p className="muted">Anda belum terdaftar di kelas mana pun.</p>
      )}
      {classes.length > 0 && (
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
          <div className="class-tabs-bar">
            <div className="class-tabs">
              {visibleClasses.map((c) => (
                <button
                  key={c.id}
                  className={`class-tab ${
                    c.id === activeClassId ? "active" : ""
                  }`}
                  onClick={() => setActiveClassId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {activeClass && (
              <button
                className="btn btn-ghost btn-sm schedule-btn"
                onClick={() => setShowSchedule(true)}
              >
                📅 Jadwal
              </button>
            )}
          </div>
          {visibleClasses.length === 0 && (
            <p className="muted">
              Tidak ada kelas pada periode ini.
            </p>
          )}
          {activeClass && (
            <>
              <p className="muted">{activeClass.description}</p>

              {subjects.length > 0 && tab !== "beranda" && (
                <div className="subject-select-wrap">
                  <label className="subject-select-label">Mata Pelajaran</label>
                  <select
                    className="subject-select"
                    value={activeSubjectId || ""}
                    onChange={(e) => setActiveSubjectId(e.target.value)}
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="admin-tabs-top tabs-float">
                {STUDENT_TABS.map((t) => (
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

              {tab === "belajar" ? (
                <SelfLearning
                  onOpen={(target) => {
                    if (target.classId && target.classId !== activeClassId) {
                      // Kelas berbeda: tunda pemilihan mapel/tab sampai mapel
                      // kelas tujuan termuat (lewat mekanisme navTarget).
                      setNavTarget(target);
                    } else {
                      if (target.subjectId) setActiveSubjectId(target.subjectId);
                      if (target.tab) setTab(target.tab);
                    }
                  }}
                />
              ) : tab === "beranda" ? (
                <StudentHome />
              ) : tab === "grades" ? (
                <StudentGrades />
              ) : subjects.length === 0 ? (
                <p className="muted">
                  Belum ada mata pelajaran pada kelas ini.
                </p>
              ) : !activeSubject ? (
                <p className="muted">Pilih mata pelajaran.</p>
              ) : (
                <>
                  {tab === "materials" && (
                    <StudentMaterials subjectId={activeSubject.id} />
                  )}
                  {tab === "assignments" && (
                    <StudentAssignments subjectId={activeSubject.id} />
                  )}
                  {tab === "quizzes" && (
                    <StudentQuizzes subjectId={activeSubject.id} />
                  )}
                  {tab === "discussion" && (
                    <ChatPanel subjectId={activeSubject.id} />
                  )}
                  {tab === "attendance" && (
                    <StudentAttendance subjectId={activeSubject.id} />
                  )}
                </>
              )}
            </>
          )}
          {showSchedule && activeClass && (
            <div className="modal-overlay" onClick={() => setShowSchedule(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <h3 className="m0">Jadwal — {activeClass.name}</h3>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowSchedule(false)}
                  >
                    Tutup
                  </button>
                </div>
                <StudentSchedule classId={activeClass.id} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProgressBar({ percent }) {
  const p = Math.max(0, Math.min(100, percent || 0));
  return (
    <div className="progress-track" aria-label={`${p}%`}>
      <div className="progress-fill" style={{ width: `${p}%` }} />
    </div>
  );
}

const LEARN_TYPE = {
  material: { icon: "📄", label: "Materi", tab: "materials" },
  quiz: { icon: "🧩", label: "Kuis", tab: "quizzes" },
  assignment: { icon: "📝", label: "Tugas", tab: "assignments" },
};

// Beranda siswa: statistik pembelajaran + pengumuman terbaru.
function StudentHome() {
  const [data, setData] = useState(null);
  const [grades, setGrades] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    // scope=all: hitung seluruh materi aktif (bukan hanya Belajar Mandiri).
    api
      .myLearning("all")
      .then((d) => alive && setData(d))
      .catch(() => alive && setErr(true));
    api
      .myGrades()
      .then((g) => alive && setGrades(g))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="stack student-home">
      <AnnouncementsBanner />
      {grades && <StudentHomeGrades grades={grades} />}
      {err ? (
        <p className="muted">Gagal memuat statistik pembelajaran.</p>
      ) : !data ? (
        <p className="muted">Memuat statistik…</p>
      ) : (
        <StudentHomeStats data={data} />
      )}
    </div>
  );
}

// Kartu rata-rata nilai: semester berjalan + keseluruhan.
function StudentHomeGrades({ grades }) {
  const subjects = grades.subjects || [];
  const currentAvg = aggregateAverage(subjects.filter((r) => r.periodActive));
  const overallAvg = aggregateAverage(subjects);
  const fmt = (v) => (v === null || v === undefined ? "—" : v);
  return (
    <div className="home-grades">
      <div className="home-grades-title">
        <span className="home-grades-ico">🏆</span>
        <span>Rata-rata Nilai</span>
      </div>
      <div className="home-grade-pills">
        <div className="home-grade-pill">
          <span className="home-grade-num">{fmt(currentAvg)}</span>
          <span className="home-grade-label">Semester Ini</span>
        </div>
        <div className="home-grade-pill">
          <span className="home-grade-num">{fmt(overallAvg)}</span>
          <span className="home-grade-label">Keseluruhan</span>
        </div>
      </div>
    </div>
  );
}

function StudentHomeStats({ data }) {
  const { overall, subjects, activePeriod } = data;
  const semester = activePeriod.semester
    ? activePeriod.semester.charAt(0).toUpperCase() +
      activePeriod.semester.slice(1)
    : "—";
  const tiles = [
    { icon: "📄", label: "Materi", done: overall.materials.done, total: overall.materials.total },
    { icon: "🧩", label: "Kuis", done: overall.quizzes.done, total: overall.quizzes.total },
    { icon: "📝", label: "Tugas", done: overall.assignments.done, total: overall.assignments.total },
  ];
  return (
    <>
      <div className="card sl-overview">
        <div className="sl-overview-head">
          <div>
            <h3 className="m0">📊 Statistik Pembelajaran</h3>
            <span className="muted tiny">
              Periode aktif · TA {activePeriod.academicYearName} · {semester}
            </span>
          </div>
          <div className="sl-overall-pct">{overall.percent}%</div>
        </div>
        <ProgressBar percent={overall.percent} />
        <div className="home-stat-tiles">
          {tiles.map((t) => (
            <div className="home-stat-tile" key={t.label}>
              <span className="home-stat-ico">{t.icon}</span>
              <span className="home-stat-num">
                {t.done}
                <span className="home-stat-total">/{t.total}</span>
              </span>
              <span className="home-stat-label">{t.label}</span>
            </div>
          ))}
          <div className="home-stat-tile">
            <span className="home-stat-ico">📚</span>
            <span className="home-stat-num">{subjects.length}</span>
            <span className="home-stat-label">Mapel</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="sl-section-title">Progres per Mata Pelajaran</h4>
        {subjects.length === 0 ? (
          <p className="muted">Belum ada mata pelajaran pada periode aktif.</p>
        ) : (
          <div className="stack">
            {subjects.map((s) => (
              <div className="card sl-subject" key={s.subjectId}>
                <div className="sl-subject-head">
                  <div className="sl-subject-name">
                    <b>{s.subjectName}</b>
                    <span className="muted tiny">{s.className}</span>
                  </div>
                  <span className="sl-subject-pct">{s.percent}%</span>
                </div>
                <ProgressBar percent={s.percent} />
                <div className="sl-stats tiny">
                  <span>
                    📄 {s.materials.done}/{s.materials.total}
                  </span>
                  <span>
                    🧩 {s.quizzes.done}/{s.quizzes.total}
                  </span>
                  <span>
                    📝 {s.assignments.done}/{s.assignments.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function SelfLearning({ onOpen }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [openSubject, setOpenSubject] = useState(null);
  // Materi yang ingin dibuka langsung saat kartu "Lanjutkan belajar" diklik.
  const [focusMaterial, setFocusMaterial] = useState(null);
  const reload = () =>
    api
      .myLearning()
      .then((d) => setData(d))
      .catch(() => setErr(true));
  useEffect(() => {
    let alive = true;
    api
      .myLearning()
      .then((d) => alive && setData(d))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, []);

  if (err)
    return <p className="muted">Gagal memuat progres belajar.</p>;
  if (!data) return <p className="muted">Memuat progres…</p>;

  const { overall, subjects, next } = data;
  // "Lanjutkan belajar" hanya menampilkan Materi (bukan Kuis/Tugas).
  const materiNext = next.filter((item) => item.type === "material");
  const open = (item) => {
    // Materi dipelajari langsung di Belajar Mandiri → buka mapel + materinya.
    if (item.type === "material") {
      setOpenSubject(item.subjectId);
      setFocusMaterial(item.id);
      // Gulir ke mapel dulu; kartu materi akan menggulir ke dirinya sendiri
      // setelah terbuka (lihat SelfLearnMaterialCard).
      setTimeout(() => {
        document
          .getElementById(`sl-subject-${item.subjectId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return;
    }
    onOpen &&
      onOpen({
        classId: item.classId,
        subjectId: item.subjectId,
        tab: LEARN_TYPE[item.type]?.tab || "materials",
      });
  };

  return (
    <div className="stack self-learning">
      <div className="card sl-overview">
        <div className="sl-overview-head">
          <div>
            <h3 className="m0">Progres Belajar Saya</h3>
            <span className="muted tiny">
              Periode aktif · TA {data.activePeriod.academicYearName} ·{" "}
              {data.activePeriod.semester
                ? data.activePeriod.semester.charAt(0).toUpperCase() +
                  data.activePeriod.semester.slice(1)
                : "—"}
            </span>
          </div>
          <div className="sl-overall-pct">{overall.percent}%</div>
        </div>
        <ProgressBar percent={overall.percent} />
        <div className="sl-stats">
          <span>
            📄 Materi {overall.materials.done}/{overall.materials.total}
          </span>
          <span>
            🧩 Kuis {overall.quizzes.done}/{overall.quizzes.total}
          </span>
          <span>
            📝 Tugas {overall.assignments.done}/{overall.assignments.total}
          </span>
        </div>
      </div>

      <div>
        <h4 className="sl-section-title">Lanjutkan belajar</h4>
        {materiNext.length === 0 ? (
          <p className="muted">
            🎉 Hebat! Semua materi pada periode ini sudah kamu pelajari.
          </p>
        ) : (
          <div className="sl-next-grid">
            {materiNext.map((item) => {
              const meta = LEARN_TYPE[item.type] || {};
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  className="card sl-next-card"
                  onClick={() => open(item)}
                >
                  <span className="sl-next-ico">{meta.icon}</span>
                  <span className="sl-next-body">
                    <span className="sl-next-kind">{meta.label}</span>
                    <span className="sl-next-title">{item.title}</span>
                    <span className="muted tiny">
                      {item.subjectName} · {item.className}
                    </span>
                  </span>
                  <span className="sl-next-go">›</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h4 className="sl-section-title">Materi Belajar Mandiri</h4>
        {subjects.length === 0 ? (
          <p className="muted">Belum ada mata pelajaran pada periode aktif.</p>
        ) : (
          <div className="stack">
            {subjects.map((s) => (
              <div
                className="card sl-subject"
                id={`sl-subject-${s.subjectId}`}
                key={s.subjectId}
              >
                <button
                  type="button"
                  className="sl-subject-head sl-subject-toggle"
                  onClick={() =>
                    setOpenSubject(
                      openSubject === s.subjectId ? null : s.subjectId
                    )
                  }
                >
                  <div className="sl-subject-name">
                    <b>{s.subjectName}</b>
                    <span className="muted tiny">{s.className}</span>
                  </div>
                  <span className="sl-subject-pct">{s.percent}%</span>
                  <span className="sl-subject-caret">
                    {openSubject === s.subjectId ? "▾" : "▸"}
                  </span>
                </button>
                <ProgressBar percent={s.percent} />
                <div className="sl-stats tiny">
                  <span>
                    📄 {s.materials.done}/{s.materials.total}
                  </span>
                  <span>
                    🧩 {s.quizzes.done}/{s.quizzes.total}
                  </span>
                  <span>
                    📝 {s.assignments.done}/{s.assignments.total}
                  </span>
                </div>
                {openSubject === s.subjectId && (
                  <SelfLearnMaterials
                    subjectId={s.subjectId}
                    focusId={focusMaterial}
                    onProgress={reload}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Daftar materi untuk dipelajari mandiri pada satu mata pelajaran. Siswa baca
// isi materi, klik "Selesai dipelajari", lalu mengerjakan Cek Pemahaman.
function SelfLearnMaterials({ subjectId, focusId, onProgress }) {
  const [materials, setMaterials] = useState(null);
  const reload = () =>
    api.listMaterials(subjectId).then(setMaterials).catch(() => setMaterials([]));
  useEffect(() => {
    reload();
  }, [subjectId]);
  const onDone = () => {
    reload();
    onProgress && onProgress();
  };
  if (materials === null)
    return <p className="muted tiny">Memuat materi…</p>;
  // Guru dapat menyembunyikan materi tertentu dari Belajar Mandiri.
  const shown = materials.filter((m) => m.selfLearn !== false);
  if (shown.length === 0)
    return <p className="muted tiny">Belum ada materi untuk dipelajari.</p>;
  return (
    <div className="stack sl-materials">
      {shown.map((m) => (
        <SelfLearnMaterialCard
          key={m.id}
          m={m}
          focus={focusId != null && m.id === focusId}
          onDone={onDone}
        />
      ))}
    </div>
  );
}

// Satu kartu materi dalam belajar mandiri: baca → "Selesai dipelajari" →
// Cek Pemahaman (kuis mini + refleksi) muncul.
function SelfLearnMaterialCard({ m, focus, onDone }) {
  const hasCheck = m.hasCheck || m.askReflection;
  const rec = m.myComprehension;
  // "learned": siswa menyatakan sudah selesai mempelajari materi ini.
  const [learned, setLearned] = useState(!!rec);
  const [busy, setBusy] = useState(false);
  const detRef = useRef(null);

  // Kartu materi yang dipilih dari "Lanjutkan belajar" langsung dibuka & digulir.
  useEffect(() => {
    if (!focus || !detRef.current) return;
    detRef.current.open = true;
    const t = setTimeout(() => {
      detRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => clearTimeout(t);
  }, [focus]);

  // Materi tanpa Cek Pemahaman: "Selesai dipelajari" langsung menandai paham.
  async function markSimple(next) {
    setBusy(true);
    try {
      await api.setMaterialRead(m.id, next);
      onDone && onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="card material" ref={detRef}>
      <summary className="material-summary">
        <b>
          <span className={`badge type-${m.type}`}>{m.type}</span> {m.title}
          {m.read && <span className="badge badge-done">✓ Dipahami</span>}
          {hasCheck && !m.read && (
            <span className="badge badge-check">🧠 Pemahaman Saya</span>
          )}
        </b>
      </summary>
      <MaterialBody m={m} />
      <div className="muted tiny">
        oleh {m.teacherName} · {fmtDateTime(m.createdAt)}
      </div>
      {hasCheck ? (
        rec || learned ? (
          <ComprehensionPanel m={m} onDone={onDone} />
        ) : (
          <div className="material-read-row">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setLearned(true)}
            >
              ✓ Selesai dipelajari
            </button>
            <span className="muted tiny">
              Lanjut ke Pemahaman Saya untuk mengukur pemahamanmu.
            </span>
          </div>
        )
      ) : (
        <div className="material-read-row">
          <button
            className={`btn btn-sm ${m.read ? "btn-ghost" : "btn-primary"}`}
            onClick={() => markSimple(!m.read)}
            disabled={busy}
          >
            {m.read ? "↩ Tandai belum dipahami" : "✓ Selesai dipelajari"}
          </button>
          {m.read && <span className="badge badge-done">Dipahami</span>}
        </div>
      )}
      <Comments targetType="material" targetId={m.id} />
    </details>
  );
}

// Panel "Cek Pemahaman": kuis mini pilihan ganda + refleksi singkat. Mengukur
// pemahaman siswa saat belajar mandiri. Lulus bila skor ≥ 70%.
const RATING_LABELS = {
  sangat: "Sangat Paham",
  paham: "Paham",
  belum: "Belum Paham",
};
function ComprehensionPanel({ m, onDone }) {
  const rec = m.myComprehension;
  const questions = Array.isArray(m.checkQuestions) ? m.checkQuestions : [];
  const [editing, setEditing] = useState(!rec);
  const [answers, setAnswers] = useState(
    rec && Array.isArray(rec.answers) && rec.answers.length
      ? rec.answers
      : questions.map(() => -1)
  );
  const [reflection, setReflection] = useState((rec && rec.reflection) || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const pick = (qi, oi) =>
    setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)));

  async function submit() {
    setError("");
    if (questions.some((_, i) => answers[i] == null || answers[i] < 0))
      return setError("Jawab semua soal terlebih dahulu.");
    if (m.askReflection && !reflection.trim())
      return setError("Isi refleksi singkat terlebih dahulu.");
    setBusy(true);
    try {
      const r = await api.submitComprehension(m.id, {
        answers,
        reflection: reflection.trim(),
      });
      setResult(r);
      setEditing(false);
      onDone && onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Ringkasan hasil terakhir (dari rekam atau hasil submit barusan).
  const summary =
    result ||
    (rec && {
      score: rec.score,
      total: rec.total,
      passed: rec.passed,
      percent: rec.total > 0 ? Math.round((rec.score / rec.total) * 100) : null,
    });

  if (!editing && summary) {
    return (
      <div className={`cek-panel ${summary.passed ? "is-pass" : "is-fail"}`}>
        <div className="row-between">
          <span className="label-strong">🧠 Pemahaman Saya</span>
          {summary.total > 0 ? (
            <span
              className={`badge ${
                summary.passed ? "badge-done" : "badge-off"
              }`}
            >
              Skor {summary.score}/{summary.total}
              {summary.percent != null ? ` · ${summary.percent}%` : ""}
            </span>
          ) : (
            <span className="badge badge-done">Refleksi terkirim</span>
          )}
        </div>
        <p className="tiny m0">
          {summary.passed
            ? "✓ Kamu dinyatakan memahami materi ini."
            : "Belum mencapai 70%. Pelajari lagi lalu ulangi."}
        </p>
        {rec && rec.reflection && (
          <p className="tiny muted m0">
            <b>Refleksimu:</b> {rec.reflection}
          </p>
        )}
        {rec && rec.rating && (
          <p className={`tiny m0 cek-rating cek-rating-${rec.rating}`}>
            🧑‍🏫 Penilaian guru:{" "}
            <b>{rec.ratingLabel || RATING_LABELS[rec.rating] || rec.rating}</b>
          </p>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setResult(null);
            setEditing(true);
          }}
        >
          ↺ Kerjakan ulang
        </button>
      </div>
    );
  }

  return (
    <div className="cek-panel">
      <span className="label-strong">🧠 Pemahaman Saya</span>
      <p className="tiny muted m0">
        Jawab kuis singkat berikut untuk memastikan kamu memahami materi. Lulus
        bila skor ≥ 70%.
      </p>
      {error && <div className="alert">{error}</div>}
      {questions.map((q, qi) => (
        <div className="cek-question" key={qi}>
          <div className="cek-q-text">
            {qi + 1}. {q.question}
          </div>
          {q.options.map((opt, oi) => (
            <label className="cek-option" key={oi}>
              <input
                type="radio"
                name={`ans-${m.id}-${qi}`}
                checked={answers[qi] === oi}
                onChange={() => pick(qi, oi)}
              />{" "}
              {opt}
            </label>
          ))}
        </div>
      ))}
      {m.askReflection && (
        <div className="cek-reflect">
          <label>
            {m.reflectionPrompt || "Tuliskan apa yang sudah kamu pahami:"}
          </label>
          <textarea
            rows={3}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="Refleksi singkatmu…"
          />
        </div>
      )}
      <div className="btn-group">
        <button
          className="btn btn-primary btn-sm"
          onClick={submit}
          disabled={busy}
        >
          {busy ? "Mengirim…" : "Kirim jawaban"}
        </button>
        {rec && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setError("");
              setEditing(false);
            }}
          >
            Batal
          </button>
        )}
      </div>
    </div>
  );
}

function StudentMaterials({ subjectId }) {
  const [materials, setMaterials] = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [active, setActive] = useState(null);
  const reload = () =>
    api.listMaterials(subjectId).then(setMaterials).catch(() => {});
  useEffect(() => {
    reload();
    api.listCurriculum(subjectId).then(setCurriculum).catch(() => setCurriculum([]));
    api.activeCurriculum(subjectId).then(setActive).catch(() => setActive(null));
  }, [subjectId]);
  const curFor = (p) =>
    curriculum.find((c) => Number(c.pertemuan) === Number(p));
  return (
    <div className="stack">
      {groupMaterialsByMateri(materials, curriculum).map((g) => (
        <div className="materi-group" key={g.key || "__no-materi__"}>
          <div className="materi-group-head">
            <span className="materi-group-title">
              {g.label ? `📚 ${g.label}` : "Tanpa Materi Pokok"}
            </span>
            <span className="materi-count">{g.pertemuan.length} pertemuan</span>
          </div>
          {g.pertemuan.map(([p, items]) => (
            <StudentPembelajaran
              key={p}
              p={p}
              items={items}
              cur={curFor(p)}
              indicators={active?.indicators}
            />
          ))}
        </div>
      ))}
      {materials.length === 0 && <p className="muted">Belum ada materi.</p>}
    </div>
  );
}

// Satu grup "Pembelajaran" pada tab Materi: judul bisa diklik untuk buka/tutup,
// sub-materi ditampilkan di samping judul agar mudah dipindai.
function StudentPembelajaran({ p, items, cur, indicators }) {
  const [open, setOpen] = useState(false);
  const submateri = (cur?.submateri || []).filter(Boolean);
  // Pembelajaran dianggap selesai bila semua materinya sudah diselesaikan siswa.
  const done = items.length > 0 && items.every((m) => m.completed);
  return (
    <div className="pertemuan-group">
      <button
        type="button"
        className="pertemuan-head pertemuan-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pertemuan-caret">{open ? "▾" : "▸"}</span>
        <span className="pertemuan-title">Pembelajaran {p}</span>
        {submateri.length > 0 && (
          <span className="pertemuan-sub">
            {submateri.map((s, i) => (
              <span className="ref-tag ref-tag-sub" key={i}>
                {s}
              </span>
            ))}
          </span>
        )}
        {done && <span className="badge badge-done pertemuan-done">✓ Selesai</span>}
      </button>
      {open && (
        <>
          <AcuanBox item={cur} indicators={indicators} hideSubmateri />
          {items.map((m) => (
            <details className="card material" key={m.id}>
              <summary className="material-summary">
                <b>
                  <span className={`badge type-${m.type}`}>{m.type}</span>{" "}
                  {m.title}
                  {m.completed && (
                    <span className="badge badge-done">✓ Selesai</span>
                  )}
                </b>
              </summary>
              <MaterialBody m={m} />
              <div className="muted tiny">
                oleh {m.teacherName} · {fmtDateTime(m.createdAt)}
              </div>
              {(m.hasCheck || m.askReflection) && (
                <p className="tiny muted material-cek-hint">
                  🧠 Materi ini punya Pemahaman Saya. Kerjakan di tab{" "}
                  <b>Belajar Mandiri</b>.
                </p>
              )}
              <Comments targetType="material" targetId={m.id} />
            </details>
          ))}
        </>
      )}
    </div>
  );
}

function StudentAssignments({ subjectId }) {
  const [assignments, setAssignments] = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [materials, setMaterials] = useState([]);
  useEffect(() => {
    api.listAssignments(subjectId).then(setAssignments).catch(() => {});
    api.listCurriculum(subjectId).then(setCurriculum).catch(() => setCurriculum([]));
    api.listMaterials(subjectId).then(setMaterials).catch(() => setMaterials([]));
  }, [subjectId]);
  const curFor = (p) =>
    curriculum.find((c) => Number(c.pertemuan) === Number(p));
  return (
    <div className="stack">
      {groupMaterialsByPertemuan(assignments).map(([p, items]) => (
        <div className="pertemuan-group" key={p}>
          <div className="pertemuan-group-head">Tugas {p}</div>
          <MateriSubMateriTags item={curFor(p)} />
          {items.map((a) => (
            <AssignmentCard
              key={a.id}
              a={a}
              material={materials.find((m) => m.id === a.materialId) || null}
            />
          ))}
        </div>
      ))}
      {assignments.length === 0 && <p className="muted">Belum ada tugas.</p>}
    </div>
  );
}

// Konfigurasi form pengumpulan menyesuaikan jenis tugas.
// Setiap jenis dapat mengatur label & placeholder kolom jawaban, serta
// apakah jawaban teks / berkas wajib diisi.
const DEFAULT_SUBMISSION_CONFIG = {
  textLabel: "Jawaban / catatan",
  textPlaceholder: "",
  textRequired: false,
  fileLabel: "Lampiran (opsional)",
  fileRequired: false,
  fileHint: "",
  fileAccept: "",
};
const SUBMISSION_CONFIG = {
  "Soal Essay": {
    textLabel: "Jawaban Essay",
    textPlaceholder: "Tulis jawaban uraian Anda di sini…",
    textRequired: true,
    fileLabel: "Lampiran pendukung (opsional)",
  },
  "Pilihan Ganda": {
    textLabel: "Jawaban pilihan ganda",
    textPlaceholder: "Contoh: 1.A 2.C 3.B 4.D",
    textRequired: true,
    fileLabel: "Lampiran (opsional)",
  },
  Proyek: {
    textLabel: "Deskripsi / tautan proyek",
    textPlaceholder:
      "Jelaskan proyek Anda atau tempel tautan (Google Drive, GitHub, dsb.)",
    fileLabel: "Berkas proyek",
    fileRequired: true,
    fileHint: "Unggah berkas proyek (zip, dokumen, gambar, atau video).",
  },
  "Pemecahan Masalah": {
    textLabel: "Langkah penyelesaian",
    textPlaceholder: "Uraikan langkah-langkah dan hasil pemecahan masalah…",
    textRequired: true,
    fileLabel: "Lampiran pendukung (opsional)",
  },
  Praktik: {
    textLabel: "Catatan praktik",
    textPlaceholder: "Tuliskan catatan atau hasil praktik Anda…",
    fileLabel: "Bukti praktik (foto/video)",
    fileRequired: true,
    fileHint: "Unggah foto atau video hasil praktik.",
    fileAccept: "image/*,video/*",
  },
  Presentasi: {
    textLabel: "Ringkasan / tautan presentasi",
    textPlaceholder: "Tempel tautan presentasi atau ringkasan singkat…",
    fileLabel: "Berkas presentasi (slide)",
    fileRequired: true,
    fileHint: "Unggah slide presentasi (PPT/PDF).",
  },
  Diskusi: {
    textLabel: "Kontribusi diskusi",
    textPlaceholder: "Tulis pendapat atau kontribusi Anda dalam diskusi…",
    textRequired: true,
    fileLabel: "Lampiran (opsional)",
  },
  Laporan: {
    textLabel: "Ringkasan laporan",
    textPlaceholder: "Tulis ringkasan isi laporan Anda…",
    fileLabel: "Berkas laporan",
    fileRequired: true,
    fileHint: "Unggah dokumen laporan (PDF/Word).",
  },
};
function submissionConfig(type) {
  return { ...DEFAULT_SUBMISSION_CONFIG, ...(SUBMISSION_CONFIG[type] || {}) };
}

// Id tahapan khusus untuk "memahami materi" (bukan tahapan buatan pengajar).
const MATERIAL_STAGE_ID = "__material__";

function AssignmentCard({ a, material }) {
  const [mine, setMine] = useState(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [stagesDone, setStagesDone] = useState([]);
  const [stageNotes, setStageNotes] = useState({});
  const [stageFiles, setStageFiles] = useState({});
  const cfg = submissionConfig(a.type);
  const stages = Array.isArray(a.stages) ? a.stages : [];
  const isProject = a.type === "Proyek" && stages.length > 0;
  // Gerbang materi: bila tugas proyek memiliki materi terkait, memahami materi
  // menjadi tahapan pertama yang wajib diselesaikan siswa.
  const materialGate = a.type === "Proyek" && !!material;
  const showStages = isProject || materialGate;
  const materialDone = !materialGate || stagesDone.includes(MATERIAL_STAGE_ID);
  // Verifikasi bertahap oleh guru (disimpan pada pengumpulan).
  const stageVerify = (mine && mine.stageVerify) || {};
  const isStageVerified = (id) => !!stageVerify[String(id)];
  const isStageUnlocked = (i) => {
    if (materialGate && !materialDone) return false;
    for (let j = 0; j < i; j++) {
      if (!isStageVerified(stages[j].id)) return false;
    }
    return true;
  };
  const allVerified = !isProject || stages.every((s) => isStageVerified(s.id));

  const load = () =>
    api.listSubmissions(a.id).then((list) => {
      const m = list[0] || null;
      setMine(m);
      if (m) {
        setText(m.text || "");
        setStagesDone(
          Array.isArray(m.stagesDone) ? m.stagesDone.map(String) : []
        );
        const notes = {};
        if (m.stageData) {
          Object.keys(m.stageData).forEach((k) => {
            notes[k] = m.stageData[k].text || "";
          });
        }
        setStageNotes(notes);
        setStageFiles({});
      }
    });
  useEffect(() => {
    load();
  }, [a.id]);

  const submitted = !!mine;
  const overdue = a.dueDate && new Date(a.dueDate + "T23:59:59") < new Date();
  const teacherStagesDone =
    !isProject || stages.every((s) => stagesDone.includes(String(s.id)));
  const allStagesDone = materialDone && teacherStagesDone;

  function toggleStage(id) {
    const sid = String(id);
    // Tahapan pengajar terkunci sampai materi selesai & tahap sebelumnya
    // diverifikasi guru; tahapan yang sudah diverifikasi tidak dapat diubah.
    if (sid !== MATERIAL_STAGE_ID) {
      const idx = stages.findIndex((s) => String(s.id) === sid);
      if (idx >= 0 && (!isStageUnlocked(idx) || isStageVerified(sid))) return;
    }
    setStagesDone((cur) =>
      cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid]
    );
  }
  function completeMaterial() {
    setStagesDone((cur) =>
      cur.includes(MATERIAL_STAGE_ID) ? cur : [...cur, MATERIAL_STAGE_ID]
    );
  }
  function setStageNote(id, val) {
    setStageNotes((cur) => ({ ...cur, [String(id)]: val }));
  }
  function setStageFile(id, f) {
    setStageFiles((cur) => ({ ...cur, [String(id)]: f }));
  }

  async function submit(e) {
    e.preventDefault();
    if (overdue) {
      setMsg("Batas waktu pengumpulan telah lewat.");
      return;
    }
    if (materialGate && !materialDone) {
      setMsg("Pahami materi terlebih dahulu sebelum melanjutkan.");
      return;
    }
    // Untuk proyek: selama belum semua tahapan diverifikasi, aksi ini menyimpan
    // progres (bukan pengumpulan akhir), jadi berkas/teks utama belum wajib.
    const finalizing = !isProject || allVerified;
    if (finalizing) {
      if (cfg.textRequired && !text.trim()) {
        setMsg(`${cfg.textLabel} wajib diisi.`);
        return;
      }
      if (cfg.fileRequired && !file && !(mine && mine.fileUrl)) {
        setMsg(`${cfg.fileLabel} wajib diunggah.`);
        return;
      }
    }
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("assignmentId", a.id);
      fd.append("text", text);
      if (showStages) {
        fd.append("stagesDone", JSON.stringify(stagesDone));
        fd.append("stageNotes", JSON.stringify(stageNotes));
        Object.keys(stageFiles).forEach((id) => {
          if (stageFiles[id]) fd.append(`stagefile_${id}`, stageFiles[id]);
        });
      }
      if (file) fd.append("file", file);
      await api.submit(fd);
      setFile(null);
      setStageFiles({});
      setMsg(
        finalizing
          ? "Tugas terkirim."
          : "Progres tersimpan. Menunggu verifikasi guru untuk lanjut."
      );
      load();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="card material asg-card">
      <summary className="material-summary">
        <b className="asg-title">{a.title}</b>
        <span className="asg-badges">
          {submitted && (
            <span className="badge badge-submitted">✓ Terkumpul</span>
          )}
          {overdue && !submitted && (
            <span className="badge badge-overdue">Terlambat</span>
          )}
          {mine && mine.grade !== undefined && mine.grade !== "" && (
            <span className="badge grade-badge">Nilai: {mine.grade}</span>
          )}
        </span>
      </summary>
      <div className="asg-head">
        <div className="asg-title-wrap">
          <div className="asg-meta">
            <span
              className={`asg-chip ${overdue && !submitted ? "overdue" : ""}`}
            >
              📅 {a.dueDate ? `Batas ${a.dueDate}` : "Tanpa batas"}
            </span>
            {a.type && <span className="asg-chip">🏷️ {a.type}</span>}
            <span className="asg-chip">👤 {a.teacherName}</span>
            <span className="asg-chip">🕐 {fmtDateTime(a.createdAt)}</span>
          </div>
        </div>
      </div>
      {a.description && (
        <div className="asg-desc">
          <div className="asg-desc-label tiny muted">Deskripsi / tautan proyek</div>
          <RichText html={a.description} />
        </div>
      )}

      {material && !materialGate && (
        <details className="material asg-material-ref">
          <summary className="material-summary">
            📚 Materi terkait: <b>{material.title}</b>
          </summary>
          <MaterialBody m={material} />
        </details>
      )}

      {mine && mine.feedback && (
        <div className="feedback-box">
          <b>Umpan balik pengajar:</b> {mine.feedback}
        </div>
      )}

      {overdue ? (
        <div className="asg-closed">
          <p className="muted tiny m0">
            ⛔ Batas waktu pengumpulan telah lewat. Pengumpulan ditutup.
          </p>
          {mine && (mine.text || mine.fileUrl) && (
            <div className="asg-closed-mine tiny">
              {mine.text && <p className="pre m0">{mine.text}</p>}
              {mine.fileUrl && (
                <FilePreview url={mine.fileUrl} name={mine.fileName} />
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="form asg-form">
          {a.type && (
            <p className="muted tiny m0">
              Jenis tugas: <b>{a.type}</b>
            </p>
          )}
          {showStages && (
            <div className="stage-checklist">
              <div className="row-between">
                <label className="m0">
                  Tahapan proyek <span className="req">*</span>
                </label>
                <span className="tiny muted">
                  {stages.filter((s) => isStageVerified(s.id)).length}/
                  {stages.length} diverifikasi
                </span>
              </div>
              <p className="muted tiny m0">
                Kerjakan tahapan secara berurutan. Setiap tahapan harus
                diverifikasi guru sebelum Anda dapat lanjut ke tahapan
                berikutnya.
              </p>
              {materialGate && (
                <div
                  className={`stage-check ${materialDone ? "done" : ""}`}
                >
                  <input type="checkbox" checked={materialDone} readOnly />
                  <div className="stage-check-body">
                    <b>1. Pahami materi terlebih dahulu</b>
                    <span className="tiny muted">
                      Selesaikan materi "{material.title}" sebelum melanjutkan ke
                      tahapan berikutnya.
                    </span>
                    <MaterialGate
                      material={material}
                      done={materialDone}
                      onComplete={completeMaterial}
                    />
                  </div>
                </div>
              )}
              {stages.map((s, i) => {
                const checked = stagesDone.includes(String(s.id));
                const sid = String(s.id);
                const verified = isStageVerified(sid);
                const unlocked = isStageUnlocked(i);
                const editable = unlocked && !verified;
                const locked = !editable;
                const num = (materialGate ? 1 : 0) + i + 1;
                const savedFile =
                  mine && mine.stageData && mine.stageData[sid]
                    ? mine.stageData[sid]
                    : null;
                const pickedFile = stageFiles[sid];
                return (
                  <div
                    key={s.id || i}
                    className={`stage-check ${checked ? "done" : ""} ${
                      verified ? "verified" : ""
                    } ${locked && !verified ? "locked" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!editable}
                      onChange={() => toggleStage(s.id)}
                    />
                    <div className="stage-check-body">
                      <b>
                        {num}. {s.title}
                        {verified ? (
                          <span className="stage-badge verified">
                            {" "}
                            ✓ Diverifikasi guru
                          </span>
                        ) : checked ? (
                          <span className="stage-badge waiting">
                            {" "}
                            ⏳ Menunggu verifikasi guru
                          </span>
                        ) : !unlocked ? (
                          <span className="tiny muted"> 🔒 terkunci</span>
                        ) : null}
                      </b>
                      {s.description && (
                        <span className="tiny muted">{s.description}</span>
                      )}
                      <div className="stage-inputs">
                        <label className="tiny muted m0">Catatan</label>
                        <textarea
                          rows={2}
                          className="stage-note-input"
                          placeholder="Tulis catatan (opsional)…"
                          disabled={!editable}
                          value={stageNotes[sid] || ""}
                          onChange={(e) => setStageNote(sid, e.target.value)}
                        />
                        <label className="tiny muted m0">
                          Lampiran (foto/video)
                        </label>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          disabled={!editable}
                          onChange={(e) =>
                            setStageFile(sid, e.target.files[0] || null)
                          }
                        />
                        {pickedFile && (
                          <span className="tiny muted">
                            Akan diunggah: {pickedFile.name}
                          </span>
                        )}
                        {!pickedFile && savedFile && savedFile.fileUrl && (
                          <FilePreview
                            url={savedFile.fileUrl}
                            name={savedFile.fileName}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <label>
            {cfg.textLabel}
            {cfg.textRequired && <span className="req"> *</span>}
          </label>
          <textarea
            rows={3}
            value={text}
            placeholder={cfg.textPlaceholder}
            onChange={(e) => setText(e.target.value)}
          />
          <label>
            {cfg.fileLabel}
            {cfg.fileRequired && <span className="req"> *</span>}
          </label>
          <input
            type="file"
            accept={cfg.fileAccept || undefined}
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
          {cfg.fileHint && <p className="muted tiny m0">{cfg.fileHint}</p>}
          {mine && mine.fileUrl && (
            <div className="tiny">
              <span className="muted">Berkas terkirim:</span>
              <FilePreview url={mine.fileUrl} name={mine.fileName} />
            </div>
          )}
          {msg && <div className="muted tiny">{msg}</div>}
          <button className="btn btn-primary" disabled={busy}>
            {busy
              ? "Mengirim…"
              : isProject && !allVerified
              ? "Simpan progres tahapan"
              : mine
              ? "Perbarui Pengumpulan"
              : "Kumpulkan"}
          </button>
        </form>
      )}
      <Comments targetType="assignment" targetId={a.id} />
    </details>
  );
}

function StudentSchedule({ classId }) {
  const [schedules, setSchedules] = useState([]);
  useEffect(() => {
    api.listSchedules(classId).then(setSchedules).catch(() => {});
  }, [classId]);
  return (
    <div className="stack">
      {schedules.map((s) => (
        <div className="list-item" key={s.id}>
          <div>
            <b>{s.title}</b>
            <div className="muted">
              {s.day} {s.startTime}
              {s.endTime ? `–${s.endTime}` : ""}
              {s.roomName && ` · 🏫 ${s.roomName}`}
              {s.teacherNames && ` · 👤 ${s.teacherNames}`}
              {s.note && ` · ${s.note}`}
            </div>
          </div>
        </div>
      ))}
      {schedules.length === 0 && <p className="muted">Belum ada jadwal.</p>}
    </div>
  );
}

const ATT_LABEL = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
  alfa: "Alfa",
};

function StudentAttendance({ subjectId }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.listAttendance(subjectId).then(setRows).catch(() => setRows([]));
  }, [subjectId]);

  const count = (st) => rows.filter((r) => r.status === st).length;

  return (
    <div className="stack">
      {rows.length > 0 && (
        <div className="att-summary">
          <span className="badge att-hadir">Hadir: {count("hadir")}</span>
          <span className="badge att-izin">Izin: {count("izin")}</span>
          <span className="badge att-sakit">Sakit: {count("sakit")}</span>
          <span className="badge att-alfa">Alfa: {count("alfa")}</span>
        </div>
      )}
      {rows.map((r) => (
        <div className="list-item" key={r.id}>
          <div>
            <b>{r.date}</b>
            {r.note && <div className="muted tiny">{r.note}</div>}
          </div>
          <span className={`badge att-${r.status}`}>
            {ATT_LABEL[r.status] || r.status}
          </span>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="muted">Belum ada catatan kehadiran.</p>
      )}
    </div>
  );
}

function StudentQuizzes({ subjectId }) {
  const [quizzes, setQuizzes] = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  useEffect(() => {
    api.listQuizzes(subjectId).then(setQuizzes).catch(() => {});
    api.listCurriculum(subjectId).then(setCurriculum).catch(() => setCurriculum([]));
  }, [subjectId]);
  const curFor = (p) =>
    curriculum.find((c) => Number(c.pertemuan) === Number(p));
  return (
    <div className="stack">
      {groupMaterialsByPertemuan(quizzes).map(([p, items]) => (
        <div className="pertemuan-group" key={p}>
          <div className="pertemuan-group-head">Kuis {p}</div>
          <MateriSubMateriTags item={curFor(p)} />
          {items.map((q) => (
            <QuizTaker key={q.id} quiz={q} />
          ))}
        </div>
      ))}
      {quizzes.length === 0 && <p className="muted">Belum ada kuis.</p>}
    </div>
  );
}

function QuizTaker({ quiz }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(null); // detik tersisa
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    api
      .listQuizResults(quiz.id)
      .then((list) => setResult(list[0] || null))
      .catch(() => {});
  }, [quiz.id]);

  const doSubmit = useCallback(
    async (auto) => {
      setError("");
      const ans = answersRef.current;
      if (!auto && Object.keys(ans).length < quiz.questions.length) {
        setError("Jawab semua pertanyaan dulu.");
        return;
      }
      setBusy(true);
      try {
        const arr = quiz.questions.map((_, i) =>
          ans[i] === undefined ? -1 : ans[i]
        );
        const r = await api.submitQuiz(quiz.id, arr);
        setResult(r);
        setOpen(false);
        setRemaining(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [quiz]
  );

  // Hitung mundur bila kuis punya batas waktu.
  useEffect(() => {
    if (!open || remaining === null) return;
    if (remaining <= 0) {
      doSubmit(true);
      return;
    }
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [open, remaining, doSubmit]);

  function start() {
    setAnswers({});
    setError("");
    setOpen(true);
    setRemaining(quiz.durationMinutes > 0 ? quiz.durationMinutes * 60 : null);
  }

  function fmt(s) {
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, "0");
    return `${m}:${ss}`;
  }

  return (
    <details className="card material">
      <summary className="material-summary">
        <b>{quiz.title}</b>
        {result ? (
          <span className="badge grade-badge">
            Skor: {result.score}/{result.total}
          </span>
        ) : (
          <span className="badge">Belum dikerjakan</span>
        )}
        {result && result.retakeAllowed && (
          <span className="badge">🔓 Boleh mengulang</span>
        )}
      </summary>
      <div className="muted tiny">
        {quiz.questions.length} soal · oleh {quiz.teacherName}
        {quiz.durationMinutes ? ` · ${quiz.durationMinutes} menit` : ""} ·
        dibuat {fmtDateTime(quiz.createdAt)}
      </div>
      {quiz.description && <p className="muted">{quiz.description}</p>}

      {!open && (
        result && !result.retakeAllowed ? (
          <div className="quiz-locked muted tiny">
            🔒 Kuis sudah dikerjakan. Untuk mengerjakan ulang, minta izin
            pengajar.
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={start}>
            {result ? "Kerjakan ulang" : "Kerjakan"}
          </button>
        )
      )}

      {open && (
        <form onSubmit={(e) => { e.preventDefault(); doSubmit(false); }} className="form">
          {remaining !== null && (
            <div className={`quiz-timer ${remaining <= 30 ? "urgent" : ""}`}>
              ⏳ Sisa waktu: {fmt(remaining)}
            </div>
          )}
          {error && <div className="alert">{error}</div>}
          {quiz.questions.map((q, qi) => (
            <div className="qbuilder" key={q.id}>
              <b>
                {qi + 1}. {q.text}
              </b>
              {q.options.map((o, oi) => (
                <label className="opt-take" key={oi}>
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[qi] === oi}
                    onChange={() => setAnswers({ ...answers, [qi]: oi })}
                  />
                  {o}
                </label>
              ))}
            </div>
          ))}
          <div className="btn-group">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Mengirim…" : "Kumpulkan Jawaban"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setOpen(false);
                setRemaining(null);
              }}
            >
              Batal
            </button>
          </div>
        </form>
      )}
      <Comments targetType="quiz" targetId={quiz.id} />
    </details>
  );
}

// ---------------------------------------------------------------------
// Nilai — rapor nilai pelajar (keseluruhan, per tahun akademik, semester
// berjalan) + tombol cetak / simpan PDF.
// ---------------------------------------------------------------------
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");

function periodLabel(r) {
  return `TA ${r.academicYearName} · ${capFirst(r.semester)}`;
}

// Rata-rata tertimbang (per jumlah item bernilai) dari sekumpulan mapel.
function aggregateAverage(rows) {
  let sum = 0;
  let n = 0;
  rows.forEach((r) => {
    if (r.average !== null) {
      sum += r.average * r.gradedCount;
      n += r.gradedCount;
    }
  });
  return n ? Math.round((sum / n) * 10) / 10 : null;
}

function gradePredicate(v) {
  if (v === null) return { label: "-", cls: "" };
  if (v >= 90) return { label: "A", cls: "g-a" };
  if (v >= 80) return { label: "B", cls: "g-b" };
  if (v >= 70) return { label: "C", cls: "g-c" };
  if (v >= 60) return { label: "D", cls: "g-d" };
  return { label: "E", cls: "g-e" };
}

function ScoreBadge({ value }) {
  if (value === null)
    return <span className="score-badge score-empty">Belum ada</span>;
  const p = gradePredicate(value);
  return (
    <span className={`score-badge ${p.cls}`}>
      {value} <small>({p.label})</small>
    </span>
  );
}

// Tabel mapel untuk satu kelompok (kelas / periode).
function SubjectTable({ rows, showDetail }) {
  return (
    <table className="grades-table">
      <thead>
        <tr>
          <th>Mata Pelajaran</th>
          <th>Kelas</th>
          <th>Pengajar</th>
          <th className="ta-c">Nilai</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.subjectId}>
            <td className="gt-subject">
              <b>{r.subjectName}</b>
              {showDetail && r.items.length > 0 && (
                <ul className="grade-items">
                  {r.items.map((it, i) => (
                    <li key={i}>
                      <span className="gi-kind">
                        {it.kind === "quiz" ? "Kuis" : "Tugas"}
                      </span>{" "}
                      {it.title}
                      <span className="gi-val">{it.display}</span>
                    </li>
                  ))}
                </ul>
              )}
            </td>
            <td data-label="Kelas">{r.className}</td>
            <td data-label="Pengajar">{r.teacherNames || "—"}</td>
            <td className="ta-c" data-label="Nilai">
              <ScoreBadge value={r.average} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StudentGrades() {
  const [data, setData] = useState(null);
  const [view, setView] = useState("overall"); // overall | year | semester
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .myGrades()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert">{error}</div>;
  if (!data) return <p className="muted">Memuat nilai…</p>;

  const subjects = data.subjects || [];
  const overallAvg = aggregateAverage(subjects);

  // Kelompokkan per periode (tahun + semester) untuk tampilan keseluruhan.
  const byPeriod = [];
  const periodMap = new Map();
  subjects.forEach((r) => {
    const key = `${r.academicYearId}|${r.semester}`;
    if (!periodMap.has(key)) {
      const grp = { key, label: periodLabel(r), periodActive: r.periodActive, rows: [] };
      periodMap.set(key, grp);
      byPeriod.push(grp);
    }
    periodMap.get(key).rows.push(r);
  });

  // Kelompokkan per tahun akademik (gabung kedua semester).
  const byYear = [];
  const yearMap = new Map();
  subjects.forEach((r) => {
    const key = r.academicYearId || r.academicYearName;
    if (!yearMap.has(key)) {
      const grp = { key, name: r.academicYearName, rows: [] };
      yearMap.set(key, grp);
      byYear.push(grp);
    }
    yearMap.get(key).rows.push(r);
  });

  // Semester berjalan (periode aktif).
  const currentRows = subjects.filter((r) => r.periodActive);
  const currentAvg = aggregateAverage(currentRows);

  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="grades-wrap">
      <div className="grades-toolbar no-print">
        <div className="seg">
          <button
            className={`seg-btn ${view === "overall" ? "active" : ""}`}
            onClick={() => setView("overall")}
          >
            Keseluruhan
          </button>
          <button
            className={`seg-btn ${view === "year" ? "active" : ""}`}
            onClick={() => setView("year")}
          >
            Per Tahun Akademik
          </button>
          <button
            className={`seg-btn ${view === "semester" ? "active" : ""}`}
            onClick={() => setView("semester")}
          >
            Semester Berjalan
          </button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
          🖨️ Cetak / Simpan PDF
        </button>
      </div>

      <div className="grades-report">
        <div className="grades-report-head">
          <h2 className="m0">Rapor Nilai</h2>
          <div className="muted">
            {data.student?.name} · Dicetak {today}
          </div>
        </div>

        {subjects.length === 0 && (
          <p className="muted">Belum ada nilai yang tercatat.</p>
        )}

        {/* Nilai Keseluruhan */}
        {view === "overall" && subjects.length > 0 && (
          <>
            <div className="grade-summary">
              <div className="gs-item">
                <span className="gs-label">Rata-rata Keseluruhan</span>
                <span className="gs-value">
                  {overallAvg === null ? "—" : overallAvg}
                </span>
              </div>
              <div className="gs-item">
                <span className="gs-label">Jumlah Mata Pelajaran</span>
                <span className="gs-value">{subjects.length}</span>
              </div>
            </div>
            {byPeriod.map((grp) => (
              <section className="grade-section" key={grp.key}>
                <h3 className="grade-section-title">
                  {grp.label}
                  {grp.periodActive && (
                    <span className="badge badge-done">Aktif</span>
                  )}
                  <span className="grade-avg-tag">
                    Rata-rata: {aggregateAverage(grp.rows) ?? "—"}
                  </span>
                </h3>
                <SubjectTable rows={grp.rows} />
              </section>
            ))}
          </>
        )}

        {/* Nilai Per Tahun Akademik */}
        {view === "year" && subjects.length > 0 && (
          <>
            {byYear.map((grp) => (
              <section className="grade-section" key={grp.key}>
                <h3 className="grade-section-title">
                  Tahun Akademik {grp.name}
                  <span className="grade-avg-tag">
                    Rata-rata: {aggregateAverage(grp.rows) ?? "—"}
                  </span>
                </h3>
                <SubjectTable rows={grp.rows} />
              </section>
            ))}
          </>
        )}

        {/* Nilai Semester Berjalan */}
        {view === "semester" && (
          <>
            <div className="grade-summary">
              <div className="gs-item">
                <span className="gs-label">Periode Aktif</span>
                <span className="gs-value gs-sm">
                  TA {data.activePeriod?.academicYearName} ·{" "}
                  {capFirst(data.activePeriod?.semester)}
                </span>
              </div>
              <div className="gs-item">
                <span className="gs-label">Rata-rata Semester</span>
                <span className="gs-value">
                  {currentAvg === null ? "—" : currentAvg}
                </span>
              </div>
            </div>
            {currentRows.length === 0 ? (
              <p className="muted">
                Belum ada nilai pada semester berjalan.
              </p>
            ) : (
              <section className="grade-section">
                <SubjectTable rows={currentRows} showDetail />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}


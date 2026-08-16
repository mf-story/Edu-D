// =====================================================================
// ParentDashboard.jsx — Dasbor orang tua (tanpa login).
// Cukup masukkan Nama + NISN siswa untuk melihat laporan hasil belajar.
// =====================================================================
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Logo from "../components/Logo.jsx";
import Footer from "../components/Footer.jsx";

const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "\u2014");

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

// Jumlahkan kehadiran (H/I/S/A) dari sekumpulan mapel.
function sumAttendance(rows) {
  return rows.reduce(
    (acc, r) => {
      if (r.attendance) {
        acc.hadir += r.attendance.hadir;
        acc.izin += r.attendance.izin;
        acc.sakit += r.attendance.sakit;
        acc.alfa += r.attendance.alfa;
      }
      return acc;
    },
    { hadir: 0, izin: 0, sakit: 0, alfa: 0 }
  );
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

function AttendanceChips({ att }) {
  if (!att) return null;
  const total = att.hadir + att.izin + att.sakit + att.alfa;
  if (!total) return <span className="muted tiny">Belum ada data</span>;
  return (
    <span className="att-tags">
      <span className="att-tag att-tag-h">H {att.hadir}</span>
      <span className="att-tag att-tag-i">I {att.izin}</span>
      <span className="att-tag att-tag-s">S {att.sakit}</span>
      <span className="att-tag att-tag-a">A {att.alfa}</span>
    </span>
  );
}

// Ringkas nilai rata-rata per mata pelajaran (tertimbang per jumlah item),
// untuk data grafik batang. Mapel yang sama pada beberapa periode digabung.
function chartBySubject(rows) {
  const map = new Map();
  rows.forEach((r) => {
    if (r.average === null) return;
    const cur = map.get(r.subjectName) || { sum: 0, n: 0 };
    cur.sum += r.average * r.gradedCount;
    cur.n += r.gradedCount;
    map.set(r.subjectName, cur);
  });
  const out = [];
  map.forEach((v, label) => {
    if (v.n > 0)
      out.push({ label, value: Math.round((v.sum / v.n) * 10) / 10 });
  });
  out.sort((a, b) => b.value - a.value);
  return out;
}

// Grafik batang horizontal: nilai rata-rata per mata pelajaran.
function PerformanceChart({ data }) {
  if (data.length === 0)
    return (
      <p className="muted tiny m0">
        Belum ada nilai yang dapat ditampilkan pada grafik.
      </p>
    );
  return (
    <div className="pchart">
      {data.map((d) => {
        const p = gradePredicate(d.value);
        return (
          <div className="pchart-row" key={d.label}>
            <div className="pchart-label" title={d.label}>
              {d.label}
            </div>
            <div className="pchart-track">
              <div
                className={`pchart-fill ${p.cls}`}
                style={{ width: `${Math.min(100, d.value)}%` }}
              />
            </div>
            <div className="pchart-val">{d.value}</div>
          </div>
        );
      })}
    </div>
  );
}

// Tabel mapel untuk satu kelompok (periode).
function SubjectTable({ rows, showDetail }) {
  return (
    <table className="grades-table">
      <thead>
        <tr>
          <th>Mata Pelajaran</th>
          <th>Pengajar</th>
          <th className="ta-c">Kehadiran</th>
          <th className="ta-c">Nilai</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.subjectId}>
            <td className="gt-subject">
              <b>{r.subjectName}</b>
              <div className="muted tiny">{r.className}</div>
              {showDetail && r.items.length > 0 && (
                <ul className="grade-items">
                  {r.items.map((it, i) => (
                    <li key={i}>
                      <span className="gi-kind">
                        {it.kind === "quiz" ? "Kuis" : "Tugas"}
                      </span>
                      <span className="gi-title">{it.title}</span>
                      <span className="gi-val">{it.display}</span>
                    </li>
                  ))}
                </ul>
              )}
            </td>
            <td data-label="Pengajar">{r.teacherNames || "\u2014"}</td>
            <td className="ta-c" data-label="Kehadiran">
              <AttendanceChips att={r.attendance} />
            </td>
            <td className="ta-c" data-label="Nilai">
              <ScoreBadge value={r.average} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ParentDashboard() {
  const [name, setName] = useState("");
  const [nisn, setNisn] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [yearFilter, setYearFilter] = useState("");
  const [semFilter, setSemFilter] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const report = await api.parentReport(name.trim(), nisn.trim());
      setData(report);
      setYearFilter("");
      setSemFilter("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setData(null);
    setError("");
    setName("");
    setNisn("");
    setYearFilter("");
    setSemFilter("");
  }

  const subjects = data?.subjects || [];

  // Pilihan tahun akademik & semester yang tersedia (dari riwayat siswa).
  const yearOptions = [];
  const yearSeen = new Set();
  subjects.forEach((r) => {
    if (r.academicYearId && !yearSeen.has(r.academicYearId)) {
      yearSeen.add(r.academicYearId);
      yearOptions.push({ id: r.academicYearId, name: r.academicYearName });
    }
  });
  const semOptions = [...new Set(subjects.map((r) => r.semester).filter(Boolean))];

  // Terapkan filter periode.
  const filteredSubjects = subjects.filter(
    (r) =>
      (!yearFilter || r.academicYearId === yearFilter) &&
      (!semFilter || r.semester === semFilter)
  );

  const chartData = chartBySubject(filteredSubjects);

  // Rekap tetap (tidak terpengaruh filter): keseluruhan & semester aktif.
  const activeSubjects = subjects.filter((r) => r.periodActive);
  const overallAverageAll = aggregateAverage(subjects);
  const activeAverage = aggregateAverage(activeSubjects);
  const activeAttendance = sumAttendance(activeSubjects);
  const isAllPeriods = !yearFilter && !semFilter;
  const scopeLabel = isAllPeriods
    ? "Keseluruhan"
    : `${
        yearFilter
          ? "TA " + (yearOptions.find((y) => y.id === yearFilter)?.name || "")
          : "Semua TA"
      } · ${semFilter ? capFirst(semFilter) : "Semua Semester"}`;

  // Kelompokkan per periode (tahun + semester).
  const byPeriod = [];
  const periodMap = new Map();
  filteredSubjects.forEach((r) => {
    const key = `${r.academicYearId}|${r.semester}`;
    if (!periodMap.has(key)) {
      const grp = {
        key,
        label: periodLabel(r),
        periodActive: r.periodActive,
        rows: [],
      };
      periodMap.set(key, grp);
      byPeriod.push(grp);
    }
    periodMap.get(key).rows.push(r);
  });

  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="parent-page">
      <header className="parent-topbar no-print">
        <div className="brand">
          <Logo className="logo" size={30} />
          <span>Edu-D</span>
        </div>
        <Link to="/login" className="btn btn-ghost btn-sm">
          Masuk sebagai pengguna
        </Link>
      </header>

      <main className="parent-main">
        {!data ? (
          <form className="card parent-form" onSubmit={onSubmit}>
            <div className="parent-form-logo">
              <Logo size={56} />
            </div>
            <h1 className="m0">Dasbor Orang Tua</h1>
            <p className="muted">
              Masukkan nama lengkap dan NISN anak Anda untuk melihat laporan
              hasil belajarnya. Tidak perlu akun.
            </p>

            {error && <div className="alert">{error}</div>}

            <label>Nama Lengkap Siswa</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="mis. Muhammad Fakhrul"
            />

            <label>NISN</label>
            <input
              value={nisn}
              onChange={(e) => setNisn(e.target.value)}
              placeholder="Nomor Induk Siswa Nasional"
              inputMode="numeric"
            />

            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Memuat…" : "Lihat Laporan"}
            </button>
          </form>
        ) : (
          <div className="grades-wrap parent-report-wrap">
            <div className="grades-toolbar no-print">
              <button className="btn btn-ghost btn-sm" onClick={reset}>
                ← Cari siswa lain
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => window.print()}
              >
                🖨️ Cetak / Simpan PDF
              </button>
            </div>

            <div className="grades-report">
              <div className="parent-identity">
                {data.student.photoUrl ? (
                  <img
                    className="parent-photo"
                    src={data.student.photoUrl}
                    alt={data.student.name}
                  />
                ) : (
                  <div className="parent-photo parent-photo-ph">
                    {data.student.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="parent-identity-info">
                  <h2 className="m0">{data.student.name}</h2>
                  <div className="parent-id-meta">
                    <span>
                      NISN: <b>{data.student.nisn || "—"}</b>
                    </span>
                    {data.currentClass && (
                      <span>
                        Kelas: <b>{data.currentClass.name}</b>
                      </span>
                    )}
                    {data.currentClass?.waliKelasName &&
                      data.currentClass.waliKelasName !== "?" && (
                        <span>
                          Wali Kelas: <b>{data.currentClass.waliKelasName}</b>
                        </span>
                      )}
                  </div>
                  <div className="muted tiny">
                    Periode aktif: TA {data.activePeriod.academicYearName} ·{" "}
                    {capFirst(data.activePeriod.semester)} · Dicetak {today}
                  </div>
                </div>
              </div>

              <div className="grade-summary">
                <div className="gs-item">
                  <span className="gs-label">Rata-rata Nilai Keseluruhan</span>
                  <span className="gs-value">
                    {overallAverageAll === null ? "—" : overallAverageAll}
                  </span>
                </div>
                <div className="gs-item">
                  <span className="gs-label">Rata-rata Nilai Semester Aktif</span>
                  <span className="gs-value">
                    {activeAverage === null ? "—" : activeAverage}
                  </span>
                </div>
                <div className="gs-item">
                  <span className="gs-label">Kehadiran Keseluruhan</span>
                  <span className="gs-value gs-sm">
                    <AttendanceChips att={data.attendanceTotal} />
                  </span>
                </div>
                <div className="gs-item">
                  <span className="gs-label">Kehadiran Semester Aktif</span>
                  <span className="gs-value gs-sm">
                    <AttendanceChips att={activeAttendance} />
                  </span>
                </div>
              </div>

              {(yearOptions.length > 0 || semOptions.length > 0) && (
                <div className="parent-filter no-print">
                  <div className="pf-field">
                    <label>Tahun Akademik</label>
                    <select
                      value={yearFilter}
                      onChange={(e) => setYearFilter(e.target.value)}
                    >
                      <option value="">Semua tahun</option>
                      {yearOptions.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pf-field">
                    <label>Semester</label>
                    <select
                      value={semFilter}
                      onChange={(e) => setSemFilter(e.target.value)}
                    >
                      <option value="">Semua semester</option>
                      {semOptions.map((s) => (
                        <option key={s} value={s}>
                          {capFirst(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!isAllPeriods && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm pf-reset"
                      onClick={() => {
                        setYearFilter("");
                        setSemFilter("");
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}

              <section className="grade-section parent-chart-section">
                <h3 className="grade-section-title">
                  Grafik Nilai {scopeLabel}
                  <span className="grade-avg-tag">Rata-rata per mapel</span>
                </h3>
                <PerformanceChart data={chartData} />
              </section>

              {filteredSubjects.length === 0 && (
                <p className="muted">Belum ada nilai untuk periode ini.</p>
              )}

              {byPeriod.map((grp) => (
                <details className="grade-section parent-period" key={grp.key} open>
                  <summary className="grade-section-title">
                    <span className="period-caret" aria-hidden="true">
                      ▸
                    </span>
                    {grp.label}
                    {grp.periodActive && (
                      <span className="badge badge-done">Aktif</span>
                    )}
                    <span className="grade-avg-tag">
                      Rata-rata: {aggregateAverage(grp.rows) ?? "—"}
                    </span>
                  </summary>
                  <SubjectTable rows={grp.rows} showDetail={grp.periodActive} />
                </details>
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

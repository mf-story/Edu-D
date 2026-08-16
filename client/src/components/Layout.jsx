// =====================================================================
// Layout.jsx — Bingkai halaman: bilah atas dengan nama & tombol keluar.
// =====================================================================
import { useState } from "react";
import { useAuth } from "../auth.jsx";
import { useEffect } from "react";
import { api } from "../api";
import ProfileModal from "./ProfileModal.jsx";
import NotificationBell from "./NotificationBell.jsx";
import Logo from "./Logo.jsx";
import Footer from "./Footer.jsx";

const ROLE_LABEL = {
  admin: "Admin",
  pimpinan: "Pimpinan",
  teacher: "Pengajar",
  student: "Pelajar",
};

// Nama hari (indeks = Date.getDay(): 0=Minggu … 6=Sabtu) sesuai data jadwal.
const JS_DAY_NAMES = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [activeYear, setActiveYear] = useState(null);
  const [activeSemester, setActiveSemester] = useState("");
  const [classNames, setClassNames] = useState("");
  const [todayLessons, setTodayLessons] = useState([]);

  const today = JS_DAY_NAMES[new Date().getDay()];

  useEffect(() => {
    if (!user) return;
    api
      .listAcademicYears()
      .then((ys) => setActiveYear(ys.find((y) => y.active) || null))
      .catch(() => {});
    api
      .getActiveSemester()
      .then((r) => setActiveSemester(r.semester))
      .catch(() => {});
    if (user.role === "student") {
      api
        .listClasses()
        .then((cs) =>
          setClassNames(
            (cs || [])
              .filter((c) => c.periodActive)
              .map((c) => c.name)
              .filter(Boolean)
              .join(", ")
          )
        )
        .catch(() => {});
    }
  }, [user]);

  // Ambil jadwal pelajaran hari ini untuk pengajar & pelajar.
  useEffect(() => {
    if (!user || (user.role !== "teacher" && user.role !== "student")) return;
    let cancelled = false;
    async function loadToday() {
      try {
        const [schedules, classes] = await Promise.all([
          api.listSchedules(),
          api.listClasses(),
        ]);
        // Hanya kelas pada periode (tahun akademik + semester) aktif.
        const activeClassIds = new Set(
          (classes || []).filter((c) => c.periodActive).map((c) => c.id)
        );
        let list = (schedules || []).filter(
          (s) => s.day === today && activeClassIds.has(s.classId)
        );
        // Pengajar: tampilkan hanya mata pelajaran yang diampu sendiri.
        if (user.role === "teacher") {
          const subjects = await api.listSubjects();
          const mine = new Set((subjects || []).map((s) => s.id));
          list = list.filter((s) => !s.subjectId || mine.has(s.subjectId));
        }
        list.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
        if (!cancelled) setTodayLessons(list);
      } catch {
        if (!cancelled) setTodayLessons([]);
      }
    }
    loadToday();
    return () => {
      cancelled = true;
    };
  }, [user, today]);

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

  // Info dasar yang ditampilkan di sambutan, sesuai peran.
  const infoItems = [];
  if (user?.role === "student") {
    if (classNames) infoItems.push(["Kelas", classNames]);
    if (user.nisn) infoItems.push(["NISN", user.nisn]);
    if (user.tahunMasuk) infoItems.push(["Tahun Masuk", user.tahunMasuk]);
    infoItems.push(["Status", cap(user.status || "aktif")]);
  } else if (user?.role === "teacher") {
    if (user.nip) infoItems.push(["NIP", user.nip]);
    if (user.nuptk) infoItems.push(["NUPTK", user.nuptk]);
    if (user.email) infoItems.push(["Email", user.email]);
  } else if (user?.role === "admin") {
    if (user.email) infoItems.push(["Email", user.email]);
  } else if (user?.role === "pimpinan") {
    if (user.email) infoItems.push(["Email", user.email]);
    if (user.phone) infoItems.push(["Telepon", user.phone]);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo className="logo" size={30} /> Edu-D
        </div>
        <div className="topbar-right">
          {(user?.role === "student" || user?.role === "teacher") && (
            <NotificationBell />
          )}
          {activeYear && (
            <span className="year-badge" title="Periode akademik aktif">
              TA {activeYear.name}
              {activeSemester ? ` · ${cap(activeSemester)}` : ""}
            </span>
          )}
          <button
            className="user-chip user-chip-btn"
            onClick={() => setShowProfile(true)}
            title="Edit Biodata"
          >
            {user?.name} · <b>{ROLE_LABEL[user?.role] || user?.role}</b>
          </button>
          <button className="btn btn-ghost" onClick={logout}>
            Keluar
          </button>
        </div>
      </header>
      <main className="content">
        {user && (
          <section className="welcome-banner">
            <div className="welcome-photo">
              {user.photoUrl ? (
                <img src={user.photoUrl} alt={user.name} />
              ) : (
                <span>{(user.name || "?").charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="welcome-text">
              <h2 className="welcome-title">
                Selamat datang, {user.name}
                <span className="welcome-role">
                  {ROLE_LABEL[user.role] || user.role}
                </span>
              </h2>
              <div className="welcome-info">
                {infoItems.map(([k, v]) => (
                  <span key={k} className="welcome-chip">
                    <span className="muted">{k}:</span> {v}
                  </span>
                ))}
              </div>
            </div>
            {user.role !== "admin" && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowProfile(true)}
              >
                Edit Biodata
              </button>
            )}
          </section>
        )}
        {user && (user.role === "teacher" || user.role === "student") && (
          <section className="today-lessons">
            <span className="today-lessons-head">
              📅 Pelajaran Hari Ini · {today}
            </span>
            {todayLessons.length === 0 ? (
              <span className="muted tiny">Tidak ada pelajaran hari ini.</span>
            ) : (
              <div className="today-lessons-list">
                {todayLessons.map((s) => (
                  <span key={s.id} className="today-lesson-chip">
                    <b>
                      {s.startTime}
                      {s.endTime ? `–${s.endTime}` : ""}
                    </b>{" "}
                    {s.subjectName || s.title || "Kegiatan"}
                    {user.role === "teacher" && s.className
                      ? ` · ${s.className}`
                      : ""}
                    {s.roomName ? ` · 🏫 ${s.roomName}` : ""}
                    {user.role === "student" && s.teacherNames
                      ? ` · 👤 ${s.teacherNames}`
                      : ""}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}
        {children}
      </main>
      <Footer />
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}

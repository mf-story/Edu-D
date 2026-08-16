// =====================================================================
// AdminDashboard.jsx — Admin: kelola pengguna, kelas, dan jadwal.
// =====================================================================
import { Fragment, useEffect, useState } from "react";
import { api } from "../api";
import AnnouncementsBanner from "../components/AnnouncementsBanner.jsx";
import AnnouncementMedia from "../components/AnnouncementMedia.jsx";
import { RichText, RichTextEditor } from "../components/RichText.jsx";

// Hari untuk penjadwalan (dipakai di form Rombel & pengelola jadwal).
const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

// Tab admin dikelompokkan agar susunannya rapi & mudah dipindai.
const TAB_GROUPS = [
  {
    group: "Ringkasan",
    items: [{ key: "stats", label: "Dashboard", icon: "📊" }],
  },
  {
    group: "Akademik",
    items: [
      { key: "years", label: "Tahun Akademik", icon: "�️" },
      { key: "classes", label: "Jadwal", icon: "🗓️" },
      { key: "master", label: "Kelas", icon: "🏫" },
      { key: "mapel", label: "Mapel", icon: "📚" },
      { key: "kurikulum", label: "Kurikulum", icon: "📗" },
      { key: "bahan", label: "Bahan Ajar", icon: "📖" },
      { key: "rooms", label: "Ruangan", icon: "🚪" },
    ],
  },
  {
    group: "Pengguna",
    items: [
      { key: "teachers", label: "Pengajar", icon: "👨‍🏫" },
      { key: "students", label: "Pelajar", icon: "🎓" },
      { key: "alumni", label: "Alumni", icon: "🎖️" },
      { key: "pimpinan", label: "Pimpinan", icon: "🏛️" },
      { key: "admins", label: "Admin", icon: "🛡️" },
    ],
  },
  {
    group: "Informasi",
    items: [{ key: "announcements", label: "Pengumuman", icon: "📢" }],
  },
];

// Status murid yang tersedia.
const STUDENT_STATUSES = [
  "aktif",
  "tidak aktif",
  "pindah",
  "keluar",
  "meninggal",
  "lulus",
];
// Status kepegawaian pengajar (umum di Indonesia).
const KEPEGAWAIAN_STATUSES = [
  "PNS",
  "PPPK",
  "GTY (Guru Tetap Yayasan)",
  "GTT (Guru Tidak Tetap)",
  "Honorer",
  "Kontrak",
];
// Kategori/jenis guru.
const JENIS_GURU_OPTS = ["Guru Kelas", "Guru Mata Pelajaran"];
const capStatus = (s) =>
  (s || "aktif").replace(/\b\w/g, (c) => c.toUpperCase());

// Pembagian jenjang sekolah menjadi fase (harus konsisten dengan backend).
// Catatan: kelas SMA (E) & SMK (F) sama-sama 10–12, sehingga fase disimpan
// eksplisit pada tiap kelas, bukan ditebak dari angka tingkat.
const FASE = {
  A: { label: "SD/MI", jenjang: "SD", grades: [1, 2], prefix: "" },
  B: { label: "SD/MI", jenjang: "SD", grades: [3, 4], prefix: "" },
  C: { label: "SD/MI", jenjang: "SD", grades: [5, 6], prefix: "" },
  D: { label: "SMP/MTs", jenjang: "SMP", grades: [7, 8, 9], prefix: "" },
  E: { label: "SMA/MA", jenjang: "SMA", grades: [10, 11, 12], prefix: "SMA " },
  F: { label: "SMK/MAK", jenjang: "SMK", grades: [10, 11, 12], prefix: "SMK " },
};
const FASE_KEYS = ["A", "B", "C", "D", "E", "F"];
const ROMBEL_OPTS = ["A", "B", "C"];
const faseLabel = (f) => (FASE[f] ? `Fase ${f} · ${FASE[f].label}` : `Fase ${f || "?"}`);
// Master mapel kini disimpan per fase, sehingga satu nama dapat muncul di
// beberapa fase. Untuk dropdown pemilih (yang hanya butuh nama), tampilkan
// nama unik agar tidak duplikat.
const uniqueSubjectNames = (options) => {
  const seen = new Set();
  const out = [];
  (options || []).forEach((o) => {
    const key = (o.name || "").toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(o);
  });
  return out.sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", "id", { numeric: true })
  );
};
const buildClassName = (fase, grade, rombel) => {
  const prefix = (FASE[fase] && FASE[fase].prefix) || "";
  const r = String(rombel || "").trim().toUpperCase();
  return `${prefix}Kelas ${grade}${r ? " " + r : ""}`;
};
const buildTingkat = (fase, grade) =>
  `${(FASE[fase] && FASE[fase].prefix) || ""}Kelas ${grade}`;
const inferFase = (name) => {
  const s = String(name || "").trim();
  if (/^SMK\b/i.test(s)) return "F";
  if (/^SMA\b/i.test(s)) return "E";
  const gm = s.match(/(\d+)/);
  const grade = gm ? parseInt(gm[1], 10) : null;
  if (grade == null) return "";
  if (grade <= 2) return "A";
  if (grade <= 4) return "B";
  if (grade <= 6) return "C";
  if (grade <= 9) return "D";
  return "E";
};

// Jenis kurikulum (berlaku untuk semua jenjang/fase).
const CURRICULUM_TYPES = [
  { key: "merdeka", label: "Kurikulum Merdeka" },
  { key: "k13", label: "Kurikulum 2013 (K-13)" },
  { key: "ktsp2006", label: "KTSP 2006" },
];
const SMP_KELAS = [7, 8, 9];
const SEMESTER_OPTS = [
  { key: "ganjil", label: "Ganjil" },
  { key: "genap", label: "Genap" },
];
const curTypeLabel = (k) =>
  (CURRICULUM_TYPES.find((t) => t.key === k) || {}).label || k || "—";

// Ikon & warna aksen per mata pelajaran untuk tampilan katalog kurikulum.
const MAPEL_STYLE = {
  "Bahasa Indonesia": { icon: "📖", color: "#e11d48" },
  "Bahasa Inggris": { icon: "🌐", color: "#2563eb" },
  "Ilmu Pengetahuan Alam": { icon: "🔬", color: "#059669" },
  "Ilmu Pengetahuan Sosial": { icon: "🌍", color: "#d97706" },
  Matematika: { icon: "🔢", color: "#7c3aed" },
  "Pendidikan Agama": { icon: "🕌", color: "#0d9488" },
  "Pendidikan Jasmani": { icon: "⚽", color: "#ea580c" },
  "Pendidikan Pancasila dan Kewarganegaraan": { icon: "🏛️", color: "#b91c1c" },
  "Seni Budaya": { icon: "🎨", color: "#db2777" },
};
const mapelStyle = (m) => MAPEL_STYLE[m] || { icon: "📘", color: "#6366f1" };

// Bagian-bagian alamat sesuai penulisan alamat di Indonesia.
const ALAMAT_PARTS = [
  { suffix: "Jalan", label: "Nama Jalan / No. Rumah", placeholder: "Jl. Merdeka No. 10, RT 003/RW 002" },
  { suffix: "Desa", label: "Desa / Kelurahan", placeholder: "Sudiang" },
  { suffix: "Kecamatan", label: "Kecamatan", placeholder: "Biringkanaya" },
  { suffix: "Kabupaten", label: "Kabupaten / Kota", placeholder: "Kota Makassar" },
  { suffix: "Provinsi", label: "Provinsi", placeholder: "Sulawesi Selatan" },
];

// Field profil murid tambahan (hanya tampil di form & detail, bukan tabel).
// type "address" akan dijabarkan menjadi beberapa sub-kolom (ALAMAT_PARTS).
const STUDENT_PROFILE_FIELDS = [
  { key: "alamat", label: "Alamat", type: "address" },
  { key: "namaAyah", label: "Nama Ayah" },
  { key: "alamatAyah", label: "Alamat Ayah", type: "address" },
  { key: "pekerjaanAyah", label: "Pekerjaan Ayah" },
  { key: "hpAyah", label: "Nomor Handphone Ayah" },
  { key: "namaIbu", label: "Nama Ibu" },
  { key: "alamatIbu", label: "Alamat Ibu", type: "address" },
  { key: "pekerjaanIbu", label: "Pekerjaan Ibu" },
  { key: "hpIbu", label: "Nomor Handphone Ibu" },
  { key: "namaWali", label: "Nama Wali" },
  { key: "alamatWali", label: "Alamat Wali", type: "address" },
  { key: "pekerjaanWali", label: "Pekerjaan Wali" },
  { key: "hpWali", label: "Nomor Handphone Wali" },
];

// Sub-kolom penyimpanan untuk sebuah alamat (mis. "alamatAyah" -> "alamatAyahJalan", dst).
const addressSubKeys = (base) => ALAMAT_PARTS.map((p) => base + p.suffix);

// Semua key penyimpanan profil (alamat dijabarkan jadi sub-kolomnya).
const profileStorageKeys = () =>
  STUDENT_PROFILE_FIELDS.flatMap((f) =>
    f.type === "address" ? addressSubKeys(f.key) : [f.key]
  );

// Baris-baris detail profil murid (alamat ditampilkan per bagian).
function ProfileDetailRows({ user }) {
  return STUDENT_PROFILE_FIELDS.map((f) => {
    if (f.type === "address") {
      return (
        <Fragment key={f.key}>
          <tr>
            <td className="tiny alamat-detail-head" colSpan={2}>
              <b>{f.label}</b>
            </td>
          </tr>
          {ALAMAT_PARTS.map((p) => (
            <tr key={f.key + p.suffix}>
              <td className="tiny" style={{ width: "45%", paddingLeft: 18 }}>
                {p.label}
              </td>
              <td className="tiny">
                {user[f.key + p.suffix] || <span className="muted">—</span>}
              </td>
            </tr>
          ))}
        </Fragment>
      );
    }
    return (
      <tr key={f.key}>
        <td className="tiny" style={{ width: "45%" }}>
          <b>{f.label}</b>
        </td>
        <td className="tiny">
          {user[f.key] || <span className="muted">—</span>}
        </td>
      </tr>
    );
  });
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("stats");
  return (
    <div>
      <AnnouncementsBanner />
      <div className="admin-tabs-top">
        {[...TAB_GROUPS[0].items, ...TAB_GROUPS[3].items].map((t) => (
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
      <div className="admin-tabs">
        {TAB_GROUPS.slice(1, 3).map((g) => (
          <div className="tab-group" key={g.group}>
            <span className="tab-group-label">{g.group}</span>
            <div className="tab-group-items">
              {g.items.map((t) => (
                <button
                  key={t.key}
                  className={`tab ${tab === t.key ? "active" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  <span className="tab-ico">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {tab === "stats" && <StatsTab />}
      {tab === "classes" && <ClassesTab />}
      {tab === "master" && <MasterKelasTab />}
      {tab === "mapel" && <MapelTab />}
      {tab === "kurikulum" && <KurikulumTab />}
      {tab === "bahan" && <BahanAjarTab />}
      {tab === "years" && <AcademicYearsTab />}
      {tab === "admins" && <UsersTab role="admin" />}
      {tab === "pimpinan" && <UsersTab role="pimpinan" />}
      {tab === "teachers" && <UsersTab role="teacher" />}
      {tab === "students" && <UsersTab role="student" />}
      {tab === "alumni" && <AlumniTab />}
      {tab === "rooms" && <RoomsTab />}
      {tab === "announcements" && <AnnouncementsTab />}
    </div>
  );
}

/* ---------------- Dashboard Statistik ---------------- */

const ROLE_META = {
  admin: { label: "Admin", color: "#6366f1", icon: "🛡️" },
  teacher: { label: "Pengajar", color: "#0d9488", icon: "👨‍🏫" },
  student: { label: "Pelajar", color: "#d97706", icon: "🎓" },
};
const STATUS_COLORS = {
  aktif: "#16a34a",
  "tidak aktif": "#9ca3af",
  pindah: "#0ea5e9",
  keluar: "#f59e0b",
  meninggal: "#6b7280",
  lulus: "#6366f1",
};

// Donut chart sederhana berbasis SVG (tanpa dependensi eksternal).
function DonutChart({ data, size = 150, thickness = 24 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#eef2f7"
        strokeWidth={thickness}
      />
      {total > 0 &&
        data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * circ;
          const seg = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return seg;
        })}
      <text
        x={cx}
        y={cy - 3}
        textAnchor="middle"
        fontSize="24"
        fontWeight="700"
        fill="#111827"
      >
        {total}
      </text>
      <text x={cx} y={cy + 15} textAnchor="middle" fontSize="11" fill="#6b7280">
        total
      </text>
    </svg>
  );
}

// Bar chart horizontal sederhana.
function BarChart({ data, unit = "" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="as-bars">
      {data.length === 0 && <div className="muted tiny">Belum ada data.</div>}
      {data.map((d, i) => (
        <div className="as-bar-row" key={i}>
          <div className="as-bar-label" title={d.label}>
            {d.label}
          </div>
          <div className="as-bar-track">
            <div
              className="as-bar-fill"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.color || "var(--primary)",
              }}
            />
          </div>
          <div className="as-bar-num">
            {d.value}
            {unit}
          </div>
        </div>
      ))}
    </div>
  );
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return "baru saja";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}

function StatCard({ icon, label, value, accent, sub }) {
  return (
    <div className="as-card">
      <div
        className="as-card-icon"
        style={{ background: `${accent}18`, color: accent }}
      >
        {icon}
      </div>
      <div className="as-card-body">
        <div className="as-card-value">{value}</div>
        <div className="as-card-label">{label}</div>
        {sub && <div className="as-card-sub">{sub}</div>}
      </div>
    </div>
  );
}

export function StatsTab({ leadership = false } = {}) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  function load() {
    api
      .stats()
      .then(setStats)
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 1000);
    return () => clearInterval(t);
  }, []);

  if (error) return <div className="alert">{error}</div>;
  if (!stats) return <div className="muted center">Memuat statistik…</div>;

  const roleData = ["admin", "teacher", "student"].map((r) => ({
    label: ROLE_META[r].label,
    value: stats.users[r] || 0,
    color: ROLE_META[r].color,
  }));
  const statusData = Object.entries(stats.studentStatus || {})
    .map(([k, v]) => ({
      label: capStatus(k),
      value: v,
      color: STATUS_COLORS[k] || "#94a3b8",
    }))
    .sort((a, b) => b.value - a.value);
  const classData = (stats.studentsPerClass || []).map((c) => ({
    label: c.name,
    value: c.count,
    color: "#6366f1",
  }));
  const c = stats.content || {};

  return (
    <div className="as-tab">
      {/* Ringkasan pengguna & online */}
      <div className="as-cards">
        {leadership ? (
          <>
            <StatCard
              icon={ROLE_META.teacher.icon}
              label="Pengajar"
              value={stats.users.teacher}
              accent={ROLE_META.teacher.color}
            />
            <StatCard
              icon={ROLE_META.student.icon}
              label="Pelajar"
              value={stats.users.student}
              accent={ROLE_META.student.color}
            />
            <StatCard
              icon="🧑‍🎓"
              label="Alumni"
              value={stats.users.alumni ?? 0}
              accent="#7c3aed"
            />
            <StatCard
              icon="🏫"
              label="Kelas Aktif"
              value={c.activeClasses}
              accent="#6366f1"
            />
            <StatCard
              icon="🚪"
              label="Ruangan"
              value={c.rooms}
              accent="#0ea5e9"
            />
            <StatCard
              icon="📈"
              label="Rata-rata Nilai Semester Aktif"
              value={stats.grades?.activeAverage ?? "—"}
              accent="#0d9488"
            />
            <StatCard
              icon="📊"
              label="Rata-rata Nilai Keseluruhan"
              value={stats.grades?.overallAverage ?? "—"}
              accent="#d97706"
            />
            <StatCard
              icon="🟢"
              label="Sedang Online"
              value={stats.online.total}
              accent="#16a34a"
              sub={`${stats.onlineWindowMinutes} mnt terakhir`}
            />
          </>
        ) : (
          <>
            <StatCard
              icon="👥"
              label="Total Pengguna"
              value={stats.users.total}
              accent="#6366f1"
            />
            <StatCard
              icon="🟢"
              label="Sedang Online"
              value={stats.online.total}
              accent="#16a34a"
              sub={`${stats.onlineWindowMinutes} mnt terakhir`}
            />
            <StatCard
              icon={ROLE_META.teacher.icon}
              label="Pengajar"
              value={stats.users.teacher}
              accent={ROLE_META.teacher.color}
            />
            <StatCard
              icon={ROLE_META.student.icon}
              label="Pelajar"
              value={stats.users.student}
              accent={ROLE_META.student.color}
            />
            <StatCard
              icon={ROLE_META.admin.icon}
              label="Admin"
              value={stats.users.admin}
              accent={ROLE_META.admin.color}
            />
          </>
        )}
      </div>

      <div className="as-grid">
        {/* Komposisi pengguna */}
        <div className="as-panel">
          <h4 className="as-panel-title">Komposisi Pengguna</h4>
          <div className="as-donut">
            <DonutChart data={roleData} />
            <ul className="as-legend">
              {roleData.map((d) => (
                <li key={d.label}>
                  <span className="as-dot" style={{ background: d.color }} />
                  {d.label}
                  <b>{d.value}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Online sekarang */}
        <div className="as-panel">
          <h4 className="as-panel-title">
            Online Sekarang
            <span className="as-badge">{stats.online.total}</span>
          </h4>
          <div className="as-role-row">
            {["admin", "teacher", "student"].map((r) => (
              <div className="as-role" key={r}>
                <span
                  className="as-dot"
                  style={{ background: ROLE_META[r].color }}
                />
                {ROLE_META[r].label}
                <b>{stats.online.byRole[r] || 0}</b>
              </div>
            ))}
          </div>
          <div className="as-list">
            {stats.online.users.length === 0 && (
              <div className="muted tiny">Tidak ada yang online.</div>
            )}
            {stats.online.users.map((u) => (
              <div className="as-item" key={u.id}>
                <span className="as-pulse" />
                <span className="as-name">{u.name}</span>
                <span
                  className="as-pill"
                  style={{
                    background: `${ROLE_META[u.role]?.color}18`,
                    color: ROLE_META[u.role]?.color,
                  }}
                >
                  {ROLE_META[u.role]?.label || u.role}
                </span>
                <span className="muted tiny as-ago">{timeAgo(u.lastSeenAt)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Murid per kelas */}
        <div className="as-panel">
          <h4 className="as-panel-title">Jumlah Murid per Kelas (aktif)</h4>
          <BarChart data={classData} />
        </div>

        {/* Status murid */}
        <div className="as-panel">
          <h4 className="as-panel-title">Status Murid</h4>
          <BarChart data={statusData} />
        </div>
      </div>

      {/* Siswa berprestasi */}
      <div className="as-panel as-toppanel">
        <h4 className="as-panel-title">🏆 Siswa Berprestasi</h4>
        {(stats.topStudents || []).length === 0 ? (
          <div className="muted tiny">
            Belum ada nilai untuk menentukan peringkat.
          </div>
        ) : (
          <ol className="as-rank">
            {stats.topStudents.map((s, i) => (
              <li className="as-rank-item" key={s.id}>
                <span className={`as-rank-no rank-${i + 1}`}>
                  {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
                </span>
                <span className="as-rank-name">
                  {s.name}
                  <span className="as-rank-class">{s.className}</span>
                </span>
                <span className="as-rank-bar">
                  <span
                    className="as-rank-fill"
                    style={{ width: `${Math.min(100, s.average)}%` }}
                  />
                </span>
                <span className="as-rank-score">{s.average}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Ringkasan konten */}
      <h4 className="as-panel-title as-section">Ringkasan Data</h4>
      <div className="as-mini">
        {[
          { icon: "🏫", label: "Kelas", value: c.classes },
          { icon: "📚", label: "Mata Pelajaran", value: c.subjects },
          { icon: "🗓️", label: "Jadwal", value: c.schedules },
          { icon: "🚪", label: "Ruangan", value: c.rooms },
          { icon: "📄", label: "Materi", value: c.materials },
          { icon: "📝", label: "Tugas", value: c.assignments },
          { icon: "🧩", label: "Kuis", value: c.quizzes },
          { icon: "📥", label: "Pengumpulan", value: c.submissions },
          { icon: "📢", label: "Pengumuman", value: c.announcements },
          { icon: "�️", label: "Tahun Akademik", value: c.academicYears },
        ].map((m) => (
          <div className="as-mini-card" key={m.label}>
            <span className="as-mini-icon">{m.icon}</span>
            <span className="as-mini-value">{m.value ?? 0}</span>
            <span className="as-mini-label">{m.label}</span>
          </div>
        ))}
      </div>
      <p className="muted tiny as-updated">
        Diperbarui otomatis tiap 30 detik · terakhir {timeAgo(stats.generatedAt)}
      </p>
    </div>
  );
}

/* ---------------- Pengumuman ---------------- */
function AnnouncementsTab() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: "", text: "" });
  const [editId, setEditId] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [existingMedia, setExistingMedia] = useState(null); // {url,type,name}
  const [removeMedia, setRemoveMedia] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    api.listAnnouncements().then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  function reset() {
    setForm({ title: "", text: "" });
    setEditId(null);
    setMediaFile(null);
    setExistingMedia(null);
    setRemoveMedia(false);
  }
  function startEdit(a) {
    setForm({ title: a.title, text: a.text });
    setEditId(a.id);
    setMediaFile(null);
    setRemoveMedia(false);
    setExistingMedia(
      a.mediaUrl ? { url: a.mediaUrl, type: a.mediaType, name: a.mediaName } : null
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function add(e) {
    e.preventDefault();
    setError("");
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("text", form.text);
      if (mediaFile) fd.append("media", mediaFile);
      if (editId) {
        if (!mediaFile && removeMedia) fd.append("removeMedia", "true");
        await api.updateAnnouncementForm(editId, fd);
      } else {
        await api.createAnnouncementForm(fd);
      }
      reset();
      load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function del(id) {
    if (!confirm("Hapus pengumuman ini?")) return;
    await api.deleteAnnouncement(id);
    if (editId === id) reset();
    load();
  }

  return (
    <div className="grid-2">
      <div className="card">
        <h3>{editId ? "Ubah Pengumuman" : "Buat Pengumuman"}</h3>
        {error && <div className="alert">{error}</div>}
        <form onSubmit={add} className="form">
          <label>Judul</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <label>Isi</label>
          <textarea
            rows={4}
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            required
          />
          <label>Lampiran (gambar, video, atau suara)</label>
          <input
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={(e) => {
              setMediaFile(e.target.files[0] || null);
              setRemoveMedia(false);
            }}
          />
          {mediaFile && (
            <AnnouncementMedia
              url={URL.createObjectURL(mediaFile)}
              type={
                mediaFile.type.startsWith("image/")
                  ? "image"
                  : mediaFile.type.startsWith("video/")
                  ? "video"
                  : mediaFile.type.startsWith("audio/")
                  ? "audio"
                  : "file"
              }
              name={mediaFile.name}
            />
          )}
          {!mediaFile && existingMedia && !removeMedia && (
            <div>
              <AnnouncementMedia
                url={existingMedia.url}
                type={existingMedia.type}
                name={existingMedia.name}
              />
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => setRemoveMedia(true)}
              >
                Hapus lampiran
              </button>
            </div>
          )}
          {!mediaFile && existingMedia && removeMedia && (
            <p className="muted tiny m0">
              Lampiran akan dihapus saat disimpan.{" "}
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setRemoveMedia(false)}
              >
                Batalkan
              </button>
            </p>
          )}
          <div className="row-gap">
            <button className="btn btn-primary">
              {editId ? "Perbarui" : "Terbitkan"}
            </button>
            {editId && (
              <button type="button" className="btn" onClick={reset}>
                Batal
              </button>
            )}
          </div>
        </form>
      </div>
      <div className="card">
        <h3>Pengumuman ({items.length})</h3>
        <div className="stack">
          {items.map((a) => (
            <div className="list-item column" key={a.id}>
              <div className="row-between">
                <b>{a.title}</b>
                <span className="row-gap">
                  <button
                    className="btn btn-sm"
                    onClick={() => startEdit(a)}
                  >
                    Ubah
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => del(a.id)}
                  >
                    Hapus
                  </button>
                </span>
              </div>
              <p className="pre m0">{a.text}</p>
              <AnnouncementMedia
                url={a.mediaUrl}
                type={a.mediaType}
                name={a.mediaName}
              />
              <span className="muted tiny">
                {a.authorName} ·{" "}
                {new Date(a.createdAt).toLocaleString("id-ID")}
              </span>
            </div>
          ))}
          {items.length === 0 && (
            <p className="muted">Belum ada pengumuman.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Pengguna ---------------- */
function slugifyUsername(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.]/g, "")
    .trim()
    .replace(/\s+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

export function UsersTab({ role = "student", readOnly = false }) {
  const ROLE_LABELS = {
    admin: "Admin",
    pimpinan: "Pimpinan",
    teacher: "Pengajar",
    student: "Pelajar",
  };
  const label = ROLE_LABELS[role] || "Pengguna";
  const rich = role === "teacher" || role === "student";
  const defaultPassword =
    role === "teacher"
      ? "guru123"
      : role === "student"
      ? "siswa123"
      : role === "pimpinan"
      ? "pimpinan123"
      : "";
  // Field identitas khas peran.
  const idFields =
    role === "teacher"
      ? [
          { key: "nip", label: "NIP (jika ada)", col: "NIP" },
          { key: "nuptk", label: "NUPTK (jika ada)", col: "NUPTK" },
          { key: "tahunMasuk", label: "Tahun Masuk", col: "Thn Masuk" },
        ]
      : role === "student"
      ? [
          { key: "nisn", label: "NISN", col: "NISN" },
          { key: "tahunMasuk", label: "Tahun Masuk", col: "Thn Masuk" },
        ]
      : [];
  const emptyForm = {
    name: "",
    username: "",
    password: defaultPassword,
    nip: "",
    nuptk: "",
    nisn: "",
    tahunMasuk: "",
    mapel: [],
    jenisGuru: "",
    statusKepegawaian: "",
    alamat: "",
    status: "aktif",
    email: "",
    phone: "",
    ...Object.fromEntries(profileStorageKeys().map((k) => [k, ""])),
  };
  const [users, setUsers] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [editId, setEditId] = useState("");
  const [existingPhotoUrl, setExistingPhotoUrl] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvResult, setCsvResult] = useState("");
  const [viewUser, setViewUser] = useState(null);
  const [transcriptUser, setTranscriptUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [graduating, setGraduating] = useState(null);
  const [graduateYear, setGraduateYear] = useState("");
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState("asc");

  const load = () =>
    api.listUsers(role).then(setUsers).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [role]);
  useEffect(() => {
    if (role === "teacher")
      api
        .listSubjectNameOptions()
        .then((l) => setSubjectOptions(uniqueSubjectNames(l)))
        .catch(() => {});
  }, [role]);

  function changeName(name) {
    setForm((f) => ({
      ...f,
      name,
      // Username otomatis dari nama lengkap, kecuali sudah diubah manual.
      username: usernameTouched ? f.username : slugifyUsername(name),
    }));
  }

  function reset() {
    setForm({ ...emptyForm, password: editId ? "" : defaultPassword });
    setPhotoFile(null);
    setUsernameTouched(false);
    setEditId("");
    setExistingPhotoUrl("");
    setShowForm(false);
  }

  function openCreate() {
    setError("");
    setEditId("");
    setForm({ ...emptyForm, password: defaultPassword });
    setPhotoFile(null);
    setUsernameTouched(false);
    setExistingPhotoUrl("");
    setShowForm(true);
  }

  function startEdit(u) {
    setError("");
    setEditId(u.id);
    setForm({
      name: u.name || "",
      username: u.username || "",
      password: "", // kosong = tidak mengubah password
      nip: u.nip || "",
      nuptk: u.nuptk || "",
      nisn: u.nisn || "",
      tahunMasuk: u.tahunMasuk || "",
      mapel: Array.isArray(u.mapel) ? u.mapel : [],
      jenisGuru: u.jenisGuru || "",
      statusKepegawaian: u.statusKepegawaian || "",
      alamat: u.alamat || "",
      status: u.status || "aktif",
      email: u.email || "",
      phone: u.phone || "",
      ...Object.fromEntries(
        profileStorageKeys().map((k) => [k, u[k] || ""])
      ),
    });
    setPhotoFile(null);
    setExistingPhotoUrl(u.photoUrl || "");
    setUsernameTouched(true);
    setShowForm(true);
  }

  async function add(e) {
    e.preventDefault();
    setError("");
    try {
      if (rich) {
        const fd = new FormData();
        fd.append("role", role);
        fd.append("name", form.name);
        fd.append("username", form.username || slugifyUsername(form.name));
        if (form.password) fd.append("password", form.password);
        idFields.forEach((f) => fd.append(f.key, form[f.key] || ""));
        if (role === "teacher") {
          fd.append("mapel", JSON.stringify(form.mapel || []));
          fd.append("jenisGuru", form.jenisGuru || "");
          fd.append("statusKepegawaian", form.statusKepegawaian || "");
          fd.append("alamat", form.alamat || "");
        }
        if (role === "student") {
          fd.append("status", form.status || "aktif");
          profileStorageKeys().forEach((k) =>
            fd.append(k, form[k] || "")
          );
        }
        fd.append("email", form.email || "");
        fd.append("phone", form.phone || "");
        if (photoFile) fd.append("photo", photoFile);
        if (editId) {
          await api.updateUserForm(editId, fd);
        } else {
          if (!form.password) fd.set("password", defaultPassword);
          await api.createUserForm(fd);
        }
      } else {
        const payload = {
          role,
          name: form.name,
          username: form.username,
        };
        if (form.password) payload.password = form.password;
        if (editId) await api.updateUser(editId, payload);
        else await api.createUser(payload);
      }
      reset();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  // Impor pengguna massal dari CSV.
  function parseCsv(text) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return [];
    const splitLine = (line) => {
      const out = [];
      let cur = "";
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQuote = !inQuote;
        } else if (ch === "," && !inQuote) {
          out.push(cur);
          cur = "";
        } else cur += ch;
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };
    const header = splitLine(lines[0]).map((h) => h.toLowerCase());
    return lines.slice(1).map((line) => {
      const cells = splitLine(line);
      const row = {};
      header.forEach((h, i) => (row[h] = cells[i] || ""));
      return row;
    });
  }

  async function importCsv(file) {
    setError("");
    setCsvResult("");
    if (!file) return;
    setCsvBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setCsvResult("File CSV kosong atau tidak ada baris data.");
        return;
      }
      let ok = 0;
      const fails = [];
      for (const [idx, row] of rows.entries()) {
        const name = row.name || row.nama || row["nama lengkap"] || "";
        if (!name.trim()) {
          fails.push(`Baris ${idx + 2}: nama kosong`);
          continue;
        }
        const username = row.username || row.user || slugifyUsername(name);
        const password = row.password || defaultPassword;
        try {
          const fd = new FormData();
          fd.append("role", role);
          fd.append("name", name.trim());
          fd.append("username", username);
          fd.append("password", password);
          idFields.forEach((f) =>
            fd.append(f.key, row[f.key] || row[f.key.toLowerCase()] || "")
          );
          fd.append("email", row.email || "");
          fd.append(
            "phone",
            row.phone || row.hp || row["nomor handphone"] || ""
          );
          if (role === "student") {
            const st = (row.status || "aktif").toLowerCase();
            fd.append("status", STUDENT_STATUSES.includes(st) ? st : "aktif");
            profileStorageKeys().forEach((k) =>
              fd.append(k, row[k] || row[k.toLowerCase()] || "")
            );
          }
          await api.createUserForm(fd);
          ok++;
        } catch (err) {
          fails.push(`Baris ${idx + 2} (${name.trim()}): ${err.message}`);
        }
      }
      setCsvResult(
        `Berhasil menambah ${ok} ${label.toLowerCase()}.` +
          (fails.length ? ` Gagal ${fails.length}: ${fails.join("; ")}` : "")
      );
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCsvBusy(false);
    }
  }

  async function del(id) {
    if (!confirm(`Hapus ${label.toLowerCase()} ini?`)) return;
    try {
      await api.deleteUser(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function changeStatus(u, status) {
    // Saat menandai lulus, minta admin memilih tahun lulus dahulu sebelum
    // siswa dipindahkan ke daftar Alumni.
    if (status === "lulus") {
      setGraduating(u);
      setGraduateYear(
        u.lulusAt
          ? String(new Date(u.lulusAt).getFullYear())
          : String(new Date().getFullYear())
      );
      return;
    }
    try {
      await api.updateUser(u.id, { status });
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function confirmGraduate() {
    if (!graduating) return;
    const yr = parseInt(graduateYear, 10);
    if (!(yr >= 1900 && yr <= 3000)) {
      alert("Tahun lulus tidak valid");
      return;
    }
    try {
      await api.updateUser(graduating.id, {
        status: "lulus",
        tahunLulus: yr,
      });
      setGraduating(null);
      setGraduateYear("");
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  const csvCols = ["name", "username", ...idFields.map((f) => f.key), "email", "phone", "password"];

  // Nilai untuk pengurutan kolom.
  function sortVal(u, key) {
    switch (key) {
      case "name":
        return (u.name || "").toLowerCase();
      case "username":
        return (u.username || "").toLowerCase();
      case "mapel":
        return (u.mapel || []).join(", ").toLowerCase();
      case "jenisGuru":
        return (u.jenisGuru || "").toLowerCase();
      case "statusKepegawaian":
        return (u.statusKepegawaian || "").toLowerCase();
      case "alamat":
        return (u.alamat || "").toLowerCase();
      case "status":
        return (u.status || "").toLowerCase();
      case "kontak":
        return (u.email || u.phone || "").toLowerCase();
      default:
        return String(u[key] ?? "").toLowerCase();
    }
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Atribut untuk judul kolom yang bisa diklik (urut + sorot).
  const thProps = (key) => ({
    className: "th-sort" + (sortKey === key ? " sorted" : ""),
    onClick: () => toggleSort(key),
    role: "button",
    title: "Klik untuk mengurutkan & menyorot kolom",
  });
  const sortArrow = (key) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";
  const colClass = (key) => (sortKey === key ? "col-highlight" : undefined);

  // Unduh daftar pengguna (sesuai urutan & filter yang tampil) sebagai CSV.
  function exportCsv() {
    const cols =
      role === "teacher"
        ? [
            "name",
            "username",
            "nip",
            "nuptk",
            "tahunMasuk",
            "mapel",
            "jenisGuru",
            "statusKepegawaian",
            "alamat",
            "email",
            "phone",
          ]
        : role === "student"
        ? ["name", "username", "nisn", "tahunMasuk", "status", "email", "phone"]
        : ["name", "username"];
    const esc = (v) => {
      const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = displayed.map((u) => cols.map((c) => esc(u[c])).join(","));
    const csv = [cols.join(","), ...rows].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daftar-${role}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Murid berstatus lulus dipindahkan ke tab Alumni.
  const filtered =
    role === "student"
      ? users.filter((u) => (u.status || "aktif") !== "lulus")
      : users;
  const displayed = sortKey
    ? [...filtered].sort((a, b) => {
        const cmp = sortVal(a, sortKey).localeCompare(
          sortVal(b, sortKey),
          "id",
          { numeric: true }
        );
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filtered;

  return (
    <div className="users-layout">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <h3 className="m0">
          Daftar {label} ({displayed.length})
        </h3>
        <div className="row" style={{ gap: 8 }}>
          {rich && (
            <button
              className="btn btn-ghost"
              onClick={exportCsv}
              disabled={displayed.length === 0}
            >
              ⬇ Unduh CSV
            </button>
          )}
          {!readOnly && (
            <button className="btn btn-primary" onClick={openCreate}>
              + Tambah {label}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={reset}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="m0">
                {editId ? "Ubah" : "Tambah"} {label}
              </h3>
              <button className="btn btn-sm" onClick={reset}>
                Tutup
              </button>
            </div>
            {error && <div className="alert">{error}</div>}
            <form onSubmit={add} className="form">
          {rich && (
            <p className="muted tiny m0">
              ID dibuat otomatis. Username terisi otomatis dari nama lengkap
              (boleh diubah).
              {editId && " Kosongkan password bila tidak ingin mengubahnya."}
            </p>
          )}
          <label>Nama lengkap</label>
          <input
            value={form.name}
            onChange={(e) =>
              rich
                ? changeName(e.target.value)
                : setForm({ ...form, name: e.target.value })
            }
            required
          />
          <label>Username</label>
          <input
            value={form.username}
            onChange={(e) => {
              setUsernameTouched(true);
              setForm({ ...form, username: e.target.value });
            }}
            required
          />
          {rich && (
            <>
              {idFields.map((f) => (
                <div key={f.key}>
                  <label>{f.label}</label>
                  <input
                    value={form[f.key]}
                    onChange={(e) =>
                      setForm({ ...form, [f.key]: e.target.value })
                    }
                  />
                </div>
              ))}
              {role === "teacher" && (
                <>
                  <label>Jenis Guru</label>
                  <select
                    value={form.jenisGuru}
                    onChange={(e) =>
                      setForm({ ...form, jenisGuru: e.target.value })
                    }
                  >
                    <option value="">— pilih jenis guru —</option>
                    {JENIS_GURU_OPTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <label>Mata Pelajaran yang Diampu</label>
                  <div className="mapel-picker">
                    {subjectOptions.length === 0 && (
                      <span className="muted tiny">
                        Belum ada mapel. Tambahkan di tab Mapel.
                      </span>
                    )}
                    {subjectOptions.map((o) => {
                      const checked = (form.mapel || []).includes(o.name);
                      return (
                        <label key={o.id} className="mapel-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setForm((f) => ({
                                ...f,
                                mapel: checked
                                  ? f.mapel.filter((m) => m !== o.name)
                                  : [...(f.mapel || []), o.name],
                              }))
                            }
                          />
                          {o.name}
                        </label>
                      );
                    })}
                  </div>
                  <label>Status Kepegawaian</label>
                  <select
                    value={form.statusKepegawaian}
                    onChange={(e) =>
                      setForm({ ...form, statusKepegawaian: e.target.value })
                    }
                  >
                    <option value="">— pilih status —</option>
                    {KEPEGAWAIAN_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <label>Alamat</label>
                  <textarea
                    rows={2}
                    value={form.alamat}
                    onChange={(e) =>
                      setForm({ ...form, alamat: e.target.value })
                    }
                    placeholder="Alamat tempat tinggal"
                  />
                </>
              )}
              {role === "student" && (
                <>
                  <label>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                  >
                    {STUDENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {capStatus(s)}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <label>Nomor Handphone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <label>Foto</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files[0] || null)}
              />
              {(photoFile || existingPhotoUrl) && (
                <img
                  src={
                    photoFile ? URL.createObjectURL(photoFile) : existingPhotoUrl
                  }
                  alt="Pratinjau"
                  style={{
                    width: 72,
                    height: 72,
                    objectFit: "cover",
                    borderRadius: 8,
                    marginTop: 4,
                  }}
                />
              )}
              {role === "student" &&
                STUDENT_PROFILE_FIELDS.map((f) =>
                  f.type === "address" ? (
                    <fieldset key={f.key} className="alamat-group">
                      <legend>{f.label}</legend>
                      {ALAMAT_PARTS.map((p) => {
                        const k = f.key + p.suffix;
                        return (
                          <div key={k}>
                            <label>{p.label}</label>
                            <input
                              placeholder={p.placeholder}
                              value={form[k]}
                              onChange={(e) =>
                                setForm({ ...form, [k]: e.target.value })
                              }
                            />
                          </div>
                        );
                      })}
                    </fieldset>
                  ) : (
                    <div key={f.key}>
                      <label>{f.label}</label>
                      <input
                        value={form[f.key]}
                        onChange={(e) =>
                          setForm({ ...form, [f.key]: e.target.value })
                        }
                      />
                    </div>
                  )
                )}
            </>
          )}
          <label>Password{editId ? " (biarkan kosong bila tetap)" : ""}</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editId}
          />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary">
              {editId ? "Perbarui" : "Simpan"}
            </button>
            {editId && (
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Batal
              </button>
            )}
          </div>
        </form>

        {rich && !editId && (
          <div className="mt">
            <div className="label-strong">Impor massal dari CSV</div>
            <p className="muted tiny m0">
              Kolom yang dikenali: <code>{csvCols.join(", ")}</code>. Baris
              pertama = header. Kolom kosong boleh; username default dari nama,
              password default <code>{defaultPassword}</code>.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={csvBusy}
              onChange={(e) => {
                const f = e.target.files[0];
                e.target.value = "";
                importCsv(f);
              }}
              className="mt-sm"
            />
            {csvBusy && <p className="muted tiny m0">Mengimpor…</p>}
            {csvResult && <div className="alert mt-sm">{csvResult}</div>}
          </div>
        )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
        <table className="table">
          <thead>
            {rich ? (
              <tr>
                <th>Foto</th>
                <th {...thProps("name")}>Nama{sortArrow("name")}</th>
                <th {...thProps("username")}>Username{sortArrow("username")}</th>
                {idFields.map((f) => (
                  <th key={f.key} {...thProps(f.key)}>
                    {f.col}
                    {sortArrow(f.key)}
                  </th>
                ))}
                {role === "teacher" && (
                  <th {...thProps("jenisGuru")}>
                    Jenis Guru{sortArrow("jenisGuru")}
                  </th>
                )}
                {role === "teacher" && (
                  <th className="cell-wide th-sort" onClick={() => toggleSort("mapel")} role="button" title="Klik untuk mengurutkan & menyorot kolom">
                    Mapel Diampu{sortArrow("mapel")}
                  </th>
                )}
                {role === "teacher" && (
                  <th {...thProps("statusKepegawaian")}>
                    Status Kepegawaian{sortArrow("statusKepegawaian")}
                  </th>
                )}
                {role === "teacher" && (
                  <th className="cell-wide th-sort" onClick={() => toggleSort("alamat")} role="button" title="Klik untuk mengurutkan & menyorot kolom">
                    Alamat{sortArrow("alamat")}
                  </th>
                )}
                {role === "student" && (
                  <th {...thProps("status")}>Status{sortArrow("status")}</th>
                )}
                <th {...thProps("kontak")}>Kontak{sortArrow("kontak")}</th>
                <th></th>
              </tr>
            ) : (
              <tr>
                <th>Nama</th>
                <th>Username</th>
                <th>Peran</th>
                <th></th>
              </tr>
            )}
          </thead>
          <tbody>
            {displayed.map((u) =>
              rich ? (
                <tr key={u.id}>
                  <td>
                    {u.photoUrl ? (
                      <img
                        src={u.photoUrl}
                        alt={u.name}
                        style={{
                          width: 40,
                          height: 40,
                          objectFit: "cover",
                          borderRadius: "50%",
                        }}
                      />
                    ) : (
                      <span className="muted tiny">—</span>
                    )}
                  </td>
                  <td className={colClass("name")}>{u.name}</td>
                  <td className={colClass("username")}>{u.username}</td>
                  {idFields.map((f) => (
                    <td key={f.key} className={colClass(f.key)}>
                      {u[f.key] || <span className="muted tiny">—</span>}
                    </td>
                  ))}
                  {role === "teacher" && (
                    <td className={`tiny${sortKey === "jenisGuru" ? " col-highlight" : ""}`}>
                      {u.jenisGuru || <span className="muted">—</span>}
                    </td>
                  )}
                  {role === "teacher" && (
                    <td className={`tiny cell-wide${sortKey === "mapel" ? " col-highlight" : ""}`}>
                      {u.mapel && u.mapel.length ? (
                        u.mapel.join(", ")
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  )}
                  {role === "teacher" && (
                    <td className={`tiny${sortKey === "statusKepegawaian" ? " col-highlight" : ""}`}>
                      {u.statusKepegawaian || (
                        <span className="muted">—</span>
                      )}
                    </td>
                  )}
                  {role === "teacher" && (
                    <td className={`tiny cell-wide${sortKey === "alamat" ? " col-highlight" : ""}`}>
                      {u.alamat || <span className="muted">—</span>}
                    </td>
                  )}
                  {role === "student" && (
                    <td className={colClass("status")}>
                      {readOnly ? (
                        <span>{capStatus(u.status || "aktif")}</span>
                      ) : (
                        <select
                          value={u.status || "aktif"}
                          onChange={(e) => changeStatus(u, e.target.value)}
                        >
                          {STUDENT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {capStatus(s)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  )}
                  <td className={`tiny${sortKey === "kontak" ? " col-highlight" : ""}`}>
                    {u.email && <div>{u.email}</div>}
                    {u.phone && <div>{u.phone}</div>}
                    {!u.email && !u.phone && <span className="muted">—</span>}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      {role === "student" && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setViewUser(u)}
                        >
                          Lihat
                        </button>
                      )}
                      {role === "student" && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setTranscriptUser(u)}
                        >
                          Transkrip
                        </button>
                      )}
                      {!readOnly && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => startEdit(u)}
                        >
                          Ubah
                        </button>
                      )}
                      {!readOnly && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => del(u.id)}
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.username}</td>
                  <td>
                    <span className={`badge role-${u.role}`}>{u.role}</span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      {!readOnly && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => startEdit(u)}
                        >
                          Ubah
                        </button>
                      )}
                      {!readOnly && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => del(u.id)}
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            )}
            {displayed.length === 0 && (
              <tr>
                <td
                  colSpan={
                    rich
                      ? 5 +
                        idFields.length +
                        (role === "student" ? 1 : 0) +
                        (role === "teacher" ? 3 : 0)
                      : 4
                  }
                  className="muted tiny"
                >
                  Belum ada {label.toLowerCase()}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      {viewUser && (
        <div className="modal-overlay" onClick={() => setViewUser(null)}>
          <div
            className="modal"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-between">
              <h3 className="m0">Detail {viewUser.name}</h3>
              <button className="btn btn-sm" onClick={() => setViewUser(null)}>
                Tutup
              </button>
            </div>
            <div className="row" style={{ gap: 12, margin: "0.8rem 0" }}>
              {viewUser.photoUrl ? (
                <img
                  src={viewUser.photoUrl}
                  alt={viewUser.name}
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "cover",
                    borderRadius: "50%",
                  }}
                />
              ) : null}
              <div className="tiny">
                <div>
                  <b>Username:</b> {viewUser.username}
                </div>
                <div>
                  <b>NISN:</b> {viewUser.nisn || "—"}
                </div>
                <div>
                  <b>Tahun Masuk:</b> {viewUser.tahunMasuk || "—"}
                </div>
                <div>
                  <b>Status:</b> {capStatus(viewUser.status || "aktif")}
                </div>
                <div>
                  <b>Email:</b> {viewUser.email || "—"}
                </div>
                <div>
                  <b>Nomor Handphone:</b> {viewUser.phone || "—"}
                </div>
              </div>
            </div>
            <table className="table">
              <tbody>
                <ProfileDetailRows user={viewUser} />
              </tbody>
            </table>
          </div>
        </div>
      )}
      {transcriptUser && (
        <TranscriptModal
          student={transcriptUser}
          onClose={() => setTranscriptUser(null)}
        />
      )}
      {graduating && (
        <div className="modal-overlay" onClick={() => setGraduating(null)}>
          <div
            className="modal"
            style={{ maxWidth: 380 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3 className="m0">Tandai Lulus</h3>
              <button
                className="btn btn-sm"
                onClick={() => setGraduating(null)}
              >
                Tutup
              </button>
            </div>
            <p className="tiny muted m0">
              Pilih tahun lulus untuk <b>{graduating.name}</b>. Setelah
              disimpan, siswa akan dipindahkan ke daftar Alumni.
            </p>
            <div className="form" style={{ marginTop: 8 }}>
              <label>Tahun lulus</label>
              <input
                type="number"
                min="1900"
                max="3000"
                value={graduateYear}
                onChange={(e) => setGraduateYear(e.target.value)}
                placeholder="mis. 2026"
              />
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary" onClick={confirmGraduate}>
                  Luluskan
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setGraduating(null)}
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Transkrip Nilai & Laporan Hasil Belajar ---------------- */
export function TranscriptModal({ student, onClose }) {
  const [data, setData] = useState(null);
  const [yearId, setYearId] = useState("");
  const [semester, setSemester] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .userTranscript(student.id, {
        academicYearId: yearId || undefined,
        semester: semester || undefined,
      })
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearId, semester]);

  const years = data
    ? Array.from(
        new Map(
          (data.availablePeriods || []).map((p) => [
            p.academicYearId,
            { id: p.academicYearId, name: p.academicYearName },
          ])
        ).values()
      )
    : [];
  const semesters = data
    ? Array.from(new Set((data.availablePeriods || []).map((p) => p.semester)))
    : [];

  const predikat = (n) => {
    if (n === null || n === undefined) return "—";
    if (n >= 90) return "A";
    if (n >= 80) return "B";
    if (n >= 70) return "C";
    if (n >= 60) return "D";
    return "E";
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3 className="m0">Transkrip Nilai — {student.name}</h3>
          <button className="btn btn-sm" onClick={onClose}>
            Tutup
          </button>
        </div>
        <p className="tiny muted" style={{ marginTop: 4 }}>
          NISN: {student.nisn || "—"} · Laporan hasil belajar keseluruhan
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label className="tiny" style={{ flex: "1 1 180px" }}>
            Tahun Akademik
            <select value={yearId} onChange={(e) => setYearId(e.target.value)}>
              <option value="">Semua</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </label>
          <label className="tiny" style={{ flex: "1 1 140px" }}>
            Semester
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            >
              <option value="">Semua</option>
              {semesters.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="error">{error}</p>}
        {loading && <p className="tiny muted">Memuat…</p>}

        {!loading && data && (
          <>
            <div
              className="card"
              style={{ margin: "0.75rem 0", padding: "0.5rem 0.75rem" }}
            >
              <b>Rata-rata keseluruhan:</b>{" "}
              {data.overallAverage !== null ? (
                <>
                  {data.overallAverage} (Predikat {predikat(data.overallAverage)})
                </>
              ) : (
                <span className="muted">Belum ada nilai</span>
              )}
            </div>

            {data.classes.length === 0 && (
              <p className="tiny muted">
                Belum ada kelas/nilai untuk filter ini.
              </p>
            )}

            {data.classes.map((c) => (
              <div key={c.classId} className="card" style={{ marginBottom: 12 }}>
                <div className="modal-head">
                  <b>{c.className}</b>
                  <span className="tiny muted">
                    {c.academicYearName} · {c.semester}
                  </span>
                </div>
                <table className="table" style={{ marginTop: 6 }}>
                  <thead>
                    <tr>
                      <th>Mata Pelajaran</th>
                      <th>Rincian Nilai</th>
                      <th style={{ width: 70 }}>Rata²</th>
                      <th style={{ width: 60 }}>Predikat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.subjects.map((s) => (
                      <tr key={s.subjectId}>
                        <td className="tiny">
                          <div>
                            <b>{s.subjectName}</b>
                          </div>
                          {s.teacherNames && (
                            <div className="muted">{s.teacherNames}</div>
                          )}
                        </td>
                        <td className="tiny">
                          {s.items.length ? (
                            s.items.map((it, i) => (
                              <div key={i}>
                                {it.kind === "quiz" ? "Kuis" : "Tugas"}:{" "}
                                {it.title} — <b>{it.display}</b>
                              </div>
                            ))
                          ) : (
                            <span className="muted">Belum ada penilaian</span>
                          )}
                        </td>
                        <td className="tiny">
                          {s.average !== null ? s.average : "—"}
                        </td>
                        <td className="tiny">{predikat(s.average)}</td>
                      </tr>
                    ))}
                    {c.subjects.length === 0 && (
                      <tr>
                        <td colSpan={4} className="tiny muted">
                          Belum ada mata pelajaran.
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="tiny">
                        <b>Rata-rata kelas</b>
                      </td>
                      <td></td>
                      <td className="tiny">
                        <b>{c.classAverage !== null ? c.classAverage : "—"}</b>
                      </td>
                      <td className="tiny">
                        <b>{predikat(c.classAverage)}</b>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Alumni ---------------- */
function AlumniTab() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [viewUser, setViewUser] = useState(null);

  const load = () =>
    api
      .listUsers("student")
      .then((list) => setItems(list.filter((u) => u.status === "lulus")))
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function setStatus(u, status) {
    try {
      await api.updateUser(u.id, { status });
      load();
    } catch (err) {
      alert(err.message);
    }
  }
  async function del(id) {
    if (!confirm("Hapus data alumni ini?")) return;
    try {
      await api.deleteUser(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="card">
      <h3>Alumni ({items.length})</h3>
      <p className="muted tiny m0">
        Daftar murid yang telah dinyatakan lulus. Ubah status untuk
        mengembalikan ke daftar pelajar.
      </p>
      {error && <div className="alert">{error}</div>}
      <table className="table mt">
        <thead>
          <tr>
            <th>Foto</th>
            <th>Nama</th>
            <th>Username</th>
            <th>NISN</th>
            <th>Thn Masuk</th>
            <th>Thn Lulus</th>
            <th>Kontak</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((u) => (
            <tr key={u.id}>
              <td>
                {u.photoUrl ? (
                  <img
                    src={u.photoUrl}
                    alt={u.name}
                    style={{
                      width: 40,
                      height: 40,
                      objectFit: "cover",
                      borderRadius: "50%",
                    }}
                  />
                ) : (
                  <span className="muted tiny">—</span>
                )}
              </td>
              <td>{u.name}</td>
              <td>{u.username}</td>
              <td>{u.nisn || <span className="muted tiny">—</span>}</td>
              <td>{u.tahunMasuk || <span className="muted tiny">—</span>}</td>
              <td>
                {u.lulusAt ? (
                  new Date(u.lulusAt).getFullYear()
                ) : (
                  <span className="muted tiny">—</span>
                )}
              </td>
              <td className="tiny">
                {u.email && <div>{u.email}</div>}
                {u.phone && <div>{u.phone}</div>}
                {!u.email && !u.phone && <span className="muted">—</span>}
              </td>
              <td>
                <select
                  value={u.status || "lulus"}
                  onChange={(e) => setStatus(u, e.target.value)}
                >
                  {STUDENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {capStatus(s)}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button
                  className="btn btn-sm"
                  onClick={() => setViewUser(u)}
                >
                  Lihat
                </button>{" "}
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => del(u.id)}
                >
                  Hapus
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={9} className="muted tiny">
                Belum ada alumni.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {viewUser && (
        <div className="modal-overlay" onClick={() => setViewUser(null)}>
          <div
            className="modal"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3 className="m0">Data Alumni — {viewUser.name}</h3>
              <button className="btn btn-sm" onClick={() => setViewUser(null)}>
                Tutup
              </button>
            </div>
            <div className="row" style={{ gap: 12, margin: "0.8rem 0" }}>
              {viewUser.photoUrl ? (
                <img
                  src={viewUser.photoUrl}
                  alt={viewUser.name}
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "cover",
                    borderRadius: "50%",
                  }}
                />
              ) : null}
              <div className="tiny">
                <div>
                  <b>Username:</b> {viewUser.username}
                </div>
                <div>
                  <b>NISN:</b> {viewUser.nisn || "—"}
                </div>
                <div>
                  <b>Tahun Masuk:</b> {viewUser.tahunMasuk || "—"}
                </div>
                <div>
                  <b>Tahun Lulus:</b>{" "}
                  {viewUser.lulusAt
                    ? new Date(viewUser.lulusAt).getFullYear()
                    : "—"}
                </div>
                <div>
                  <b>Status:</b> {capStatus(viewUser.status || "lulus")}
                </div>
                <div>
                  <b>Email:</b> {viewUser.email || "—"}
                </div>
                <div>
                  <b>Nomor Handphone:</b> {viewUser.phone || "—"}
                </div>
              </div>
            </div>
            <table className="table">
              <tbody>
                <ProfileDetailRows user={viewUser} />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Kelas ---------------- */
function ClassesTab() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [nameOptions, setNameOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [years, setYears] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeSemester, setActiveSemester] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    academicYearId: "",
    semester: "",
    waliKelasId: "",
    curriculumType: "",
    subjects: [{ name: "", teacherId: "", slots: [] }],
  });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  // Perubahan Wali Kelas & Kurikulum ditahan sebagai draf per kelas,
  // baru disimpan saat tombol "Simpan Perubahan" ditekan.
  const [drafts, setDrafts] = useState({});
  const [saveStatus, setSaveStatus] = useState({});

  const toggleExpand = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const load = () => {
    api.listClasses().then(setClasses).catch((e) => setError(e.message));
    api.listUsers("teacher").then(setTeachers).catch(() => {});
    api.listSubjects().then(setSubjects).catch(() => {});
    api.listClassNameOptions().then(setNameOptions).catch(() => {});
    api
      .listSubjectNameOptions()
      .then((l) => setSubjectOptions(uniqueSubjectNames(l)))
      .catch(() => {});
    api.listCurriculumCatalog().then(setCatalog).catch(() => {});
    api.listRooms().then(setRooms).catch(() => {});
    api
      .listAcademicYears()
      .then((ys) => {
        setYears(ys);
        // Default tahun pada form = tahun aktif.
        setForm((f) =>
          f.academicYearId
            ? f
            : { ...f, academicYearId: (ys.find((y) => y.active) || {}).id || "" }
        );
      })
      .catch(() => {});
    api
      .getActiveSemester()
      .then((r) => {
        setActiveSemester(r.semester);
        setForm((f) => (f.semester ? f : { ...f, semester: r.semester }));
      })
      .catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  function setSubjectRow(i, patch) {
    setForm((f) => {
      const next = f.subjects.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
      return { ...f, subjects: next };
    });
  }
  function addSubjectRow() {
    setForm((f) => ({
      ...f,
      subjects: [...f.subjects, { name: "", teacherId: "", slots: [] }],
    }));
  }
  function removeSubjectRow(i) {
    setForm((f) => ({
      ...f,
      subjects: f.subjects.filter((_, idx) => idx !== i),
    }));
  }
  function addSlot(i) {
    setForm((f) => ({
      ...f,
      subjects: f.subjects.map((s, idx) =>
        idx === i
          ? {
              ...s,
              slots: [
                ...(s.slots || []),
                { day: "Senin", startTime: "", endTime: "", roomId: "" },
              ],
            }
          : s
      ),
    }));
  }
  function setSlot(i, j, patch) {
    setForm((f) => ({
      ...f,
      subjects: f.subjects.map((s, idx) =>
        idx === i
          ? {
              ...s,
              slots: (s.slots || []).map((sl, k) =>
                k === j ? { ...sl, ...patch } : sl
              ),
            }
          : s
      ),
    }));
  }
  function removeSlot(i, j) {
    setForm((f) => ({
      ...f,
      subjects: f.subjects.map((s, idx) =>
        idx === i
          ? { ...s, slots: (s.slots || []).filter((_, k) => k !== j) }
          : s
      ),
    }));
  }

  function openCreate() {
    setError("");
    setForm({
      name: "",
      description: "",
      academicYearId: (years.find((y) => y.active) || {}).id || "",
      semester: activeSemester || "",
      waliKelasId: "",
      curriculumType: "",
      subjects: [{ name: "", teacherId: "", slots: [] }],
    });
    setShowForm(true);
  }

  async function add(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // Buat kelas beserta mata pelajarannya sebagai satu kelompok.
      // Siswa otomatis diambil backend dari Master Kelas sesuai nama.
      const cls = await api.createClass({
        name: form.name,
        description: form.description,
        academicYearId: form.academicYearId,
        semester: form.semester,
        waliKelasId: form.waliKelasId,
        curriculumType: form.curriculumType,
      });
      for (const s of form.subjects) {
        const name = s.name.trim();
        if (!name) continue;
        const sub = await api.createSubject({
          classId: cls.id,
          name,
          teacherIds: s.teacherId ? [s.teacherId] : [],
        });
        // Buat jadwal untuk tiap slot mapel (bila jam diisi).
        for (const sl of s.slots || []) {
          if (!sl.startTime || !sl.endTime) continue;
          await api.createSchedule({
            classId: cls.id,
            subjectId: sub.id,
            title: name,
            day: sl.day,
            roomId: sl.roomId || "",
            startTime: sl.startTime,
            endTime: sl.endTime,
          });
        }
      }
      setForm({
        name: "",
        description: "",
        academicYearId: (years.find((y) => y.active) || {}).id || "",
        semester: form.semester,
        waliKelasId: "",
        curriculumType: "",
        subjects: [{ name: "", teacherId: "", slots: [] }],
      });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id) {
    if (!confirm("Hapus jadwal beserta mata pelajaran & seluruh isinya?")) return;
    await api.deleteClass(id);
    load();
  }

  // Nilai yang ditampilkan pada select = draf bila ada, jika tidak nilai kelas.
  const draftVal = (c, field) => {
    const d = drafts[c.id];
    return d && field in d ? d[field] : c[field] || "";
  };
  const setDraft = (classId, field, value) => {
    setSaveStatus((s) => ({ ...s, [classId]: "" }));
    setDrafts((prev) => ({
      ...prev,
      [classId]: { ...prev[classId], [field]: value },
    }));
  };
  // Draf pengajar per mata pelajaran (checkbox pada SubjectsManager).
  const subjectTeacherDraft = (c, sub) => {
    const st = drafts[c.id] && drafts[c.id].subjectTeachers;
    return st && sub.id in st ? st[sub.id] : sub.teacherIds || [];
  };
  const toggleSubjectTeacher = (classId, sub, teacherId) => {
    setSaveStatus((s) => ({ ...s, [classId]: "" }));
    setDrafts((prev) => {
      const cur = prev[classId] || {};
      const st = { ...(cur.subjectTeachers || {}) };
      const list = sub.id in st ? st[sub.id] : sub.teacherIds || [];
      st[sub.id] = list.includes(teacherId)
        ? list.filter((x) => x !== teacherId)
        : [...list, teacherId];
      return { ...prev, [classId]: { ...cur, subjectTeachers: st } };
    });
  };
  const sameSet = (a = [], b = []) =>
    a.length === b.length &&
    [...a].sort().join("|") === [...b].sort().join("|");
  const subjectsDirty = (c) => {
    const st = drafts[c.id] && drafts[c.id].subjectTeachers;
    if (!st) return false;
    return Object.keys(st).some((sid) => {
      const sub = subjects.find((s) => s.id === sid);
      return sub && !sameSet(st[sid], sub.teacherIds || []);
    });
  };
  const isDirty = (c) => {
    const d = drafts[c.id];
    if (!d) return false;
    return (
      ("waliKelasId" in d && (d.waliKelasId || "") !== (c.waliKelasId || "")) ||
      ("curriculumType" in d &&
        (d.curriculumType || "") !== (c.curriculumType || "")) ||
      subjectsDirty(c)
    );
  };

  async function saveClassEdits(c) {
    const d = drafts[c.id] || {};
    const patch = {};
    if ("waliKelasId" in d) patch.waliKelasId = d.waliKelasId;
    if ("curriculumType" in d) patch.curriculumType = d.curriculumType;
    try {
      setSaveStatus((s) => ({ ...s, [c.id]: "saving" }));
      if (Object.keys(patch).length) await api.updateClass(c.id, patch);
      const st = d.subjectTeachers || {};
      for (const sid of Object.keys(st)) {
        const sub = subjects.find((s) => s.id === sid);
        if (sub && !sameSet(st[sid], sub.teacherIds || [])) {
          await api.updateSubject(sid, { teacherIds: st[sid] });
        }
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
      setSaveStatus((s) => ({ ...s, [c.id]: "ok" }));
      load();
    } catch (err) {
      setError(err.message);
      setSaveStatus((s) => ({ ...s, [c.id]: "err" }));
    }
  }

  // Rombel hanya untuk periode aktif (tahun akademik + semester aktif).
  const activeClasses = classes.filter((c) => c.periodActive);

  // Mata pelajaran yang tersedia disesuaikan dengan kurikulum + kelas terpilih:
  // diambil dari katalog kurikulum (jenis kurikulum + fase + tingkat kelas),
  // bukan seluruh master mapel.
  const selectedClassOpt = nameOptions.find((o) => o.name === form.name);
  const selectedFase = selectedClassOpt ? selectedClassOpt.fase : "";
  const selectedGrade = (() => {
    const m = String(form.name || "").match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  })();
  const availableMapel = (() => {
    if (!form.curriculumType || !form.name) return [];
    const names = catalog
      .filter(
        (e) =>
          e.curriculumType === form.curriculumType &&
          (selectedGrade == null || Number(e.kelas) === selectedGrade) &&
          (!selectedFase || e.fase === selectedFase)
      )
      .map((e) => e.mapel);
    return Array.from(new Set(names)).sort((a, b) =>
      String(a).localeCompare(String(b), "id", { numeric: true })
    );
  })();

  return (
    <div className="users-layout">
      <div className="modal-head">
        <div>
          <h3 className="m0">Daftar Jadwal</h3>
          <span className="muted tiny">
            Menampilkan periode aktif:{" "}
            <b>
              {(years.find((y) => y.active) || {}).name || "—"}
              {activeSemester
                ? ` · ${activeSemester === "ganjil" ? "Ganjil" : "Genap"}`
                : ""}
            </b>
          </span>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + Buat Jadwal
        </button>
      </div>
      {error && <div className="alert">{error}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="m0">Buat Jadwal Baru</h3>
              <button className="btn btn-sm" onClick={() => setShowForm(false)}>
                Tutup
              </button>
            </div>
            <p className="muted tiny m0">
              Tentukan nama kelas dan mata pelajarannya sekaligus dalam satu
              kelompok.
            </p>
            <form onSubmit={add} className="form">
          <label className="label-strong">Kurikulum</label>
          <select
            value={form.curriculumType}
            onChange={(e) =>
              setForm({ ...form, curriculumType: e.target.value })
            }
            required
          >
            <option value="">— pilih kurikulum —</option>
            {CURRICULUM_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>

          <label className="label-strong mt-sm">Nama Kelas</label>
          <div className="form-inline">
            <select
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              disabled={!form.curriculumType}
            >
              <option value="">— pilih nama kelas —</option>
              {nameOptions
                .filter(
                  (o) =>
                    // Nama unik hanya per periode: nama yang sama boleh dipakai
                    // di tahun/semester berbeda dan datanya tersimpan terpisah.
                    !classes.some(
                      (c) =>
                        c.name === o.name &&
                        c.academicYearId === form.academicYearId &&
                        c.semester === form.semester
                    )
                )
                .map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
            </select>
            <input
              placeholder="Deskripsi (opsional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <label className="label-strong mt-sm">Tahun Akademik</label>
          <select
            value={form.academicYearId}
            onChange={(e) =>
              setForm({ ...form, academicYearId: e.target.value })
            }
            disabled
            required
          >
            {years
              .filter((y) => y.active)
              .map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} (aktif)
                </option>
              ))}
          </select>

          <label className="label-strong mt-sm">Semester</label>
          <select
            value={form.semester}
            onChange={(e) => setForm({ ...form, semester: e.target.value })}
            disabled
            required
          >
            {activeSemester && (
              <option value={activeSemester}>
                {activeSemester === "ganjil" ? "Ganjil" : "Genap"} (aktif)
              </option>
            )}
          </select>
          <p className="muted tiny m0">
            Kelas baru otomatis dibuat pada periode aktif untuk mencegah salah
            pengaturan.
          </p>

          <label className="label-strong mt-sm">Wali Kelas</label>
          <select
            value={form.waliKelasId}
            onChange={(e) => setForm({ ...form, waliKelasId: e.target.value })}
          >
            <option value="">— belum ditentukan —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <div className="label-strong mt-sm">Mata Pelajaran &amp; Jadwal</div>
          <p className="muted tiny m0">
            Tambahkan mata pelajaran, lalu atur jadwalnya (bisa lebih dari satu
            hari per mapel). Jadwal boleh dikosongkan dan diisi nanti.
          </p>
          {(!form.curriculumType || !form.name) && (
            <p className="muted tiny m0">
              Pilih <b>kurikulum</b> dan <b>nama kelas</b> dulu untuk menampilkan
              daftar mata pelajaran yang sesuai.
            </p>
          )}
          {form.curriculumType && form.name && availableMapel.length === 0 && (
            <p className="muted tiny m0">
              Belum ada mata pelajaran pada katalog untuk kurikulum &amp; kelas
              ini.
            </p>
          )}
          <div className="stack mt-sm">
            {form.subjects.map((s, i) => (
              <div className="subject-block" key={i}>
                <div className="subject-row">
                  <select
                    value={s.name}
                    onChange={(e) => setSubjectRow(i, { name: e.target.value })}
                    disabled={!form.curriculumType || !form.name}
                  >
                    <option value="">— Pilih mata pelajaran —</option>
                    {availableMapel.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={s.teacherId}
                    onChange={(e) =>
                      setSubjectRow(i, { teacherId: e.target.value })
                    }
                  >
                    <option value="">— Pilih pengajar —</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {form.subjects.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeSubjectRow(i)}
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="slot-list">
                  {(s.slots || []).map((sl, j) => (
                    <div className="slot-row" key={j}>
                      <select
                        value={sl.day}
                        onChange={(e) => setSlot(i, j, { day: e.target.value })}
                      >
                        {DAYS.map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={sl.startTime}
                        onChange={(e) =>
                          setSlot(i, j, { startTime: e.target.value })
                        }
                      />
                      <input
                        type="time"
                        value={sl.endTime}
                        onChange={(e) =>
                          setSlot(i, j, { endTime: e.target.value })
                        }
                      />
                      <select
                        value={sl.roomId}
                        onChange={(e) =>
                          setSlot(i, j, { roomId: e.target.value })
                        }
                      >
                        <option value="">— tanpa ruangan —</option>
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeSlot(i, j)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => addSlot(i)}
                  >
                    + Tambah jadwal
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-sm"
            onClick={addSubjectRow}
          >
            + Tambah mapel
          </button>

          <div className="label-strong mt-sm">Pelajar (otomatis dari Master Kelas)</div>
          <p className="muted tiny m0">
            Daftar siswa mengikuti Master Kelas. Ubah anggota di tab
            <b> Kelas</b> → Penempatan Siswa.
          </p>
          <div className="chips">
            {(() => {
              const master = nameOptions.find((o) => o.name === form.name);
              const roster = master ? master.students || [] : [];
              if (!form.name)
                return (
                  <span className="muted tiny">
                    Pilih nama kelas dulu untuk melihat siswanya.
                  </span>
                );
              if (roster.length === 0)
                return (
                  <span className="muted tiny">
                    Belum ada siswa pada Master Kelas ini.
                  </span>
                );
              return roster.map((s) => (
                <span key={s.id} className="chip chip-on">
                  {s.name}
                </span>
              ));
            })()}
          </div>

          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Membuat…" : "Buat Jadwal"}
          </button>
        </form>
          </div>
        </div>
      )}

      <div className="stack">
        {activeClasses.map((c) => {
          const isOpen = expanded.has(c.id);
          const studentCount = (c.students || []).length;
          const subjectCount = subjects.filter((s) => s.classId === c.id).length;
          const gradeMatch = (c.name || "").match(/\d+/);
          const avatar = gradeMatch
            ? gradeMatch[0]
            : (c.name || "?").trim().charAt(0).toUpperCase() || "?";
          return (
            <div
              className={`card jadwal-card ${isOpen ? "open" : ""}`}
              key={c.id}
            >
              <div className="row-between">
                <button
                  type="button"
                  className="class-toggle"
                  onClick={() => toggleExpand(c.id)}
                  aria-expanded={isOpen}
                >
                  <span className={`chevron ${isOpen ? "open" : ""}`}>▸</span>
                  <span className="jadwal-avatar" aria-hidden="true">
                    {avatar}
                  </span>
                  <span className="jadwal-head-text">
                    <h3 className="m0">
                      {c.name}{" "}
                      <span className="badge role-admin">
                        {c.academicYearName} ·{" "}
                        {c.semester === "ganjil" ? "Ganjil" : "Genap"}
                      </span>
                    </h3>
                    {isOpen ? (
                      <p className="muted m0">{c.description || "—"}</p>
                    ) : (
                      <div className="jadwal-meta">
                        <span className="jadwal-chip">
                          🧑‍🎓 {studentCount} pelajar
                        </span>
                        <span className="jadwal-chip">
                          📚 {subjectCount} mapel
                        </span>
                        {c.waliKelasName && (
                          <span className="jadwal-chip">
                            🧑‍🏫 {c.waliKelasName}
                          </span>
                        )}
                        {c.curriculumType && (
                          <span className="jadwal-chip cur">
                            🎓 {curTypeLabel(c.curriculumType)}
                          </span>
                        )}
                      </div>
                    )}
                  </span>
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => del(c.id)}
                >
                  Hapus jadwal
                </button>
              </div>

              {isOpen && (
                <>
                  <div className="mt">
                    <label className="label-strong">Wali Kelas</label>
                    <select
                      value={draftVal(c, "waliKelasId")}
                      onChange={(e) =>
                        setDraft(c.id, "waliKelasId", e.target.value)
                      }
                    >
                      <option value="">— belum ditentukan —</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt">
                    <label className="label-strong">Kurikulum</label>
                    <select
                      value={draftVal(c, "curriculumType")}
                      onChange={(e) =>
                        setDraft(c.id, "curriculumType", e.target.value)
                      }
                    >
                      <option value="">— belum ditetapkan —</option>
                      {CURRICULUM_TYPES.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt">
                    <div className="label-strong">
                      Pelajar{" "}
                      <span className="muted tiny">
                        (otomatis dari Master Kelas)
                      </span>
                    </div>
                    <div className="chips">
                      {(c.students || []).map((s) => (
                        <span key={s.id} className="chip chip-on">
                          {s.name}
                        </span>
                      ))}
                      {studentCount === 0 && (
                        <span className="muted tiny">
                          Belum ada siswa. Atur di tab Kelas → Penempatan Siswa.
                        </span>
                      )}
                    </div>
                  </div>

                  <SubjectsManager
                    cls={c}
                    teachers={teachers}
                    subjects={subjects.filter((s) => s.classId === c.id)}
                    subjectOptions={subjectOptions}
                    catalog={catalog}
                    onChange={load}
                    teacherIdsFor={(sub) => subjectTeacherDraft(c, sub)}
                    onToggleTeacher={(sub, tid) =>
                      toggleSubjectTeacher(c.id, sub, tid)
                    }
                  />

                  <ScheduleManager
                    cls={c}
                    rooms={rooms}
                    subjects={subjects.filter((s) => s.classId === c.id)}
                  />

                  <div
                    className="mt cur-save-bar"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!isDirty(c) || saveStatus[c.id] === "saving"}
                      onClick={() => saveClassEdits(c)}
                    >
                      {saveStatus[c.id] === "saving"
                        ? "Menyimpan…"
                        : "Simpan Perubahan"}
                    </button>
                    {saveStatus[c.id] === "ok" && (
                      <span className="grade-status ok">✓ Tersimpan.</span>
                    )}
                    {isDirty(c) && saveStatus[c.id] !== "saving" && (
                      <span className="muted tiny">
                        Ada perubahan belum disimpan.
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        {activeClasses.length === 0 && (
          <p className="muted">Belum ada kelas pada periode aktif.</p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Mata Pelajaran (per kelas) ---------------- */
function SubjectsManager({
  cls,
  teachers,
  subjects,
  subjectOptions = [],
  catalog = [],
  onChange,
  teacherIdsFor = (sub) => sub.teacherIds || [],
  onToggleTeacher,
}) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");

  // Daftar mapel disesuaikan dengan kurikulum + kelas ini (dari katalog
  // kurikulum). Jika kelas belum punya kurikulum, tampilkan seluruh master mapel.
  const grade = (() => {
    const m = String(cls.name || "").match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  })();
  const mapelOptions = (() => {
    if (!cls.curriculumType)
      return subjectOptions.map((o) => o.name);
    const names = catalog
      .filter(
        (e) =>
          e.curriculumType === cls.curriculumType &&
          (grade == null || Number(e.kelas) === grade) &&
          (!cls.fase || e.fase === cls.fase)
      )
      .map((e) => e.mapel);
    return Array.from(new Set(names)).sort((a, b) =>
      String(a).localeCompare(String(b), "id", { numeric: true })
    );
  })();

  async function add(e) {
    e.preventDefault();
    setError("");
    try {
      await api.createSubject({
        classId: cls.id,
        name: form.name,
        description: form.description,
      });
      setForm({ name: "", description: "" });
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function del(id) {
    if (!confirm("Hapus mata pelajaran beserta materi, tugas, kuis, dll?")) return;
    await api.deleteSubject(id);
    onChange();
  }

  return (
    <div className="mt subject-box">
      <div className="label-strong">Mata Pelajaran ({subjects.length})</div>
      <form onSubmit={add} className="form form-inline mt-sm">
        <select
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        >
          <option value="">— Pilih mata pelajaran —</option>
          {mapelOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <input
          placeholder="Deskripsi (opsional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button className="btn btn-primary btn-sm">Tambah Mapel</button>
      </form>
      {error && <div className="alert">{error}</div>}
      <div className="stack mt-sm">
        {subjects.map((sub) => (
          <div className="list-item column" key={sub.id}>
            <div className="row-between">
              <b>{sub.name}</b>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => del(sub.id)}
              >
                Hapus
              </button>
            </div>
            {sub.description && (
              <p className="muted tiny m0">{sub.description}</p>
            )}
            <div className="label-strong tiny mt-sm">Pengajar</div>
            <div className="chips">
              {teachers.map((t) => (
                <label
                  key={t.id}
                  className={`chip ${
                    teacherIdsFor(sub).includes(t.id) ? "chip-on" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={teacherIdsFor(sub).includes(t.id)}
                    onChange={() => onToggleTeacher(sub, t.id)}
                  />
                  {t.name}
                </label>
              ))}
              {teachers.length === 0 && (
                <span className="muted">Belum ada pengajar.</span>
              )}
            </div>
          </div>
        ))}
        {subjects.length === 0 && (
          <p className="muted tiny">Belum ada mata pelajaran.</p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Jadwal per kelas (di dalam kartu Rombel) ---------------- */
function ScheduleManager({ cls, rooms, subjects }) {
  const [schedules, setSchedules] = useState([]);
  const [error, setError] = useState("");
  const [slot, setSlot] = useState({
    subjectId: "",
    day: "Senin",
    startTime: "",
    endTime: "",
    roomId: "",
  });

  const load = () => {
    api
      .listSchedules(cls.id)
      .then(setSchedules)
      .catch((e) => setError(e.message));
  };
  useEffect(() => {
    load();
  }, [cls.id]);

  async function add(e) {
    e.preventDefault();
    setError("");
    if (!slot.startTime || !slot.endTime) {
      setError("Isi jam mulai dan jam selesai.");
      return;
    }
    const sub = subjects.find((s) => s.id === slot.subjectId);
    try {
      await api.createSchedule({
        classId: cls.id,
        subjectId: slot.subjectId || "",
        title: sub ? sub.name : "Kegiatan",
        day: slot.day,
        roomId: slot.roomId || "",
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
      setSlot({
        subjectId: "",
        day: "Senin",
        startTime: "",
        endTime: "",
        roomId: "",
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function del(id) {
    if (!confirm("Hapus jadwal ini?")) return;
    await api.deleteSchedule(id);
    load();
  }

  // Urutkan berdasarkan hari lalu jam mulai.
  const sorted = [...schedules].sort((a, b) => {
    const da = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    return da !== 0 ? da : (a.startTime || "").localeCompare(b.startTime || "");
  });

  return (
    <div className="mt subject-box">
      <div className="label-strong">Jadwal ({schedules.length})</div>
      <form onSubmit={add} className="slot-row mt-sm">
        <select
          value={slot.subjectId}
          onChange={(e) => setSlot({ ...slot, subjectId: e.target.value })}
        >
          <option value="">— kegiatan lain —</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={slot.day}
          onChange={(e) => setSlot({ ...slot, day: e.target.value })}
        >
          {DAYS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <input
          type="time"
          value={slot.startTime}
          onChange={(e) => setSlot({ ...slot, startTime: e.target.value })}
        />
        <input
          type="time"
          value={slot.endTime}
          onChange={(e) => setSlot({ ...slot, endTime: e.target.value })}
        />
        <select
          value={slot.roomId}
          onChange={(e) => setSlot({ ...slot, roomId: e.target.value })}
        >
          <option value="">— tanpa ruangan —</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary btn-sm">Tambah</button>
      </form>
      {error && <div className="alert">{error}</div>}
      <div className="stack mt-sm">
        {sorted.map((s) => (
          <div className="list-item row-between" key={s.id}>
            <span>
              <b>{s.day}</b> {s.startTime}–{s.endTime}
              {" · "}
              {s.subjectName || s.title}
              {s.roomName ? ` · 🏫 ${s.roomName}` : ""}
            </span>
            <button className="btn btn-danger btn-sm" onClick={() => del(s.id)}>
              Hapus
            </button>
          </div>
        ))}
        {schedules.length === 0 && (
          <p className="muted tiny">Belum ada jadwal.</p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Master Mata Pelajaran (daftar nama mapel) ---------------- */
function MapelTab() {
  const [options, setOptions] = useState([]);
  const [name, setName] = useState("");
  const [fase, setFase] = useState("D");
  const [editId, setEditId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    api.listSubjectNameOptions().then(setOptions).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const byFase = {};
  options.forEach((o) => {
    const f = FASE[o.fase] ? o.fase : "?";
    (byFase[f] = byFase[f] || []).push(o);
  });
  const faseOrder = [...FASE_KEYS, "?"].filter((f) => byFase[f]);

  function reset() {
    setName("");
    setFase("D");
    setEditId("");
    setShowForm(false);
  }
  function openCreate() {
    setError("");
    setName("");
    setFase("D");
    setEditId("");
    setShowForm(true);
  }
  function startEdit(o) {
    setError("");
    setEditId(o.id);
    setName(o.name);
    setFase(FASE[o.fase] ? o.fase : "D");
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (editId) await api.updateSubjectNameOption(editId, name.trim(), fase);
      else await api.createSubjectNameOption(name.trim(), fase);
      reset();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function del(id) {
    if (!confirm("Hapus pilihan mata pelajaran ini?")) return;
    await api.deleteSubjectNameOption(id);
    load();
  }

  return (
    <div className="users-layout">
      <div className="modal-head">
        <div>
          <h3 className="m0">Mata Pelajaran ({options.length})</h3>
          <p className="muted tiny m0">
            Kelola daftar nama mata pelajaran per fase yang dapat dipilih saat
            membuat rombel atau jadwal.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + Tambah Mapel
        </button>
      </div>
      {error && <div className="alert">{error}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={reset}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="m0">{editId ? "Ubah" : "Tambah"} Mata Pelajaran</h3>
              <button className="btn btn-sm" onClick={reset}>
                Tutup
              </button>
            </div>
            <form onSubmit={submit} className="form">
              <label>Fase</label>
              <select value={fase} onChange={(e) => setFase(e.target.value)}>
                {FASE_KEYS.map((f) => (
                  <option key={f} value={f}>
                    {faseLabel(f)}
                  </option>
                ))}
              </select>
              <label>Nama mata pelajaran</label>
              <input
                placeholder="mis. Matematika"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary">
                  {editId ? "Perbarui" : "Simpan"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={reset}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="stack">
        {faseOrder.map((f) => (
          <div key={f} className="fase-section">
            <div className="fase-section-head">
              <span className="badge cur-badge">{faseLabel(f)}</span>
              <span className="muted tiny">{byFase[f].length} mapel</span>
            </div>
            <div className="card">
              <div className="stack">
                {byFase[f].map((o) => (
                  <div className="list-item" key={o.id}>
                    <span>{o.name}</span>
                    <div className="row" style={{ gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEdit(o)}
                      >
                        Ubah
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => del(o.id)}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {options.length === 0 && (
          <p className="muted tiny">Belum ada mata pelajaran.</p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Katalog Kurikulum (SMP) ---------------- */
const capSem = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

// Tampilan detail satu entri katalog sesuai struktur jenis kurikulumnya.
// Total JP seluruh materi pokok pada satu entri kurikulum.
function materiTotalJP(materiPokok) {
  return (materiPokok || []).reduce((sum, m) => {
    const jp = typeof m === "object" ? Number(m.jp) : 0;
    return sum + (Number.isFinite(jp) ? jp : 0);
  }, 0);
}

// Satu submateri pada katalog: menampilkan nama + JP, serta bahan ajar
// (materi bacaan) yang bisa dibuka/tutup bila tersedia. Tombol bahan ajar
// hanya muncul saat showBahan=true (dipakai di tab Bahan Ajar), sedangkan
// tab Kurikulum menampilkan silabus tanpa bahan ajar.
function CatalogSubmateri({ s, showBahan = false }) {
  const [open, setOpen] = useState(false);
  const sn = typeof s === "object" ? s.nama : s;
  const sj = typeof s === "object" ? s.jp : undefined;
  const bahan = showBahan && s && typeof s === "object" ? s.bahanAjar : "";
  return (
    <li>
      {sn}
      {sj !== undefined && sj !== "" && (
        <span className="cur-sub-jp"> ({sj} JP)</span>
      )}
      {bahan && (
        <>
          {" "}
          <button
            type="button"
            className="btn btn-ghost btn-xs cur-bahan-toggle"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "▲ Tutup bahan ajar" : "📖 Bahan ajar"}
          </button>
          {open && (
            <div
              className="cur-bahan-ajar"
              dangerouslySetInnerHTML={{ __html: bahan }}
            />
          )}
        </>
      )}
    </li>
  );
}

// Tampilan bahan ajar satu entri katalog: materi pokok → submateri (dengan
// tombol lihat/edit bahan ajar). Fokus pada materi bacaan saja.
function BahanAjarEntry({ entry, onSaveBahan }) {
  const mp = Array.isArray(entry.materiPokok) ? entry.materiPokok : [];
  if (!mp.length)
    return (
      <p className="tiny muted m0">Belum ada materi pokok untuk entri ini.</p>
    );
  return (
    <div className="cur-detail">
      {mp.map((m, i) => {
        const nama = typeof m === "object" ? m.nama : m;
        const subs = (typeof m === "object" && m.submateri) || [];
        return (
          <div className="cur-block" key={i}>
            <span className="cur-block-title">{nama}</span>
            <ul className="cur-sublist">
              {subs.map((s, j) => (
                <BahanAjarSubmateri
                  key={j}
                  s={s}
                  onSave={(html) => onSaveBahan(i, j, html)}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// Satu submateri pada tab Bahan Ajar: bisa dilihat & DIEDIT (dengan editor
// kaya yang mendukung unggah gambar/video dan tautan video).
function BahanAjarSubmateri({ s, onSave }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const nama = typeof s === "object" ? s.nama : s;
  const jp = typeof s === "object" ? s.jp : undefined;
  const bahan = s && typeof s === "object" ? s.bahanAjar : "";

  function startEdit() {
    setDraft(bahan || "");
    setErr("");
    setEditing(true);
    setOpen(true);
  }
  async function save() {
    setBusy(true);
    setErr("");
    try {
      await onSave(draft);
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      {nama}
      {jp !== undefined && jp !== "" && (
        <span className="cur-sub-jp"> ({jp} JP)</span>
      )}{" "}
      {bahan && !editing && (
        <button
          type="button"
          className="btn btn-ghost btn-xs cur-bahan-toggle"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "▲ Tutup bahan ajar" : "📖 Bahan ajar"}
        </button>
      )}{" "}
      {!editing && (
        <button
          type="button"
          className="btn btn-ghost btn-xs cur-bahan-toggle"
          onClick={startEdit}
        >
          {bahan ? "✏️ Edit" : "➕ Tambah bahan ajar"}
        </button>
      )}
      {open && !editing && bahan && (
        <div className="cur-bahan-ajar">
          <RichText html={bahan} />
        </div>
      )}
      {editing && (
        <div className="cur-bahan-edit">
          {err && <div className="alert">{err}</div>}
          <RichTextEditor
            value={draft}
            onChange={setDraft}
            enableMedia
            placeholder="Tulis bahan ajar… (sisipkan gambar & video via toolbar)"
          />
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={save}
            >
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// Tab khusus Bahan Ajar: menelusuri materi bacaan SD Kurikulum Merdeka
// (Fase A–C, Kelas 1–6) per kelas, mata pelajaran, dan semester.
function BahanAjarTab() {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({ kelas: "", semester: "", mapel: "" });
  const [collapsed, setCollapsed] = useState({});

  const load = () =>
    api
      .listCurriculumCatalog({ curriculumType: "merdeka" })
      .then((cat) =>
        setEntries((cat || []).filter((e) => ["A", "B", "C"].includes(e.fase)))
      )
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  // Simpan bahan ajar satu submateri: perbarui materiPokok entri lalu PUT.
  async function saveBahan(entry, mi, si, html) {
    const materiPokok = (entry.materiPokok || []).map((m, i) => {
      if (i !== mi || !m || typeof m !== "object") return m;
      const submateri = (m.submateri || []).map((s, j) => {
        if (j !== si) return s;
        const base = typeof s === "object" ? s : { nama: String(s) };
        return { ...base, bahanAjar: html };
      });
      return { ...m, submateri };
    });
    const updated = await api.updateCurriculumCatalog(entry.id, {
      ...entry,
      materiPokok,
    });
    setEntries((list) => list.map((e) => (e.id === entry.id ? updated : e)));
  }

  const mapelOptions = [...new Set(entries.map((e) => e.mapel))].sort((a, b) =>
    a.localeCompare(b, "id")
  );
  const visible = entries.filter(
    (e) =>
      (!filter.kelas || String(e.kelas) === String(filter.kelas)) &&
      (!filter.semester || e.semester === filter.semester) &&
      (!filter.mapel || e.mapel === filter.mapel)
  );
  const byMapel = {};
  visible.forEach((e) => {
    (byMapel[e.mapel] = byMapel[e.mapel] || []).push(e);
  });
  const mapelGroups = Object.keys(byMapel).sort((a, b) => a.localeCompare(b, "id"));
  const toggleGroup = (m) => setCollapsed((c) => ({ ...c, [m]: !c[m] }));

  return (
    <div className="users-layout">
      <div className="modal-head">
        <div>
          <h3 className="m0">Bahan Ajar SD — Kurikulum Merdeka</h3>
          <p className="muted tiny m0">
            Materi bacaan per submateri untuk jenjang SD (Fase A–C, Kelas 1–6).
            Klik “📖 Bahan ajar” untuk membaca, atau “✏️ Edit” untuk menyunting —
            termasuk menyisipkan gambar, video unggahan, dan tautan video.
          </p>
        </div>
      </div>
      {error && <div className="alert">{error}</div>}

      <div className="card">
        <div className="filter-row">
          <div>
            <label className="tiny">Kelas</label>
            <select
              value={filter.kelas}
              onChange={(e) => setFilter({ ...filter, kelas: e.target.value })}
            >
              <option value="">Semua kelas</option>
              {[1, 2, 3, 4, 5, 6].map((k) => (
                <option key={k} value={k}>
                  Kelas {k}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="tiny">Mata Pelajaran</label>
            <select
              value={filter.mapel}
              onChange={(e) => setFilter({ ...filter, mapel: e.target.value })}
            >
              <option value="">Semua mapel</option>
              {mapelOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="tiny">Semester</label>
            <select
              value={filter.semester}
              onChange={(e) =>
                setFilter({ ...filter, semester: e.target.value })
              }
            >
              <option value="">Semua semester</option>
              {SEMESTER_OPTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {entries.length === 0 && !error && (
        <p className="muted tiny">Memuat bahan ajar…</p>
      )}
      {entries.length > 0 && mapelGroups.length === 0 && (
        <p className="muted tiny">Tidak ada bahan ajar untuk filter ini.</p>
      )}
      {mapelGroups.map((mapel) => (
        <div
          className="card cur-mapel-card"
          key={mapel}
          style={{ "--mapel-color": mapelStyle(mapel).color }}
        >
          <button
            type="button"
            className="cur-mapel-toggle"
            onClick={() => toggleGroup(mapel)}
            aria-expanded={!collapsed[mapel]}
          >
            <span className="cur-mapel-head">
              <span className="cur-caret">{collapsed[mapel] ? "▸" : "▾"}</span>
              <span className="cur-mapel-icon">{mapelStyle(mapel).icon}</span>
              <span className="cur-mapel-name">{mapel}</span>
            </span>
            <span className="cur-mapel-count">{byMapel[mapel].length} entri</span>
          </button>
          {!collapsed[mapel] && (
            <div className="stack">
              {byMapel[mapel]
                .slice()
                .sort(
                  (a, b) =>
                    a.kelas - b.kelas || a.semester.localeCompare(b.semester)
                )
                .map((e) => (
                  <div className="cur-entry" key={e.id}>
                    <div className="cur-entry-head">
                      <span>
                        <b>Kelas {e.kelas}</b>
                        <span className="badge">
                          Fase {e.fase} · {FASE[e.fase].jenjang}
                        </span>
                        <span className="badge">{capSem(e.semester)}</span>
                      </span>
                    </div>
                    <BahanAjarEntry
                      entry={e}
                      onSaveBahan={(mi, si, html) => saveBahan(e, mi, si, html)}
                    />
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


function CatalogEntryView({ entry }) {
  if (entry.curriculumType === "merdeka") {
    return (
      <div className="cur-detail">
        <p className="tiny m0">
          <b>Fase {entry.fase || "D"}</b>
        </p>
        {entry.capaianPembelajaran && (
          <div className="cur-block">
            <span className="cur-block-title">Capaian Pembelajaran (CP)</span>
            <p className="tiny m0">{entry.capaianPembelajaran}</p>
          </div>
        )}
        {(entry.tema || []).length > 0 && (
          <div className="cur-block">
            <span className="cur-block-title">Tema Projek (P5)</span>
            <ul className="cur-list">
              {entry.tema.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}
        {(entry.materiPokok || []).length > 0 && (
          <div className="cur-block">
            <span className="cur-block-title">
              Materi Pokok{materiTotalJP(entry.materiPokok) > 0
                ? ` · Total ${materiTotalJP(entry.materiPokok)} JP`
                : ""}
            </span>
            <ul className="cur-list">
              {entry.materiPokok.map((m, i) => {
                const nama = typeof m === "object" ? m.nama : m;
                const jp = typeof m === "object" ? m.jp : undefined;
                const subs = (typeof m === "object" && m.submateri) || [];
                return (
                  <li key={i}>
                    <b>{nama}</b>
                    {jp !== undefined && jp !== "" && (
                      <span className="badge cur-jp-badge">{jp} JP</span>
                    )}
                    {subs.length > 0 && (
                      <ul className="cur-sublist">
                        {subs.map((s, j) => (
                          <CatalogSubmateri key={j} s={s} />
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {(entry.elemen || []).length > 0 && (
          <div className="cur-block">
            <span className="cur-block-title">Elemen</span>
            <ul className="cur-list">
              {entry.elemen.map((e, i) => (
                <li key={i}>
                  <b>{e.nama}</b>
                  {e.capaian ? ` — ${e.capaian}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(entry.tujuanPembelajaran || []).length > 0 && (
          <div className="cur-block">
            <span className="cur-block-title">Tujuan Pembelajaran</span>
            <ol className="cur-list">
              {entry.tujuanPembelajaran.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  }
  if (entry.curriculumType === "k13") {
    return (
      <div className="cur-detail">
        {(entry.kompetensiInti || []).length > 0 && (
          <div className="cur-block">
            <span className="cur-block-title">Kompetensi Inti (KI)</span>
            <ul className="cur-list">
              {entry.kompetensiInti.map((k, i) => (
                <li key={i}>
                  <b>{k.kode}</b> {k.deskripsi}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(entry.kompetensiDasar || []).length > 0 && (
          <div className="cur-block">
            <span className="cur-block-title">
              Kompetensi Dasar (KD){materiTotalJP(entry.kompetensiDasar) > 0
                ? ` · Total ${materiTotalJP(entry.kompetensiDasar)} JP`
                : ""}
            </span>
            <ul className="cur-list">
              {entry.kompetensiDasar.map((k, i) => (
                <li key={i}>
                  <b>{k.kode}</b> {k.deskripsi}
                  {k && typeof k === "object" && k.jp !== undefined && k.jp !== "" && Number(k.jp) > 0 && (
                    <span className="badge cur-jp-badge">{k.jp} JP</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(entry.indikator || []).length > 0 && (
          <div className="cur-block">
            <span className="cur-block-title">
              Indikator Pencapaian Kompetensi (IPK)
            </span>
            <ul className="cur-list">
              {entry.indikator.map((k, i) => (
                <li key={i}>
                  <b>{k.kode}</b> {k.deskripsi}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(entry.tujuanPembelajaran || []).length > 0 && (
          <div className="cur-block">
            <span className="cur-block-title">Tujuan Pembelajaran</span>
            <ol className="cur-list">
              {entry.tujuanPembelajaran.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  }
  // KTSP 2006
  return (
    <div className="cur-detail">
      {(entry.standarKompetensi || []).map((sk, i) => (
        <div className="cur-block" key={i}>
          <span className="cur-block-title">
            SK {sk.kode}: {sk.deskripsi}
          </span>
          {(sk.kompetensiDasar || []).length > 0 && (
            <ul className="cur-list">
              {sk.kompetensiDasar.map((kd, j) => (
                <li key={j}>
                  <b>{kd.kode}</b> {kd.deskripsi}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

const emptyCurForm = () => ({
  curriculumType: "merdeka",
  kelas: 7,
  semester: "ganjil",
  mapel: "",
  catatan: "",
  fase: "D",
  capaianPembelajaran: "",
  elemen: [],
  tema: [],
  materiPokok: [],
  tujuanPembelajaran: [],
  kompetensiInti: [],
  kompetensiDasar: [],
  indikator: [],
  standarKompetensi: [],
});

function KurikulumTab() {
  const [entries, setEntries] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [filter, setFilter] = useState({
    curriculumType: "merdeka",
    fase: "",
    kelas: "",
    semester: "",
    mapel: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState("");
  const [form, setForm] = useState(emptyCurForm());
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const toggleGroup = (mapel) =>
    setCollapsed((c) => ({ ...c, [mapel]: !c[mapel] }));

  const load = () =>
    Promise.all([api.listCurriculumCatalog(), api.listSubjectNameOptions()])
      .then(([cat, subs]) => {
        setEntries(cat);
        setSubjectOptions(uniqueSubjectNames(subs));
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  // Entri yang tampil sesuai filter.
  const visible = entries.filter(
    (e) =>
      (!filter.curriculumType || e.curriculumType === filter.curriculumType) &&
      (!filter.fase || (e.fase || "D") === filter.fase) &&
      (!filter.kelas || String(e.kelas) === String(filter.kelas)) &&
      (!filter.semester || e.semester === filter.semester) &&
      (!filter.mapel || e.mapel === filter.mapel)
  );
  // Kelompokkan per mapel untuk tampilan.
  const byMapel = {};
  visible.forEach((e) => {
    (byMapel[e.mapel] = byMapel[e.mapel] || []).push(e);
  });
  const mapelGroups = Object.keys(byMapel).sort((a, b) =>
    a.localeCompare(b, "id")
  );

  function openCreate() {
    setError("");
    setEditId("");
    const fase = filter.fase || "D";
    const grades = FASE[fase].grades;
    setForm({
      ...emptyCurForm(),
      curriculumType: filter.curriculumType || "merdeka",
      fase,
      kelas: filter.kelas || grades[0],
      semester: filter.semester || "ganjil",
      mapel: filter.mapel || "",
    });
    setShowForm(true);
  }
  function startEdit(e) {
    setError("");
    setEditId(e.id);
    setForm({
      ...emptyCurForm(),
      ...e,
      elemen: e.elemen || [],
      tema: e.tema || [],
      materiPokok: e.materiPokok || [],
      tujuanPembelajaran: e.tujuanPembelajaran || [],
      kompetensiInti: e.kompetensiInti || [],
      kompetensiDasar: e.kompetensiDasar || [],
      indikator: e.indikator || [],
      standarKompetensi: e.standarKompetensi || [],
    });
    setShowForm(true);
  }
  function reset() {
    setShowForm(false);
    setEditId("");
    setForm(emptyCurForm());
  }
  const upd = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function submit(ev) {
    ev.preventDefault();
    setError("");
    try {
      if (editId) await api.updateCurriculumCatalog(editId, form);
      else await api.createCurriculumCatalog(form);
      reset();
      load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function del(id) {
    if (!confirm("Hapus entri kurikulum ini?")) return;
    await api.deleteCurriculumCatalog(id);
    load();
  }

  // Pre-isi Kompetensi Inti standar K-13 bila kosong.
  function seedKI() {
    upd({
      kompetensiInti: [
        { kode: "KI-1", deskripsi: "" },
        { kode: "KI-2", deskripsi: "" },
        { kode: "KI-3", deskripsi: "" },
        { kode: "KI-4", deskripsi: "" },
      ],
    });
  }

  return (
    <div className="users-layout">
      <div className="modal-head">
        <div>
          <h3 className="m0">Katalog Kurikulum ({entries.length})</h3>
          <p className="muted tiny m0">
            Katalog kurikulum semua jenjang (Fase A–C: SD, D: SMP, E: SMA, F:
            SMK): Kurikulum Merdeka, Kurikulum 2013 (K-13), dan KTSP 2006.
            Dikelompokkan per mata pelajaran dan per kelas.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + Tambah Kurikulum
        </button>
      </div>
      {error && <div className="alert">{error}</div>}

      {/* Filter katalog */}
      <div className="card">
        <div className="filter-row">
          <div>
            <label className="tiny">Jenis Kurikulum</label>
            <select
              value={filter.curriculumType}
              onChange={(e) =>
                setFilter({ ...filter, curriculumType: e.target.value })
              }
            >
              <option value="">Semua jenis</option>
              {CURRICULUM_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="tiny">Fase / Jenjang</label>
            <select
              value={filter.fase}
              onChange={(e) =>
                setFilter({ ...filter, fase: e.target.value, kelas: "" })
              }
            >
              <option value="">Semua fase</option>
              {FASE_KEYS.map((f) => (
                <option key={f} value={f}>
                  {faseLabel(f)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="tiny">Kelas</label>
            <select
              value={filter.kelas}
              onChange={(e) => setFilter({ ...filter, kelas: e.target.value })}
            >
              <option value="">Semua kelas</option>
              {(filter.fase ? FASE[filter.fase].grades : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).map(
                (k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className="tiny">Semester</label>
            <select
              value={filter.semester}
              onChange={(e) =>
                setFilter({ ...filter, semester: e.target.value })
              }
            >
              <option value="">Semua semester</option>
              {SEMESTER_OPTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="tiny">Mata Pelajaran</label>
            <select
              value={filter.mapel}
              onChange={(e) => setFilter({ ...filter, mapel: e.target.value })}
            >
              <option value="">Semua mapel</option>
              {subjectOptions.map((o) => (
                <option key={o.id} value={o.name}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Katalog dikelompokkan per mapel */}
      {mapelGroups.length === 0 && (
        <p className="muted tiny">
          Belum ada entri kurikulum untuk filter ini.
        </p>
      )}
      {mapelGroups.map((mapel) => (
        <div
          className="card cur-mapel-card"
          key={mapel}
          style={{ "--mapel-color": mapelStyle(mapel).color }}
        >
          <button
            type="button"
            className="cur-mapel-toggle"
            onClick={() => toggleGroup(mapel)}
            aria-expanded={!collapsed[mapel]}
          >
            <span className="cur-mapel-head">
              <span className="cur-caret">{collapsed[mapel] ? "▸" : "▾"}</span>
              <span className="cur-mapel-icon">{mapelStyle(mapel).icon}</span>
              <span className="cur-mapel-name">{mapel}</span>
            </span>
            <span className="cur-mapel-count">
              {byMapel[mapel].length} entri
            </span>
          </button>
          {!collapsed[mapel] && (
            <div className="stack">
              {byMapel[mapel]
                .slice()
                .sort((a, b) => a.kelas - b.kelas)
                .map((e) => (
                  <div className="cur-entry" key={e.id}>
                    <div className="cur-entry-head">
                      <span>
                        <b>Kelas {e.kelas}</b>
                        <span className="badge cur-badge">
                          {curTypeLabel(e.curriculumType)}
                        </span>
                        <span className="badge">
                          Fase {e.fase || "D"} · {FASE[e.fase || "D"].jenjang}
                        </span>
                        <span className="badge">{capSem(e.semester)}</span>
                      </span>
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => startEdit(e)}
                        >
                          Ubah
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => del(e.id)}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                    <CatalogEntryView entry={e} />
                    {e.catatan && (
                      <p className="tiny muted m0">Catatan: {e.catatan}</p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}

      {/* Form tambah/ubah */}
      {showForm && (
        <div className="modal-overlay" onClick={reset}>
          <div
            className="modal modal-lg"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="modal-head">
              <h3 className="m0">{editId ? "Ubah" : "Tambah"} Kurikulum</h3>
              <button className="btn btn-sm" onClick={reset}>
                Tutup
              </button>
            </div>
            <form onSubmit={submit} className="form">
              <div className="filter-row">
                <div>
                  <label>Jenis Kurikulum</label>
                  <select
                    value={form.curriculumType}
                    onChange={(e) => upd({ curriculumType: e.target.value })}
                  >
                    {CURRICULUM_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Fase / Jenjang</label>
                  <select
                    value={form.fase}
                    onChange={(e) => {
                      const fase = e.target.value;
                      const grades = FASE[fase].grades;
                      upd({
                        fase,
                        kelas: grades.includes(Number(form.kelas))
                          ? form.kelas
                          : grades[0],
                      });
                    }}
                  >
                    {FASE_KEYS.map((f) => (
                      <option key={f} value={f}>
                        {faseLabel(f)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Kelas</label>
                  <select
                    value={form.kelas}
                    onChange={(e) => upd({ kelas: Number(e.target.value) })}
                  >
                    {FASE[form.fase || "D"].grades.map((k) => (
                      <option key={k} value={k}>
                        Kelas {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Semester</label>
                  <select
                    value={form.semester}
                    onChange={(e) => upd({ semester: e.target.value })}
                  >
                    {SEMESTER_OPTS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Mata Pelajaran</label>
                  <select
                    value={form.mapel}
                    onChange={(e) => upd({ mapel: e.target.value })}
                    required
                  >
                    <option value="">— Pilih mata pelajaran —</option>
                    {subjectOptions.map((o) => (
                      <option key={o.id} value={o.name}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bidang khusus jenis kurikulum */}
              {form.curriculumType === "merdeka" && (
                <MerdekaFields form={form} upd={upd} />
              )}
              {form.curriculumType === "k13" && (
                <K13Fields form={form} upd={upd} seedKI={seedKI} />
              )}
              {form.curriculumType === "ktsp2006" && (
                <KtspFields form={form} upd={upd} />
              )}

              <label>Catatan (opsional)</label>
              <textarea
                rows={2}
                value={form.catatan}
                onChange={(e) => upd({ catatan: e.target.value })}
                placeholder="Keterangan tambahan"
              />

              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary">
                  {editId ? "Perbarui" : "Simpan"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={reset}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Editor bidang Kurikulum Merdeka (Fase, CP, Elemen, Tujuan Pembelajaran).
function MerdekaFields({ form, upd }) {
  const setElemen = (i, patch) =>
    upd({
      elemen: form.elemen.map((el, j) => (i === j ? { ...el, ...patch } : el)),
    });
  // Normalisasi bentuk lama (string) ke objek agar editor selalu konsisten.
  const toMateriObj = (m) =>
    m && typeof m === "object"
      ? m
      : { nama: String(m || ""), jp: "", submateri: [] };
  const toSubObj = (s) =>
    s && typeof s === "object" ? s : { nama: String(s || ""), jp: "" };
  const setMateri = (i, patch) =>
    upd({
      materiPokok: (form.materiPokok || []).map((m, j) =>
        i === j ? { ...toMateriObj(m), ...patch } : m
      ),
    });
  const setSub = (i, j, patch) => {
    const subs = (toMateriObj((form.materiPokok || [])[i]).submateri || []).map(
      (s, k) => (k === j ? { ...toSubObj(s), ...patch } : s)
    );
    setMateri(i, { submateri: subs });
  };
  const addSub = (i) => {
    const subs = [
      ...(toMateriObj((form.materiPokok || [])[i]).submateri || []),
      { nama: "", jp: "" },
    ];
    setMateri(i, { submateri: subs });
  };
  const removeSub = (i, j) => {
    const subs = (toMateriObj((form.materiPokok || [])[i]).submateri || []).filter(
      (_, k) => k !== j
    );
    setMateri(i, { submateri: subs });
  };
  return (
    <div className="cur-fields">
      <label>Capaian Pembelajaran (CP)</label>
      <textarea
        rows={3}
        value={form.capaianPembelajaran}
        onChange={(e) => upd({ capaianPembelajaran: e.target.value })}
        placeholder="Deskripsi capaian pembelajaran pada fase ini"
      />
      <label>Tema Projek (P5)</label>
      {(form.tema || []).map((t, i) => (
        <div className="cur-item-row" key={i}>
          <input
            value={t}
            onChange={(e) =>
              upd({
                tema: form.tema.map((x, j) => (i === j ? e.target.value : x)),
              })
            }
            placeholder={`Tema ${i + 1}`}
          />
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() =>
              upd({ tema: form.tema.filter((_, j) => j !== i) })
            }
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => upd({ tema: [...(form.tema || []), ""] })}
      >
        + Tambah Tema
      </button>
      <label>Materi Pokok &amp; Submateri (JP)</label>
      <p className="tiny muted m0">
        JP tiap submateri sebaiknya berjumlah sama dengan JP materi pokoknya.
      </p>
      {(form.materiPokok || []).map((m, i) => {
        const mo = toMateriObj(m);
        const subs = mo.submateri || [];
        const subTotal = subs.reduce(
          (a, s) => a + (Number(toSubObj(s).jp) || 0),
          0
        );
        return (
          <div className="cur-materi-card" key={i}>
            <div className="cur-item-row">
              <input
                value={mo.nama}
                onChange={(e) => setMateri(i, { nama: e.target.value })}
                placeholder={`Materi pokok ${i + 1}`}
              />
              <input
                type="number"
                min="0"
                style={{ flex: "0 0 90px" }}
                value={mo.jp}
                onChange={(e) => setMateri(i, { jp: e.target.value })}
                placeholder="JP"
                title="Jumlah JP materi pokok"
              />
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() =>
                  upd({
                    materiPokok: form.materiPokok.filter((_, j) => j !== i),
                  })
                }
                title="Hapus materi pokok"
              >
                ×
              </button>
            </div>
            <div className="cur-sub-editor">
              <div className="cur-sub-head">
                <span className="tiny muted">
                  Submateri{subs.length > 0 ? ` · ${subTotal} JP` : ""}
                </span>
              </div>
              {subs.map((s, j) => {
                const so = toSubObj(s);
                return (
                  <div className="cur-item-row cur-sub-row" key={j}>
                    <input
                      value={so.nama}
                      onChange={(e) =>
                        setSub(i, j, { nama: e.target.value })
                      }
                      placeholder={`Submateri ${j + 1}`}
                    />
                    <input
                      type="number"
                      min="0"
                      style={{ flex: "0 0 80px" }}
                      value={so.jp}
                      onChange={(e) => setSub(i, j, { jp: e.target.value })}
                      placeholder="JP"
                    />
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeSub(i, j)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => addSub(i)}
              >
                + Tambah Submateri
              </button>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() =>
          upd({
            materiPokok: [
              ...(form.materiPokok || []),
              { nama: "", jp: "", submateri: [] },
            ],
          })
        }
      >
        + Tambah Materi Pokok
      </button>
      <label>Elemen</label>
      {form.elemen.map((el, i) => (
        <div className="cur-item-row" key={i}>
          <input
            style={{ flex: "0 0 160px" }}
            value={el.nama}
            onChange={(e) => setElemen(i, { nama: e.target.value })}
            placeholder="Nama elemen"
          />
          <input
            value={el.capaian}
            onChange={(e) => setElemen(i, { capaian: e.target.value })}
            placeholder="Capaian elemen"
          />
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() =>
              upd({ elemen: form.elemen.filter((_, j) => j !== i) })
            }
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => upd({ elemen: [...form.elemen, { nama: "", capaian: "" }] })}
      >
        + Tambah Elemen
      </button>
      <label>Tujuan Pembelajaran</label>
      {form.tujuanPembelajaran.map((t, i) => (
        <div className="cur-item-row" key={i}>
          <input
            value={t}
            onChange={(e) =>
              upd({
                tujuanPembelajaran: form.tujuanPembelajaran.map((x, j) =>
                  i === j ? e.target.value : x
                ),
              })
            }
            placeholder={`Tujuan pembelajaran ${i + 1}`}
          />
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() =>
              upd({
                tujuanPembelajaran: form.tujuanPembelajaran.filter(
                  (_, j) => j !== i
                ),
              })
            }
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() =>
          upd({ tujuanPembelajaran: [...form.tujuanPembelajaran, ""] })
        }
      >
        + Tambah Tujuan
      </button>
    </div>
  );
}

// Editor bidang K-13 (Kompetensi Inti & Kompetensi Dasar).
function K13Fields({ form, upd, seedKI }) {
  const setKI = (i, patch) =>
    upd({
      kompetensiInti: form.kompetensiInti.map((k, j) =>
        i === j ? { ...k, ...patch } : k
      ),
    });
  const setKD = (i, patch) =>
    upd({
      kompetensiDasar: form.kompetensiDasar.map((k, j) =>
        i === j ? { ...k, ...patch } : k
      ),
    });
  const setIPK = (i, patch) =>
    upd({
      indikator: (form.indikator || []).map((k, j) =>
        i === j ? { ...k, ...patch } : k
      ),
    });
  return (
    <div className="cur-fields">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <label className="m0">Kompetensi Inti (KI)</label>
        {form.kompetensiInti.length === 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={seedKI}>
            Isi KI-1..KI-4
          </button>
        )}
      </div>
      {form.kompetensiInti.map((k, i) => (
        <div className="cur-item-row" key={i}>
          <input
            style={{ flex: "0 0 90px" }}
            value={k.kode}
            onChange={(e) => setKI(i, { kode: e.target.value })}
            placeholder="KI-1"
          />
          <input
            value={k.deskripsi}
            onChange={(e) => setKI(i, { deskripsi: e.target.value })}
            placeholder="Deskripsi kompetensi inti"
          />
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() =>
              upd({
                kompetensiInti: form.kompetensiInti.filter((_, j) => j !== i),
              })
            }
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() =>
          upd({
            kompetensiInti: [...form.kompetensiInti, { kode: "", deskripsi: "" }],
          })
        }
      >
        + Tambah KI
      </button>
      <label>Kompetensi Dasar (KD)</label>
      {form.kompetensiDasar.map((k, i) => (
        <div className="cur-item-row" key={i}>
          <input
            style={{ flex: "0 0 90px" }}
            value={k.kode}
            onChange={(e) => setKD(i, { kode: e.target.value })}
            placeholder="3.1"
          />
          <input
            value={k.deskripsi}
            onChange={(e) => setKD(i, { deskripsi: e.target.value })}
            placeholder="Deskripsi kompetensi dasar"
          />
          <input
            style={{ flex: "0 0 70px" }}
            type="number"
            min="0"
            value={k.jp ?? ""}
            onChange={(e) => setKD(i, { jp: e.target.value })}
            placeholder="JP"
            title="Alokasi jam pelajaran"
          />
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() =>
              upd({
                kompetensiDasar: form.kompetensiDasar.filter((_, j) => j !== i),
              })
            }
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() =>
          upd({
            kompetensiDasar: [
              ...form.kompetensiDasar,
              { kode: "", deskripsi: "", jp: "" },
            ],
          })
        }
      >
        + Tambah KD
      </button>
      <label>Indikator Pencapaian Kompetensi (IPK)</label>
      {(form.indikator || []).map((k, i) => (
        <div className="cur-item-row" key={i}>
          <input
            style={{ flex: "0 0 90px" }}
            value={k.kode}
            onChange={(e) => setIPK(i, { kode: e.target.value })}
            placeholder="3.1.1"
          />
          <input
            value={k.deskripsi}
            onChange={(e) => setIPK(i, { deskripsi: e.target.value })}
            placeholder="Deskripsi indikator"
          />
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() =>
              upd({
                indikator: (form.indikator || []).filter((_, j) => j !== i),
              })
            }
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() =>
          upd({
            indikator: [...(form.indikator || []), { kode: "", deskripsi: "" }],
          })
        }
      >
        + Tambah IPK
      </button>
      <label>Tujuan Pembelajaran</label>
      {(form.tujuanPembelajaran || []).map((t, i) => (
        <div className="cur-item-row" key={i}>
          <input
            value={t}
            onChange={(e) =>
              upd({
                tujuanPembelajaran: form.tujuanPembelajaran.map((x, j) =>
                  i === j ? e.target.value : x
                ),
              })
            }
            placeholder={`Tujuan pembelajaran ${i + 1}`}
          />
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() =>
              upd({
                tujuanPembelajaran: form.tujuanPembelajaran.filter(
                  (_, j) => j !== i
                ),
              })
            }
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() =>
          upd({ tujuanPembelajaran: [...(form.tujuanPembelajaran || []), ""] })
        }
      >
        + Tambah Tujuan
      </button>
    </div>
  );
}

// Editor bidang KTSP 2006 (Standar Kompetensi -> Kompetensi Dasar).
function KtspFields({ form, upd }) {
  const setSK = (i, patch) =>
    upd({
      standarKompetensi: form.standarKompetensi.map((sk, j) =>
        i === j ? { ...sk, ...patch } : sk
      ),
    });
  const setKDinSK = (i, k, patch) =>
    setSK(i, {
      kompetensiDasar: (form.standarKompetensi[i].kompetensiDasar || []).map(
        (kd, m) => (k === m ? { ...kd, ...patch } : kd)
      ),
    });
  return (
    <div className="cur-fields">
      <label>Standar Kompetensi (SK) &amp; Kompetensi Dasar (KD)</label>
      {form.standarKompetensi.map((sk, i) => (
        <div className="cur-sk-block" key={i}>
          <div className="cur-item-row">
            <input
              style={{ flex: "0 0 70px" }}
              value={sk.kode}
              onChange={(e) => setSK(i, { kode: e.target.value })}
              placeholder="1"
            />
            <input
              value={sk.deskripsi}
              onChange={(e) => setSK(i, { deskripsi: e.target.value })}
              placeholder="Deskripsi standar kompetensi"
            />
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() =>
                upd({
                  standarKompetensi: form.standarKompetensi.filter(
                    (_, j) => j !== i
                  ),
                })
              }
            >
              ×
            </button>
          </div>
          <div className="cur-kd-list">
            {(sk.kompetensiDasar || []).map((kd, k) => (
              <div className="cur-item-row" key={k}>
                <input
                  style={{ flex: "0 0 70px" }}
                  value={kd.kode}
                  onChange={(e) => setKDinSK(i, k, { kode: e.target.value })}
                  placeholder="1.1"
                />
                <input
                  value={kd.deskripsi}
                  onChange={(e) =>
                    setKDinSK(i, k, { deskripsi: e.target.value })
                  }
                  placeholder="Deskripsi kompetensi dasar"
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() =>
                    setSK(i, {
                      kompetensiDasar: sk.kompetensiDasar.filter(
                        (_, m) => m !== k
                      ),
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setSK(i, {
                  kompetensiDasar: [
                    ...(sk.kompetensiDasar || []),
                    { kode: "", deskripsi: "" },
                  ],
                })
              }
            >
              + Tambah KD
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() =>
          upd({
            standarKompetensi: [
              ...form.standarKompetensi,
              { kode: "", deskripsi: "", kompetensiDasar: [] },
            ],
          })
        }
      >
        + Tambah Standar Kompetensi
      </button>
    </div>
  );
}

/* ---------------- Master Kelas (daftar nama kelas) ---------------- */
function MasterKelasTab() {
  const [options, setOptions] = useState([]);
  const load = () =>
    api.listClassNameOptions().then(setOptions).catch(() => {});
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="users-layout">
      <ClassStudentAssigner options={options} onChange={load} />
      <NameOptionsManager options={options} onChange={load} />
    </div>
  );
}

function ClassStudentAssigner({ options, onChange }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);
  const [activePeriod, setActivePeriod] = useState(null);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    api.listUsers("student").then(setStudents).catch(() => {});
    api.listClasses().then(setClasses).catch(() => {});
    api.listAcademicYears().then(setYears).catch(() => {});
    api.getActivePeriod().then(setActivePeriod).catch(() => {});
  }, []);

  // Peta siswa -> Master Kelas saat ini (1 siswa hanya di 1 master).
  const masterOfStudent = {};
  options.forEach((o) =>
    (o.studentIds || []).forEach((id) => (masterOfStudent[id] = o))
  );

  // Acuan = periode aktif saja (tahun akademik & semester aktif).
  const refYearId = activePeriod ? activePeriod.academicYearId : "";
  const refSemester = activePeriod ? activePeriod.semester : "";

  // Semester sebelumnya (relatif terhadap periode aktif):
  // - Genap aktif  -> Ganjil pada tahun yang sama.
  // - Ganjil aktif -> Genap pada tahun akademik sebelumnya.
  const sortedYears = [...years].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", "id", { numeric: true })
  );
  let prevYearId = "";
  let prevSemester = "";
  if (refYearId && refSemester) {
    if (refSemester === "genap") {
      prevYearId = refYearId;
      prevSemester = "ganjil";
    } else {
      const idx = sortedYears.findIndex((y) => y.id === refYearId);
      if (idx > 0) {
        prevYearId = sortedYears[idx - 1].id;
        prevSemester = "genap";
      }
    }
  }
  const prevYear = years.find((y) => y.id === prevYearId) || null;
  const prevPeriodLabel =
    prevYear && prevSemester
      ? `${prevYear.name} · ${prevSemester === "ganjil" ? "Ganjil" : "Genap"}`
      : "";

  // Peta siswa -> kelas pada semester lalu.
  const lastClassOfStudent = {};
  if (prevYearId && prevSemester) {
    classes
      .filter(
        (c) => c.academicYearId === prevYearId && c.semester === prevSemester
      )
      .forEach((c) =>
        (c.studentIds || []).forEach((id) => (lastClassOfStudent[id] = c.name))
      );
  }

  const shown = students.filter((s) =>
    !search.trim()
      ? true
      : (s.name || "").toLowerCase().includes(search.trim().toLowerCase()) ||
        (s.nisn || "").toLowerCase().includes(search.trim().toLowerCase())
  );

  const shownSorted = [...shown].sort((a, b) => {
    const valOf = (s) => {
      switch (sortCol) {
        case "nisn":
          return (s.nisn || "").toLowerCase();
        case "tahunMasuk":
          return s.tahunMasuk || "";
        case "kelasLalu":
          return (lastClassOfStudent[s.id] || "").toLowerCase();
        case "kelas":
          return (masterOfStudent[s.id]?.name || "").toLowerCase();
        case "name":
        default:
          return (s.name || "").toLowerCase();
      }
    };
    const va = valOf(a);
    const vb = valOf(b);
    let cmp;
    if (sortCol === "tahunMasuk") {
      cmp = (Number(va) || 0) - (Number(vb) || 0);
    } else {
      cmp = String(va).localeCompare(String(vb), "id", { numeric: true });
    }
    if (cmp === 0)
      cmp = (a.name || "").localeCompare(b.name || "", "id", {
        numeric: true,
      });
    return sortDir === "asc" ? cmp : -cmp;
  });

  function toggleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const sortArrow = (col) =>
    sortCol === col ? (sortDir === "asc" ? " \u2191" : " \u2193") : "";

  async function assign(student, newOptionId) {
    const current = masterOfStudent[student.id] || null;
    if (newOptionId === (current ? current.id : "")) return;
    setError("");
    setBusyId(student.id);
    try {
      if (newOptionId) {
        const target = options.find((o) => o.id === newOptionId);
        const ids = target.studentIds || [];
        // enforceSingleMaster di backend akan mengeluarkan dari master lain.
        await api.updateClassNameOption(newOptionId, {
          studentIds: [...ids, student.id],
        });
      } else if (current) {
        await api.updateClassNameOption(current.id, {
          studentIds: (current.studentIds || []).filter(
            (x) => x !== student.id
          ),
        });
      }
      onChange && onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="users-layout">
      <div className="modal-head">
        <div>
          <h3 className="m0">Penempatan Siswa ke Master Kelas</h3>
          <p className="muted tiny m0">
            Tetapkan setiap siswa masuk ke kelas mana. Rombel per periode akan
            otomatis mengambil daftar siswa dari sini. 1 siswa hanya di 1 kelas.
          </p>
        </div>
      </div>
      {error && <div className="alert">{error}</div>}

      <div className="card">
        <div className="filter-row">
          <div style={{ flex: 1 }}>
            <label className="label-strong">Cari Siswa</label>
            <input
              placeholder="Nama atau NISN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <p className="muted tiny m0">
          Acuan mengikuti periode aktif. Kolom "Kelas Semester Lalu"
          menampilkan kelas terakhir siswa pada semester sebelumnya
          {prevPeriodLabel ? ` (${prevPeriodLabel})` : ""}.
        </p>
      </div>

      {options.length === 0 && (
        <p className="muted tiny">
          Belum ada nama kelas. Tambah dulu pada daftar di bawah.
        </p>
      )}

      <div className="card">
        <table className="table assign-table">
          <thead>
            <tr>
              <th
                className="th-sort"
                onClick={() => toggleSort("name")}
                title="Urutkan berdasarkan nama"
              >
                Nama Siswa{sortArrow("name")}
              </th>
              <th
                className="th-sort"
                onClick={() => toggleSort("nisn")}
                title="Urutkan berdasarkan NISN"
              >
                NISN{sortArrow("nisn")}
              </th>
              <th
                className="th-sort"
                onClick={() => toggleSort("tahunMasuk")}
                title="Urutkan berdasarkan tahun masuk"
              >
                Tahun Masuk{sortArrow("tahunMasuk")}
              </th>
              <th
                className="th-sort"
                onClick={() => toggleSort("kelasLalu")}
                title="Urutkan berdasarkan kelas semester lalu"
              >
                Kelas Semester Lalu{sortArrow("kelasLalu")}
                {prevPeriodLabel && (
                  <span className="muted tiny"> ({prevPeriodLabel})</span>
                )}
              </th>
              <th
                className="th-sort"
                onClick={() => toggleSort("kelas")}
                title="Urutkan berdasarkan kelas"
              >
                Kelas{sortArrow("kelas")}
              </th>
            </tr>
          </thead>
          <tbody>
            {shownSorted.map((s) => {
              const current = masterOfStudent[s.id] || null;
              const lastClass = lastClassOfStudent[s.id];
              return (
                <tr key={s.id} className={current ? "row-placed" : "row-unplaced"}>
                  <td>
                    <div className="student-cell">
                      <div className="student-name-wrap">
                        <span className="student-name">{s.name}</span>
                        <span
                          className={`placed-dot ${current ? "ok" : "no"}`}
                        >
                          {current ? "✓ Sudah berkelas" : "• Belum berkelas"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {s.nisn ? (
                      <span className="mono-cell">{s.nisn}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{s.tahunMasuk || <span className="muted">—</span>}</td>
                  <td>
                    {lastClass ? (
                      <span className="class-chip last">{lastClass}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <select
                      className={`assign-select ${current ? "has-value" : ""}`}
                      value={current ? current.id : ""}
                      disabled={busyId === s.id}
                      onChange={(e) => assign(s, e.target.value)}
                    >
                      <option value="">— tanpa kelas —</option>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
            {shownSorted.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Tidak ada siswa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NameOptionsManager({ options, onChange }) {
  const [error, setError] = useState("");
  // Modal tambah kelas (fase + tingkat + daftar rombel)
  const [showForm, setShowForm] = useState(false);
  const [faseSel, setFaseSel] = useState("D");
  const [gradeSel, setGradeSel] = useState(7);
  const [rombelText, setRombelText] = useState("A, B, C");
  // Tambah rombel ke kelas yang sudah ada
  const [addTo, setAddTo] = useState("");
  const [addRombelText, setAddRombelText] = useState("");
  // Edit satu rombel
  const [editId, setEditId] = useState("");
  const [editRombel, setEditRombel] = useState("");

  const parseRombel = (txt) =>
    String(txt || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const baseName = buildTingkat(faseSel, gradeSel);

  // Kelompokkan pilihan berdasarkan tingkat (nama kelas induk).
  const groups = {};
  options.forEach((o) => {
    const t = o.tingkat || o.name;
    (groups[t] = groups[t] || []).push(o);
  });
  const groupNames = Object.keys(groups).sort((a, b) =>
    a.localeCompare(b, "id", { numeric: true })
  );
  // Fase tiap tingkat (untuk pengelompokan tampilan).
  const faseOfGroup = (t) => {
    const first = groups[t][0];
    return (first && first.fase) || inferFase(t);
  };
  const byFase = {};
  groupNames.forEach((t) => {
    const f = faseOfGroup(t) || "?";
    (byFase[f] = byFase[f] || []).push(t);
  });
  const faseOrder = [...FASE_KEYS, "?"].filter((f) => byFase[f]);

  function openCreate() {
    setError("");
    setFaseSel("D");
    setGradeSel(7);
    setRombelText("A, B, C");
    setShowForm(true);
  }

  async function submitGroup(e) {
    e.preventDefault();
    setError("");
    const base = baseName.trim();
    if (!base) return;
    const rombels = parseRombel(rombelText);
    try {
      if (rombels.length === 0) {
        await api.createClassNameOption({
          name: base,
          fase: faseSel,
          tingkat: base,
          rombel: "",
        });
      } else {
        for (const r of rombels) {
          await api.createClassNameOption({
            name: buildClassName(faseSel, gradeSel, r),
            fase: faseSel,
            tingkat: base,
            rombel: r,
          });
        }
      }
      setShowForm(false);
      setRombelText("A, B, C");
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitAddRombel(e) {
    e.preventDefault();
    setError("");
    const rombels = parseRombel(addRombelText);
    if (rombels.length === 0) return;
    const fase = faseOfGroup(addTo);
    try {
      for (const r of rombels) {
        await api.createClassNameOption({
          name: `${addTo} ${r}`,
          fase,
          tingkat: addTo,
          rombel: r,
        });
      }
      setAddTo("");
      setAddRombelText("");
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(o) {
    setError("");
    setEditId(o.id);
    setEditRombel(o.rombel || "");
  }

  async function submitEdit(o) {
    setError("");
    const r = editRombel.trim();
    const tingkat = o.tingkat || o.name;
    try {
      await api.updateClassNameOption(o.id, {
        name: r ? `${tingkat} ${r}` : tingkat,
        rombel: r,
      });
      setEditId("");
      setEditRombel("");
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function renameGroup(tingkat) {
    const nn = prompt("Nama kelas baru:", tingkat);
    if (nn === null) return;
    const base = nn.trim();
    if (!base || base === tingkat) return;
    setError("");
    try {
      for (const o of groups[tingkat]) {
        const r = o.rombel || "";
        await api.updateClassNameOption(o.id, {
          name: r ? `${base} ${r}` : base,
          tingkat: base,
        });
      }
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteGroup(tingkat) {
    if (!confirm(`Hapus kelas "${tingkat}" beserta semua rombelnya?`)) return;
    setError("");
    try {
      for (const o of groups[tingkat]) await api.deleteClassNameOption(o.id);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function delOption(o) {
    if (!confirm(`Hapus rombel "${o.name}"?`)) return;
    setError("");
    try {
      await api.deleteClassNameOption(o.id);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  const preview = (() => {
    const base = baseName.trim();
    if (!base) return "";
    const rombels = parseRombel(rombelText);
    if (rombels.length === 0) return base;
    return rombels.map((r) => `${base} ${r}`).join(" · ");
  })();

  return (
    <div className="users-layout">
      <div className="modal-head">
        <div>
          <h3 className="m0">
            Master Kelas — Daftar Kelas ({groupNames.length})
          </h3>
          <p className="muted tiny m0">
            Kelola daftar kelas per fase/jenjang (Fase A–C: SD, D: SMP, E: SMA,
            F: SMK) beserta rombongan belajar (rombel). Tiap kelas bisa punya
            beberapa rombel, mis. Kelas 7 → A, B, C.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + Tambah Kelas
        </button>
      </div>
      {error && <div className="alert">{error}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="m0">Tambah Kelas</h3>
              <button className="btn btn-sm" onClick={() => setShowForm(false)}>
                Tutup
              </button>
            </div>
            <form onSubmit={submitGroup} className="form">
              <label>Fase / Jenjang</label>
              <select
                value={faseSel}
                onChange={(e) => {
                  const f = e.target.value;
                  setFaseSel(f);
                  if (!FASE[f].grades.includes(gradeSel))
                    setGradeSel(FASE[f].grades[0]);
                }}
              >
                {FASE_KEYS.map((f) => (
                  <option key={f} value={f}>
                    {faseLabel(f)}
                  </option>
                ))}
              </select>
              <label>Tingkat (kelas)</label>
              <select
                value={gradeSel}
                onChange={(e) => setGradeSel(Number(e.target.value))}
              >
                {FASE[faseSel].grades.map((g) => (
                  <option key={g} value={g}>
                    Kelas {g}
                  </option>
                ))}
              </select>
              <label>Rombel (pisahkan dengan koma)</label>
              <input
                placeholder="mis. A, B, C"
                value={rombelText}
                onChange={(e) => setRombelText(e.target.value)}
              />
              <p className="muted tiny m0">
                Kosongkan bila kelas ini tanpa rombel. Rombel akan dibuat sebagai{" "}
                <b>{buildClassName(faseSel, gradeSel, "A")}</b>, dst.
              </p>
              {preview && (
                <p className="tiny m0">
                  <b>Akan dibuat:</b> {preview}
                </p>
              )}
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary">Simpan</button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowForm(false)}
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="stack">
        {faseOrder.map((f) => (
          <div key={f} className="fase-section">
            <div className="fase-section-head">
              <span className="badge cur-badge">{faseLabel(f)}</span>
              <span className="muted tiny">{byFase[f].length} tingkat</span>
            </div>
            {byFase[f].map((t) => {
          const items = groups[t]
            .slice()
            .sort((a, b) =>
              (a.rombel || "").localeCompare(b.rombel || "", "id", {
                numeric: true,
              })
            );
          const gm = t.match(/\d+/);
          const avatar = gm ? gm[0] : (t || "?").trim().charAt(0).toUpperCase();
          return (
            <div className="card kelas-group" key={t}>
              <div className="row-between kelas-group-head">
                <div className="kelas-group-title">
                  <span className="jadwal-avatar" aria-hidden="true">
                    {avatar}
                  </span>
                  <div>
                    <h4 className="m0">{t}</h4>
                    <span className="muted tiny">{items.length} rombel</span>
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => renameGroup(t)}
                  >
                    Ubah Nama
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setAddTo(t);
                      setAddRombelText("");
                      setError("");
                    }}
                  >
                    + Rombel
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteGroup(t)}
                  >
                    Hapus
                  </button>
                </div>
              </div>

              <div className="rombel-list">
                {items.map((o) => {
                  const count = (o.studentIds || []).length;
                  if (editId === o.id) {
                    return (
                      <div className="rombel-row editing" key={o.id}>
                        <input
                          className="rombel-edit-input"
                          placeholder="Rombel (mis. A)"
                          value={editRombel}
                          onChange={(e) => setEditRombel(e.target.value)}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => submitEdit(o)}
                        >
                          Simpan
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setEditId("")}
                        >
                          Batal
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="rombel-row" key={o.id}>
                      <span className="rombel-badge">{o.rombel || "—"}</span>
                      <span className="rombel-name">{o.name}</span>
                      <span className="muted tiny rombel-count">
                        {count} siswa
                      </span>
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => startEdit(o)}
                        >
                          Ubah
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => delOption(o)}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {addTo === t && (
                <form onSubmit={submitAddRombel} className="rombel-add-form">
                  <input
                    placeholder="Rombel baru (mis. D atau D, E)"
                    value={addRombelText}
                    onChange={(e) => setAddRombelText(e.target.value)}
                    autoFocus
                  />
                  <button className="btn btn-primary btn-sm">Tambah</button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setAddTo("")}
                  >
                    Batal
                  </button>
                </form>
              )}
            </div>
          );
        })}
          </div>
        ))}
        {groupNames.length === 0 && (
          <p className="muted tiny">Belum ada kelas. Tambah dengan tombol di atas.</p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Tahun Akademik ---------------- */
function AcademicYearsTab() {
  const [years, setYears] = useState([]);
  const [activeYearId, setActiveYearId] = useState("");
  const [activeSemester, setActiveSemester] = useState("");
  const [selYearId, setSelYearId] = useState("");
  const [selSemester, setSelSemester] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [name, setName] = useState("");
  const [editId, setEditId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    api.listAcademicYears().then(setYears).catch((e) => setError(e.message));
    api
      .getActivePeriod()
      .then((r) => {
        setActiveYearId(r.academicYearId || "");
        setActiveSemester(r.semester || "");
        setSelYearId(r.academicYearId || "");
        setSelSemester(r.semester || "");
      })
      .catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  function reset() {
    setName("");
    setEditId("");
    setShowForm(false);
  }

  function openCreate() {
    setError("");
    setName("");
    setEditId("");
    setShowForm(true);
  }

  function startEdit(y) {
    setError("");
    setEditId(y.id);
    setName(y.name);
    setShowForm(true);
  }

  function pickPeriod(yearId, semester) {
    setSaveStatus("");
    setSelYearId(yearId);
    setSelSemester(semester);
  }

  async function savePeriod() {
    if (!selYearId || !selSemester) return;
    setError("");
    setSaveStatus("saving");
    try {
      await api.setActivePeriod(selYearId, selSemester);
      setActiveYearId(selYearId);
      setActiveSemester(selSemester);
      setSaveStatus("ok");
      load();
    } catch (err) {
      setError(err.message);
      setSaveStatus("err");
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (editId) await api.updateAcademicYear(editId, { name: name.trim() });
      else await api.createAcademicYear(name.trim(), false);
      reset();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function del(id) {
    setError("");
    if (!confirm("Hapus tahun akademik ini?")) return;
    try {
      await api.deleteAcademicYear(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const SEMS = [
    ["ganjil", "Ganjil"],
    ["genap", "Genap"],
  ];

  const periodDirty =
    selYearId !== activeYearId || selSemester !== activeSemester;
  const selYear = years.find((y) => y.id === selYearId) || null;
  const selLabel =
    selYear && selSemester
      ? `${selYear.name} · ${selSemester === "ganjil" ? "Ganjil" : "Genap"}`
      : "—";

  return (
    <div className="users-layout">
      <div className="modal-head">
        <div>
          <h3 className="m0">Tahun Akademik ({years.length})</h3>
          <p className="muted tiny m0">
            Tiap tahun akademik punya periode Ganjil &amp; Genap yang tersimpan
            terpisah. Pilih persis satu periode yang aktif; siswa hanya melihat
            kelas pada periode aktif, sedangkan periode lain tetap tersimpan dan
            tetap terlihat oleh guru &amp; admin untuk evaluasi.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + Tambah Tahun
        </button>
      </div>
      {error && <div className="alert">{error}</div>}

      <div
        className="card cur-save-bar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          flexWrap: "wrap",
        }}
      >
        <span className="label-strong">Periode aktif dipilih:</span>
        <span>{selLabel}</span>
        <button
          className="btn btn-primary btn-sm"
          disabled={!periodDirty || !selYearId || saveStatus === "saving"}
          onClick={savePeriod}
        >
          {saveStatus === "saving" ? "Menyimpan…" : "Simpan Periode Aktif"}
        </button>
        {saveStatus === "ok" && (
          <span className="grade-status ok">✓ Tersimpan.</span>
        )}
        {periodDirty && saveStatus !== "saving" && (
          <span className="muted tiny">Perubahan belum disimpan.</span>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={reset}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="m0">{editId ? "Ubah" : "Tambah"} Tahun Akademik</h3>
              <button className="btn btn-sm" onClick={reset}>
                Tutup
              </button>
            </div>
            <form onSubmit={submit} className="form">
              <label>Nama tahun akademik</label>
              <input
                placeholder="mis. 2026/2027"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary">
                  {editId ? "Perbarui" : "Simpan"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={reset}
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="year-list">
          {years.map((y) => (
            <div className="year-row" key={y.id}>
              <b className="year-name">{y.name}</b>
              <div className="row" style={{ gap: 6 }}>
                {SEMS.map(([val, label]) => {
                  const isSelected =
                    y.id === selYearId && val === selSemester;
                  const isActive =
                    y.id === activeYearId && val === activeSemester;
                  return (
                    <button
                      key={val}
                      className={`btn btn-sm ${
                        isSelected ? "btn-primary" : "btn-ghost"
                      }`}
                      onClick={() => pickPeriod(y.id, val)}
                      title={
                        isActive
                          ? "Periode aktif saat ini"
                          : `Pilih ${y.name} ${label} sebagai periode aktif`
                      }
                    >
                      {label}
                      {isActive ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
              <div className="row year-actions" style={{ gap: 6 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => startEdit(y)}
                >
                  Ubah
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => del(y.id)}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
          {years.length === 0 && (
            <p className="muted tiny">Belum ada tahun akademik.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Master Ruangan ---------------- */
function RoomsTab() {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState({ name: "", location: "", capacity: "" });
  const [editId, setEditId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    api.listRooms().then(setRooms).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  function reset() {
    setForm({ name: "", location: "", capacity: "" });
    setEditId("");
    setShowForm(false);
  }

  function openCreate() {
    setError("");
    setForm({ name: "", location: "", capacity: "" });
    setEditId("");
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        location: form.location.trim(),
        capacity: form.capacity,
      };
      if (editId) await api.updateRoom(editId, payload);
      else await api.createRoom(payload);
      reset();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(r) {
    setError("");
    setEditId(r.id);
    setForm({
      name: r.name || "",
      location: r.location || "",
      capacity: r.capacity ? String(r.capacity) : "",
    });
    setShowForm(true);
  }

  async function del(id) {
    setError("");
    if (!confirm("Hapus ruangan ini?")) return;
    try {
      await api.deleteRoom(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="users-layout">
      <div className="modal-head">
        <h3 className="m0">Daftar Ruangan ({rooms.length})</h3>
        <button className="btn btn-primary" onClick={openCreate}>
          + Tambah Ruangan
        </button>
      </div>
      {error && <div className="alert">{error}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={reset}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="m0">{editId ? "Ubah" : "Tambah"} Ruangan</h3>
              <button className="btn btn-sm" onClick={reset}>
                Tutup
              </button>
            </div>
            <p className="muted tiny m0">
              Ruangan yang ditambahkan di sini dapat dipilih saat membuat jadwal.
            </p>
            <form onSubmit={submit} className="form">
              <label>Nama ruangan</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="mis. Ruang 101 / Lab Komputer"
                required
              />
              <label>Lokasi / Gedung (opsional)</label>
              <input
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
                placeholder="mis. Gedung A Lantai 2"
              />
              <label>Kapasitas (opsional)</label>
              <input
                type="number"
                min="0"
                value={form.capacity}
                onChange={(e) =>
                  setForm({ ...form, capacity: e.target.value })
                }
              />
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary">
                  {editId ? "Perbarui" : "Simpan"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={reset}
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Lokasi</th>
              <th>Kapasitas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id}>
                <td>
                  <b>{r.name}</b>
                </td>
                <td>{r.location || <span className="muted tiny">—</span>}</td>
                <td>
                  {r.capacity ? r.capacity : <span className="muted tiny">—</span>}
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(r)}
                    >
                      Ubah
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => del(r.id)}
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr>
                <td colSpan={4} className="muted tiny">
                  Belum ada ruangan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

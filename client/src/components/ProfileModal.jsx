// =====================================================================
// ProfileModal.jsx — Edit Biodata & kata sandi sendiri (per peran).
// Guru: Nama Lengkap terkunci. Murid: Nama, NISN, Tahun Masuk,
// Tahun Lulus, Status terkunci.
// =====================================================================
import { useState } from "react";
import { useAuth } from "../auth.jsx";

// Penulisan alamat sesuai format di Indonesia (dijabarkan per bagian).
const ALAMAT_PARTS = [
  { suffix: "Jalan", label: "Nama Jalan / No. Rumah", placeholder: "Jl. Merdeka No. 10, RT 003/RW 002" },
  { suffix: "Desa", label: "Desa / Kelurahan", placeholder: "Sudiang" },
  { suffix: "Kecamatan", label: "Kecamatan", placeholder: "Biringkanaya" },
  { suffix: "Kabupaten", label: "Kabupaten / Kota", placeholder: "Kota Makassar" },
  { suffix: "Provinsi", label: "Provinsi", placeholder: "Sulawesi Selatan" },
];

// Daftar key penyimpanan untuk sekumpulan field (alamat dijabarkan jadi sub-kolom).
const storageKeysOf = (fields) =>
  fields.flatMap((f) =>
    f.type === "address" ? ALAMAT_PARTS.map((p) => f.key + p.suffix) : [f.key]
  );

// Field biodata yang boleh diedit sendiri, per peran.
const EDITABLE = {
  admin: [
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Nomor Handphone" },
  ],
  teacher: [
    { key: "nip", label: "NIP" },
    { key: "nuptk", label: "NUPTK" },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Nomor Handphone" },
  ],
  student: [
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Nomor Handphone" },
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
  ],
};

const capStatus = (s) =>
  (s || "aktif").replace(/\b\w/g, (c) => c.toUpperCase());

export default function ProfileModal({ onClose }) {
  const { user, updateProfileForm } = useAuth();
  const role = user?.role || "student";
  const fields = EDITABLE[role] || [];

  const [form, setForm] = useState(() => {
    const init = { name: user?.name || "" };
    storageKeysOf(fields).forEach((k) => (init[k] = user?.[k] || ""));
    return init;
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Info yang hanya bisa dilihat (tidak boleh diedit).
  const lockedRows =
    role === "teacher"
      ? [{ label: "Nama Lengkap", value: user?.name }]
      : role === "student"
      ? [
          { label: "Nama Lengkap", value: user?.name },
          { label: "NISN", value: user?.nisn },
          { label: "Tahun Masuk", value: user?.tahunMasuk },
          {
            label: "Tahun Lulus",
            value: user?.lulusAt ? new Date(user.lulusAt).getFullYear() : "",
          },
          { label: "Status", value: capStatus(user?.status || "aktif") },
        ]
      : [];

  async function save(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const fd = new FormData();
      // Nama hanya dikirim untuk admin (boleh diubah).
      if (role === "admin") fd.append("name", form.name);
      storageKeysOf(fields).forEach((k) => fd.append(k, form[k] || ""));
      if (photoFile) fd.append("photo", photoFile);
      if (password) {
        fd.append("password", password);
        fd.append("currentPassword", currentPassword);
      }
      await updateProfileForm(fd);
      setMsg("Biodata diperbarui.");
      setPassword("");
      setCurrentPassword("");
      setPhotoFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-between">
          <h3 className="m0">Edit Biodata</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        {error && <div className="alert">{error}</div>}
        {msg && <div className="feedback-box">{msg}</div>}

        {lockedRows.length > 0 && (
          <div className="mt">
            <div className="label-strong">Data terkunci</div>
            <table className="table">
              <tbody>
                {lockedRows.map((r) => (
                  <tr key={r.label}>
                    <td className="tiny" style={{ width: "45%" }}>
                      <b>{r.label}</b>
                    </td>
                    <td className="tiny">
                      {r.value || <span className="muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={save} className="form">
          {role === "admin" && (
            <>
              <label>Nama lengkap</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </>
          )}
          {fields.map((f) =>
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
                  type={f.type || "text"}
                  value={form[f.key]}
                  onChange={(e) =>
                    setForm({ ...form, [f.key]: e.target.value })
                  }
                />
              </div>
            )
          )}

          {role !== "admin" && (
            <>
              <label>Foto</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files[0] || null)}
              />
              {(photoFile || user?.photoUrl) && (
                <img
                  src={
                    photoFile ? URL.createObjectURL(photoFile) : user.photoUrl
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
            </>
          )}

          <div className="muted tiny mt">
            Kosongkan bagian kata sandi jika tidak ingin menggantinya.
          </div>
          <label>Kata sandi saat ini</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="untuk mengganti kata sandi"
          />
          <label>Kata sandi baru</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </form>
      </div>
    </div>
  );
}

// =====================================================================
// PimpinanDashboard.jsx — Pimpinan sekolah (akses baca-saja).
// Langsung menampilkan grafik rekapitulasi (dashboard statistik),
// tanpa tab/menu. Komponen dashboard admin dipakai ulang.
// =====================================================================
import { StatsTab } from "./AdminDashboard.jsx";

export default function PimpinanDashboard() {
  return (
    <div className="pimpinan-stats">
      <StatsTab leadership />
    </div>
  );
}

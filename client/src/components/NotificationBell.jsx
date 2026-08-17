// =====================================================================
// NotificationBell.jsx — Lonceng notifikasi dengan jumlah belum dibaca.
// =====================================================================
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";

// Tebak tab tujuan dari isi teks notifikasi.
function tabFromText(text) {
  const t = (text || "").toLowerCase();
  if (t.startsWith("materi") || t.startsWith("pembelajaran")) return "materials";
  if (t.startsWith("tugas")) return "assignments";
  if (t.startsWith("kuis")) return "quizzes";
  if (t.startsWith("diskusi") || t.startsWith("pesan")) return "discussion";
  return null;
}

const DASH_PATH = {
  student: "/pelajar",
  teacher: "/pengajar",
  admin: "/admin",
};

// Mainkan bunyi "ding" ringan memakai Web Audio (tanpa file audio).
function playDing() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // Dua nada singkat menyerupai bel notifikasi.
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.15;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch {
    /* abaikan bila audio tidak didukung */
  }
}

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const seenIds = useRef(null); // Set id notifikasi yg sudah diketahui
  const navigate = useNavigate();
  const { user } = useAuth();

  const load = () =>
    api
      .listNotifications()
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        // Bunyikan bila ada notifikasi baru (bukan saat pemuatan pertama).
        if (seenIds.current === null) {
          seenIds.current = new Set(arr.map((n) => n.id));
        } else {
          const adaBaru = arr.some(
            (n) => !n.read && !seenIds.current.has(n.id)
          );
          arr.forEach((n) => seenIds.current.add(n.id));
          if (adaBaru) playDing();
        }
        setItems(arr);
      })
      .catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // segarkan tiap 20 detik
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await api.readAllNotifications().catch(() => {});
      setItems((list) => list.map((n) => ({ ...n, read: true })));
    }
  }

  // Klik notifikasi → menuju mapel & tab yang dimaksud pada dasbor.
  function openNotif(n) {
    const tab = tabFromText(n.text);
    if (n.subjectId && tab) {
      const target = {
        classId: n.classId || null,
        subjectId: n.subjectId,
        tab,
      };
      try {
        sessionStorage.setItem("edud_notif_target", JSON.stringify(target));
      } catch {
        /* abaikan */
      }
      navigate(DASH_PATH[user?.role] || "/");
      // Bila dasbor sudah termuat (tanpa remount), terapkan segera.
      window.dispatchEvent(
        new CustomEvent("edud:notif-nav", { detail: target })
      );
    }
    setOpen(false);
  }

  return (
    <div className="notif" ref={ref}>
      <button className="notif-btn" onClick={toggle} title="Notifikasi">
        🔔
        {unread > 0 && <span className="notif-badge">{unread}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-head">Notifikasi</div>
          {items.length === 0 && (
            <div className="notif-empty muted">Belum ada notifikasi.</div>
          )}
          {items.map((n) => {
            const clickable = !!(n.subjectId && tabFromText(n.text));
            return (
              <button
                type="button"
                className={`notif-item ${clickable ? "notif-item-link" : ""}`}
                key={n.id}
                onClick={() => openNotif(n)}
              >
                <div>{n.text}</div>
                <div className="muted tiny">
                  {new Date(n.createdAt).toLocaleString("id-ID")}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

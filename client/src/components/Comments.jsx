// =====================================================================
// Comments.jsx — Komentar pada materi, tugas, dan kuis.
// Dipakai di sisi guru maupun siswa. targetType: material|assignment|quiz
// =====================================================================
import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";

const ROLE_LABEL = {
  admin: "Admin",
  teacher: "Pengajar",
  student: "Pelajar",
};

export default function Comments({ targetType, targetId }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api.listComments(targetType, targetId).then(setItems).catch(() => {});
  useEffect(() => {
    load();
  }, [targetType, targetId]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await api.postComment(targetType, targetId, body);
      setText("");
      await load();
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }
  async function del(id) {
    if (!confirm("Hapus komentar ini?")) return;
    await api.deleteComment(id);
    load();
  }
  const canDelete = (c) =>
    c.authorId === user.id || user.role === "admin" || user.role === "teacher";

  return (
    <div className="comments">
      <button
        type="button"
        className="comments-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        💬 Komentar{items.length ? ` (${items.length})` : ""}
      </button>
      {open && (
        <div className="comments-body">
          {items.map((c) => (
            <div className="comment" key={c.id}>
              <div className="comment-head">
                <b>{c.authorName}</b>
                <span className="badge type-link">
                  {ROLE_LABEL[c.authorRole] || c.authorRole}
                </span>
                <span className="muted tiny">
                  {new Date(c.createdAt).toLocaleString("id-ID")}
                </span>
                {canDelete(c) && (
                  <button
                    className="disc-del"
                    title="Hapus"
                    onClick={() => del(c.id)}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="comment-text pre">{c.text}</div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="muted tiny">Belum ada komentar.</p>
          )}
          <form onSubmit={send} className="comment-form">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tulis komentar…"
            />
            <button className="btn btn-primary btn-sm" disabled={busy}>
              {busy ? "…" : "Kirim"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

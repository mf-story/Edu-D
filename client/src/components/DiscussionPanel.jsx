// =====================================================================
// DiscussionPanel.jsx — Forum diskusi per kelas (dipakai guru & siswa).
// =====================================================================
import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";

const ROLE_LABEL = {
  admin: "Admin",
  teacher: "Pengajar",
  student: "Pelajar",
};

export default function DiscussionPanel({ subjectId }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const listRef = useRef(null);

  const load = () =>
    api.listDiscussions(subjectId).then(setPosts).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // segarkan tiap 15 dtk
    return () => clearInterval(t);
  }, [subjectId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [posts]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setMsg("");
    try {
      await api.postDiscussion(subjectId, body);
      setText("");
      await load();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id) {
    if (!confirm("Hapus pesan ini?")) return;
    await api.deleteDiscussion(id);
    load();
  }

  const canDelete = (p) =>
    p.authorId === user.id || user.role === "admin" || user.role === "teacher";

  return (
    <div className="card discussion">
      <h3>Diskusi Mata Pelajaran</h3>
      <div className="discussion-list" ref={listRef}>
        {posts.map((p) => (
          <div
            key={p.id}
            className={`disc-msg ${p.authorId === user.id ? "mine" : ""}`}
          >
            <div className="disc-head">
              <span className="disc-author">{p.authorName}</span>
              <span className={`badge type-link disc-role`}>
                {ROLE_LABEL[p.authorRole] || p.authorRole}
              </span>
              <span className="disc-time">
                {new Date(p.createdAt).toLocaleString("id-ID")}
              </span>
              {canDelete(p) && (
                <button
                  className="disc-del"
                  title="Hapus"
                  onClick={() => del(p.id)}
                >
                  ×
                </button>
              )}
            </div>
            <div className="disc-text pre">{p.text}</div>
          </div>
        ))}
        {posts.length === 0 && (
          <p className="muted">Belum ada diskusi. Mulai percakapan!</p>
        )}
      </div>
      <form onSubmit={send} className="disc-form">
        <textarea
          rows={2}
          placeholder="Tulis pesan…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {msg && <div className="muted tiny">{msg}</div>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Mengirim…" : "Kirim"}
        </button>
      </form>
    </div>
  );
}

// =====================================================================
// ChatPanel.jsx — Obrolan seperti chat (dipakai guru & siswa).
// Bisa mengobrol ke Kelas, ke Mata Pelajaran, dan pesan Pribadi
// (ke guru maupun siswa). Menggantikan forum diskusi lama.
// =====================================================================
import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";

const ROLE_LABEL = {
  admin: "Admin",
  teacher: "Pengajar",
  student: "Pelajar",
};

const ROLE_ICON = {
  admin: "🛡️",
  teacher: "🧑‍🏫",
  student: "🧑‍🎓",
};

// Waktu ringkas: jam bila hari ini, tanggal bila lampau.
function shortTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" });
}

export default function ChatPanel({ subjectId }) {
  const { user } = useAuth();
  const [ctx, setCtx] = useState(null); // { class, subject, contacts }
  const [scope, setScope] = useState("subject"); // class | subject | dm
  const [peerId, setPeerId] = useState(null);
  const [threads, setThreads] = useState([]); // inbox percakapan pribadi
  const [showContacts, setShowContacts] = useState(false);
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const listRef = useRef(null);

  // Muat konteks (kelas, mapel, daftar kontak) saat mapel berganti.
  useEffect(() => {
    setCtx(null);
    setScope("subject");
    setPeerId(null);
    setThreads([]);
    setShowContacts(false);
    setPosts([]);
    api
      .chatContacts(subjectId)
      .then(setCtx)
      .catch(() => setCtx(null));
  }, [subjectId]);

  const classId = ctx?.class?.id || null;

  const query = () => {
    if (scope === "class") return classId ? { scope, classId } : null;
    if (scope === "subject") return { scope, subjectId };
    if (scope === "dm") return peerId ? { scope, peerId } : null;
    return null;
  };

  const load = () => {
    const q = query();
    if (!q) {
      setPosts([]);
      return;
    }
    api.listMessages(q).then(setPosts).catch(() => {});
  };

  const loadThreads = () => api.chatThreads().then(setThreads).catch(() => {});

  useEffect(() => {
    load();
    if (scope === "dm") loadThreads();
    const t = setInterval(() => {
      load();
      if (scope === "dm") loadThreads();
    }, 15000); // segarkan tiap 15 dtk
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, peerId, subjectId, classId]);

  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [posts]);

  const selPeer =
    (ctx?.contacts || []).find((c) => c.id === peerId) ||
    threads.find((t) => t.peerId === peerId) ||
    null;
  const selPeerName = selPeer ? selPeer.name || selPeer.peerName : "";
  const selPeerRole = selPeer ? selPeer.role || selPeer.peerRole : "student";

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const q = query();
    if (!q) return;
    setBusy(true);
    setMsg("");
    try {
      await api.sendMessage({ ...q, text: body });
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
    await api.deleteMessage(id);
    load();
  }

  const canDelete = (p) =>
    p.authorId === user.id || user.role === "admin" || user.role === "teacher";

  const disabled = scope === "dm" && !peerId;
  const showThread = scope !== "dm" || !!peerId;
  const placeholder =
    scope === "dm"
      ? selPeerName
        ? `Kirim pesan ke ${selPeerName}…`
        : "Pilih kontak dulu…"
      : scope === "class"
      ? `Tulis pesan ke ${ctx?.class?.name || "kelas"}…`
      : `Tulis pesan ke ${ctx?.subject?.name || "mapel"}…`;

  return (
    <div className="card discussion chat-panel">
      <div className="chat-scopes">
        {ctx?.class && (
          <button
            type="button"
            className={`chat-scope ${scope === "class" ? "active" : ""}`}
            onClick={() => {
              setScope("class");
              setPeerId(null);
            }}
          >
            🏫 {ctx.class.name}
          </button>
        )}
        <button
          type="button"
          className={`chat-scope ${scope === "subject" ? "active" : ""}`}
          onClick={() => {
            setScope("subject");
            setPeerId(null);
          }}
        >
          📚 {ctx?.subject?.name || "Mapel"}
        </button>
        <button
          type="button"
          className={`chat-scope ${scope === "dm" ? "active" : ""}`}
          onClick={() => setScope("dm")}
        >
          💬 Pribadi
        </button>
      </div>

      {scope === "dm" && !peerId && (
        <div className="chat-inbox">
          <div className="chat-inbox-head">
            <span className="muted tiny">Obrolan Pribadi</span>
            <button
              type="button"
              className="chat-newbtn"
              onClick={() => setShowContacts((s) => !s)}
            >
              {showContacts ? "Tutup" : "✏️ Baru"}
            </button>
          </div>

          {showContacts ? (
            <div className="chat-contacts">
              {(ctx?.contacts || []).map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className="chat-contact"
                  onClick={() => {
                    setPeerId(c.id);
                    setShowContacts(false);
                  }}
                >
                  <span className="chat-contact-ava">
                    {ROLE_ICON[c.role] || "👤"}
                  </span>
                  <span className="chat-contact-name">{c.name}</span>
                  <span className="badge type-link">
                    {ROLE_LABEL[c.role] || c.role}
                  </span>
                </button>
              ))}
              {(ctx?.contacts || []).length === 0 && (
                <p className="muted tiny">
                  Belum ada kontak yang bisa diajak obrol.
                </p>
              )}
            </div>
          ) : threads.length > 0 ? (
            <div className="chat-threads">
              {threads.map((t) => (
                <button
                  type="button"
                  key={t.peerId}
                  className="chat-thread"
                  onClick={() => setPeerId(t.peerId)}
                >
                  <span className="chat-contact-ava">
                    {ROLE_ICON[t.peerRole] || "👤"}
                  </span>
                  <span className="chat-thread-main">
                    <span className="chat-thread-top">
                      <span className="chat-contact-name">{t.peerName}</span>
                      <span className="chat-thread-time">
                        {shortTime(t.lastAt)}
                      </span>
                    </span>
                    <span className="chat-thread-preview">
                      {t.fromMe ? "Anda: " : ""}
                      {t.lastText}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted tiny">
              Belum ada obrolan pribadi. Tekan “Baru” untuk memulai.
            </p>
          )}
        </div>
      )}

      {scope === "dm" && peerId && (
        <div className="chat-thread-head">
          <button
            type="button"
            className="chat-back"
            title="Kembali ke daftar obrolan"
            onClick={() => setPeerId(null)}
          >
            ‹
          </button>
          <span className="chat-contact-ava">
            {ROLE_ICON[selPeerRole] || "👤"}
          </span>
          <span className="chat-contact-name">{selPeerName}</span>
          <span className="badge type-link">
            {ROLE_LABEL[selPeerRole] || selPeerRole}
          </span>
        </div>
      )}

      {showThread && (
        <div className="discussion-list" ref={listRef}>
          {posts.map((p) => (
            <div
              key={p.id}
              className={`disc-msg ${p.authorId === user.id ? "mine" : ""}`}
            >
              <div className="disc-head">
                <span className="disc-author">{p.authorName}</span>
                <span className="badge type-link disc-role">
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
            <p className="muted">Belum ada pesan. Mulai percakapan!</p>
          )}
        </div>
      )}

      {showThread && (
        <form onSubmit={send} className="disc-form">
          <textarea
            rows={2}
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
          />
          {msg && <div className="muted tiny">{msg}</div>}
          <button className="btn btn-primary" disabled={busy || disabled}>
            {busy ? "Mengirim…" : "Kirim"}
          </button>
        </form>
      )}
    </div>
  );
}

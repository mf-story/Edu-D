// =====================================================================
// AnnouncementsBanner.jsx — Menampilkan pengumuman terbaru (semua peran).
// =====================================================================
import { useEffect, useState } from "react";
import { api } from "../api";
import AnnouncementMedia from "./AnnouncementMedia.jsx";

export default function AnnouncementsBanner() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.listAnnouncements().then(setItems).catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="announce-banner">
      <div className="announce-head">📢 Pengumuman</div>
      <div className="announce-stack">
        {items.slice(0, 3).map((a) => (
          <div className="announce-item" key={a.id}>
            <b>{a.title}</b>
            <p className="pre m0">{a.text}</p>
            <AnnouncementMedia url={a.mediaUrl} type={a.mediaType} name={a.mediaName} />
            <span className="tiny announce-meta">
              {a.authorName} · {new Date(a.createdAt).toLocaleDateString("id-ID")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

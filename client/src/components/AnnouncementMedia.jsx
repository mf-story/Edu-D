// =====================================================================
// AnnouncementMedia.jsx — Menampilkan lampiran pengumuman.
// Mendukung gambar, video, dan suara (audio). Jenis lain jadi tautan.
// =====================================================================

export default function AnnouncementMedia({ url, type, name }) {
  if (!url) return null;

  if (type === "image") {
    return (
      <img className="announce-media announce-media-img" src={url} alt={name || "Gambar"} />
    );
  }
  if (type === "video") {
    return (
      <video className="announce-media" src={url} controls preload="metadata" />
    );
  }
  if (type === "audio") {
    return <audio className="announce-media-audio" src={url} controls preload="metadata" />;
  }
  return (
    <a className="announce-media-file" href={url} target="_blank" rel="noreferrer">
      📎 {name || "Unduh lampiran"}
    </a>
  );
}

// FilePreview.jsx — Menampilkan/ membuka berkas (foto, video, audio, PDF,
// dokumen) langsung di dalam aplikasi. Foto & video/audio tampil inline;
// PDF dibuka pada penampil modal; dokumen lain disediakan tautan buka/unduh.
import { useState } from "react";
import { createPortal } from "react-dom";

function extOf(name = "", url = "") {
  const s = String(name || url).split("?")[0];
  const dot = s.lastIndexOf(".");
  return dot >= 0 ? s.slice(dot + 1).toLowerCase() : "";
}

const IMG = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif"];
const VID = ["mp4", "webm", "ogv", "mov", "m4v", "mkv"];
const AUD = ["mp3", "wav", "m4a", "aac", "oga", "ogg"];

export function fileKind(name, url) {
  const ext = extOf(name, url);
  if (IMG.includes(ext)) return "image";
  if (VID.includes(ext)) return "video";
  if (AUD.includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  return "file";
}

export default function FilePreview({ url, name, className = "" }) {
  const [zoom, setZoom] = useState(false);
  const [doc, setDoc] = useState(false);
  if (!url) return null;
  const label = name || "Berkas";
  const kind = fileKind(name, url);

  if (kind === "image") {
    return (
      <div className={`file-preview ${className}`}>
        <img
          className="file-preview-img"
          src={url}
          alt={label}
          onClick={() => setZoom(true)}
          title="Klik untuk memperbesar"
        />
        <div className="file-preview-name tiny muted">{label}</div>
        {zoom &&
          createPortal(
            <div className="lightbox-overlay" onClick={() => setZoom(false)}>
              <button
                type="button"
                className="lightbox-close"
                onClick={() => setZoom(false)}
                aria-label="Tutup"
              >
                ✕
              </button>
              <img
                className="lightbox-img"
                src={url}
                alt={label}
                onClick={(e) => e.stopPropagation()}
              />
            </div>,
            document.body
          )}
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className={`file-preview ${className}`}>
        <video className="file-preview-video" src={url} controls />
        <div className="file-preview-name tiny muted">{label}</div>
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className={`file-preview ${className}`}>
        <audio className="file-preview-audio" src={url} controls />
        <div className="file-preview-name tiny muted">{label}</div>
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <div className={`file-preview ${className}`}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setDoc(true)}
        >
          📄 Buka {label}
        </button>{" "}
        <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer">
          ↗ Tab baru
        </a>
        {doc &&
          createPortal(
            <div className="lightbox-overlay" onClick={() => setDoc(false)}>
              <button
                type="button"
                className="lightbox-close"
                onClick={() => setDoc(false)}
                aria-label="Tutup"
              >
                ✕
              </button>
              <iframe
                className="doc-frame"
                src={url}
                title={label}
                onClick={(e) => e.stopPropagation()}
              />
            </div>,
            document.body
          )}
      </div>
    );
  }

  // Dokumen lain (Word/Excel/PowerPoint/zip, dll.) — buka/unduh di tab baru.
  return (
    <a
      className={`btn btn-ghost btn-sm ${className}`}
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      ⬇ {label}
    </a>
  );
}

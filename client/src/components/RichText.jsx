// =====================================================================
// RichText.jsx — Editor teks kaya (WYSIWYG ala MS Office) + penampil.
// Editor memakai contentEditable + document.execCommand agar tanpa
// dependensi tambahan. Konten disimpan sebagai HTML dan dibersihkan
// (sanitize) saat ditampilkan untuk mencegah XSS.
// =====================================================================
import { useRef, useEffect, useState } from "react";
import { api } from "../api.js";

const TAG_WHITELIST = new Set([
  "B", "STRONG", "I", "EM", "U", "S", "P", "BR",
  "UL", "OL", "LI", "H1", "H2", "H3", "H4",
  "BLOCKQUOTE", "DIV", "SPAN", "A",
  "IMG", "VIDEO", "SOURCE", "IFRAME", "FIGURE", "FIGCAPTION",
]);

// Atribut aman yang boleh dipertahankan per tag.
const ATTR_WHITELIST = {
  A: ["href", "target", "rel"],
  IMG: ["src", "alt", "style"],
  VIDEO: ["src", "controls", "style"],
  SOURCE: ["src", "type"],
  IFRAME: ["src", "allow", "allowfullscreen", "frameborder", "style"],
  DIV: ["style"],
  SPAN: ["style"],
  FIGURE: ["style"],
};

// Host tepercaya untuk penyematan (iframe) video.
const IFRAME_HOSTS =
  /(^|\.)(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|drive\.google\.com)$/i;

function safeUrl(v) {
  const s = String(v || "").trim();
  if (!s || /^\s*javascript:/i.test(s)) return "";
  if (/^\/uploads\//.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^data:image\//i.test(s)) return s;
  return "";
}
function safeIframeUrl(v) {
  try {
    const u = new URL(String(v || "").trim());
    if (
      (u.protocol === "https:" || u.protocol === "http:") &&
      IFRAME_HOSTS.test(u.hostname)
    )
      return u.href;
  } catch {
    /* url tidak valid */
  }
  return "";
}
function safeStyle(v) {
  const s = String(v || "");
  if (/(expression\(|javascript:|<)/i.test(s)) return "";
  return s;
}
function applyAttrs(child, el, tag) {
  (ATTR_WHITELIST[tag] || []).forEach((name) => {
    if (!child.hasAttribute(name)) return;
    let val = child.getAttribute(name);
    if (name === "src") {
      val = tag === "IFRAME" ? safeIframeUrl(val) : safeUrl(val);
      if (!val) return;
    } else if (name === "href") {
      if (/^\s*javascript:/i.test(val)) return;
    } else if (name === "style") {
      val = safeStyle(val);
      if (!val) return;
    }
    el.setAttribute(name, val);
  });
  if (tag === "A") {
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noreferrer");
  }
}

// Bersihkan HTML: hanya izinkan tag & atribut aman.
export function sanitizeHtml(html) {
  if (!html) return "";
  const src = new DOMParser().parseFromString(html, "text/html").body;
  const out = document.createElement("div");
  const process = (from, to) => {
    from.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        to.appendChild(document.createTextNode(child.nodeValue));
        return;
      }
      if (child.nodeType !== 1) return;
      const tag = child.tagName;
      if (!TAG_WHITELIST.has(tag)) {
        // Tag tidak diizinkan: buang tag-nya, pertahankan isinya.
        process(child, to);
        return;
      }
      const el = document.createElement(tag.toLowerCase());
      applyAttrs(child, el, tag);
      // Media wajib punya src valid (VIDEO boleh via <source>).
      if ((tag === "IMG" || tag === "IFRAME" || tag === "SOURCE") && !el.getAttribute("src"))
        return;
      // Elemen mandiri tanpa anak.
      if (tag === "IMG" || tag === "SOURCE" || tag === "BR") {
        to.appendChild(el);
        return;
      }
      process(child, el);
      if (tag === "VIDEO" && !el.getAttribute("src") && !el.querySelector("source"))
        return;
      to.appendChild(el);
    });
  };
  process(src, out);
  return out.innerHTML;
}

// Penampil konten. Bila teks biasa (tanpa tag) pertahankan baris baru.
export function RichText({ html, className }) {
  const s = html || "";
  if (!/[<]/.test(s)) {
    return <p className={`pre m0 ${className || ""}`}>{s}</p>;
  }
  return (
    <div
      className={`richtext ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(s) }}
    />
  );
}

const TOOLS = [
  { cmd: "bold", label: "B", title: "Tebal", style: { fontWeight: 700 } },
  { cmd: "italic", label: "I", title: "Miring", style: { fontStyle: "italic" } },
  { cmd: "underline", label: "U", title: "Garis bawah", style: { textDecoration: "underline" } },
];

export function RichTextEditor({ value, onChange, placeholder, enableMedia = false }) {
  const ref = useRef(null);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // Sinkronkan konten bila nilai berubah dari luar (reset / mode edit),
  // tanpa mengganggu posisi kursor saat mengetik.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };
  const exec = (cmd, arg) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    handleInput();
  };
  const insertHTML = (html) => {
    ref.current?.focus();
    document.execCommand("insertHTML", false, html);
    handleInput();
  };
  const chooseFile = (accept) => {
    if (!fileRef.current) return;
    fileRef.current.accept = accept;
    fileRef.current.value = "";
    fileRef.current.click();
  };
  const onFilePicked = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await api.uploadMedia(fd);
      if (r.kind === "video")
        insertHTML(
          `<video src="${r.url}" controls style="max-width:100%;border-radius:8px"></video><p><br/></p>`
        );
      else if (r.kind === "audio")
        insertHTML(
          `<audio src="${r.url}" controls></audio><p><br/></p>`
        );
      else
        insertHTML(
          `<img src="${r.url}" alt="${(f.name || "gambar").replace(/"/g, "")}" style="max-width:100%;border-radius:8px"/><p><br/></p>`
        );
    } catch (err) {
      alert("Gagal mengunggah berkas: " + err.message);
    } finally {
      setUploading(false);
    }
  };
  const insertVideoLink = () => {
    const url = prompt(
      "Tempel tautan video (YouTube / Google Drive / Vimeo):"
    );
    if (!url) return;
    const embed = toEmbedUrl(url.trim());
    if (embed)
      insertHTML(
        `<div style="position:relative;width:100%;max-width:640px;aspect-ratio:16/9;margin:8px 0"><iframe src="${embed}" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:8px" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><p><br/></p>`
      );
    else
      insertHTML(
        `<a href="${url.trim()}">${url.trim()}</a><p><br/></p>`
      );
  };

  return (
    <div className="rte">
      <div className="rte-toolbar">
        {TOOLS.map((t) => (
          <button
            key={t.cmd}
            type="button"
            className="rte-btn"
            title={t.title}
            style={t.style}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(t.cmd)}
          >
            {t.label}
          </button>
        ))}
        <span className="rte-sep" />
        <button
          type="button"
          className="rte-btn"
          title="Judul"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("formatBlock", "H3")}
        >
          H
        </button>
        <button
          type="button"
          className="rte-btn"
          title="Daftar poin"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertUnorderedList")}
        >
          • Daftar
        </button>
        <button
          type="button"
          className="rte-btn"
          title="Daftar bernomor"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertOrderedList")}
        >
          1. Daftar
        </button>
        {enableMedia && (
          <>
            <span className="rte-sep" />
            <button
              type="button"
              className="rte-btn"
              title="Sisip gambar (unggah)"
              disabled={uploading}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => chooseFile("image/*")}
            >
              🖼 Gambar
            </button>
            <button
              type="button"
              className="rte-btn"
              title="Unggah video"
              disabled={uploading}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => chooseFile("video/*")}
            >
              🎬 Video
            </button>
            <button
              type="button"
              className="rte-btn"
              title="Sisip tautan video (YouTube/Drive)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertVideoLink}
            >
              🔗 Tautan video
            </button>
            {uploading && <span className="tiny muted">Mengunggah…</span>}
          </>
        )}
        <span className="rte-sep" />
        <button
          type="button"
          className="rte-btn"
          title="Hapus format"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("removeFormat")}
        >
          ⨯
        </button>
      </div>
      <div
        ref={ref}
        className="rte-area"
        contentEditable
        data-placeholder={placeholder || "Tulis di sini…"}
        onInput={handleInput}
        suppressContentEditableWarning
      />
      {enableMedia && (
        <input
          ref={fileRef}
          type="file"
          style={{ display: "none" }}
          onChange={onFilePicked}
        />
      )}
    </div>
  );
}

// Ubah URL YouTube/Google Drive/Vimeo menjadi URL embed; "" bila tak dikenali.
function toEmbedUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname.startsWith("/embed/")) return url;
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        return id ? `https://www.youtube.com/embed/${id}` : "";
      }
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
    if (host === "drive.google.com") {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (/^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    /* url tidak valid */
  }
  return "";
}

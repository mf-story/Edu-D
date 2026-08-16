import { useRef, useState } from "react";
import { MaterialBody } from "../pages/TeacherDashboard.jsx";

// Gerbang materi: siswa wajib menyelesaikan materi (menonton video sampai
// habis / membaca) sebelum dapat melanjutkan ke tahapan berikutnya.
export default function MaterialGate({ material, done, onComplete }) {
  if (!material) return null;
  const isVideo = material.type === "video" && material.fileUrl;
  if (isVideo)
    return <VideoGate material={material} done={done} onComplete={onComplete} />;
  return <ReadGate material={material} done={done} onComplete={onComplete} />;
}

function VideoGate({ material, done, onComplete }) {
  const ref = useRef(null);
  const maxTime = useRef(0);
  const [pct, setPct] = useState(done ? 100 : 0);
  const [finished, setFinished] = useState(!!done);
  const [playing, setPlaying] = useState(false);

  // Paksa kecepatan tetap 1x (tidak bisa dipercepat).
  function enforceRate() {
    const v = ref.current;
    if (v && v.playbackRate !== 1) v.playbackRate = 1;
  }
  function handleTimeUpdate() {
    const v = ref.current;
    if (!v) return;
    enforceRate();
    // Bila entah bagaimana melompat maju (mis. keyboard), kembalikan.
    if (!finished && v.currentTime > maxTime.current + 1) {
      v.currentTime = maxTime.current;
      return;
    }
    if (v.currentTime > maxTime.current) maxTime.current = v.currentTime;
    if (v.duration)
      setPct(Math.min(100, Math.round((maxTime.current / v.duration) * 100)));
  }
  // Cegah melompati bagian yang belum ditonton (mundur tetap diizinkan).
  function handleSeeking() {
    const v = ref.current;
    if (!v || finished) return;
    if (v.currentTime > maxTime.current + 0.4) {
      v.currentTime = maxTime.current;
    }
  }
  function handleEnded() {
    setPlaying(false);
    setFinished(true);
    if (!done) onComplete();
  }
  function togglePlay() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.playbackRate = 1;
      v.play();
    } else {
      v.pause();
    }
  }

  return (
    <div className="material-gate">
      {/* Tanpa kontrol bawaan: tidak ada bilah geser & menu kecepatan,
          sehingga video tidak dapat dimajukan atau dipercepat. */}
      <video
        ref={ref}
        className="material-img gate-video"
        src={material.fileUrl}
        playsInline
        onClick={togglePlay}
        onContextMenu={(e) => e.preventDefault()}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onSeeking={handleSeeking}
        onRateChange={enforceRate}
        onEnded={handleEnded}
      />
      <div className="gate-controls">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={togglePlay}
        >
          {playing ? "⏸ Jeda" : finished ? "↺ Putar ulang" : "▶ Putar"}
        </button>
        <div className="gate-bar">
          <div className="gate-bar-fill" style={{ width: pct + "%" }} />
        </div>
        <span className="tiny muted gate-pct">{pct}%</span>
      </div>
      {finished ? (
        <span className="tiny gate-ok">
          ✓ Video telah selesai ditonton. Anda dapat melanjutkan.
        </span>
      ) : (
        <span className="tiny muted">
          Tonton video sampai selesai. Tidak dapat dipercepat maupun dilompati.
        </span>
      )}
    </div>
  );
}

function ReadGate({ material, done, onComplete }) {
  return (
    <div className="material-gate">
      <MaterialBody m={material} />
      {done ? (
        <span className="tiny gate-ok">✓ Materi telah ditandai selesai.</span>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onComplete}
        >
          Saya sudah memahami materi ini
        </button>
      )}
    </div>
  );
}

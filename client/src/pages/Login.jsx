// =====================================================================
// Login.jsx — Halaman masuk (username & password).
// =====================================================================
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import Logo from "../components/Logo.jsx";
import Footer from "../components/Footer.jsx";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    navigate("/", { replace: true });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-logo">
          <Logo size={72} />
        </div>
        <h1>Edu-D</h1>
        <p className="muted">Aplikasi Belajar Mengajar</p>

        {error && <div className="alert">{error}</div>}

        <label>Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          placeholder="mis. admin"
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••"
        />

        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Masuk…" : "Masuk"}
        </button>

        <div className="login-sep">
          <span>Orang tua siswa?</span>
        </div>
        <Link to="/orangtua" className="btn btn-parent">
          👨‍👩‍👧 Lihat Laporan Belajar Anak
        </Link>
      </form>
      <Footer />
    </div>
  );
}

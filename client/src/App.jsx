// =====================================================================
// App.jsx — Routing utama berbasis peran.
// =====================================================================
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Login from "./pages/Login.jsx";
import Layout from "./components/Layout.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import PimpinanDashboard from "./pages/PimpinanDashboard.jsx";
import TeacherDashboard from "./pages/TeacherDashboard.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import ParentDashboard from "./pages/ParentDashboard.jsx";

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center muted">Memuat…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center muted">Memuat…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (user.role === "pimpinan") return <Navigate to="/pimpinan" replace />;
  if (user.role === "teacher") return <Navigate to="/pengajar" replace />;
  return <Navigate to="/pelajar" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/orangtua" element={<ParentDashboard />} />
      <Route
        path="/admin"
        element={
          <Protected role="admin">
            <Layout>
              <AdminDashboard />
            </Layout>
          </Protected>
        }
      />
      <Route
        path="/pimpinan"
        element={
          <Protected role="pimpinan">
            <Layout>
              <PimpinanDashboard />
            </Layout>
          </Protected>
        }
      />
      <Route
        path="/pengajar"
        element={
          <Protected role="teacher">
            <Layout>
              <TeacherDashboard />
            </Layout>
          </Protected>
        }
      />
      <Route
        path="/pelajar"
        element={
          <Protected role="student">
            <Layout>
              <StudentDashboard />
            </Layout>
          </Protected>
        }
      />
      <Route path="/" element={<Home />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

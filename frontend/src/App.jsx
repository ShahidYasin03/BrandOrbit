import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useRef, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Landing from "./pages/Landing";
import VerifyOTP from "./pages/VerifyOTP";
import DashboardHome from "./pages/DashboardHome";
import BrandManager from "./pages/BrandManager";
import ContentWorkspace from "./pages/ContentWorkspace";
import ScheduleEngine from './pages/ScheduleEngine';
import AdminPanel from "./pages/AdminPanel";
import Navbar from "./components/Navbar";

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm" style={{ background: '#08090c', color: '#4a5568' }}>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/?modal=login" replace />;
  }
  
  if (!user.is_verified) {
    return <Navigate to="/verify-otp" replace />;
  }
  
  return children;
};

// Admin Route Wrapper
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm" style={{ background: '#08090c', color: '#4a5568' }}>Loading...</div>;
  }
  
  if (user?.role?.toUpperCase() !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

const DashboardLayout = ({ children }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const stars = Array.from({ length: 130 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.0 + 0.2,
      baseAlpha: Math.random() * 0.35 + 0.08,
      speed: Math.random() * 0.005 + 0.002,
      offset: Math.random() * Math.PI * 2,
    }));
    let t = 0;
    const draw = () => {
      t += 0.012;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        const alpha = s.baseAlpha + Math.sin(t * s.speed * 60 + s.offset) * 0.12;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210,225,255,${Math.max(0, alpha)})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div className="min-h-screen flex relative" style={{ background: '#08090c' }}>
      {/* Star canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />
      {/* Static faded grid */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(to right,  rgba(255,255,255,0.038) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.038) 1px, transparent 1px)
        `,
        backgroundSize: '55px 55px',
        WebkitMaskImage: `
          linear-gradient(to bottom,
            transparent 0%, rgba(0,0,0,0.15) 12%,
            rgba(0,0,0,0.6) 26%, black 38%,
            black 70%, rgba(0,0,0,0.35) 100%
          ),
          linear-gradient(to right,
            rgba(0,0,0,0.06) 0%, black 8%,
            black 92%, rgba(0,0,0,0.06) 100%
          )
        `,
        WebkitMaskComposite: 'destination-in',
        maskImage: `
          linear-gradient(to bottom,
            transparent 0%, rgba(0,0,0,0.15) 12%,
            rgba(0,0,0,0.6) 26%, black 38%,
            black 70%, rgba(0,0,0,0.35) 100%
          ),
          linear-gradient(to right,
            rgba(0,0,0,0.06) 0%, black 8%,
            black 92%, rgba(0,0,0,0.06) 100%
          )
        `,
        maskComposite: 'intersect',
      }} />
      <Navbar />
      <main className="flex-1 p-8 overflow-y-auto h-screen relative z-10">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Navigate to="/?modal=login" replace />} />
          <Route path="/register" element={<Navigate to="/?modal=register" replace />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          
          {/* Protected Dashboard Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout>
                <DashboardHome />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminRoute>
                <DashboardLayout>
                  <AdminPanel />
                </DashboardLayout>
              </AdminRoute>
            </ProtectedRoute>
          } />
          <Route path="/brands" element={
            <ProtectedRoute>
              <DashboardLayout>
                <BrandManager />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/workspace/:id" element={
            <ProtectedRoute>
              <DashboardLayout>
                <ContentWorkspace />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/workspace" element={
            <ProtectedRoute>
              <DashboardLayout>
                <ContentWorkspace />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/schedule/:id" element={
            <ProtectedRoute>
              <DashboardLayout>
                <ScheduleEngine />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/schedule" element={
            <ProtectedRoute>
              <DashboardLayout>
                <ScheduleEngine />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

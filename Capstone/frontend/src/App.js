import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Lazy loading for optimal performance - loads within 5 seconds
const Login = lazy(() => import('./pages/login'));
const Admin = lazy(() => import('./pages/admin/AdminMain'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const DriverMain = lazy(() => import('./pages/driver/DriverMain'));
const PickupPage = lazy(() => import('./pages/clientEmployee/PickupPage'));
const TrackPage = lazy(() => import('./pages/clientEmployee/TrackPage'));
const RoleSelectionPage = lazy(() => import('./pages/RoleSelection'));

// Loading component
const LoadingScreen = () => {
  return (
    <div style={styles.loadingContainer}>
      <div style={styles.spinner}></div>
      <p style={styles.loadingText}>Loading...</p>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Role Selection */}
          <Route path="/" element={<RoleSelectionPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/:role" element={<Login />} />

          {/* Admin routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Driver routes */}
          <Route
            path="/driver/*"
            element={
              <ProtectedRoute allowedRoles={["driver"]}>
                <DriverMain />
              </ProtectedRoute>
            }
          />

          {/* Client / Public routes */}
          <Route
            path="/pickup"
            element={
              <ProtectedRoute allowedRoles={["client"]}>
                <PickupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/track"
            element={
              <ProtectedRoute allowedRoles={["client"]}>
                <TrackPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </Router>
  );
};

function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('authToken');
  const rawRole = localStorage.getItem('role') || '';
  const role = rawRole.toLowerCase();

  if (!token || !role) {
    return <Navigate to="/" replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const allowed = allowedRoles.map((r) => r.toLowerCase());
    if (!allowed.includes(role)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

// Styles
const styles = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '5px solid #e0e0e0',
    borderTop: '5px solid #4CAF50',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '20px',
    color: '#333',
    fontSize: '16px',
  },
};

// Add spinner animation
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default App;
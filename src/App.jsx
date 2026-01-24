import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import ChefLoginPage from "./pages/ChefLoginPage";
import ChefHome from "./pages/ChefHome";
import ChefDashboard from "./pages/ChefDashboard";
import ScanBill from "./pages/ScanBill";

// ✅ Protect routes
function ProtectedRoute({ isAuthenticated, children }) {
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  // ✅ check token once on load
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return (
      !!localStorage.getItem("chefToken") ||
      !!localStorage.getItem("admin_token")
    );
  });

  // ✅ login handler
  const handleLoginSuccess = (token) => {
    localStorage.setItem("chefToken", token);
    setIsAuthenticated(true);
  };

  // ✅ logout handler
  const handleLogout = () => {
    localStorage.removeItem("chefToken");
    localStorage.removeItem("admin_token");
    setIsAuthenticated(false);
  };

  return (
    <Routes>
      {/* ✅ LOGIN PAGE */}
      <Route
        path="/login"
        element={<ChefLoginPage onLoginSuccess={handleLoginSuccess} />}
      />

      {/* ✅ HOME PAGE (Two Options Page) */}
      <Route
        path="/"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <ChefHome onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />

      {/* ✅ CHEF DASHBOARD */}
      <Route
        path="/chef"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <ChefDashboard handleLogout={handleLogout} />
          </ProtectedRoute>
        }
      />

      {/* ✅ SCAN BILL */}
      <Route
        path="/scan"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <ScanBill />
          </ProtectedRoute>
        }
      />

      {/* ✅ fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

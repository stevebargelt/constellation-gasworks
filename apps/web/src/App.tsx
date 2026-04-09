import React from "react";
import { Link, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@constellation/hooks";
import { supabase } from "@constellation/api";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import AuthCallback from "./pages/AuthCallback";
import ProfilePage from "./pages/ProfilePage";
import InvitesPage from "./screens/InvitesPage";
import SendInvitePage from "./screens/SendInvitePage";
import RelationshipsPage from "./pages/RelationshipsPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}

function HomePage() {
  const { user } = useAuth();
  async function handleLogout() {
    await supabase.auth.signOut();
  }
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Constellation</h1>
        <div className="flex items-center gap-4">
          <Link to="/relationships" className="text-sm text-gray-400 hover:text-white">
            Relationships
          </Link>
          <Link to="/settings" className="text-sm text-gray-400 hover:text-white">
            Settings
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>
      <p className="text-gray-400 text-sm">Signed in as {user?.email}</p>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/signup" element={<SignupPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/profile/setup"
          element={
            <ProtectedRoute>
              <ProfilePage mode="setup" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <ProfilePage mode="edit" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invites"
          element={
            <ProtectedRoute>
              <InvitesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invites/send"
          element={
            <ProtectedRoute>
              <SendInvitePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/relationships"
          element={
            <ProtectedRoute>
              <RelationshipsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

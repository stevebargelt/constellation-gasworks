import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@constellation/api";

/**
 * Handles the OAuth redirect callback for web.
 * Supabase automatically exchanges the code/token from the URL hash/query
 * and fires onAuthStateChange, which updates useAuth state.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ error }) => {
      if (error) {
        setError(error.message);
      } else {
        navigate("/", { replace: true });
      }
    });
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p className="text-red-400">Sign-in failed: {error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
      <p className="text-gray-400">Signing in…</p>
    </div>
  );
}

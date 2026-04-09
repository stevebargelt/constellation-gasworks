import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@constellation/api";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setLoading(false);
    if (authError) {
      setError("Something went wrong. Please try again.");
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Reset password</h1>
        {sent ? (
          <p className="text-green-400 text-sm text-center">
            If that email is registered, you'll receive a password reset link shortly.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-gray-400 text-sm">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <div>
              <label className="block text-sm text-gray-400 mb-1" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-white font-medium transition-colors"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <div className="mt-4 text-center">
          <Link to="/auth/login" className="text-sm text-gray-400 hover:text-white">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

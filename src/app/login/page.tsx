"use client";

import { useState, FormEvent, useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    formData.set("flow", flow);

    try {
      await signIn("password", formData);
      router.replace("/");
    } catch {
      setError(
        flow === "signUp"
          ? "Could not create account. The email may already be in use."
          : "Invalid email or password."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = () => {
    void signIn("google");
  };

  // Dev bypass: skip auth entirely in development
  const handleDevSkip = () => {
    localStorage.setItem("afindr_onboarding", JSON.stringify({ completed: true, name: "Dev" }));
    window.location.replace("/");
  };

  // Show nothing while checking auth state (with dev escape hatch)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{
            borderColor: "var(--glass-border)",
            borderTopColor: "var(--accent)",
          }}
        />
        {process.env.NODE_ENV === "development" && (
          <button
            onClick={handleDevSkip}
            style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 9999,
              padding: "8px 16px", borderRadius: 8,
              background: "#c47b3a", color: "#fff", border: "none",
              fontSize: 12, fontFamily: "monospace", fontWeight: 700,
              cursor: "pointer", boxShadow: "0 4px 16px rgba(196,123,58,0.4)",
            }}
          >
            DEV SKIP →
          </button>
        )}
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full"
          style={{
            width: 500,
            height: 500,
            background: "radial-gradient(circle, rgba(196,123,58,0.06) 0%, transparent 70%)",
            top: "-10%",
            left: "-10%",
            filter: "blur(120px)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 400,
            height: 400,
            background: "radial-gradient(circle, rgba(107,155,212,0.04) 0%, transparent 70%)",
            bottom: "-10%",
            right: "-10%",
            filter: "blur(120px)",
          }}
        />
      </div>

      {/* Login card */}
      <div
        className="relative w-full max-w-[400px] rounded-2xl p-8"
        style={{
          background: "var(--bg-raised)",
          border: "var(--border-panel)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-8">
          <svg className="w-12 h-12 mb-3" viewBox="0 0 64 64" fill="none">
            <ellipse cx="32" cy="36" rx="18" ry="20" fill="var(--accent)" />
            <ellipse cx="25" cy="29" rx="3.5" ry="4" fill="var(--text-primary)" />
            <ellipse cx="39" cy="29" rx="3.5" ry="4" fill="var(--text-primary)" />
            <path
              d="M26 38 Q32 43 38 38"
              stroke="var(--text-primary)"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {flow === "signIn" ? "Sign in to aFindr" : "Create your account"}
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            {flow === "signIn"
              ? "Welcome back. Enter your credentials below."
              : "Start trading with AI-powered insights."}
          </p>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
          style={{
            background: "var(--glass)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-primary)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--glass-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "var(--glass)")
          }
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.42l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px" style={{ background: "var(--divider)" }} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            or
          </span>
          <div className="flex-1 h-px" style={{ background: "var(--divider)" }} />
        </div>

        {/* Email / Password form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors placeholder:opacity-40"
              style={{
                background: "var(--glass)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--glass-border)")
              }
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete={flow === "signUp" ? "new-password" : "current-password"}
              placeholder={flow === "signUp" ? "Create a password" : "Enter your password"}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors placeholder:opacity-40"
              style={{
                background: "var(--glass)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--glass-border)")
              }
            />
          </div>

          {/* Hidden flow field */}
          <input type="hidden" name="flow" value={flow} />

          {/* Error message */}
          {error && (
            <p
              className="text-xs rounded-md px-3 py-2"
              style={{
                color: "var(--sell)",
                background: "var(--sell-muted)",
              }}
            >
              {error}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "var(--accent)",
              color: "#fff",
              boxShadow: "0 0 20px var(--accent-glow)",
            }}
            onMouseEnter={(e) => {
              if (!submitting)
                e.currentTarget.style.background = "var(--accent-bright)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--accent)";
            }}
          >
            {submitting
              ? "Please wait..."
              : flow === "signIn"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        {/* Toggle sign in / sign up */}
        <p
          className="text-center text-sm mt-6"
          style={{ color: "var(--text-muted)" }}
        >
          {flow === "signIn" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setFlow("signUp");
                  setError("");
                }}
                className="font-medium cursor-pointer hover:underline"
                style={{ color: "var(--accent-bright)" }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setFlow("signIn");
                  setError("");
                }}
                className="font-medium cursor-pointer hover:underline"
                style={{ color: "var(--accent-bright)" }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>

      {/* Dev nav panel */}
      {process.env.NODE_ENV === "development" && (
        <div style={{
          position: "fixed", bottom: 12, right: 12, zIndex: 99999,
          background: "rgba(26,23,20,0.95)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(196,123,58,0.3)", borderRadius: 10,
          padding: "6px 8px", display: "flex", gap: 4, alignItems: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          fontFamily: "monospace", fontSize: 9, fontWeight: 600,
        }}>
          <span style={{ color: "rgba(196,123,58,0.6)", padding: "0 4px", userSelect: "none" }}>DEV</span>
          {["landing", "login", "onboarding"].map((r) => (
            <button key={r} onClick={() => window.location.href = `/${r}`} style={{
              padding: "3px 7px", borderRadius: 5, border: "1px dashed rgba(196,123,58,0.2)", cursor: "pointer",
              background: r === "login" ? "rgba(196,123,58,0.25)" : "transparent",
              color: r === "login" ? "#c47b3a" : "rgba(236,227,213,0.3)",
              fontSize: 9, fontFamily: "monospace", fontWeight: 600, textTransform: "capitalize" as const,
            }}>{r}</button>
          ))}
          <span style={{ width: 1, height: 12, background: "rgba(236,227,213,0.1)" }} />
          <button onClick={() => {
            localStorage.setItem("afindr_onboarding", JSON.stringify({ completed: true, name: "Dev" }));
            window.location.href = "/";
          }} style={{
            padding: "3px 10px", borderRadius: 5, border: "none", cursor: "pointer",
            background: "#c47b3a", color: "#fff",
            fontSize: 9, fontFamily: "monospace", fontWeight: 700,
          }}>SKIP TO APP →</button>
        </div>
      )}
    </div>
  );
}

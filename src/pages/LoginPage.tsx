import {
  FormEvent,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import { useRouter } from "../router/Router";

const USERNAME_RE =
  /^[a-zA-Z0-9._-]{3,50}$/;

export function LoginPage() {
  const { navigate } = useRouter();
  const [username, setUsername] =
    useState("");
  const [password, setPassword] =
    useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [busy, setBusy] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError(null);

    const normalizedUsername =
      username.trim().toLowerCase();

    if (
      !normalizedUsername ||
      !password
    ) {
      setError(
        "Username dan password wajib diisi"
      );
      return;
    }

    if (
      !USERNAME_RE.test(
        normalizedUsername
      )
    ) {
      setError(
        "Format username tidak valid"
      );
      return;
    }

    setBusy(true);

    const loginDomain =
      import.meta.env
        .VITE_AUTH_LOGIN_DOMAIN ||
      "marriot.com";

    const email =
      `${normalizedUsername}@${loginDomain}`;

    const {
      data,
      error: loginError,
    } =
      await supabase.auth
        .signInWithPassword({
          email,
          password,
        });

    if (
      loginError ||
      !data.user
    ) {
      setBusy(false);
      setError(
        "Username atau password salah"
      );
      return;
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        "role,is_active"
      )
      .eq("id", data.user.id)
      .single();

    if (
      profileError ||
      !profile?.is_active
    ) {
      await supabase.auth.signOut();
      setBusy(false);
      setError(
        "Akun tidak aktif"
      );
      return;
    }

    navigate(
      profile.role === "ADMIN"
        ? "/admin/dashboard"
        : "/dashboard",
      { replace: true }
    );
  }

  return (
    <main className="hotel-login-page">
      <div className="hotel-login-overlay" />
      <div className="hotel-login-gradient" />

      <div className="hotel-login-container">
        <section className="hotel-login-card">
          <div className="hotel-login-brands">
            <img
              src="/images/fairfield-logo.png"
              alt="Fairfield by Marriott"
              className="hotel-brand-logo fairfield-logo"
            />

            <div className="hotel-brand-divider" />

            <img
              src="/images/four-points-logo.png"
              alt="Four Points by Sheraton"
              className="hotel-brand-logo four-points-logo"
            />
          </div>

          <div className="hotel-login-heading">

            <h1>
              IT Helpdesk
            </h1>

            <p className="hotel-login-description">
              Sign in to manage and track IT
              support tickets.
            </p>
          </div>

          {error && (
            <div className="hotel-login-error">
              <div className="hotel-login-error-icon">
                !
              </div>
              <span>{error}</span>
            </div>
          )}

          <form
            onSubmit={submit}
            className="hotel-login-form"
          >
            <div className="hotel-login-field">
              <label htmlFor="username">
                Username
              </label>

              <div className="hotel-login-input-wrapper">
                <span className="hotel-login-input-icon">
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle
                      cx="12"
                      cy="8"
                      r="4"
                    />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                  </svg>
                </span>

                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  disabled={busy}
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value
                    )
                  }
                />
              </div>
            </div>

            <div className="hotel-login-field">
              <label htmlFor="password">
                Password
              </label>

              <div className="hotel-login-input-wrapper">
                <span className="hotel-login-input-icon">
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect
                      x="4"
                      y="10"
                      width="16"
                      height="10"
                      rx="2"
                    />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="current-password"
                  required
                  disabled={busy}
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                />

                <button
                  type="button"
                  className="hotel-password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current
                    )
                  }
                  disabled={busy}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m3 3 18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5 0 9 5 9 8a11.5 11.5 0 0 1-2.1 3.5" />
                      <path d="M6.6 6.6C4.5 8 3 10.2 3 12c0 3 4 8 9 8 1.3 0 2.5-.3 3.6-.8" />
                    </svg>
                  ) : (
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              className="hotel-login-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="hotel-login-spinner" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="hotel-login-footer">
            <span>
              Internal hotel system
            </span>
            <span className="hotel-login-footer-dot">
              •
            </span>
            <span>
              Authorized personnel only
            </span>
          </div>
        </section>
      </div>

      <div className="hotel-login-copyright">
        IT Helpdesk System
      </div>
    </main>
  );
}

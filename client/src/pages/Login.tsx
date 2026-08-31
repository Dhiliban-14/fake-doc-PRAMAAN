import React, { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { COOKIE_NAME } from "@shared/const";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Sun,
  Moon,
  Fingerprint,
  ArrowLeft,
} from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const utils = trpc.useUtils();

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      if (data.token) {
        try {
          sessionStorage.setItem("manus-cookie", `${COOKIE_NAME}=${data.token}`);
        } catch {}
      }
      await utils.auth.me.invalidate();
      toast.success(`Welcome back, ${data.user?.name || "Investigator"}`, {
        description: "Authenticated with secure session token.",
      });
      setLocation("/");
    },
    onError: (err) => {
      setErrorMessage(err.message || "Failed to authenticate credentials.");
      toast.error("Authentication failed", { description: err.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!usernameOrEmail.trim()) {
      setErrorMessage("Please enter your official username or email.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your security password.");
      return;
    }

    loginMutation.mutate({
      usernameOrEmail: usernameOrEmail.trim(),
      password,
    });
  };

  const autofillDemo = () => {
    setUsernameOrEmail("investigator@pramaan.gov.in");
    setPassword("pramaan2026");
    setErrorMessage(null);
    toast.info("Demo credentials filled", {
      description: "Click 'Sign In' or hit Enter to access the dashboard.",
    });
  };

  return (
    <div className="login-container">
      <div className="login-topbar">
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="login-back-btn"
          aria-label="Return to application"
        >
          <ArrowLeft size={16} />
          <span>Return to Dashboard</span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="icon-button bordered theme-toggle-btn"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      <div className="login-card-wrapper">
        <div className="login-card">
          <div className="login-header">
            <div className="brand-lockup login-brand">
              <div className="brand-mark">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div>
                <div className="brand-name">PRAMAAN</div>
                <div className="brand-subtitle">FORENSIC INTELLIGENCE PORTAL</div>
              </div>
            </div>

            <h1>Investigator Sign In</h1>
            <p>
              Access restricted case dossiers, cryptographic hash registries, and deep forensic pipelines.
            </p>
          </div>

          {errorMessage && (
            <div className="login-error-alert" role="alert">
              <AlertCircle size={17} />
              <div>
                <strong>Authentication Error</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field-group">
              <label htmlFor="usernameOrEmail">
                <span>Investigator Email / ID</span>
                <span className="field-required">*</span>
              </label>
              <div className="login-input-wrapper">
                <Mail size={16} className="login-input-icon" />
                <input
                  id="usernameOrEmail"
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="e.g. investigator@pramaan.gov.in"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="login-field-group">
              <div className="login-label-row">
                <label htmlFor="password">
                  <span>Security Password</span>
                  <span className="field-required">*</span>
                </label>
              </div>
              <div className="login-input-wrapper">
                <Lock size={16} className="login-input-icon" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter security passphrase"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle-btn"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="login-actions">
              <button
                type="submit"
                className="primary-button login-submit-btn"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <span>Verifying session...</span>
                ) : (
                  <>
                    <span>Authenticate & Access</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={autofillDemo}
                className="demo-autofill-btn"
              >
                <Sparkles size={15} />
                <span>Autofill Official Investigator Credentials</span>
              </button>
            </div>
          </form>

          <div className="login-footer">
            <div className="security-notice">
              <Fingerprint size={16} />
              <span>
                All authentication events are bound to cryptographic audit chains and monitored for investigative non-repudiation.
              </span>
            </div>

            <div className="guest-skip-row">
              <span>Need read-only review?</span>
              <button
                type="button"
                onClick={() => setLocation("/")}
                className="text-button"
              >
                Continue as Guest →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Banknote,
  Building2,
  FileCheck2,
  ArrowUpRight,
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  Truck,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Route,
} from "lucide-react";

const DEMO_ACCOUNTS = [
  { role: "Dispatch Manager", email: "dispatch@vectologistics.in" },
  { role: "Driver Mobile App", email: "driver.rajesh@vectologistics.in" },
  { role: "Internal Audit Desk", email: "audit.lead@vectologistics.in" },
  { role: "Accounts & Billing", email: "billing.finance@vectologistics.in" },
  { role: "Client AP Portal", email: "ap.payments@metro-wholesale.in" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("name@vectologistics.in");
  const [password, setPassword] = useState("password");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage("Please enter both email address and password.");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      if (password === "error" || email === "locked@test.com") {
        setIsLoading(false);
        setErrorMessage("Account temporarily locked after 5 failed attempts. Please contact IT Security.");
        return;
      }

      if (password.length < 6) {
        setIsLoading(false);
        setErrorMessage("Invalid credentials. The password entered does not match our records.");
        return;
      }

      document.cookie = "vecto_access_token=vecto_mock_jwt_session_token_2026; path=/; max-age=86400; SameSite=Lax";
      setSuccessMessage("Authentication verified. Redirecting to workspace...");

      const normalizedEmail = email.toLowerCase();
      let destination = "/dispatch";
      if (normalizedEmail.includes("driver")) destination = "/driver";
      else if (normalizedEmail.includes("audit")) destination = "/audit";
      else if (normalizedEmail.includes("billing") || normalizedEmail.includes("account")) destination = "/accounts";
      else if (normalizedEmail.includes("metro") || normalizedEmail.includes("client") || normalizedEmail.includes("ap.")) destination = "/client-portal";
      else if (normalizedEmail.includes("admin")) destination = "/admin";

      setTimeout(() => router.push(destination), 500);
    }, 850);
  };

  const handleSelectPreset = (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword("Enterprise@2026");
    setErrorMessage(null);
  };

  return (
    <main className="login-shell">
      <section className="login-hero" aria-labelledby="login-hero-title">
        <div className="login-hero-photo" aria-hidden="true" />
        <div className="login-hero-grid" aria-hidden="true" />
        <div className="login-world-map" aria-hidden="true">
          <span className="login-continent login-continent-americas" />
          <span className="login-continent login-continent-europe" />
          <span className="login-continent login-continent-africa" />
          <span className="login-continent login-continent-asia" />
          <span className="login-continent login-continent-australia" />
        </div>
        <div className="login-route-visual" aria-hidden="true">
          <div className="login-route-heading"><Route className="h-3.5 w-3.5" /> GLOBAL SHIPMENT CORRIDOR</div>
          <div className="login-route-line"><span className="login-route-node login-route-node-start" /><span className="login-route-node login-route-node-middle" /><span className="login-route-node login-route-node-end" /></div>
          <div className="login-route-labels"><span>MUMBAI</span><span>SINGAPORE</span><span>ROTTERDAM</span></div>
        </div>

        <div className="login-hero-content">
          <header className="login-hero-header">
            <div className="login-hero-brand">
              <div className="login-hero-mark"><Truck className="h-5 w-5" /></div>
              <div>
                <div className="login-hero-brand-name">VECTO <span>LOGISTICS</span></div>
                <div className="login-hero-brand-caption">POD-TO-CASH ENGINE</div>
              </div>
            </div>
            <nav className="login-journey-nav" aria-label="Platform capabilities">
              <span className="is-current">MOVE</span><span>TRACK</span><span>SETTLE</span><span>GROW</span>
            </nav>
          </header>

          <div className="login-hero-copy">
            <div className="login-hero-eyebrow"><span /> BUILT FOR THE FULL FREIGHT LIFECYCLE</div>
            <h1 id="login-hero-title" className="login-hero-title">POD-to-Cash<span>Settlement Engine</span></h1>
            <p className="login-hero-description">From dispatch to verified delivery to cleared payment.<br className="hidden sm:block" /> Every shipment, connected.</p>
          </div>

          <div className="login-feature-grid">
            {[
              { title: "Live shipment visibility", icon: MapPin },
              { title: "Faster settlements", icon: Banknote },
              { title: "Verified digital POD", icon: FileCheck2 },
              { title: "Automated reconciliation", icon: Activity },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="login-feature">
                  <span className="login-feature-icon"><Icon className="h-4 w-4" /></span>
                  <span>{feature.title}</span>
                  <ArrowUpRight className="login-feature-arrow h-3.5 w-3.5" />
                </div>
              );
            })}
          </div>

          <div className="login-metrics-bar">
            {[
              { label: "SHIPMENTS / MONTH", value: "12,400+" },
              { label: "ON-TIME POD", value: "98.6%" },
              { label: "FASTER SETTLEMENT", value: "3.2×" },
              { label: "AUDIT-READY RECORDS", value: "100%" },
            ].map((item) => (
              <div key={item.label} className="login-metric">
                <span className="login-metric-value">{item.value}</span>
                <span className="login-metric-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="login-auth-panel">
        <div className="login-auth-content">
          <div className="login-auth-brand">
            <div className="login-auth-mark"><Truck className="h-5 w-5" /></div>
            <div>
              <div className="login-auth-brand-name">VECTO <span>LOGISTICS</span></div>
              <div className="login-auth-brand-caption">POD-TO-CASH SETTLEMENT ENGINE</div>
            </div>
          </div>

          <div className="login-security-pills">
            <span><ShieldCheck className="h-3.5 w-3.5" /> Enterprise Gateway</span>
            <span><Lock className="h-3.5 w-3.5" /> SSO Ready</span>
          </div>

          <div className="login-form-intro">
            <div className="login-panel-eyebrow">WELCOME BACK</div>
            <h2>Sign in to your workspace</h2>
            <p>Use your Vecto Logistics account to continue.</p>
          </div>

          <form onSubmit={handleSignIn} className="login-form">
            <div className="login-field">
              <label htmlFor="corporate-email">Corporate email</label>
              <div className="login-input-wrap">
                <Mail className="h-4 w-4" />
                <input
                  id="corporate-email"
                  name="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="login-field-input"
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-field-heading">
                <label htmlFor="corporate-password">Password</label>
                <button type="button" className="login-forgot">Forgot Password?</button>
              </div>
              <div className="login-input-wrap">
                <Lock className="h-4 w-4" />
                <input
                  id="corporate-password"
                  name="password"
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-field-input"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="login-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="login-message login-message-error" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" /><span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="login-message login-message-success" role="status">
                <CheckCircle2 className="h-4 w-4 shrink-0" /><span>{successMessage}</span>
              </div>
            )}

            <button type="submit" disabled={isLoading} className="login-submit">
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing In...</> : <>Sign In <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <div className="login-divider"><span>OR CONTINUE WITH</span></div>

          <button type="button" className="login-sso-button">
            <Building2 className="h-4 w-4" /> Sign in with Enterprise SSO <ArrowRight className="ml-auto h-4 w-4" />
          </button>

          <div className="login-presets-heading"><span>QUICK ROLE PRESETS</span><span>DEMO ACCESS</span></div>
          <div className="login-presets-grid">
            {DEMO_ACCOUNTS.map((item) => {
              const Icon = item.role.includes("Driver")
                ? Truck
                : item.role.includes("Accounts")
                ? Banknote
                : item.role.includes("Audit")
                ? FileCheck2
                : item.role.includes("Client")
                ? Building2
                : Activity;
              return (
                <button
                  key={item.email}
                  type="button"
                  onClick={() => handleSelectPreset(item.email)}
                  className="login-preset"
                >
                  <span className="login-preset-icon"><Icon className="h-3.5 w-3.5" /></span>
                  <span>{item.role}</span>
                  <ArrowUpRight className="login-preset-arrow h-3 w-3" />
                </button>
              );
            })}
          </div>

          <div className="login-security-footer">
            <span><ShieldCheck className="h-3.5 w-3.5" /> Role-based access</span>
            <span><Lock className="h-3.5 w-3.5" /> Secure session</span>
          </div>
        </div>
      </aside>
    </main>
  );
}

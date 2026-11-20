"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api/client";
import {
  Lock,
  CheckCircle2,
  Circle,
  Truck,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  KeyRound,
} from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface PasswordRule {
  id: string;
  label: string;
  validator: (pwd: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "Minimum 10 characters",
    validator: (p) => p.length >= 10,
  },
  {
    id: "uppercase",
    label: "At least 1 uppercase letter (A-Z)",
    validator: (p) => /[A-Z]/.test(p),
  },
  {
    id: "lowercase",
    label: "At least 1 lowercase letter (a-z)",
    validator: (p) => /[a-z]/.test(p),
  },
  {
    id: "number",
    label: "At least 1 number (0-9)",
    validator: (p) => /[0-9]/.test(p),
  },
  {
    id: "symbol",
    label: "At least 1 special symbol (!@#$%^&*...)",
    validator: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

function InviteAcceptForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // Form State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Submission States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic Rule Validation Results
  const ruleResults = useMemo(() => {
    return PASSWORD_RULES.map((rule) => ({
      ...rule,
      isMet: rule.validator(newPassword),
    }));
  }, [newPassword]);

  // All policy rules satisfied
  const allRulesMet = useMemo(() => {
    return ruleResults.every((r) => r.isMet);
  }, [ruleResults]);

  // Confirmation match validation
  const passwordsMatch = useMemo(() => {
    return (
      newPassword.length > 0 &&
      confirmPassword.length > 0 &&
      newPassword === confirmPassword
    );
  }, [newPassword, confirmPassword]);

  // Form submission enabled only when all rules are met and confirmation matches
  const isFormValid = allRulesMet && passwordsMatch;

  // Strength score for progress bar (0 - 5)
  const strengthScore = useMemo(() => {
    return ruleResults.filter((r) => r.isMet).length;
  }, [ruleResults]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Missing invitation token.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!allRulesMet) {
      setError("Password does not meet policy.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.post("/auth/accept-invite", { token, password: newPassword });
      router.push("/login");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Could not accept invitation.");
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-[480px] bg-white border border-slate-200 rounded-xl shadow-md overflow-hidden">
      {/* Branding & Welcome Header */}
      <CardHeader className="p-8 pb-5 text-center border-b border-slate-100 bg-white">
        <div className="mx-auto h-14 w-14 rounded-xl bg-royal flex items-center justify-center text-white mb-4 shadow-md">
          <Truck className="h-7 w-7" />
        </div>

        <CardTitle className="text-2xl font-bold tracking-tight text-void">
          Welcome to Vecto Logistics
        </CardTitle>
        <CardDescription className="text-sm text-slate-500 font-medium tracking-wide mt-1.5">
          Set up your account password to continue.
        </CardDescription>

        <div className="mt-3 inline-flex items-center justify-center space-x-2 px-3 py-1 rounded-full bg-slate-100 text-xs font-mono text-void font-medium border border-slate-200">
          <KeyRound className="h-3.5 w-3.5 text-royal" />
          <span>Invite Token: {token ? `${token.slice(0, 14)}...` : "None"}</span>
        </div>
      </CardHeader>

      <CardContent className="p-8 pt-6 space-y-5">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="animate-in fade-in-50 duration-150 bg-magenta/15 border-magenta/40 text-magenta">
            <AlertCircle className="h-4 w-4 text-magenta" />
            <AlertTitle className="text-sm font-bold">
              Invitation Error
            </AlertTitle>
            <AlertDescription className="text-xs font-semibold">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* New Password Field */}
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-sm font-semibold text-void">
              New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                placeholder="Enter enterprise password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                required
                className="pl-10 pr-10 h-11 text-base text-void placeholder:text-slate-400 border-slate-300 bg-white focus-visible:ring-royal font-mono"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-void transition-colors"
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Password Strength Meter Bar */}
            {newPassword.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                  <span>Policy Compliance</span>
                  <span className="font-bold text-void">
                    {strengthScore}/5 Requirements
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1 p-0.5 border border-slate-200">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`h-full flex-1 rounded-full transition-colors ${
                        strengthScore >= level
                          ? strengthScore === 5
                            ? "bg-turquoise"
                            : strengthScore >= 3
                            ? "bg-royal"
                            : "bg-magenta"
                          : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Password Policy Validator Checklist */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <span className="text-xs font-bold text-void uppercase tracking-wider block">
              Enterprise Password Requirements:
            </span>

            <div className="space-y-2">
              {ruleResults.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center space-x-2.5 text-xs transition-colors"
                >
                  {rule.isMet ? (
                    <CheckCircle2 className="h-4 w-4 text-turquoise flex-shrink-0 animate-in zoom-in-75 duration-100" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300 flex-shrink-0" />
                  )}
                  <span
                    className={`text-xs ${
                      rule.isMet
                        ? "text-void font-bold"
                        : "text-slate-500"
                    }`}
                  >
                    {rule.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="confirmPassword" className="text-sm font-semibold text-void">
                Confirm Password
              </Label>
              {confirmPassword.length > 0 && (
                <span
                  className={`text-xs font-mono font-bold flex items-center gap-1 ${
                    passwordsMatch ? "text-turquoise" : "text-magenta"
                  }`}
                >
                  {passwordsMatch ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3.5 w-3.5" /> Passwords do not match
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
                className={`pl-10 pr-10 h-11 text-base text-void placeholder:text-slate-400 border-slate-300 bg-white focus-visible:ring-royal font-mono ${
                  confirmPassword.length > 0 && !passwordsMatch
                    ? "border-magenta focus-visible:ring-magenta"
                    : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-void transition-colors"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Action Button: Disabled until policy & confirm password match */}
          <Button
            type="submit"
            disabled={!isFormValid || loading}
            className="w-full h-11 text-base font-semibold bg-royal hover:bg-royal/90 text-white rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-white" />
                <span>Saving Password...</span>
              </>
            ) : (
              <>
                <span>Save Password & Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        {/* Back to Sign In Link */}
        <div className="text-center pt-2 border-t border-slate-100">
          <Link
            href="/login"
            className="text-sm text-slate-500 hover:text-void font-medium inline-flex items-center gap-1 transition-colors"
          >
            Already have an active account? Sign In
          </Link>
        </div>
      </CardContent>

      {/* Card Footer: Enterprise Security Details */}
      <CardFooter className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center flex flex-col justify-center items-center text-xs text-slate-500">
        <p className="flex items-center gap-1.5 font-medium text-void">
          <ShieldCheck className="h-4 w-4 text-royal" />
          Encrypted using Argon2id hashing.
        </p>
        <p className="font-mono text-xs text-slate-400 mt-0.5">
          Single-use cryptographic invitation link.
        </p>
      </CardFooter>
    </Card>
  );
}

export default function InviteAcceptPage() {
  return (
    <div className="min-h-screen w-full bg-platinum flex flex-col justify-center items-center p-4 sm:p-6 antialiased font-sans text-void select-none">
      <Suspense
        fallback={
          <div className="flex items-center justify-center text-sm font-mono text-slate-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-royal" />
            Verifying invitation token...
          </div>
        }
      >
        <InviteAcceptForm />
      </Suspense>
    </div>
  );
}

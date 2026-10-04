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
    <Card className="w-full max-w-[440px] bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
      {/* Branding & Welcome Header */}
      <CardHeader className="p-6 pb-4 text-center border-b border-slate-100 bg-white">
        <div className="mx-auto h-11 w-11 rounded-md bg-slate-900 flex items-center justify-center text-white mb-3 shadow-xs">
          <Truck className="h-6 w-6" />
        </div>

        <CardTitle className="text-xl font-bold tracking-tight text-slate-900">
          Welcome to Vecto Logistics
        </CardTitle>
        <CardDescription className="text-xs text-slate-500 font-medium tracking-wide mt-1">
          Set up your account password to continue.
        </CardDescription>

        <div className="mt-2.5 inline-flex items-center justify-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-mono text-slate-600 font-medium border border-slate-200">
          <KeyRound className="h-3 w-3 text-blue-800" />
          <span>Invite Token: {token ? `${token.slice(0, 14)}...` : "None"}</span>
        </div>
      </CardHeader>

      <CardContent className="p-6 pt-5 space-y-4">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="animate-in fade-in-50 duration-150">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-xs font-bold">
              Invitation Error
            </AlertTitle>
            <AlertDescription className="text-xs">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password Field */}
          <div className="space-y-1.5">
            <Label htmlFor="newPassword" className="text-xs font-semibold text-slate-700">
              New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                placeholder="Enter enterprise password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                required
                className="pl-9 pr-9 h-10 text-xs text-slate-900 placeholder:text-slate-400 border-slate-200 bg-white focus-visible:ring-1 focus-visible:ring-slate-950 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Password Strength Meter Bar */}
            {newPassword.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>Policy Compliance</span>
                  <span className="font-bold text-slate-700">
                    {strengthScore}/5 Requirements
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1 p-0.5 border border-slate-200">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`h-full flex-1 rounded-full transition-colors ${
                        strengthScore >= level
                          ? strengthScore === 5
                            ? "bg-emerald-600"
                            : strengthScore >= 3
                            ? "bg-amber-500"
                            : "bg-red-500"
                          : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Password Policy Validator Checklist */}
          <div className="p-3 bg-slate-50/80 rounded-md border border-slate-200 space-y-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Enterprise Password Requirements:
            </span>

            <div className="space-y-1.5">
              {ruleResults.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center space-x-2 text-xs transition-colors"
                >
                  {rule.isMet ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 animate-in zoom-in-75 duration-100" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300 flex-shrink-0" />
                  )}
                  <span
                    className={`text-xs ${
                      rule.isMet
                        ? "text-slate-900 font-medium"
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">
                Confirm Password
              </Label>
              {confirmPassword.length > 0 && (
                <span
                  className={`text-[10px] font-mono font-medium flex items-center gap-1 ${
                    passwordsMatch ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {passwordsMatch ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Passwords match
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3" /> Passwords do not match
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
                className={`pl-9 pr-9 h-10 text-xs text-slate-900 placeholder:text-slate-400 border-slate-200 bg-white focus-visible:ring-1 focus-visible:ring-slate-950 font-mono ${
                  confirmPassword.length > 0 && !passwordsMatch
                    ? "border-red-300 focus-visible:ring-red-400"
                    : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
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
            className="w-full h-10 text-xs font-semibold bg-blue-800 hover:bg-blue-900 text-white rounded-md shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Saving Password...</span>
              </>
            ) : (
              <>
                <span>Save Password & Sign In</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </form>

        {/* Back to Sign In Link */}
        <div className="text-center pt-1 border-t border-slate-100">
          <Link
            href="/login"
            className="text-xs text-slate-500 hover:text-slate-900 font-medium inline-flex items-center gap-1 transition-colors"
          >
            Already have an active account? Sign In
          </Link>
        </div>
      </CardContent>

      {/* Card Footer: Enterprise Security Details */}
      <CardFooter className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center flex flex-col justify-center items-center text-[11px] text-slate-500">
        <p className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-800" />
          Encrypted using Argon2id hashing.
        </p>
        <p className="font-mono text-[10px] text-slate-400 mt-0.5">
          Single-use cryptographic invitation link.
        </p>
      </CardFooter>
    </Card>
  );
}

export default function InviteAcceptPage() {
  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 antialiased font-sans text-slate-800 select-none">
      <Suspense
        fallback={
          <div className="flex items-center justify-center text-xs font-mono text-slate-500 gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-800" />
            Verifying invitation token...
          </div>
        }
      >
        <InviteAcceptForm />
      </Suspense>
    </div>
  );
}

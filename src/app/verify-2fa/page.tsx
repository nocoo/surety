"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { ShieldCheck, KeyRound, ArrowLeft } from "lucide-react";

type Mode = "totp" | "recovery";

export default function VerifyTwoFactorPage() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, [mode]);

  const submitCode = useCallback(async (token: string, type: Mode) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type, rememberDevice }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        if (type === "totp") {
          // Clear code inputs
          setCode(["", "", "", "", "", ""]);
          inputRefs.current[0]?.focus();
        }
        return;
      }

      // Update NextAuth JWT with server-signed nonce (prevents bypass)
      await updateSession({
        twoFactorNonce: data.twoFactorNonce,
        twoFactorSig: data.twoFactorSig,
        // Recovery code login: set session-scoped claim for force-disable authorization
        ...(data.recoverySession && { recoverySession: true }),
      });

      // Redirect to home
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [router, updateSession, rememberDevice]);

  // Handle individual digit input
  const handleDigitChange = useCallback((index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);

    setCode((prev) => {
      const next = [...prev];
      next[index] = digit;

      // Auto-submit when all 6 digits entered
      if (digit && next.every((d) => d !== "")) {
        const token = next.join("");
        submitCode(token, "totp");
      }

      return next;
    });

    // Move focus to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [submitCode]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [code]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const digits = pasted.split("");
      setCode(digits);
      inputRefs.current[5]?.focus();
      submitCode(pasted, "totp");
    }
  }, [submitCode]);

  const handleRecoverySubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim()) return;
    submitCode(recoveryCode.trim(), "recovery");
  }, [recoveryCode, submitCode]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden">
      {/* Radial glow — same as login page */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 70% 55% at 50% 50%,",
            "hsl(var(--foreground) / 0.045) 0%,",
            "hsl(var(--foreground) / 0.042) 10%,",
            "hsl(var(--foreground) / 0.036) 20%,",
            "hsl(var(--foreground) / 0.028) 32%,",
            "hsl(var(--foreground) / 0.020) 45%,",
            "hsl(var(--foreground) / 0.012) 58%,",
            "hsl(var(--foreground) / 0.006) 72%,",
            "hsl(var(--foreground) / 0.002) 86%,",
            "transparent 100%)",
          ].join(" "),
        }}
      />

      <div className="flex flex-col items-center">
        {/* Badge card */}
        <div
          className="relative w-80 overflow-hidden rounded-2xl bg-card flex flex-col ring-1 ring-black/[0.08] dark:ring-white/[0.06]"
          style={{
            boxShadow: [
              "0 1px 2px rgba(0,0,0,0.06)",
              "0 4px 8px rgba(0,0,0,0.04)",
              "0 12px 24px rgba(0,0,0,0.06)",
              "0 24px 48px rgba(0,0,0,0.04)",
              "0 0 0 0.5px rgba(0,0,0,0.02)",
              "0 0 60px rgba(0,0,0,0.03)",
            ].join(", "),
          }}
        >
          {/* Header strip */}
          <div className="bg-primary px-5 py-4">
            <div className="flex items-center justify-between">
              <ShieldCheck className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
              <span className="text-sm font-semibold text-primary-foreground">
                {mode === "totp" ? "Two-Factor Verification" : "Recovery Code"}
              </span>
              <div className="w-4" />
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col items-center px-6 pt-6 pb-6">
            {/* Icon */}
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary ring-1 ring-border">
              {mode === "totp" ? (
                <ShieldCheck className="h-7 w-7 text-primary" strokeWidth={1.5} />
              ) : (
                <KeyRound className="h-7 w-7 text-primary" strokeWidth={1.5} />
              )}
            </div>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "totp"
                ? "Enter the 6-digit code from your authenticator app"
                : "Enter your recovery code"}
            </p>

            {/* Error */}
            {error && (
              <div className="mt-3 w-full rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive text-center">
                {error}
              </div>
            )}

            {mode === "totp" ? (
              <>
                {/* 6-digit code input */}
                <div className="mt-5 flex gap-2" onPaste={handlePaste}>
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      disabled={loading}
                      className="h-12 w-10 rounded-lg border border-border bg-background text-center text-lg font-mono text-foreground
                        focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                        disabled:opacity-50 transition-colors"
                    />
                  ))}
                </div>

                {/* Remember device toggle */}
                <label className="mt-4 flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <span className="text-xs text-muted-foreground">Trust this device for 30 days</span>
                </label>

                {/* Switch to recovery */}
                <button
                  onClick={() => { setMode("recovery"); setError(""); }}
                  className="mt-5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Use recovery code instead
                </button>
              </>
            ) : (
              <>
                {/* Recovery code input */}
                <form onSubmit={handleRecoverySubmit} className="mt-5 w-full space-y-3">
                  <input
                    ref={(el) => { inputRefs.current[0] = el; }}
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    placeholder="xxxx-xxxx-xxxx-..."
                    disabled={loading}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-mono text-foreground
                      placeholder:text-muted-foreground/50
                      focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                      disabled:opacity-50 transition-colors"
                  />
                  {/* No "Trust this device" for recovery — break-glass credential should not grant persistent trust */}
                  <button
                    type="submit"
                    disabled={loading || !recoveryCode.trim()}
                    className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground
                      hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {loading ? "Verifying..." : "Verify"}
                  </button>
                </form>

                {/* Switch back to TOTP */}
                <button
                  onClick={() => { setMode("totp"); setError(""); setRecoveryCode(""); }}
                  className="mt-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to authenticator code
                </button>
              </>
            )}
          </div>

          {/* Footer strip */}
          <div className="flex items-center justify-center border-t border-border bg-secondary/50 py-2.5">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
              <span className="text-[10px] text-muted-foreground">Verification Required</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ShieldCheck, Loader2, AlertTriangle, Copy, Check, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function TwoFactorSettings() {
  const { data: sessionData, update: updateSession } = useSession();

  const [tfaEnabled, setTfaEnabled] = useState(false);
  const [tfaLoading, setTfaLoading] = useState(true);
  const [tfaSetupData, setTfaSetupData] = useState<{ qrDataURL: string; secret: string } | null>(null);
  const [tfaSetupCode, setTfaSetupCode] = useState("");
  const [tfaDisableCode, setTfaDisableCode] = useState("");
  const [tfaRecoveryCode, setTfaRecoveryCode] = useState<string | null>(null);
  const [tfaError, setTfaError] = useState<string | null>(null);
  const [tfaProcessing, setTfaProcessing] = useState(false);
  const [tfaShowSecret, setTfaShowSecret] = useState(false);
  const [tfaCopied, setTfaCopied] = useState(false);
  const [tfaShowDisable, setTfaShowDisable] = useState(false);

  // Load 2FA status
  const loadTfaStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/2fa/status");
      if (res.ok) {
        const data = await res.json();
        setTfaEnabled(data.enabled);
      }
    } catch {
      // ignore
    } finally {
      setTfaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTfaStatus();
  }, [loadTfaStatus]);

  // 2FA: start setup
  const handleTfaSetup = async () => {
    setTfaProcessing(true);
    setTfaError(null);
    try {
      const res = await fetch("/api/settings/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setTfaError(data.error || "Setup failed");
        return;
      }
      setTfaSetupData(data);
      setTfaSetupCode("");
    } catch {
      setTfaError("Network error");
    } finally {
      setTfaProcessing(false);
    }
  };

  // 2FA: verify setup code
  const handleTfaVerifySetup = async () => {
    if (!tfaSetupCode || !/^\d{6}$/.test(tfaSetupCode)) {
      setTfaError("Please enter a 6-digit code");
      return;
    }
    setTfaProcessing(true);
    setTfaError(null);
    try {
      const res = await fetch("/api/settings/2fa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tfaSetupCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTfaError(data.error || "Verification failed");
        return;
      }
      setTfaEnabled(true);
      setTfaRecoveryCode(data.recoveryCode);
      setTfaSetupData(null);
      setTfaSetupCode("");

      // Promote JWT: setup proves authenticator ownership, exempt current session
      if (data.twoFactorNonce && data.twoFactorSig) {
        await updateSession({
          twoFactorNonce: data.twoFactorNonce,
          twoFactorSig: data.twoFactorSig,
        });
      }
    } catch {
      setTfaError("Network error");
    } finally {
      setTfaProcessing(false);
    }
  };

  // 2FA: disable
  const handleTfaDisable = async () => {
    if (!tfaDisableCode || !/^\d{6}$/.test(tfaDisableCode)) {
      setTfaError("Please enter a 6-digit code");
      return;
    }
    setTfaProcessing(true);
    setTfaError(null);
    try {
      const res = await fetch("/api/settings/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tfaDisableCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTfaError(data.error || "Failed to disable 2FA");
        return;
      }
      if (data.success) {
        setTfaEnabled(false);
        setTfaShowDisable(false);
        setTfaDisableCode("");
        setTfaRecoveryCode(null);
      }
    } catch {
      setTfaError("Network error");
    } finally {
      setTfaProcessing(false);
    }
  };

  // 2FA: force disable (recovery session — no authenticator available)
  const handleTfaForceDisable = async () => {
    setTfaProcessing(true);
    setTfaError(null);
    try {
      const res = await fetch("/api/settings/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTfaError(data.error || "Failed to disable 2FA");
        return;
      }
      if (data.success) {
        setTfaEnabled(false);
        setTfaShowDisable(false);
        setTfaDisableCode("");
        setTfaRecoveryCode(null);
        // Revoke the one-time force-disable privilege from JWT
        if (data.clearRecoverySession) {
          await updateSession({ clearRecoverySession: true });
        }
      }
    } catch {
      setTfaError("Network error");
    } finally {
      setTfaProcessing(false);
    }
  };

  // 2FA: copy recovery code
  const handleCopyRecoveryCode = async () => {
    if (!tfaRecoveryCode) return;
    await navigator.clipboard.writeText(tfaRecoveryCode);
    setTfaCopied(true);
    setTimeout(() => setTfaCopied(false), 2000);
  };

  return (
    <div className="rounded-card bg-secondary p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
          <ShieldCheck className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="font-semibold">双因素认证</h2>
          <p className="text-sm text-muted-foreground">
            {tfaEnabled ? "已启用 TOTP 双因素认证" : "使用 TOTP 增强登录安全性"}
          </p>
        </div>
        {tfaEnabled && (
          <Badge variant="success" className="ml-auto">已启用</Badge>
        )}
      </div>
      <Separator className="mb-4" />

      {tfaLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : !tfaEnabled ? (
        /* --- NOT ENABLED: setup flow --- */
        <div className="space-y-4">
          {!tfaSetupData ? (
            /* Step 1: start setup */
            <>
              <p className="text-sm text-muted-foreground">
                启用后，每次登录需输入 Google Authenticator 等应用生成的 6 位验证码。
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleTfaSetup()}
                disabled={tfaProcessing}
              >
                {tfaProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <ShieldCheck className="mr-2 h-4 w-4" />
                开始设置
              </Button>
            </>
          ) : (
            /* Step 2: scan QR and verify */
            <>
              <p className="text-sm text-muted-foreground">
                使用 Google Authenticator 或其他 TOTP 应用扫描二维码，然后输入 6 位验证码确认。
              </p>
              {/* QR code */}
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tfaSetupData.qrDataURL}
                  alt="TOTP QR Code"
                  className="h-48 w-48 rounded-lg border bg-white p-2"
                />
              </div>
              {/* Manual secret */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Manual key</Label>
                  <button
                    onClick={() => setTfaShowSecret(!tfaShowSecret)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {tfaShowSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
                {tfaShowSecret && (
                  <code className="block text-xs font-mono bg-muted rounded-widget px-2 py-1 break-all select-all">
                    {tfaSetupData.secret}
                  </code>
                )}
              </div>
              {/* Verify code input */}
              <div className="flex items-center gap-2">
                <Input
                  className="h-9 w-40 font-mono text-center tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  value={tfaSetupCode}
                  onChange={(e) => setTfaSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <Button
                  size="sm"
                  onClick={() => void handleTfaVerifySetup()}
                  disabled={tfaProcessing || tfaSetupCode.length !== 6}
                >
                  {tfaProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  确认启用
                </Button>
              </div>
            </>
          )}

          {/* Recovery code display (shown right after enabling) */}
          {tfaRecoveryCode && (
            <div className="rounded-widget border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950 space-y-2">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Recovery Code (save this — shown only once)
              </p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-background rounded-widget px-3 py-1.5 select-all">
                  {tfaRecoveryCode}
                </code>
                <button
                  onClick={() => void handleCopyRecoveryCode()}
                  className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Copy recovery code"
                >
                  {tfaCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                如果您丢失了认证设备，可以使用此备用码登录（仅可使用一次）。
              </p>
            </div>
          )}

          {tfaError && (
            <div className="flex items-start gap-2 rounded-widget border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{tfaError}</p>
            </div>
          )}
        </div>
      ) : (
        /* --- ENABLED: status & disable --- */
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>TOTP 双因素认证已启用。每次登录需要验证码。</p>
            {sessionData?.user?.recoverySession && (
              <p className="text-amber-600 dark:text-amber-400">
                当前会话通过 Recovery code 登录。建议禁用后重新启用以获取新的 recovery code。
              </p>
            )}
          </div>

          {/* Recovery code display (if just enabled) */}
          {tfaRecoveryCode && (
            <div className="rounded-widget border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950 space-y-2">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Recovery Code (save this — shown only once)
              </p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-background rounded-widget px-3 py-1.5 select-all">
                  {tfaRecoveryCode}
                </code>
                <button
                  onClick={() => void handleCopyRecoveryCode()}
                  className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Copy recovery code"
                >
                  {tfaCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                如果您丢失了认证设备，可以使用此备用码登录（仅可使用一次）。
              </p>
            </div>
          )}

          {!tfaShowDisable ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setTfaShowDisable(true); setTfaError(null); }}
            >
              禁用双因素认证
            </Button>
          ) : sessionData?.user?.recoverySession ? (
            /* Recovery session — authenticator lost, allow force disable */
            <div className="space-y-3 rounded-widget border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">
                当前会话通过 Recovery code 登录，您可以直接禁用双因素认证。禁用后建议重新启用以获取新的 recovery code。
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleTfaForceDisable()}
                  disabled={tfaProcessing}
                >
                  {tfaProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  确认禁用
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setTfaShowDisable(false); setTfaError(null); }}
                >
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-widget border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">
                输入当前验证码以禁用双因素认证
              </p>
              <div className="flex items-center gap-2">
                <Input
                  className="h-9 w-40 font-mono text-center tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  value={tfaDisableCode}
                  onChange={(e) => setTfaDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleTfaDisable()}
                  disabled={tfaProcessing || tfaDisableCode.length !== 6}
                >
                  {tfaProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  确认禁用
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setTfaShowDisable(false); setTfaDisableCode(""); setTfaError(null); }}
                >
                  取消
                </Button>
              </div>
            </div>
          )}

          {tfaError && (
            <div className="flex items-start gap-2 rounded-widget border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{tfaError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

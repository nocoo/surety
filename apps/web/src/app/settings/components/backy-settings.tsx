"use client";

import { useState, useEffect, useCallback } from "react";
import { Cloud, Save, Plug, Send, History, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// ── Backy types ──

interface BackySettings {
  webhookUrl: string;
  apiKey: string;
  hasApiKey: boolean;
  environment: "prod" | "dev";
}

interface BackyPushResponse {
  success: boolean;
  error?: string;
  request?: {
    url: string;
    method: string;
    environment: string;
    tag: string;
    fileName: string;
    fileSizeBytes: number;
    backupStats: Record<string, number>;
  };
  response?: {
    status: number;
    body: unknown;
  };
  durationMs?: number;
}

interface BackyBackupEntry {
  id: string;
  tag: string;
  environment: string;
  file_size: number;
  is_single_json: number;
  created_at: string;
}

interface BackyHistoryData {
  project_name: string;
  environment: string | null;
  total_backups: number;
  recent_backups: BackyBackupEntry[];
}

// ── Backy helpers ──

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return `${Math.floor(days / 30)} 个月前`;
}

// Table display names for backup stats
const TABLE_LABELS: Record<string, string> = {
  members: "成员",
  insurers: "保险公司",
  assets: "资产",
  policies: "保单",
  beneficiaries: "受益人",
  payments: "缴费记录",
  cashValues: "现金价值",
  settings: "设置",
};

export function BackySettings() {
  const [backySettings, setBackySettings] = useState<BackySettings | null>(null);
  const [backyUrl, setBackyUrl] = useState("");
  const [backyKey, setBackyKey] = useState("");
  const [backySaving, setBackySaving] = useState(false);
  const [backySaveError, setBackySaveError] = useState<string | null>(null);
  const [backyTesting, setBackyTesting] = useState(false);
  const [backyTestResult, setBackyTestResult] = useState<{ success: boolean; status: number; error?: string } | null>(null);
  const [backyPushing, setBackyPushing] = useState(false);
  const [backyPushResult, setBackyPushResult] = useState<BackyPushResponse | null>(null);
  const [backyHistory, setBackyHistory] = useState<BackyHistoryData | null>(null);
  const [backyHistoryLoading, setBackyHistoryLoading] = useState(false);

  // Load Backy settings from backend
  const loadBackySettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/backy");
      if (res.ok) {
        const data: BackySettings = await res.json();
        setBackySettings(data);
        setBackyUrl(data.webhookUrl);
        // Don't overwrite key input with masked value
      }
    } catch {
      // ignore
    }
  }, []);

  // Load Backy history
  const loadBackyHistory = useCallback(async () => {
    setBackyHistoryLoading(true);
    try {
      const res = await fetch("/api/settings/backy/history");
      if (res.ok) {
        const data: BackyHistoryData = await res.json();
        setBackyHistory(data);
      }
    } catch {
      // ignore
    } finally {
      setBackyHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBackySettings();
  }, [loadBackySettings]);

  // Auto-load history when backy settings are loaded and configured
  useEffect(() => {
    if (backySettings?.hasApiKey && backySettings.webhookUrl) {
      void loadBackyHistory();
    }
  }, [backySettings, loadBackyHistory]);

  // Backy: save settings with proper error handling
  const handleBackySave = async () => {
    setBackySaving(true);
    setBackyTestResult(null);
    setBackySaveError(null);
    try {
      const res = await fetch("/api/settings/backy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: backyUrl, apiKey: backyKey }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Parse error response and show error toast
        setBackySaveError(data.error || "保存失败");
        return;
      }

      setBackySettings(data as BackySettings);
      setBackyKey(""); // Clear key input after save
    } catch {
      setBackySaveError("网络错误，请重试");
    } finally {
      setBackySaving(false);
    }
  };

  // Backy: test connection
  const handleBackyTest = async () => {
    setBackyTesting(true);
    setBackyTestResult(null);
    try {
      const res = await fetch("/api/settings/backy/test", { method: "POST" });
      const data = await res.json();
      setBackyTestResult(data);
    } catch {
      setBackyTestResult({ success: false, status: 0, error: "网络错误" });
    } finally {
      setBackyTesting(false);
    }
  };

  // Backy: push backup
  const handleBackyPush = async () => {
    setBackyPushing(true);
    setBackyPushResult(null);
    try {
      const res = await fetch("/api/settings/backy/push", { method: "POST" });
      const data: BackyPushResponse = await res.json();
      setBackyPushResult(data);
      if (data.success) {
        void loadBackyHistory();
      }
    } catch {
      setBackyPushResult({ success: false, error: "网络错误" });
    } finally {
      setBackyPushing(false);
    }
  };

  const backyConfigured = backySettings?.hasApiKey && backySettings.webhookUrl;

  return (
    <div className="rounded-card bg-secondary p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
          <Cloud className="h-5 w-5 text-violet-500" strokeWidth={1.5} />
        </div>
        <div className="flex items-center gap-2">
          <div>
            <h2 className="font-semibold">远程备份</h2>
            <p className="text-sm text-muted-foreground">推送数据到 Backy 服务</p>
          </div>
          <Badge variant={backySettings?.environment === "prod" ? "success" : "warning"} className="ml-1">
            {backySettings?.environment ?? "dev"}
          </Badge>
        </div>
      </div>
      <Separator className="mb-4" />

      {/* Config form */}
      <div className="space-y-4">
        <div className="space-y-1">
          <Label className="text-sm">Webhook URL</Label>
          <Input
            className="h-9"
            placeholder="https://backy.example.com/api/webhook/..."
            value={backyUrl}
            onChange={(e) => setBackyUrl(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">API Key</Label>
          <Input
            className="h-9"
            type="password"
            placeholder={backySettings?.hasApiKey ? "已配置（输入新值可覆盖）" : "输入 API Key"}
            value={backyKey}
            onChange={(e) => setBackyKey(e.target.value)}
          />
        </div>

        {/* Save error display */}
        {backySaveError && (
          <div className="flex items-start gap-2 rounded-widget border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{backySaveError}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackySave}
            disabled={backySaving || !backyUrl}
          >
            {backySaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackyTest}
            disabled={backyTesting || !backyConfigured}
          >
            {backyTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Plug className="mr-2 h-4 w-4" />
            测试连接
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackyPush}
            disabled={backyPushing || !backyConfigured}
          >
            {backyPushing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="mr-2 h-4 w-4" />
            推送备份
          </Button>
        </div>

        {/* Test result */}
        {backyTestResult && (
          <div className={`flex items-start gap-2 rounded-widget border p-3 ${
            backyTestResult.success
              ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
              : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
          }`}>
            {backyTestResult.success ? (
              <p className="text-sm text-green-700 dark:text-green-300">
                连接成功 (HTTP {backyTestResult.status})
              </p>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  连接失败{backyTestResult.status ? ` (HTTP ${backyTestResult.status})` : ""}{backyTestResult.error ? `: ${backyTestResult.error}` : ""}
                </p>
              </>
            )}
          </div>
        )}

        {/* Push result */}
        {backyPushResult && (
          <div className={`rounded-widget border p-3 ${
            backyPushResult.success
              ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
              : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
          }`}>
            {backyPushResult.success ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  推送成功 ({backyPushResult.durationMs}ms)
                </p>
                {backyPushResult.request && (
                  <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
                    <p>Tag: {backyPushResult.request.tag}</p>
                    <p>文件: {backyPushResult.request.fileName} ({formatFileSize(backyPushResult.request.fileSizeBytes)})</p>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-0.5">
                      {Object.entries(backyPushResult.request.backupStats).map(([key, count]) => (
                        <span key={key}>{TABLE_LABELS[key] || key}: {count}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="text-sm text-red-700 dark:text-red-300">
                  <p>推送失败: {backyPushResult.error}</p>
                  {backyPushResult.response && (
                    <p className="text-xs mt-1">HTTP {backyPushResult.response.status}: {JSON.stringify(backyPushResult.response.body)}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Remote history panel */}
      {backyConfigured && (
        <>
          <Separator className="my-4" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">远程备份记录</span>
                {backyHistory && (
                  <Badge variant="secondary">{backyHistory.total_backups} 份</Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadBackyHistory()}
                disabled={backyHistoryLoading}
              >
                <RefreshCw className={`h-4 w-4 ${backyHistoryLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {backyHistory && backyHistory.recent_backups.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {backyHistory.recent_backups.map((entry) => (
                  <div key={entry.id} className="rounded-widget border bg-muted/50 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant={entry.environment === "prod" ? "success" : "warning"}>
                        {entry.environment}
                      </Badge>
                      <span className="text-muted-foreground">{formatFileSize(entry.file_size)}</span>
                    </div>
                    <p className="text-muted-foreground truncate" title={entry.tag}>{entry.tag}</p>
                    <p className="text-muted-foreground">{formatTimeAgo(entry.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : backyHistory && backyHistory.recent_backups.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无备份记录</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

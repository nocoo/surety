"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Save, Database, Bell, Shield, Terminal, Download, Upload, AlertTriangle, Loader2, Cloud, RefreshCw, History, Plug, Send } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SettingsData {
  annualIncome: string;
  reminderDays: string;
  currency: string;
}

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

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({
    annualIncome: "600000",
    reminderDays: "30",
    currency: "CNY",
  });

  const [saved, setSaved] = useState(false);
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [mcpLoading, setMcpLoading] = useState(true);

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<{ name: string; data: Record<string, unknown[]> } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<Record<string, number> | null>(null);

  // Backy state
  const [backySettings, setBackySettings] = useState<BackySettings | null>(null);
  const [backyUrl, setBackyUrl] = useState("");
  const [backyKey, setBackyKey] = useState("");
  const [backySaving, setBackySaving] = useState(false);
  const [backyTesting, setBackyTesting] = useState(false);
  const [backyTestResult, setBackyTestResult] = useState<{ success: boolean; status: number; error?: string } | null>(null);
  const [backyPushing, setBackyPushing] = useState(false);
  const [backyPushResult, setBackyPushResult] = useState<BackyPushResponse | null>(null);
  const [backyHistory, setBackyHistory] = useState<BackyHistoryData | null>(null);
  const [backyHistoryLoading, setBackyHistoryLoading] = useState(false);

  // Load MCP setting from backend
  const loadMcpSetting = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/mcp.enabled");
      if (res.ok) {
        const data = await res.json();
        setMcpEnabled(data.value === "true");
      }
    } catch {
      // Setting doesn't exist yet, default to false
    } finally {
      setMcpLoading(false);
    }
  }, []);

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
    void loadMcpSetting();
    void loadBackySettings().then(() => {
      // Auto-load history after settings are loaded (if configured)
    });
  }, [loadMcpSetting, loadBackySettings]);

  // Auto-load history when backy settings are loaded and configured
  useEffect(() => {
    if (backySettings?.hasApiKey && backySettings.webhookUrl) {
      void loadBackyHistory();
    }
  }, [backySettings, loadBackyHistory]);

  // Toggle MCP setting via API
  const handleMcpToggle = async (enabled: boolean) => {
    setMcpEnabled(enabled);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "mcp.enabled", value: String(enabled) }),
      });
    } catch {
      // Revert on failure
      setMcpEnabled(!enabled);
    }
  };

  // Table display names for import preview
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

  // Handle file selection for import
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (json.version !== 1 || !json.data) {
          setImportError("无效的备份文件：缺少 version 或 data 字段");
          return;
        }
        setImportFile({ name: file.name, data: json.data });
        setImportDialogOpen(true);
      } catch {
        setImportError("无法解析 JSON 文件，请检查文件格式");
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  // Execute the actual import
  const handleImportConfirm = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 1, data: importFile.data }),
      });
      const body = await res.json();
      if (!res.ok) {
        setImportError(body.error || "导入失败");
      } else {
        setImportResult(body.restored);
      }
    } catch {
      setImportError("网络错误，请重试");
    } finally {
      setImporting(false);
      setImportDialogOpen(false);
      setImportFile(null);
    }
  };

  // Backy: save settings
  const handleBackySave = async () => {
    setBackySaving(true);
    setBackyTestResult(null);
    try {
      const res = await fetch("/api/settings/backy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: backyUrl, apiKey: backyKey }),
      });
      if (res.ok) {
        const data: BackySettings = await res.json();
        setBackySettings(data);
        setBackyKey(""); // Clear key input after save
      }
    } catch {
      // ignore
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

  const handleChange = (field: keyof SettingsData, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    console.log("Settings saved:", settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const backyConfigured = backySettings?.hasApiKey && backySettings.webhookUrl;

  return (
    <AppShell breadcrumbs={[{ label: "设置" }]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
          <p className="text-sm text-muted-foreground">
            管理应用偏好和家庭财务参数
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-card bg-secondary p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="font-semibold">家庭财务</h2>
                <p className="text-sm text-muted-foreground">用于计算保费占比等指标</p>
              </div>
            </div>
            <Separator className="mb-4" />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="annualIncome">家庭年收入 (元)</Label>
                <Input
                  id="annualIncome"
                  type="number"
                  placeholder="600000"
                  value={settings.annualIncome}
                  onChange={(e) => handleChange("annualIncome", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  建议保费支出控制在年收入的 10-15%
                </p>
              </div>

              <div className="space-y-2">
                <Label>货币单位</Label>
                <Select
                  value={settings.currency}
                  onValueChange={(value) => handleChange("currency", value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                    <SelectItem value="USD">美元 (USD)</SelectItem>
                    <SelectItem value="HKD">港币 (HKD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-card bg-secondary p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Bell className="h-5 w-5 text-orange-500" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="font-semibold">提醒设置</h2>
                <p className="text-sm text-muted-foreground">保单到期和缴费提醒</p>
              </div>
            </div>
            <Separator className="mb-4" />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reminderDays">提前提醒天数</Label>
                <Select
                  value={settings.reminderDays}
                  onValueChange={(value) => handleChange("reminderDays", value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 天</SelectItem>
                    <SelectItem value="14">14 天</SelectItem>
                    <SelectItem value="30">30 天</SelectItem>
                    <SelectItem value="60">60 天</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  在保单到期或缴费日前多少天开始提醒
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-card bg-secondary p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Database className="h-5 w-5 text-blue-500" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="font-semibold">数据管理</h2>
                <p className="text-sm text-muted-foreground">备份与恢复</p>
              </div>
            </div>
            <Separator className="mb-4" />
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  导出所有保单、成员、资产等数据为 JSON 文件，可用于备份或迁移。
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.location.href = "/api/backup";
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  导出 JSON 备份
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  从 JSON 备份文件恢复数据。此操作将覆盖当前所有数据。
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  导入 JSON 备份
                </Button>

                {importError && (
                  <div className="flex items-start gap-2 rounded-widget border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-300">{importError}</p>
                  </div>
                )}

                {importResult && (
                  <div className="rounded-widget border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                      导入成功
                    </p>
                    <div className="text-xs text-green-700 dark:text-green-300 grid grid-cols-3 gap-x-4 gap-y-1">
                      {Object.entries(importResult).map(([key, count]) => (
                        <span key={key}>
                          {TABLE_LABELS[key] || key}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <AlertDialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认导入数据？</AlertDialogTitle>
                  <AlertDialogDescription>
                    此操作将<span className="font-semibold text-foreground">覆盖当前所有数据</span>，不可撤销。
                    请确认已备份重要数据。
                  </AlertDialogDescription>
                </AlertDialogHeader>

                {importFile && (
                  <div className="rounded-widget border bg-muted/50 p-3 text-sm">
                    <p className="font-medium mb-2">文件: {importFile.name}</p>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-muted-foreground">
                      {Object.entries(importFile.data).map(([key, rows]) => (
                        <span key={key}>
                          {TABLE_LABELS[key] || key}: {Array.isArray(rows) ? rows.length : 0}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <AlertDialogFooter>
                  <AlertDialogCancel disabled={importing}>取消</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleImportConfirm}
                    disabled={importing}
                  >
                    {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    确认覆盖导入
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* MCP Access */}
          <div className="rounded-card bg-secondary p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Terminal className="h-5 w-5 text-emerald-500" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="font-semibold">MCP 访问</h2>
                  <p className="text-sm text-muted-foreground">
                    允许外部 AI 助手（Claude Code、Cursor 等）查询保单数据
                  </p>
                </div>
              </div>
              <Switch
                checked={mcpEnabled}
                onCheckedChange={handleMcpToggle}
                disabled={mcpLoading}
                aria-label="Toggle MCP access"
              />
            </div>
            {mcpEnabled && (
              <>
                <Separator className="my-4" />
                <div className="rounded-widget bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-2">配置方式</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    在 AI 助手的 MCP 配置中添加以下内容：
                  </p>
                  <pre className="text-xs bg-background rounded-widget p-3 overflow-x-auto">
{`{
  "mcpServers": {
    "surety": {
      "command": "bun",
      "args": ["run", "${typeof window !== "undefined" ? "" : ""}mcp/index.ts"]
    }
  }
}`}
                  </pre>
                  <p className="text-xs text-muted-foreground mt-2">
                    请将路径替换为实际的项目目录路径。
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Backy Remote Backup */}
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
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saved}>
            <Save className="mr-2 h-4 w-4" />
            {saved ? "已保存" : "保存设置"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

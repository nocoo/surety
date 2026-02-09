"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, Database, Bell, Shield, Info, Palette, Check, Terminal } from "lucide-react";
import { AppShell } from "@/components/layout";
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
import { useTheme, ThemeColor } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const themeColors: { value: ThemeColor; label: string; color: string }[] = [
  { value: "orange", label: "橙色", color: "bg-orange-500" },
  { value: "blue", label: "蓝色", color: "bg-blue-500" },
  { value: "green", label: "绿色", color: "bg-green-600" },
  { value: "purple", label: "紫色", color: "bg-purple-500" },
  { value: "rose", label: "玫红", color: "bg-rose-500" },
];

function ThemeColorPicker() {
  const { themeColor, setThemeColor } = useTheme();

  return (
    <div className="space-y-3">
      <Label>主题色</Label>
      <div className="flex gap-3">
        {themeColors.map((theme) => (
          <button
            key={theme.value}
            type="button"
            onClick={() => setThemeColor(theme.value)}
            className={cn(
              "relative h-10 w-10 rounded-full transition-all",
              theme.color,
              themeColor === theme.value
                ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                : "hover:scale-105"
            )}
            title={theme.label}
          >
            {themeColor === theme.value && (
              <Check className="absolute inset-0 m-auto h-5 w-5 text-white" />
            )}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        选择你喜欢的主题色，更改会立即生效
      </p>
    </div>
  );
}

interface SettingsData {
  annualIncome: string;
  reminderDays: string;
  currency: string;
  exportFormat: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({
    annualIncome: "600000",
    reminderDays: "30",
    currency: "CNY",
    exportFormat: "xlsx",
  });

  const [saved, setSaved] = useState(false);
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [mcpLoading, setMcpLoading] = useState(true);

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

  useEffect(() => {
    void loadMcpSetting();
  }, [loadMcpSetting]);

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

  const handleChange = (field: keyof SettingsData, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    console.log("Settings saved:", settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
          <div className="rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
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

          <div className="rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Bell className="h-5 w-5 text-orange-500" />
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

          <div className="rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <Palette className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h2 className="font-semibold">外观设置</h2>
                <p className="text-sm text-muted-foreground">自定义主题颜色</p>
              </div>
            </div>
            <Separator className="mb-4" />
            <ThemeColorPicker />
          </div>

          <div className="rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Database className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h2 className="font-semibold">数据管理</h2>
                <p className="text-sm text-muted-foreground">导出和备份</p>
              </div>
            </div>
            <Separator className="mb-4" />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>导出格式</Label>
                <Select
                  value={settings.exportFormat}
                  onValueChange={(value) => handleChange("exportFormat", value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                    <SelectItem value="csv">CSV (.csv)</SelectItem>
                    <SelectItem value="json">JSON (.json)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  导出全部数据
                </Button>
                <Button variant="outline" size="sm">
                  备份数据库
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Terminal className="h-5 w-5 text-emerald-500" />
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
                <div className="rounded-md bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-2">配置方式</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    在 AI 助手的 MCP 配置中添加以下内容：
                  </p>
                  <pre className="text-xs bg-background border rounded-md p-3 overflow-x-auto">
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
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">关于数据安全</p>
              <p className="text-blue-600 dark:text-blue-400">
                所有数据仅存储在本地 SQLite 数据库中，不会上传至任何服务器。
                建议定期备份数据库文件。
              </p>
            </div>
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

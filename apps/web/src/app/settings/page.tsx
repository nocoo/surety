
import { useState, useEffect, useCallback } from "react";
import { Save, Shield, Bell } from "lucide-react";
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

import {
  DatabaseSettings,
  BackySettings,
} from "./components";

interface SettingsData {
  annualIncome: string;
  reminderDays: string;
  currency: string;
}

const DEFAULT_SETTINGS: SettingsData = {
  annualIncome: "600000",
  reminderDays: "30",
  currency: "CNY",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({
    ...DEFAULT_SETTINGS,
  });

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const responses = await Promise.all([
        fetch("/api/settings/annualIncome"),
        fetch("/api/settings/reminderDays"),
        fetch("/api/settings/currency"),
      ]);

      if (responses.every((response) => response.ok)) {
        const settingsResponses = await Promise.all(
          responses.map(async (response) => response.json() as Promise<{ value: string | null }>)
        );
        const [annualIncomeSetting, reminderDaysSetting, currencySetting] = settingsResponses as [
          { value: string | null },
          { value: string | null },
          { value: string | null },
        ];

        setSettings({
          annualIncome: annualIncomeSetting.value ?? DEFAULT_SETTINGS.annualIncome,
          reminderDays: reminderDaysSetting.value ?? DEFAULT_SETTINGS.reminderDays,
          currency: currencySetting.value ?? DEFAULT_SETTINGS.currency,
        });
      }
    } catch {
      // ignore and keep defaults
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleChange = (field: keyof SettingsData, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const responses = await Promise.all([
        fetch("/api/settings/annualIncome", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: settings.annualIncome }),
        }),
        fetch("/api/settings/reminderDays", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: settings.reminderDays }),
        }),
        fetch("/api/settings/currency", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: settings.currency }),
        }),
      ]);

      if (!responses.every((response) => response.ok)) {
        throw new Error("SAVE_FAILED");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError("保存失败，请重试");
    } finally {
      setSaving(false);
    }
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
          {/* Family Finance Settings */}
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

          {/* Reminder Settings */}
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

          {/* Database Settings (backup/restore) */}
          <DatabaseSettings />

          {/* Backy Remote Backup */}
          <BackySettings />
        </div>

        <div className="flex flex-col items-end gap-2">
          {saveError && (
            <p className="text-sm text-destructive" role="alert">
              {saveError}
            </p>
          )}
          <Button onClick={() => void handleSave()} disabled={saving || saved}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "保存中..." : saved ? "已保存" : "保存设置"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

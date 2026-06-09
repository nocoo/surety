
import { useRef, useState } from "react";
import { Database, Download, Upload, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Separator } from "@/components/ui/separator";
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

export function DatabaseSettings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<{ name: string; data: Record<string, unknown[]> } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<Record<string, number> | null>(null);

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

  return (
    <div className="rounded-card bg-secondary p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
          <Database className="h-5 w-5 text-info" strokeWidth={1.5} />
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
            <Notice variant="destructive" className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{importError}</p>
            </Notice>
          )}

          {importResult && (
            <Notice variant="success">
              <p className="font-medium mb-1">导入成功</p>
              <div className="text-xs grid grid-cols-3 gap-x-4 gap-y-1">
                {Object.entries(importResult).map(([key, count]) => (
                  <span key={key}>
                    {TABLE_LABELS[key] || key}: {count}
                  </span>
                ))}
              </div>
            </Notice>
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
  );
}

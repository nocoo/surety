"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X, Save, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { CoverageItem } from "@/lib/types/policy";

interface CoverageSectionProps {
  policyId: number;
  items: CoverageItem[];
  onItemsChange: (items: CoverageItem[]) => void;
}

interface CoverageFormData {
  name: string;
  periodLimit: string;
  lifetimeLimit: string;
  deductible: string;
  coveragePercent: string;
  notes: string;
  isOptional: boolean;
}

const emptyForm: CoverageFormData = {
  name: "",
  periodLimit: "",
  lifetimeLimit: "",
  deductible: "",
  coveragePercent: "",
  notes: "",
  isOptional: false,
};

function itemToForm(item: CoverageItem): CoverageFormData {
  return {
    name: item.name,
    periodLimit: item.periodLimit != null ? String(item.periodLimit) : "",
    lifetimeLimit: item.lifetimeLimit != null ? String(item.lifetimeLimit) : "",
    deductible: item.deductible != null ? String(item.deductible) : "",
    coveragePercent:
      item.coveragePercent != null ? String(item.coveragePercent) : "",
    notes: item.notes ?? "",
    isOptional: item.isOptional === true || item.isOptional === 1,
  };
}

function formToPayload(form: CoverageFormData, sortOrder: number) {
  return {
    name: form.name.trim(),
    periodLimit: form.periodLimit ? Number(form.periodLimit) : null,
    lifetimeLimit: form.lifetimeLimit ? Number(form.lifetimeLimit) : null,
    deductible: form.deductible ? Number(form.deductible) : null,
    coveragePercent: form.coveragePercent
      ? Number(form.coveragePercent)
      : null,
    isOptional: form.isOptional,
    notes: form.notes || null,
    sortOrder,
  };
}

// ---------------------------------------------------------------------------
// Inline form (shared between add & edit)
// ---------------------------------------------------------------------------

function CoverageForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  saveLabel,
}: {
  form: CoverageFormData;
  onChange: (f: CoverageFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  saveLabel: string;
}) {
  const update = (
    field: keyof CoverageFormData,
    value: string | boolean,
  ) => onChange({ ...form, [field]: value });

  return (
    <div className="space-y-3 rounded-lg border bg-background p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">保障名称 *</Label>
        <Input
          placeholder="如：住院医疗"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">年度限额</Label>
          <Input
            type="number"
            placeholder="6000000"
            value={form.periodLimit}
            onChange={(e) => update("periodLimit", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">终身限额</Label>
          <Input
            type="number"
            placeholder="可选"
            value={form.lifetimeLimit}
            onChange={(e) => update("lifetimeLimit", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">免赔额</Label>
          <Input
            type="number"
            placeholder="10000"
            value={form.deductible}
            onChange={(e) => update("deductible", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">赔付比例 (%)</Label>
          <Input
            type="number"
            placeholder="100"
            value={form.coveragePercent}
            onChange={(e) => update("coveragePercent", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">备注</Label>
        <Input
          placeholder="如：含ICU"
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={form.isOptional}
            onCheckedChange={(v) => update("isOptional", v)}
          />
          <Label className="text-xs">可选保障</Label>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={saving}
          >
            <X className="mr-1 size-3.5" />
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={saving || !form.name.trim()}
          >
            <Save className="mr-1 size-3.5" />
            {saving ? "保存中..." : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export function CoverageSection({
  policyId,
  items,
  onItemsChange,
}: CoverageSectionProps) {
  const [addingForm, setAddingForm] = useState<CoverageFormData | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<CoverageFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  // --- mutual exclusion ---
  const startAdd = () => {
    setAddingForm({ ...emptyForm });
    setEditingId(null);
  };
  const startEdit = (item: CoverageItem) => {
    setEditingId(item.id);
    setEditingForm(itemToForm(item));
    setAddingForm(null);
  };

  // --- CRUD handlers ---
  const handleAdd = async () => {
    if (!addingForm || !addingForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/policies/${policyId}/coverage-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(addingForm, items.length)),
      });
      if (res.ok) {
        const created = (await res.json()) as CoverageItem;
        onItemsChange([...items, created]);
        setAddingForm(null);
      }
    } catch (e) {
      console.error("Failed to add coverage item:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (editingId === null || !editingForm.name.trim()) return;
    setSaving(true);
    try {
      const existing = items.find((i) => i.id === editingId);
      const res = await fetch(
        `/api/policies/${policyId}/coverage-items/${editingId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            formToPayload(editingForm, existing?.sortOrder ?? 0),
          ),
        },
      );
      if (res.ok) {
        const updated = (await res.json()) as CoverageItem;
        onItemsChange(items.map((i) => (i.id === editingId ? updated : i)));
        setEditingId(null);
      }
    } catch (e) {
      console.error("Failed to update coverage item:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId: number) => {
    try {
      const res = await fetch(
        `/api/policies/${policyId}/coverage-items/${itemId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        onItemsChange(items.filter((i) => i.id !== itemId));
      }
    } catch (e) {
      console.error("Failed to delete coverage item:", e);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          <Shield className="mr-1.5 inline size-4 align-text-bottom" />
          保障明细
          {items.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {items.length}
            </Badge>
          )}
        </h3>
        {!addingForm && editingId === null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={startAdd}
          >
            <Plus className="mr-1 size-3.5" />
            添加保障项目
          </Button>
        )}
      </div>

      {/* Item list */}
      {sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map((item) => (
            <div key={item.id}>
              {editingId === item.id ? (
                <CoverageForm
                  form={editingForm}
                  onChange={setEditingForm}
                  onSave={handleUpdate}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                  saveLabel="保存"
                />
              ) : (
                <div className="group rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {item.name}
                      {(item.isOptional === true ||
                        item.isOptional === 1) && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-xs"
                        >
                          可选
                        </Badge>
                      )}
                    </span>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => startEdit(item)}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(item.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {item.periodLimit !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          年度限额
                        </span>
                        <span>{formatCurrency(item.periodLimit)}</span>
                      </div>
                    )}
                    {item.lifetimeLimit !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          终身限额
                        </span>
                        <span>{formatCurrency(item.lifetimeLimit)}</span>
                      </div>
                    )}
                    {item.deductible !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          免赔额
                        </span>
                        <span>{formatCurrency(item.deductible)}</span>
                      </div>
                    )}
                    {item.coveragePercent !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          赔付比例
                        </span>
                        <span>{item.coveragePercent}%</span>
                      </div>
                    )}
                  </div>

                  {item.notes && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {sorted.length === 0 && !addingForm && (
        <div className="rounded-lg bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">暂无保障明细</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={startAdd}
          >
            <Plus className="mr-1 size-3.5" />
            添加保障项目
          </Button>
        </div>
      )}

      {/* Add form */}
      {addingForm && (
        <div className={cn(sorted.length > 0 && "mt-3")}>
          <CoverageForm
            form={addingForm}
            onChange={setAddingForm}
            onSave={handleAdd}
            onCancel={() => setAddingForm(null)}
            saving={saving}
            saveLabel="添加"
          />
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>删除保障项目</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除该保障项目吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTarget !== null) void handleDelete(deleteTarget);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

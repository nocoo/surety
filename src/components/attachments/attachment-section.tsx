"use client";

import { useState, useEffect, useCallback } from "react";
import { AttachmentDropZone } from "./attachment-drop-zone";
import { AttachmentList } from "./attachment-list";
import { AttachmentPreviewDialog } from "./attachment-preview-dialog";
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
import type { Attachment } from "@/db/schema";

interface AttachmentSectionProps {
  policyId: number;
}

export function AttachmentSection({ policyId }: AttachmentSectionProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/policies/${policyId}/attachments`);
      if (res.ok) {
        const data = (await res.json()) as Attachment[];
        setAttachments(data);
      }
    } catch {
      // Silently fail — user can retry by reloading
    } finally {
      setLoading(false);
    }
  }, [policyId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleUploadComplete = useCallback(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/policies/${policyId}/attachments/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg =
          (body as { error?: string } | null)?.error ??
          `删除失败 (${res.status})`;
        setDeleteError(msg);
        return;
      }
      setDeleteTarget(null);
      fetchAttachments();
    } catch {
      setDeleteError("网络错误，请重试");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">保单附件</h3>

      <AttachmentDropZone
        policyId={policyId}
        onUploadComplete={handleUploadComplete}
      />

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          加载中...
        </p>
      ) : (
        <AttachmentList
          attachments={attachments}
          policyId={policyId}
          onPreview={setPreviewAttachment}
          onDelete={setDeleteTarget}
        />
      )}

      <AttachmentPreviewDialog
        attachment={previewAttachment}
        policyId={policyId}
        open={!!previewAttachment}
        onOpenChange={(open) => {
          if (!open) setPreviewAttachment(null);
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除附件 &quot;{deleteTarget?.filename}&quot; 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive px-6">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "删除中..." : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

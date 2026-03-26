"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Attachment } from "@/db/schema";

interface AttachmentPreviewDialogProps {
  attachment: Attachment | null;
  policyId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttachmentPreviewDialog({
  attachment,
  policyId,
  open,
  onOpenChange,
}: AttachmentPreviewDialogProps) {
  if (!attachment) return null;

  const fileUrl = `/api/policies/${policyId}/attachments/${attachment.id}/file`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">{attachment.filename}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          <iframe
            src={fileUrl}
            className="w-full h-full rounded border"
            title={`Preview: ${attachment.filename}`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

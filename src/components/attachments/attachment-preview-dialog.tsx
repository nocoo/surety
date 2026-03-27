"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isImageContentType } from "@/lib/attachment-validation";
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
      <DialogContent className="max-w-[90vw] sm:max-w-[90vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">{attachment.filename}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {isImageContentType(attachment.contentType) ? (
            <div className="relative w-full h-full">
              <Image
                src={fileUrl}
                alt={attachment.filename}
                fill
                className="object-contain rounded"
                unoptimized
              />
            </div>
          ) : (
            <iframe
              src={fileUrl}
              className="w-full h-full rounded border"
              title={`Preview: ${attachment.filename}`}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { FileText, ImageIcon, Download, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, isImageContentType } from "@/lib/attachment-validation";
import type { Attachment } from "@surety/db/schema";

interface AttachmentListProps {
  attachments: Attachment[];
  policyId: number;
  onPreview: (attachment: Attachment) => void;
  onDelete: (attachment: Attachment) => void;
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function AttachmentIcon({ contentType }: { contentType: string }) {
  if (isImageContentType(contentType)) {
    return <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />;
  }
  return <FileText className="h-5 w-5 text-red-500 shrink-0" />;
}

export function AttachmentList({
  attachments,
  policyId,
  onPreview,
  onDelete,
}: AttachmentListProps) {
  if (attachments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        暂无附件
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/50">
      {attachments.map((attachment) => (
        <li key={attachment.id} className="flex items-center gap-3 py-3">
          <AttachmentIcon contentType={attachment.contentType} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {attachment.filename}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(attachment.size)} · {formatDate(attachment.createdAt)}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onPreview(attachment)}
              title="预览"
              className="h-8 w-8"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" asChild title="下载" className="h-8 w-8">
              <a
                href={`/api/policies/${policyId}/attachments/${attachment.id}/file?download=true`}
              >
                <Download className="h-4 w-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(attachment)}
              title="删除"
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

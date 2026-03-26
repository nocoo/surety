"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_FILE_SIZE } from "@/lib/attachment-validation";
import { uploadWithProgress } from "@/lib/upload-with-progress";

interface AttachmentDropZoneProps {
  policyId: number;
  onUploadComplete: () => void;
}

export function AttachmentDropZone({
  policyId,
  onUploadComplete,
}: AttachmentDropZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (file.type !== "application/pdf") {
        setError("仅支持 PDF 文件");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError("文件大小不能超过 50MB");
        return;
      }

      setUploading(true);
      setProgress(0);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const result = await uploadWithProgress(
          `/api/policies/${policyId}/attachments`,
          formData,
          setProgress,
        );

        if (!result.ok) {
          setError(result.error);
        } else {
          onUploadComplete();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "上传失败",
        );
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [policyId, onUploadComplete],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: uploading,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          uploading && "opacity-50 cursor-not-allowed",
        )}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">上传中...</p>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {isDragActive
                ? "松开鼠标上传 PDF"
                : "拖拽 PDF 到此处，或点击选择文件"}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              仅限 PDF 文件，最大 50MB
            </p>
          </>
        )}
      </div>
      {error && (
        <div className="mt-2 flex items-center gap-1 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

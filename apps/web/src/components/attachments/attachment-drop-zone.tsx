
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_FILE_SIZE, ALLOWED_CONTENT_TYPES } from "@surety/api/lib/attachment-validation";
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
  const [currentFile, setCurrentFile] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      // Validate all files upfront
      const allowedTypes: readonly string[] = ALLOWED_CONTENT_TYPES;
      for (const file of acceptedFiles) {
        if (!allowedTypes.includes(file.type)) {
          setError(`不支持的文件类型: ${file.name}。仅支持 PDF、JPG、PNG`);
          return;
        }
        if (file.size > MAX_FILE_SIZE) {
          setError(`文件过大: ${file.name}。最大 50MB`);
          return;
        }
      }

      setUploading(true);
      setProgress(0);
      setError(null);
      setTotalFiles(acceptedFiles.length);

      const errors: string[] = [];

      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        if (!file) continue;
        setCurrentFile(i + 1);
        setProgress(0);

        try {
          const formData = new FormData();
          formData.append("file", file);

          const result = await uploadWithProgress(
            `/api/policies/${policyId}/attachments`,
            formData,
            setProgress,
          );

          if (!result.ok) {
            errors.push(`${file.name}: ${result.error}`);
          }
        } catch (err) {
          errors.push(
            `${file.name}: ${err instanceof Error ? err.message : "上传失败"}`,
          );
        }
      }

      if (errors.length > 0) {
        setError(errors.join("\n"));
      }

      // Always refresh the list — some files may have succeeded
      onUploadComplete();

      setUploading(false);
      setProgress(0);
      setCurrentFile(0);
      setTotalFiles(0);
    },
    [policyId, onUploadComplete],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
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
            <p className="text-sm text-muted-foreground">
              上传中 ({currentFile}/{totalFiles})...
            </p>
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
                ? "松开鼠标上传文件"
                : "拖拽 PDF 或图片到此处，或点击选择文件"}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              支持 PDF、JPG、PNG，最大 50MB
            </p>
          </>
        )}
      </div>
      {error && (
        <div className="mt-2 flex items-start gap-1 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="whitespace-pre-line">{error}</span>
        </div>
      )}
    </div>
  );
}

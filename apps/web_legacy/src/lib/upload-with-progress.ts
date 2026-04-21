/**
 * Upload file with XMLHttpRequest for progress tracking.
 *
 * The Fetch API does not support upload progress events.
 * For files up to 50MB, showing real-time progress is essential UX.
 */

export function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true });
      } else {
        try {
          const body = JSON.parse(xhr.responseText) as { error?: string };
          resolve({
            ok: false,
            error: body.error || `Upload failed (${xhr.status})`,
          });
        } catch {
          resolve({ ok: false, error: `Upload failed (${xhr.status})` });
        }
      }
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Network error during upload")),
    );
    xhr.addEventListener("abort", () =>
      reject(new Error("Upload was cancelled")),
    );

    xhr.send(formData);
  });
}

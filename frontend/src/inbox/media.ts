export type MessageMediaInput = { publicId: string; version: number; signature: string };
export type UploadSignature = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  resourceType: string;
};

export function validateMessageImages(files: File[], existingCount: number): string | null {
  if (files.length + existingCount > 5) return "Mỗi tin nhắn chỉ được gửi tối đa 5 ảnh.";
  for (const file of files) {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))
      return "Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF.";
    if (file.size <= 0 || file.size > 10 * 1024 * 1024)
      return "Mỗi ảnh phải có dung lượng tối đa 10 MB và không được rỗng.";
  }
  return null;
}

export function uploadMessageImage(
  file: File,
  signed: UploadSignature,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
): Promise<MessageMediaInput> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Đã hủy tải ảnh", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => signal.removeEventListener("abort", abort);
    const fail = () => {
      cleanup();
      reject(new Error("Không tải được ảnh. Hãy thử lại."));
    };
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`,
    );
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = fail;
    xhr.ontimeout = fail;
    xhr.timeout = 120000;
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Đã hủy tải ảnh", "AbortError"));
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status < 200 || xhr.status >= 300) {
        fail();
        return;
      }
      try {
        const value = JSON.parse(xhr.responseText);
        if (
          typeof value.public_id !== "string" ||
          !Number.isInteger(value.version) ||
          typeof value.signature !== "string"
        )
          throw new Error();
        resolve({ publicId: value.public_id, version: value.version, signature: value.signature });
      } catch {
        fail();
      }
    };
    const body = new FormData();
    body.append("file", file);
    body.append("api_key", signed.apiKey);
    body.append("timestamp", String(signed.timestamp));
    body.append("signature", signed.signature);
    body.append("folder", signed.folder);
    signal.addEventListener("abort", abort, { once: true });
    xhr.send(body);
  });
}

import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { MessageMediaInput, UploadSignature } from "./media";
import { uploadMessageImage, validateMessageImages } from "./media";

type Attachment = {
  id: number;
  file: File;
  preview: string;
  progress: number;
  state: "queued" | "uploading" | "ready" | "error";
  uploaded?: MessageMediaInput;
};

export function useMessageMedia(conversationId: string) {
  const current = useRef<Attachment[]>([]);
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  const transfers = useRef(new Map<number, AbortController>());
  const serial = useRef(0);
  const mounted = useRef(true);
  const sync = () => {
    if (mounted.current) setItems([...current.current]);
  };
  useEffect(() => {
    mounted.current = true;
    const active = transfers.current;
    return () => {
      mounted.current = false;
      active.forEach((transfer) => {
        transfer.abort();
      });
      current.current.forEach((item) => {
        URL.revokeObjectURL(item.preview);
      });
    };
  }, []);

  async function upload(item: Attachment): Promise<MessageMediaInput> {
    if (item.uploaded) return item.uploaded;
    if (transfers.current.has(item.id)) throw new Error("Ảnh đang được tải lên.");
    const controller = new AbortController();
    transfers.current.set(item.id, controller);
    item.state = "uploading";
    item.progress = 0;
    sync();
    try {
      const signed = await api<UploadSignature>(
        `/conversations/${encodeURIComponent(conversationId)}/media/upload-signature`,
        { method: "POST", auth: true, signal: controller.signal },
      );
      controller.signal.throwIfAborted();
      const value = await uploadMessageImage(item.file, signed, controller.signal, (percent) => {
        item.progress = percent;
        sync();
      });
      item.uploaded = value;
      item.state = "ready";
      item.progress = 100;
      return value;
    } catch (failure) {
      item.state = "error";
      throw failure;
    } finally {
      transfers.current.delete(item.id);
      sync();
    }
  }

  return {
    items,
    error,
    busy: items.some((item) => item.state === "uploading"),
    add(files: File[]) {
      const failure = validateMessageImages(files, current.current.length);
      setError(failure ?? "");
      if (failure) return;
      current.current = [
        ...current.current,
        ...files.map((file) => ({
          id: serial.current++,
          file,
          preview: URL.createObjectURL(file),
          progress: 0,
          state: "queued" as const,
        })),
      ];
      sync();
    },
    remove(id: number) {
      transfers.current.get(id)?.abort();
      const item = current.current.find((entry) => entry.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      current.current = current.current.filter((entry) => entry.id !== id);
      setError("");
      sync();
    },
    async retry(id: number) {
      const item = current.current.find((entry) => entry.id === id);
      if (item) {
        try {
          await upload(item);
        } catch {
          /* Item state renders the retry action. */
        }
      }
    },
    async uploadAll() {
      const values: MessageMediaInput[] = [];
      for (const item of current.current) values.push(await upload(item));
      return values;
    },
    clear() {
      current.current.forEach((item) => {
        URL.revokeObjectURL(item.preview);
      });
      current.current = [];
      setError("");
      sync();
    },
  };
}

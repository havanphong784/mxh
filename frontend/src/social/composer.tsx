import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import type { User } from "../session";
import {
  MAX_CONTENT,
  MAX_MEDIA,
  classifyMedia,
  composePayload,
  createRequest,
  isActive,
  mediaPayload,
  postPath,
  signedUpload,
} from "./model";
import type {
  CreateRequest,
  MediaKind,
  MediaPayload,
  Placement,
  Post,
  UploadSignature,
  Visibility,
} from "./model";
import { errorLabel, useQuery } from "./requests";
import { Avatar, Icon, Loading, Message, VisibilityPicker } from "./ui";

type Attachment = { id: number; file: File; kind: MediaKind };

function AttachmentPreview({
  item,
  disabled,
  remove,
}: {
  item: Attachment;
  disabled: boolean;
  remove: () => void;
}) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (item.kind !== "image") return;
    const url = URL.createObjectURL(item.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [item]);
  return (
    <li>
      {preview ? <img src={preview} alt="" /> : <Icon name="clip" />}
      <span>{item.file.name}</span>
      <button
        className="social-icon-button"
        type="button"
        disabled={disabled}
        onClick={remove}
        aria-label={`Bỏ tệp ${item.file.name}`}
      >
        <Icon name="close" />
      </button>
    </li>
  );
}

export function Composer({
  user,
  placement = {},
  inline = false,
  onCreated,
}: {
  user: User;
  placement?: Placement;
  inline?: boolean;
  onCreated?: (post: Post) => void;
}) {
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState("");
  const [published, setPublished] = useState<Post>();
  const request = useRef<AbortController | null>(null);
  const uploads = useRef(new Map<number, MediaPayload>());
  const intent = useRef<CreateRequest | null>(null);
  const serial = useRef(0);
  const textArea = useRef<HTMLTextAreaElement>(null);
  const targetId = placement.parentId ?? placement.quotedPostId;
  const context = useQuery<Post>(
    !inline && targetId ? postPath(targetId) : undefined,
    true,
  );
  const contextBlocked =
    !inline &&
    Boolean(targetId) &&
    (!isActive(context.data) ||
      (Boolean(placement.quotedPostId) &&
        context.data.visibility !== "PUBLIC"));
  const title = placement.parentId
    ? "Đăng trả lời"
    : placement.quotedPostId
      ? "Đăng trích dẫn"
      : "Đăng bài";
  const placeholder = placement.parentId
    ? "Viết lời trả lời…"
    : placement.quotedPostId
      ? "Thêm lời bình của bạn…"
      : "Bạn đang nghĩ gì?";
  const length = Array.from(text).length;
  useEffect(() => () => request.current?.abort(), []);

  function pick(files: FileList | null) {
    if (!files || !files.length) return;
    const selected: Attachment[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      if (attachments.length + selected.length >= MAX_MEDIA) {
        errors.push(`Chỉ được đính kèm tối đa ${MAX_MEDIA} tệp.`);
        break;
      }
      try {
        selected.push({
          file,
          kind: classifyMedia(file),
          id: serial.current++,
        });
      } catch (error) {
        errors.push(errorLabel(error, "Không thể thêm tệp này."));
      }
    }
    setAttachments((current) => [...current, ...selected]);
    setNotice(errors.join(" "));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current || contextBlocked) return;
    const controller = new AbortController();
    const { signal } = controller;
    request.current = controller;
    setNotice("");
    setPublished(undefined);
    try {
      const staged: MediaPayload[] = [];
      for (const [order, item] of attachments.entries()) {
        let uploaded = uploads.current.get(item.id);
        if (!uploaded) {
          setProgress(`Đang tải tệp ${order + 1}/${attachments.length}…`);
          const signature = await api<UploadSignature>(
            `/media/upload-signature?folder=posts&mediaType=${item.kind}`,
            { auth: true, signal },
          );
          const transfer = signedUpload(item.file, signature);
          const response = await fetch(transfer.url, {
            method: "POST",
            body: transfer.body,
            signal,
          });
          if (!response.ok)
            throw new Error(
              `Không tải được “${item.file.name}”. Vui lòng thử lại.`,
            );
          uploaded = mediaPayload(await response.json(), item.kind, order);
          uploads.current.set(item.id, uploaded);
        }
        staged.push({ ...uploaded, order });
      }
      const body = composePayload(text, visibility, staged, placement);
      const current = createRequest(body, intent.current);
      intent.current = current;
      setProgress("Đang đăng…");
      const post = await api<Post>("/posts", {
        method: "POST",
        body,
        auth: true,
        signal,
        idempotencyKey: current.key,
      });
      if (signal.aborted) return;
      setPublished(post);
      setText("");
      setAttachments([]);
      setVisibility("PUBLIC");
      uploads.current.clear();
      intent.current = null;
      onCreated?.(post);
    } catch (error) {
      if (!signal.aborted)
        setNotice(
          errorLabel(
            error,
            "Không đăng được bài. Bản nháp vẫn được giữ, hãy thử lại.",
          ),
        );
    } finally {
      if (request.current === controller) request.current = null;
      if (!signal.aborted) setProgress("");
    }
  }

  if (published && !inline) {
    return (
      <Message
        title={placement.parentId ? "Đã đăng lời trả lời" : "Đã đăng bài"}
        action={
          <>
            <a className="button button-primary" href={postPath(published.id)}>
              Xem bài vừa đăng <Icon name="arrow" />
            </a>
            <button
              className="button"
              type="button"
              onClick={() => setPublished(undefined)}
            >
              Viết tiếp
            </button>
          </>
        }
      >
        Nội dung đã được lưu với chế độ hiển thị bạn chọn.
      </Message>
    );
  }
  return (
    <form
      className="social-composer"
      data-inline={inline}
      onSubmit={(event) => void submit(event)}
    >
      {!inline &&
        targetId &&
        (context.loading ? (
          <Loading label="Đang mở bài gốc…" />
        ) : context.error ? (
          <Message
            title="Không tải được bài gốc"
            error
            action={
              <button className="button" type="button" onClick={context.reload}>
                Thử lại
              </button>
            }
          >
            {context.error}
          </Message>
        ) : isActive(context.data) ? (
          <div className="social-reference">
            <a href={postPath(context.data.id)}>
              {placement.parentId ? "Trả lời" : "Trích dẫn"} @
              {context.data.author.username}
            </a>
            <p>{context.data.content || "Bài viết có tệp đính kèm"}</p>
            {contextBlocked && (
              <p role="alert">Chỉ có thể trích dẫn bài viết công khai.</p>
            )}
          </div>
        ) : (
          <Message title="Bài gốc không còn khả dụng" />
        ))}
      <div className="social-compose-text">
        <Avatar key={user.avatarUrl ?? user.id} user={user} />
        <textarea
          ref={textArea}
          aria-label={placeholder}
          placeholder={placeholder}
          value={text}
          rows={inline ? 2 : 6}
          onChange={(event) => setText(event.currentTarget.value)}
          disabled={Boolean(progress)}
        />
      </div>
      {attachments.length > 0 && (
        <ul className="social-attachments" aria-label="Tệp đính kèm">
          {attachments.map((item) => (
            <AttachmentPreview
              key={item.id}
              item={item}
              disabled={Boolean(progress)}
              remove={() => {
                uploads.current.delete(item.id);
                setAttachments((current) =>
                  current.filter(({ id }) => id !== item.id),
                );
                setNotice("");
              }}
            />
          ))}
        </ul>
      )}
      <footer className="social-compose-tools">
        <label
          className="social-file social-icon-button"
          title="Đính kèm ảnh, video hoặc âm thanh"
          aria-disabled={Boolean(progress) || attachments.length >= MAX_MEDIA}
        >
          <Icon name="clip" />
          <span className="social-sr">Đính kèm ảnh, video hoặc âm thanh</span>
          <input
            aria-label="Đính kèm ảnh, video hoặc âm thanh"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/*,.mov,.m4a"
            disabled={Boolean(progress) || attachments.length >= MAX_MEDIA}
            onChange={(event) => {
              pick(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <VisibilityPicker
          value={visibility}
          onChange={setVisibility}
          disabled={Boolean(progress)}
        />
        <span
          className="social-count"
          data-over={length > MAX_CONTENT}
          aria-label={`${length} trên ${MAX_CONTENT} ký tự`}
        >
          {length}/{MAX_CONTENT}
        </span>
        <button
          className="button button-primary"
          type="submit"
          disabled={
            Boolean(progress) ||
            contextBlocked ||
            length > MAX_CONTENT ||
            (!text.trim() && !attachments.length)
          }
        >
          {title}
        </button>
      </footer>
      {progress && <Loading label={progress} />}
      {notice && (
        <p className="social-error" role="alert">
          {notice}
        </p>
      )}
      {published && inline && (
        <p className="social-success" role="status">
          {placement.parentId ? "Đã gửi lời trả lời." : "Đã đăng bài."}{" "}
          <a href={postPath(published.id)}>Xem bài vừa đăng</a>
        </p>
      )}
    </form>
  );
}

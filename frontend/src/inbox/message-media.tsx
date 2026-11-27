import { useEffect, useRef, useState } from "react";
import type { MessageMedia as Media } from "./data";

export function MessageMedia({ items }: { items: Media[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (selected !== null && !dialog.current?.open) dialog.current?.showModal();
  }, [selected]);
  if (!items.length) return null;
  const close = () => {
    dialog.current?.close();
    setSelected(null);
    opener.current?.focus();
  };
  const move = (direction: number) =>
    setSelected((value) => ((value ?? 0) + direction + items.length) % items.length);
  return (
    <>
      <div className="mx-message-images">
        {items.map((item, index) => (
          <button
            type="button"
            key={item.id}
            aria-label={`Xem ảnh ${index + 1}`}
            onClick={(event) => {
              opener.current = event.currentTarget;
              setSelected(index);
            }}
          >
            <img
              src={item.url}
              width={item.width}
              height={item.height}
              alt={`Ảnh ${index + 1}`}
              loading="lazy"
              onError={(event) => {
                event.currentTarget.alt = "Không tải được ảnh";
              }}
            />
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="mx-image-viewer"
        aria-label="Xem ảnh"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            move(1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            move(-1);
          }
        }}
      >
        {selected !== null && (
          <div className="mx-image-viewer-content">
            {/* biome-ignore lint/a11y/noAutofocus: Opening the modal moves focus to its close action; closing restores the image button. */}
            <button type="button" className="button" onClick={close} autoFocus>
              Đóng ảnh
            </button>
            <img src={items[selected].url} alt={`Ảnh ${selected + 1}`} />
            <div className="mx-image-controls">
              <button
                className="button"
                type="button"
                disabled={items.length < 2}
                onClick={() => move(-1)}
              >
                Ảnh trước
              </button>
              <span>
                {selected + 1} / {items.length}
              </span>
              <button
                className="button"
                type="button"
                disabled={items.length < 2}
                onClick={() => move(1)}
              >
                Ảnh sau
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

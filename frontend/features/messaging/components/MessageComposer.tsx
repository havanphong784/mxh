"use client";

import { FormEvent, useState } from "react";

export function MessageComposer({
  onSend,
  disabled = false,
}: {
  onSend: (body: string) => void;
  disabled?: boolean;
}) {
  const [body, setBody] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = body.trim();
    if (!value || disabled) return;
    onSend(value);
    setBody("");
  }

  return (
    <form
      onSubmit={submit}
      className="border-t border-[#f0eef8] bg-white p-3 sm:p-4"
    >
      <div className="flex items-end gap-2 rounded-[20px] bg-[#f8f7fc] p-2 pl-4 focus-within:ring-2 focus-within:ring-[#dcd9ff]">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, 2000))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          placeholder="Viết tin nhắn…"
          aria-label="Nội dung tin nhắn"
          disabled={disabled}
          className="max-h-28 min-h-10 flex-1 resize-none bg-transparent py-2 text-[13px] leading-5 text-[#1c1b29] outline-none placeholder:text-[#aaa7bb]"
        />
        <button
          type="submit"
          disabled={disabled || !body.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[15px] bg-[#7b78ff] text-[17px] text-white transition hover:bg-[#6763eb] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Gửi tin nhắn"
        >
          ↑
        </button>
      </div>
      <p className="mt-2 px-2 text-[10px] text-[#aaa7bb]">
        Enter để gửi · Shift + Enter để xuống dòng
      </p>
    </form>
  );
}

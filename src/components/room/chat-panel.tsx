"use client";

import { useChat } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";

const MAX_MESSAGE = 300;

export function ChatPanel({
  open,
  onClose,
  onUnread,
}: {
  open: boolean;
  onClose: () => void;
  onUnread: () => void;
}) {
  const { chatMessages, send, isSending } = useChat();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const seen = useRef(0);

  // Count messages that arrive from others while the panel is closed.
  useEffect(() => {
    const fresh = chatMessages.slice(seen.current);
    seen.current = chatMessages.length;
    if (!open) fresh.filter((m) => !m.from?.isLocal).forEach(onUnread);
  }, [chatMessages, open, onUnread]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chatMessages, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await send(text.slice(0, MAX_MESSAGE)).catch(() => setDraft(text));
  }

  return (
    <div
      className={`fixed inset-0 z-20 flex items-end justify-center bg-black/50 transition sm:items-center ${
        open ? "" : "pointer-events-none opacity-0"
      }`}
      onClick={onClose}
      inert={!open}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[70dvh] w-full max-w-md flex-col rounded-t-3xl bg-night-2 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="font-semibold">แชทในห้อง</h2>
          <button onClick={onClose} aria-label="ปิดแชท" className="rounded-full px-3 py-1 text-muted hover:bg-night-3">
            ✕
          </button>
        </div>

        <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-2">
          {chatMessages.length === 0 && (
            <p className="m-auto text-sm text-muted">ยังไม่มีข้อความ พิมพ์ทักทายกันหน่อย</p>
          )}
          {chatMessages.map((m) => {
            const mine = m.from?.isLocal;
            return (
              <div key={m.id} className={`flex max-w-[85%] flex-col ${mine ? "self-end items-end" : "items-start"}`}>
                {!mine && (
                  <span className="mb-0.5 text-xs text-muted">
                    {m.from?.attributes.avatar} {m.from?.name}
                  </span>
                )}
                <span
                  className={`rounded-2xl px-3 py-2 break-words whitespace-pre-wrap ${
                    mine ? "bg-lilac text-night" : "bg-night-3"
                  }`}
                >
                  {m.message}
                </span>
              </div>
            );
          })}
        </div>

        <form onSubmit={submit} className="flex gap-2 p-4">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_MESSAGE}
            placeholder="พิมพ์ข้อความ…"
            className="min-w-0 flex-1 rounded-full bg-night-3 px-4 py-3 outline-none focus:ring-2 focus:ring-lilac"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="rounded-full bg-sun px-5 font-semibold text-night disabled:opacity-40"
          >
            ส่ง
          </button>
        </form>
      </div>
    </div>
  );
}

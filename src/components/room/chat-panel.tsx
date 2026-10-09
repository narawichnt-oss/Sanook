"use client";

import type { ReceivedChatMessage } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";
import { useSwipe } from "@/lib/use-swipe";
import { Avatar } from "../avatar";

export const MAX_MESSAGE = 300;

/** Slides in from the right; swipe right (or tap outside) to get back to the stage. */
export function ChatPanel({
  open,
  onClose,
  messages,
  send,
  isSending,
}: {
  open: boolean;
  onClose: () => void;
  messages: ReceivedChatMessage[];
  send: (text: string) => Promise<unknown>;
  isSending: boolean;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const swipe = useSwipe({ onRight: onClose });

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await send(text.slice(0, MAX_MESSAGE)).catch(() => setDraft(text));
  }

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-20 bg-black/40 transition-opacity ${open ? "" : "pointer-events-none opacity-0"}`}
      />
      <aside
        {...swipe}
        inert={!open}
        aria-label="แชทในห้อง"
        className={`glass-solid fixed inset-y-0 right-0 z-30 flex w-full flex-col transition-transform duration-300 ease-out sm:w-96 sm:rounded-l-[2rem] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-4 pt-5 pb-3">
          <button
            onClick={onClose}
            aria-label="กลับไปที่ห้อง"
            className="glass grid size-10 place-items-center rounded-full text-lg"
          >
            ←
          </button>
          <div>
            <h2 className="font-bold">แชทในห้อง</h2>
            <p className="text-xs text-muted">พิมพ์ &quot;555&quot; หรือ &quot;โกรธ&quot; แล้วดูตัวเองบนเวที</p>
          </div>
        </div>

        <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-2">
          {messages.length === 0 && <p className="m-auto text-sm text-muted">ยังไม่มีข้อความ พิมพ์ทักทายกันหน่อย</p>}
          {messages.map((m) => {
            const mine = m.from?.isLocal;
            return (
              <div key={m.id} className={`flex max-w-[85%] flex-col ${mine ? "items-end self-end" : "items-start"}`}>
                {!mine && (
                  <span className="mb-0.5 flex items-center gap-1.5 text-xs text-muted">
                    <span className="grid size-5 place-items-center overflow-hidden rounded-full bg-night-3 text-[13px]">
                      <Avatar emoji={m.from?.attributes.avatar} photo={m.from?.attributes.photo} />
                    </span>
                    {m.from?.name}
                  </span>
                )}
                <span
                  className={`rounded-2xl px-3 py-2 break-words whitespace-pre-wrap ${
                    mine ? "rounded-br-md bg-lilac text-night" : "glass rounded-bl-md"
                  }`}
                >
                  {m.message}
                </span>
              </div>
            );
          })}
        </div>

        <form onSubmit={submit} className="flex gap-2 p-4 pb-6">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_MESSAGE}
            placeholder="พิมพ์ข้อความ…"
            className="glass min-w-0 flex-1 rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-lilac"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="rounded-full bg-sun px-5 font-bold text-night transition active:scale-95 disabled:opacity-40"
          >
            ส่ง
          </button>
        </form>
      </aside>
    </>
  );
}

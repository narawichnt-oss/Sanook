"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_TITLE, MAX_TOPIC, ROOM_COLORS, ROOM_EMOJIS, type RoomColor } from "@/lib/room-meta";
import { ROOM_BG } from "./colors";

export function CreateRoom({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [emoji, setEmoji] = useState<string>(ROOM_EMOJIS[0]);
  const [color, setColor] = useState<RoomColor>(ROOM_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, topic, emoji, color }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "เปิดห้องไม่สำเร็จ ลองใหม่อีกครั้ง");
      router.push(`/room/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong flex w-full max-w-md flex-col gap-4 rounded-t-[2rem] p-5 pb-8 sm:rounded-[2rem] sm:pb-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">เปิดห้องใหม่</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="rounded-full px-3 py-1 text-muted hover:bg-night-3">
            ✕
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {ROOM_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={e === emoji}
              onClick={() => setEmoji(e)}
              className={`grid size-11 shrink-0 place-items-center rounded-xl text-xl ${
                e === emoji ? "bg-night-3 ring-2 ring-sun" : "glass"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TITLE}
          autoFocus
          placeholder="ชื่อห้อง เช่น นั่งเล่นหลังเลิกงาน"
          className="glass rounded-2xl px-4 py-3 outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-lilac"
        />
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={MAX_TOPIC}
          placeholder="คุยเรื่องอะไรกันดี (ไม่ใส่ก็ได้)"
          className="glass rounded-2xl px-4 py-3 outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-lilac"
        />

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">สีห้อง</span>
          {ROOM_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={c === color}
              onClick={() => setColor(c)}
              className={`size-8 rounded-full ${ROOM_BG[c]} ${c === color ? "ring-2 ring-ink ring-offset-2 ring-offset-night-2" : ""}`}
            />
          ))}
        </div>

        {error && <p className="text-sm text-coral">{error}</p>}

        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="neon rounded-full bg-sun px-4 py-4 text-lg font-extrabold text-night transition active:scale-95 disabled:opacity-40 disabled:shadow-none"
        >
          {busy ? "กำลังเปิดห้อง…" : "เปิดห้องแล้วเข้าเลย"}
        </button>
      </form>
    </div>
  );
}

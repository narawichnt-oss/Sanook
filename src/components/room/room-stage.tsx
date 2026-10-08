"use client";

import {
  useConnectionState,
  useDataChannel,
  useParticipants,
  useRoomContext,
  useStartAudio,
  useTrackToggle,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { useCallback, useEffect, useState } from "react";
import type { RoomMeta } from "@/lib/room-meta";
import { ROOM_TINT, ROOM_VAR } from "../colors";
import { ChatPanel } from "./chat-panel";
import { Seat, type FloatingReaction } from "./seat";

const REACTIONS = ["👏", "😂", "❤️", "🔥", "😮", "🙏"];
const REACTION_TOPIC = "reaction";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function RoomStage({ roomId, meta }: { roomId: string; meta: RoomMeta }) {
  const room = useRoomContext();
  const state = useConnectionState();
  const participants = useParticipants();
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [toast, setToast] = useState("");

  const mic = useTrackToggle({
    source: Track.Source.Microphone,
    onDeviceError: () => setToast("เปิดไมค์ไม่ได้ — กดอนุญาตให้เว็บนี้ใช้ไมค์ในเบราว์เซอร์ก่อนนะ"),
  });

  // Some browsers only let audio play after a tap.
  const { mergedProps: startAudioProps, canPlayAudio } = useStartAudio({ room, props: {} });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showReaction = useCallback((identity: string, emoji: string) => {
    const id = Math.random().toString(36).slice(2);
    setReactions((list) => [...list, { id, identity, emoji }]);
    setTimeout(() => setReactions((list) => list.filter((r) => r.id !== id)), 1900);
  }, []);

  const onReaction = useCallback(
    (msg: { payload: Uint8Array; from?: { identity: string } }) => {
      const emoji = decoder.decode(msg.payload);
      if (msg.from && REACTIONS.includes(emoji)) showReaction(msg.from.identity, emoji);
    },
    [showReaction],
  );
  const { send } = useDataChannel(REACTION_TOPIC, onReaction);

  function react(emoji: string) {
    setPickerOpen(false);
    // Our own messages don't echo back, so show it locally too.
    showReaction(room.localParticipant.identity, emoji);
    send(encoder.encode(emoji), { reliable: true, topic: REACTION_TOPIC }).catch(() => {});
  }

  async function share() {
    const url = `${location.origin}/room/${roomId}`;
    try {
      if (navigator.share) await navigator.share({ title: meta.title, text: "มาคุยกันในห้องนี้", url });
      else {
        await navigator.clipboard.writeText(url);
        setToast("คัดลอกลิงก์ห้องแล้ว ส่งให้เพื่อนได้เลย");
      }
    } catch {
      // user cancelled the share sheet
    }
  }

  return (
    <div
      className={`relative mx-auto flex min-h-dvh max-w-2xl flex-col bg-gradient-to-b ${ROOM_TINT[meta.color]} to-night to-40%`}
      style={{ "--ring": ROOM_VAR[meta.color] } as React.CSSProperties}
    >
      <header className="flex items-start gap-3 px-4 pt-5 pb-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-night/40 text-2xl">{meta.emoji}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{meta.title}</h1>
          <p className="truncate text-sm text-muted">
            {state === ConnectionState.Connected
              ? meta.topic || `${participants.length} คนในห้อง`
              : state === ConnectionState.Reconnecting
                ? "สัญญาณหลุด กำลังต่อใหม่…"
                : "กำลังเชื่อมต่อ…"}
          </p>
        </div>
        <button onClick={share} className="shrink-0 rounded-full bg-night/40 px-4 py-2 text-sm hover:bg-night/60">
          ชวนเพื่อน
        </button>
      </header>

      <section className="grid flex-1 grid-cols-3 content-start gap-x-2 gap-y-6 px-4 pt-6 sm:grid-cols-4">
        {participants.map((p) => (
          <Seat
            key={p.identity}
            participant={p}
            reactions={reactions.filter((r) => r.identity === p.identity)}
          />
        ))}
      </section>

      {!canPlayAudio && (
        <button
          {...startAudioProps}
          style={undefined}
          className="mx-4 mb-3 rounded-2xl bg-sky px-4 py-3 font-semibold text-night"
        >
          🔈 แตะเพื่อเปิดเสียงในห้อง
        </button>
      )}

      {toast && (
        <div role="status" className="mx-4 mb-3 rounded-2xl bg-night-3 px-4 py-3 text-sm">
          {toast}
        </div>
      )}

      {pickerOpen && (
        <div className="mx-4 mb-3 flex justify-around rounded-2xl bg-night-2 p-2">
          {REACTIONS.map((e) => (
            <button key={e} onClick={() => react(e)} className="rounded-xl p-2 text-3xl hover:bg-night-3">
              {e}
            </button>
          ))}
        </div>
      )}

      <nav className="sticky bottom-0 flex items-center gap-2 bg-night/90 px-4 pt-3 pb-6 backdrop-blur">
        <button
          onClick={() => room.disconnect()}
          className="h-12 rounded-full bg-night-3 px-4 text-sm font-medium whitespace-nowrap hover:bg-coral hover:text-night"
        >
          ออก
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setPickerOpen((v) => !v)}
          aria-label="ส่งอีโมจิ"
          aria-expanded={pickerOpen}
          className="grid size-12 place-items-center rounded-full bg-night-3 text-xl"
        >
          😊
        </button>
        <button
          onClick={() => {
            setChatOpen(true);
            setUnread(0);
          }}
          aria-label="แชท"
          className="relative grid size-12 place-items-center rounded-full bg-night-3 text-xl"
        >
          💬
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-coral px-1 text-xs font-semibold text-night">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
        <button
          onClick={() => mic.toggle()}
          disabled={mic.pending || state !== ConnectionState.Connected}
          aria-pressed={mic.enabled}
          className={`flex h-12 items-center gap-1.5 rounded-full px-4 font-semibold whitespace-nowrap transition disabled:opacity-50 ${
            mic.enabled ? "bg-mint text-night" : "bg-night-3"
          }`}
        >
          {mic.enabled ? "🎙️ กำลังพูด" : "🔇 เปิดไมค์"}
        </button>
      </nav>

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onUnread={() => setUnread((n) => n + 1)}
      />
    </div>
  );
}

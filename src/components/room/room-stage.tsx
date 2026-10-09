"use client";

import {
  useChat,
  useConnectionState,
  useDataChannel,
  useParticipants,
  useRoomContext,
  useStartAudio,
  useTrackToggle,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { MOODS, detectMood } from "@/lib/mood";
import type { Profile } from "@/lib/profile";
import type { RoomMeta } from "@/lib/room-meta";
import { useSwipe } from "@/lib/use-swipe";
import { ROOM_TINT, ROOM_VAR } from "../colors";
import { EventLayer } from "../hub/event-layer";
import { HubBar } from "../hub/hub-bar";
import { Meditation } from "../hub/meditation";
import { useHub } from "../hub/use-hub";
import { ChatPanel } from "./chat-panel";
import { Seat, type FloatingReaction, type SeatMood } from "./seat";

const REACTIONS = ["👏", "😂", "❤️", "🔥", "😮", "🙏"];
const REACTION_TOPIC = "reaction";
const MOOD_MS = 2400;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function RoomStage({
  roomId,
  meta,
  token,
  profile,
}: {
  roomId: string;
  meta: RoomMeta;
  token: string;
  profile: Profile;
}) {
  const photo = profile.photo;
  const room = useRoomContext();
  const state = useConnectionState();
  const participants = useParticipants();
  // Chat lives here, not in the panel: LiveKit allows one chat listener per room,
  // and the stage needs every message for unread counts and avatar moods.
  const { chatMessages, send: sendChat, isSending } = useChat();
  const [chatOpen, setChatOpen] = useState(false);
  // How many of other people's messages had arrived when the chat was last open.
  const [readUpTo, setReadUpTo] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [moods, setMoods] = useState<Record<string, SeatMood>>({});
  const [toast, setToast] = useState("");
  const seen = useRef(0);
  const photoSent = useRef(false);
  const [meditating, setMeditating] = useState(false);
  const hub = useHub({ token, profile, active: state === ConnectionState.Connected });

  const mic = useTrackToggle({
    source: Track.Source.Microphone,
    onDeviceError: () => setToast("เปิดไมค์ไม่ได้ — กดอนุญาตให้เว็บนี้ใช้ไมค์ในเบราว์เซอร์ก่อนนะ"),
  });

  // Put our photo on our seat once we're in. The server sets it (clients can't
  // edit their own attributes); it can lag the join by a moment, so retry.
  useEffect(() => {
    if (state !== ConnectionState.Connected || !photo || photoSent.current) return;
    photoSent.current = true;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const push = () =>
      fetch("/api/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ photo }),
      })
        .then((res) => {
          if (!res.ok) throw new Error();
        })
        .catch(() => {
          if (++tries < 4) timer = setTimeout(push, 1500);
          else setToast("ใส่รูปโปรไฟล์ในห้องไม่สำเร็จ เพื่อน ๆ จะเห็นตัวการ์ตูนแทน");
        });
    push();
    return () => clearTimeout(timer);
  }, [state, photo, token]);

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

  const fromOthers = chatMessages.filter((m) => !m.from?.isLocal).length;
  const unread = chatOpen ? 0 : Math.max(0, fromOthers - readUpTo);

  /** The sender's avatar acts out what they typed, then settles down. */
  const actOut = useCallback(
    (identity: string, text: string, key: string) => {
      const mood = detectMood(text);
      if (!mood) return;
      setMoods((all) => ({ ...all, [identity]: { mood, key } }));
      showReaction(identity, MOODS[mood]);
      setTimeout(
        () =>
          setMoods((all) => {
            if (all[identity]?.key !== key) return all;
            const next = { ...all };
            delete next[identity];
            return next;
          }),
        MOOD_MS,
      );
    },
    [showReaction],
  );

  // Chat messages arrive from LiveKit; handle each new one exactly once.
  useEffect(() => {
    const fresh = chatMessages.slice(seen.current);
    seen.current = chatMessages.length;
    for (const m of fresh) {
      if (!m.from?.isLocal) haptic("tap");
      else hub.noteChat();
      if (m.from) actOut(m.from.identity, m.message, m.id);
    }
  }, [chatMessages, actOut]); // eslint-disable-line react-hooks/exhaustive-deps -- hub.noteChat only flips a ref

  const onReaction = useCallback(
    (msg: { payload: Uint8Array; from?: { identity: string } }) => {
      const emoji = decoder.decode(msg.payload);
      if (msg.from && REACTIONS.includes(emoji)) showReaction(msg.from.identity, emoji);
    },
    [showReaction],
  );
  const { send } = useDataChannel(REACTION_TOPIC, onReaction);

  function react(emoji: string) {
    haptic("tick");
    setPickerOpen(false);
    // Our own messages don't echo back, so show it locally too.
    showReaction(room.localParticipant.identity, emoji);
    send(encoder.encode(emoji), { reliable: true, topic: REACTION_TOPIC }).catch(() => {});
  }

  function openChat() {
    haptic("tick");
    setPickerOpen(false);
    setChatOpen(true);
    setReadUpTo(fromOthers);
  }

  function closeChat() {
    setChatOpen(false);
    setReadUpTo(fromOthers);
  }

  const swipe = useSwipe({ onLeft: openChat });

  async function share() {
    const url = `${location.origin}/room/${roomId}`;
    try {
      if (navigator.share) await navigator.share({ title: meta.title, text: "มาคุยกันในห้องนี้ที่ สนุก", url });
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
      {...swipe}
      className={`relative mx-auto flex min-h-dvh max-w-2xl flex-col bg-gradient-to-b ${ROOM_TINT[meta.color]} to-transparent to-50%`}
      style={{ "--ring": ROOM_VAR[meta.color], "--glow": ROOM_VAR[meta.color] } as React.CSSProperties}
    >
      <header className="glass m-3 flex items-center gap-3 rounded-3xl p-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-night/40 text-2xl">{meta.emoji}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{meta.title}</h1>
          <p className="truncate text-sm text-muted">
            {state === ConnectionState.Connected
              ? `${participants.length} คน${meta.topic ? ` · ${meta.topic}` : ""}`
              : state === ConnectionState.Reconnecting
                ? "สัญญาณหลุด กำลังต่อใหม่…"
                : "กำลังเชื่อมต่อ…"}
          </p>
        </div>
        <button onClick={share} className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-bold text-night active:scale-95">
          ชวนเพื่อน
        </button>
      </header>

      <HubBar view={hub.view} gains={hub.gains} error={hub.error} onMeditate={() => setMeditating(true)} />

      <section className="grid flex-1 grid-cols-3 content-start gap-x-1 gap-y-4 px-2 pt-6 sm:grid-cols-4">
        {participants.map((p) => (
          <Seat
            key={p.identity}
            participant={p}
            mood={moods[p.identity]}
            reactions={reactions.filter((r) => r.identity === p.identity)}
          />
        ))}
      </section>

      <p className="pb-2 text-center text-xs text-muted/70 sm:hidden">← ปัดซ้ายเพื่อเปิดแชท</p>

      <div className="sticky bottom-0 flex flex-col gap-2 px-3 pb-5">
        {!canPlayAudio && (
          <button {...startAudioProps} style={undefined} className="rounded-2xl bg-sky px-4 py-3 font-bold text-night">
            🔈 แตะเพื่อเปิดเสียงในห้อง
          </button>
        )}

        {toast && (
          <div role="status" className="glass-strong rounded-2xl px-4 py-3 text-sm">
            {toast}
          </div>
        )}

        {pickerOpen && (
          <div className="glass-strong flex justify-around rounded-full p-1.5">
            {REACTIONS.map((e) => (
              <button key={e} onClick={() => react(e)} className="rounded-full p-2 text-3xl transition active:scale-125">
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Mic sits dead centre, under the thumb. */}
        <nav className="glass-strong grid grid-cols-[1fr_auto_1fr] items-center rounded-full p-2">
          <button
            onClick={() => room.disconnect()}
            className="h-12 justify-self-start rounded-full px-4 text-sm font-bold text-muted transition hover:bg-coral hover:text-night"
          >
            ออก
          </button>
          <button
            onClick={() => {
              haptic("tap");
              mic.toggle();
            }}
            disabled={mic.pending || state !== ConnectionState.Connected}
            aria-pressed={mic.enabled}
            aria-label={mic.enabled ? "ปิดไมค์" : "เปิดไมค์"}
            className={`grid size-16 place-items-center rounded-full text-2xl transition active:scale-90 disabled:opacity-50 ${
              mic.enabled ? "neon bg-mint text-night [--glow:var(--color-mint)]" : "bg-night-3"
            }`}
          >
            {mic.enabled ? "🎙️" : "🔇"}
          </button>
          <div className="flex justify-end gap-1">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              aria-label="ส่งอีโมจิ"
              aria-expanded={pickerOpen}
              className="grid size-12 place-items-center rounded-full text-xl transition active:scale-90"
            >
              😊
            </button>
            <button
              onClick={openChat}
              aria-label="แชท"
              className="relative grid size-12 place-items-center rounded-full text-xl transition active:scale-90"
            >
              💬
              {unread > 0 && (
                <span className="absolute top-0 right-0 grid min-w-5 place-items-center rounded-full bg-pink px-1 text-xs font-bold text-night">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          </div>
        </nav>
      </div>

      {meditating && <Meditation view={hub.view} avatar={profile.avatar} photo={photo} onExit={() => setMeditating(false)} />}
      <EventLayer event={hub.event} serverNow={hub.serverNow} onChest={hub.tapChest} onSpirit={hub.tapSpirit} />

      <ChatPanel
        open={chatOpen}
        onClose={closeChat}
        messages={chatMessages}
        send={sendChat}
        isSending={isSending}
      />
    </div>
  );
}

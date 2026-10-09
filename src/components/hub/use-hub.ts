"use client";

import { useDataChannel } from "@livekit/components-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { guildApi, useGuildMe } from "@/lib/guild/client";
import type { EventView, HubMessage, HubView } from "@/lib/hub/service";
import type { LevelInfo } from "@/lib/hub/rules";
import { IDLE_AFTER_MS } from "@/lib/hub/rules";
import type { Profile } from "@/lib/profile";

const TOPIC = "hub";
const BEAT_MS = 60_000;
const SPIRIT_FLUSH_MS = 350;
const decoder = new TextDecoder();

export type Gain = { id: number; amount: number; label: string };
export type LiveEvent = EventView & { result?: "won" | "lost" | "claimed"; paid?: number };

type TapResponse = { accepted: number; event: EventView; paid: number; exp: number; level: LevelInfo };

/**
 * Runs the hub for one room session: heartbeats, live events and taps. The
 * server decides every number; this only reports and displays.
 */
export function useHub({ token, profile, active }: { token: string; profile: Profile; active: boolean }) {
  const { me } = useGuildMe(profile);
  const [view, setView] = useState<HubView | null>(null);
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [gains, setGains] = useState<Gain[]>([]);
  const [error, setError] = useState("");
  const offset = useRef(0); // server clock − local clock
  const lastInput = useRef(0);
  const chatted = useRef(false);
  const pendingTaps = useRef(0);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showGain = useCallback((amount: number, label: string) => {
    if (amount <= 0) return;
    const id = Date.now() + Math.random();
    setGains((list) => [...list.slice(-3), { id, amount, label }]);
    setTimeout(() => setGains((list) => list.filter((g) => g.id !== id)), 2200);
  }, []);

  // Anything the person does counts as "awake"; dozing halves presence EXP.
  useEffect(() => {
    lastInput.current = Date.now();
    const mark = () => (lastInput.current = Date.now());
    window.addEventListener("pointerdown", mark);
    window.addEventListener("keydown", mark);
    return () => {
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
    };
  }, []);

  const beat = useCallback(async () => {
    try {
      const next = await guildApi<HubView>("/api/hub/beat", {
        body: { lk: token, idle: Date.now() - lastInput.current > IDLE_AFTER_MS, chatted: chatted.current },
      });
      chatted.current = false;
      offset.current = next.now - Date.now();
      setView(next);
      setError("");
      showGain(next.gained, "นั่งฝึก");
      showGain(next.paid, "รางวัลอีเวนต์");
      if (next.event) setEvent((current) => (current?.id === next.event!.id ? current : next.event));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [token, showGain]);

  // Heartbeat once signed in, while the tab is visible.
  useEffect(() => {
    if (!me || !active) return;
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const tick = async () => {
      if (document.visibilityState === "visible") await beat();
      if (alive) timer = setTimeout(tick, BEAT_MS);
    };
    tick();
    const onShow = () => document.visibilityState === "visible" && beat();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [me, active, beat]);

  // Events and spirit HP arrive from the server over LiveKit.
  const onMessage = useCallback((msg: { payload: Uint8Array }) => {
    let data: HubMessage;
    try {
      data = JSON.parse(decoder.decode(msg.payload));
    } catch {
      return;
    }
    if (data.type === "event") {
      offset.current = data.now - Date.now();
      setEvent({ ...data.event, mine: 0 });
    } else if (data.type === "hp") {
      setEvent((current) =>
        current && current.id === data.id ? { ...current, damage: Math.max(current.damage, data.damage), defeated: data.defeated } : current,
      );
      // Someone landed the final blow: collect our share right away.
      if (data.defeated) beat();
    }
  }, [beat]);
  useDataChannel(TOPIC, onMessage);

  const applyTap = useCallback(
    (res: TapResponse) => {
      setView((v) => (v ? { ...v, exp: res.exp, level: res.level } : v));
      setEvent((current) => {
        if (!current || current.id !== res.event.id) return current;
        const won = res.event.kind === "chest" || res.event.defeated;
        return {
          ...current,
          ...res.event,
          damage: Math.max(current.damage, res.event.damage),
          ...(res.paid ? { result: won ? (res.event.kind === "chest" ? "claimed" : "won") : current.result, paid: res.paid } : {}),
        };
      });
      showGain(res.paid, res.event.kind === "chest" ? "เปิดหีบ" : "ปราบวิญญาณ");
    },
    [showGain],
  );

  const tapChest = useCallback(async () => {
    if (!event || event.kind !== "chest" || event.result) return;
    setEvent({ ...event, result: "claimed" });
    try {
      applyTap(await guildApi<TapResponse>("/api/hub/tap", { body: { lk: token, eventId: event.id, taps: 1 } }));
    } catch (err) {
      setEvent((current) => (current ? { ...current, result: "lost" } : current));
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [event, token, applyTap]);

  /** Spirit taps are batched so a frantic tapper sends a few requests, not dozens. */
  const tapSpirit = useCallback(() => {
    if (!event || event.kind !== "spirit" || event.defeated) return;
    pendingTaps.current += 1;
    setEvent((current) => (current ? { ...current, damage: current.damage + 1, mine: current.mine + 1 } : current));
    if (flushTimer.current) return;
    const id = event.id;
    flushTimer.current = setTimeout(async () => {
      flushTimer.current = null;
      const taps = pendingTaps.current;
      pendingTaps.current = 0;
      try {
        applyTap(await guildApi<TapResponse>("/api/hub/tap", { body: { lk: token, eventId: id, taps } }));
      } catch {
        // window closed mid-batch — the outcome screen covers it
      }
    }, SPIRIT_FLUSH_MS);
  }, [event, token, applyTap]);

  // When an event's window closes, settle it on screen and collect rewards.
  useEffect(() => {
    if (!event) return;
    const left = event.expiresAt - (Date.now() + offset.current);
    const timer = setTimeout(
      () => {
        setEvent((current) => {
          if (!current || current.id !== event.id) return current;
          if (current.result) return current;
          if (current.kind === "spirit") return { ...current, result: current.defeated ? "won" : "lost" };
          return { ...current, result: "lost" };
        });
        beat();
        setTimeout(() => setEvent((current) => (current?.id === event.id ? null : current)), 2500);
      },
      Math.max(0, left) + 300,
    );
    return () => clearTimeout(timer);
  }, [event?.id, event?.expiresAt, beat]); // eslint-disable-line react-hooks/exhaustive-deps

  const serverNow = useCallback(() => Date.now() + offset.current, []);
  const noteChat = useCallback(() => {
    chatted.current = true;
  }, []);

  return {
    view,
    event,
    gains,
    error,
    serverNow,
    noteChat,
    tapChest,
    tapSpirit,
    dismissEvent: () => setEvent(null),
  };
}

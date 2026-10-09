"use client";

import { useEffect, useMemo, useState } from "react";
import { haptic } from "@/lib/haptics";
import { CHEST_EXP, SPIRIT_EXP } from "@/lib/hub/rules";
import type { LiveEvent } from "./use-hub";

/** The chest or spirit popping into the room. Sits above everything, even meditation. */
export function EventLayer({
  event,
  serverNow,
  onChest,
  onSpirit,
}: {
  event: LiveEvent | null;
  serverNow: () => number;
  onChest: () => void;
  onSpirit: () => void;
}) {
  const [now, setNow] = useState(() => serverNow());

  const eventId = event?.id;
  useEffect(() => {
    if (!eventId) return;
    haptic("nudge");
    const timer = setInterval(() => setNow(serverNow()), 200);
    return () => clearInterval(timer);
  }, [eventId, serverNow]);

  // Chests land somewhere new each time, so you actually have to look.
  const spot = useMemo(() => {
    if (!event) return { left: 50, top: 45 };
    let h = 0;
    for (const c of event.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return { left: 20 + (h % 60), top: 30 + ((h >>> 8) % 35) };
  }, [event]);

  if (!event) return null;
  const left = Math.max(0, Math.ceil((event.expiresAt - now) / 1000));
  const total = Math.round((event.expiresAt - event.spawnAt) / 1000);

  if (event.kind === "chest") {
    const done = event.result;
    return (
      <div className="pointer-events-none fixed inset-0 z-50">
        <button
          onClick={() => {
            haptic("tap");
            onChest();
          }}
          disabled={!!done}
          aria-label="เปิดหีบสมบัติ"
          className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
          style={{ left: `${spot.left}%`, top: `${spot.top}%` }}
        >
          <span className={`text-7xl drop-shadow-[0_0_24px_rgba(255,221,60,0.8)] ${done ? "chest-open" : "chest-bounce"}`}>
            {done === "claimed" ? "✨" : "🎁"}
          </span>
          <span className="glass-strong rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap">
            {done === "claimed"
              ? event.paid
                ? `+${event.paid} EXP!`
                : "กำลังเปิด…"
              : done === "lost"
                ? "หีบหายไปแล้ว…"
                : `แตะเร็ว! +${CHEST_EXP} EXP · ${left} วิ`}
          </span>
        </button>
      </div>
    );
  }

  const hpLeft = Math.max(0, event.hp - event.damage);
  const pct = Math.round((hpLeft / event.hp) * 100);
  const outcome = event.defeated ? "won" : event.result === "lost" ? "lost" : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-night/70 px-6 backdrop-blur-sm">
      <p className="text-center text-lg font-extrabold">
        {outcome === "won" ? "ปราบสำเร็จ! 🎉" : outcome === "lost" ? "วิญญาณหนีไปแล้ว…" : "👻 วิญญาณร้ายบุกห้อง! ช่วยกันแตะรัว ๆ"}
      </p>
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          if (outcome) return;
          haptic("tick");
          onSpirit();
        }}
        aria-label="โจมตีวิญญาณร้าย"
        className={`grid size-52 place-items-center rounded-full text-[7rem] select-none ${outcome ? "" : "spirit-wobble active:scale-90"}`}
        style={{ touchAction: "manipulation", filter: outcome === "won" ? "grayscale(1) opacity(0.4)" : undefined }}
      >
        👻
      </button>
      <div className="w-full max-w-xs">
        <div className="h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-coral to-pink transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted tabular-nums">
          <span>
            HP {hpLeft}/{event.hp} · คุณตีไป {event.mine}
          </span>
          <span>{outcome ? "" : `${left}/${total} วิ`}</span>
        </div>
      </div>
      <p className="text-sm text-muted">
        {outcome === "won"
          ? `ทุกคนที่ช่วยตีได้ +${SPIRIT_EXP} EXP`
          : outcome === "lost"
            ? "คนที่ช่วยตีได้รางวัลปลอบใจนิดหน่อย"
            : `ชนะได้ +${SPIRIT_EXP} EXP — เรียกเพื่อนในห้องมาช่วย!`}
      </p>
    </div>
  );
}

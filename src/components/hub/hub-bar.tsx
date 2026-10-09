"use client";

import type { HubView } from "@/lib/hub/service";
import type { Gain } from "./use-hub";

/** Level, EXP bar and the room's boost, right under the room header. */
export function HubBar({ view, gains, error, onMeditate }: { view: HubView | null; gains: Gain[]; error: string; onMeditate: () => void }) {
  if (!view) {
    return (
      <div className="glass mx-3 -mt-1 flex h-12 items-center rounded-2xl px-3 text-xs text-muted">
        {error || "กำลังเข้าสู่ลานฝึก…"}
      </div>
    );
  }
  const { level, multiplier } = view;
  const pct = Math.min(100, Math.round((level.into / level.need) * 100));
  const boosted = multiplier > 1;

  return (
    <div className="glass relative mx-3 -mt-1 flex items-center gap-3 rounded-2xl px-3 py-2">
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sun/90 text-sm leading-none font-extrabold text-night">
        {level.level}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="truncate font-bold">{level.title}</span>
          <span className="shrink-0 text-muted tabular-nums">
            {level.into.toLocaleString()}/{level.need.toLocaleString()} EXP
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-sun to-pink transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span
        title={boosted ? "ห้องนี้คุยกันคึกคัก ได้ EXP เพิ่ม" : "เปิดไมค์คุยกัน 2 คนขึ้นไป หรือแชทโต้ตอบกัน เพื่อเพิ่ม EXP"}
        className={`shrink-0 rounded-full px-2 py-1 text-xs font-extrabold tabular-nums ${
          boosted ? "neon bg-pink text-night [--glow:var(--color-pink)]" : "bg-white/10 text-muted"
        }`}
      >
        {boosted ? "🔥" : "💤"} x{Number(multiplier.toFixed(2))}
      </span>
      <button onClick={onMeditate} aria-label="โหมดนั่งสมาธิ (ประหยัดแบต)" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-lg">
        🧘
      </button>

      {/* EXP pops drift up from the bar. */}
      <div className="pointer-events-none absolute -top-2 left-14 flex flex-col items-start">
        {gains.map((g) => (
          <span key={g.id} className="exp-pop text-sm font-extrabold whitespace-nowrap text-sun drop-shadow">
            +{g.amount} EXP <span className="font-medium text-ink/80">{g.label}</span>
          </span>
        ))}
      </div>
      {view.capped && (
        <span className="absolute -bottom-5 left-3 text-[11px] text-muted">วันนี้ฝึกเต็มโควตาแล้ว EXP จากการนั่งจะได้ครึ่งเดียว</span>
      )}
    </div>
  );
}

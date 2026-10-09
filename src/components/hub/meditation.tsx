"use client";

import { useEffect } from "react";
import type { HubView } from "@/lib/hub/service";
import { Avatar } from "../avatar";

/**
 * Battery-friendly "sit and train" screen: nearly black (cheap on OLED), no
 * animation, and a wake lock so the phone doesn't sleep and drop the session.
 * Events still pop up on top of it.
 */
export function Meditation({
  view,
  avatar,
  photo,
  onExit,
}: {
  view: HubView | null;
  avatar: string;
  photo?: string;
  onExit: () => void;
}) {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const acquire = async () => {
      try {
        const next = await navigator.wakeLock?.request("screen");
        if (alive) lock = next ?? null;
        else next?.release();
      } catch {
        // not supported or not allowed — the screen may dim, that's all
      }
    };
    acquire();
    // The lock drops when the tab is hidden; take it again on return.
    const onShow = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      lock?.release().catch(() => {});
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  return (
    <button
      onClick={onExit}
      aria-label="ออกจากโหมดนั่งสมาธิ"
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-black text-center"
    >
      <span className="grid size-24 place-items-center overflow-hidden rounded-full bg-white/5 text-5xl opacity-70">
        <Avatar emoji={avatar} photo={photo} />
      </span>
      <span className="text-sm text-white/40">กำลังนั่งสมาธิ…</span>
      {view && (
        <span className="text-white/60">
          Lv.{view.level.level} {view.level.title} · {view.level.into.toLocaleString()}/{view.level.need.toLocaleString()} EXP
          {view.multiplier > 1 && <span className="text-white/40"> · x{Number(view.multiplier.toFixed(2))}</span>}
        </span>
      )}
      <span className="mt-8 max-w-60 text-xs text-white/25">
        จอมืดช่วยประหยัดแบต ยังได้ EXP ตามปกติ ถ้ามีหีบหรือวิญญาณโผล่จะเด้งขึ้นมาให้แตะ · แตะที่ไหนก็ได้เพื่อกลับ
      </span>
    </button>
  );
}

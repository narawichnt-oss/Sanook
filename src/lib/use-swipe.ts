"use client";

import { useRef } from "react";

const THRESHOLD = 60;

/**
 * Touch handlers that fire on a clear horizontal swipe. Mostly-vertical drags
 * are left alone so the page still scrolls normally.
 */
export function useSwipe({ onLeft, onRight }: { onLeft?: () => void; onRight?: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart(e: React.TouchEvent) {
      const t = e.touches[0];
      start.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
    },
    onTouchEnd(e: React.TouchEvent) {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) onLeft?.();
      else onRight?.();
    },
  };
}

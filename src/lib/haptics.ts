"use client";

// Short buzzes for taps that matter. Android browsers support this; iOS Safari
// ignores navigator.vibrate, so these are a bonus, never the only feedback.
const PATTERNS = {
  tick: 8,
  tap: 15,
  nudge: [12, 40, 12],
} as const;

export function haptic(kind: keyof typeof PATTERNS = "tap") {
  try {
    navigator.vibrate?.(PATTERNS[kind] as VibratePattern);
  } catch {
    // not allowed here (e.g. before the first user gesture) — skip quietly
  }
}

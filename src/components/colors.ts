import type { RoomColor } from "@/lib/room-meta";

// Spelled out in full so Tailwind can see every class at build time.
export const ROOM_BG: Record<RoomColor, string> = {
  coral: "bg-coral",
  mint: "bg-mint",
  sky: "bg-sky",
  lilac: "bg-lilac",
  sun: "bg-sun",
};

export const ROOM_TINT: Record<RoomColor, string> = {
  coral: "from-coral/25",
  mint: "from-mint/25",
  sky: "from-sky/25",
  lilac: "from-lilac/25",
  sun: "from-sun/25",
};

export const ROOM_VAR: Record<RoomColor, string> = {
  coral: "var(--color-coral)",
  mint: "var(--color-mint)",
  sky: "var(--color-sky)",
  lilac: "var(--color-lilac)",
  sun: "var(--color-sun)",
};

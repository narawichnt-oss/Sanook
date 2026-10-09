import type { RoomColor } from "@/lib/room-meta";

// Spelled out in full so Tailwind can see every class at build time.
export const ROOM_BG: Record<RoomColor, string> = {
  coral: "bg-coral",
  mint: "bg-mint",
  sky: "bg-sky",
  lilac: "bg-lilac",
  sun: "bg-sun",
  pink: "bg-pink",
};

export const ROOM_TINT: Record<RoomColor, string> = {
  coral: "from-coral/25",
  mint: "from-mint/25",
  sky: "from-sky/25",
  lilac: "from-lilac/25",
  sun: "from-sun/25",
  pink: "from-pink/25",
};

/** Stronger wash for the big lobby cards. */
export const ROOM_CARD: Record<RoomColor, string> = {
  coral: "from-coral/55 via-coral/15",
  mint: "from-mint/45 via-mint/10",
  sky: "from-sky/50 via-sky/15",
  lilac: "from-lilac/55 via-lilac/15",
  sun: "from-sun/45 via-sun/10",
  pink: "from-pink/55 via-pink/15",
};

export const ROOM_VAR: Record<RoomColor, string> = {
  coral: "var(--color-coral)",
  mint: "var(--color-mint)",
  sky: "var(--color-sky)",
  lilac: "var(--color-lilac)",
  sun: "var(--color-sun)",
  pink: "var(--color-pink)",
};

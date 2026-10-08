"use client";

import { useIsMuted, useIsSpeaking } from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import { AVATARS } from "@/lib/room-meta";

export type FloatingReaction = { id: string; identity: string; emoji: string };

export function Seat({ participant, reactions }: { participant: Participant; reactions: FloatingReaction[] }) {
  const speaking = useIsSpeaking(participant);
  const muted = useIsMuted({ participant, source: Track.Source.Microphone });
  const avatar = participant.attributes.avatar || AVATARS[0];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div
          className={`grid size-20 place-items-center rounded-full bg-night-3 text-4xl transition sm:size-24 ${
            speaking && !muted ? "speaking" : ""
          }`}
        >
          {avatar}
        </div>
        {muted && (
          <span
            aria-label="ปิดไมค์อยู่"
            className="absolute right-0 bottom-0 grid size-7 place-items-center rounded-full bg-night-2 text-sm ring-2 ring-night"
          >
            🔇
          </span>
        )}
        {reactions.map((r) => (
          <span key={r.id} className="float-up pointer-events-none absolute top-0 left-1/2 text-4xl">
            {r.emoji}
          </span>
        ))}
      </div>
      <span className="max-w-full truncate px-1 text-sm">
        {participant.name || "ไม่มีชื่อ"}
        {participant.isLocal && <span className="text-muted"> (คุณ)</span>}
      </span>
    </div>
  );
}

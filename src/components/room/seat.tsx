"use client";

import { useIsMuted, useIsSpeaking, useMultibandTrackVolume, useParticipantTracks } from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import type { Mood } from "@/lib/mood";
import { Avatar } from "../avatar";

export type FloatingReaction = { id: string; identity: string; emoji: string };
export type SeatMood = { mood: Mood; key: string };

// Bars around the avatar; the analyser gives half and we mirror it so the
// ring looks balanced left and right.
const BANDS = 8;
const RADIUS = 44;

export function Seat({
  participant,
  reactions,
  mood,
}: {
  participant: Participant;
  reactions: FloatingReaction[];
  mood?: SeatMood;
}) {
  const speaking = useIsSpeaking(participant);
  const muted = useIsMuted({ participant, source: Track.Source.Microphone });
  const [mic] = useParticipantTracks([Track.Source.Microphone], participant.identity);
  const bands = useMultibandTrackVolume(muted ? undefined : mic, { bands: BANDS, updateInterval: 50 });

  // The analyser reports roughly 0.3–0.4 for room noise; stretch the rest to 0–1,
  // and let the bars sink when LiveKit doesn't think this person is talking.
  const gate = speaking && !muted ? 1 : 0.2;
  const levels = bands.map((v) => Math.min(1, Math.max(0, (v - 0.38) / 0.5)) * gate);
  const ring = [...levels, ...levels.slice().reverse()];
  const loudness = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative grid size-28 place-items-center">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {ring.map((level, i) => (
            <span
              key={i}
              className="absolute top-1/2 left-1/2 -ml-[2px] w-1 origin-top rounded-full transition-[height] duration-75"
              style={{
                height: `${4 + level * 18}px`,
                background: "var(--ring)",
                opacity: 0.35 + level * 0.65,
                transform: `rotate(${(360 / ring.length) * i + 180}deg) translateY(${RADIUS}px)`,
              }}
            />
          ))}
        </div>

        <div
          key={mood?.key}
          className={`grid size-20 place-items-center overflow-hidden rounded-full bg-night-3 text-4xl transition-transform duration-100 ${
            mood ? `mood-${mood.mood}` : ""
          }`}
          style={{
            scale: `${1 + loudness * 0.18}`,
            boxShadow: speaking && !muted ? "0 0 0 3px var(--ring), 0 0 24px 2px color-mix(in srgb, var(--ring) 45%, transparent)" : undefined,
          }}
        >
          <Avatar emoji={participant.attributes.avatar} photo={participant.attributes.photo} />
        </div>

        {muted && (
          <span
            aria-label="ปิดไมค์อยู่"
            className="absolute right-3 bottom-3 grid size-7 place-items-center rounded-full bg-night-2 text-sm ring-2 ring-night"
          >
            🔇
          </span>
        )}
        {reactions.map((r) => (
          <span key={r.id} className="float-up pointer-events-none absolute top-2 left-1/2 text-4xl">
            {r.emoji}
          </span>
        ))}
      </div>
      <span className={`-mt-2 max-w-full truncate px-1 text-sm ${speaking && !muted ? "font-bold" : ""}`}>
        {participant.name || "ไม่มีชื่อ"}
        {participant.isLocal && <span className="text-muted"> (คุณ)</span>}
      </span>
    </div>
  );
}

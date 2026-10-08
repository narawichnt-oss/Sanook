"use client";

import { useState } from "react";
import { AVATARS, MAX_NAME } from "@/lib/room-meta";
import type { Profile } from "@/lib/profile";

export function ProfileForm({
  initial,
  submitLabel,
  onSave,
}: {
  initial?: Profile | null;
  submitLabel: string;
  onSave: (profile: Profile) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [avatar, setAvatar] = useState(() => initial?.avatar ?? AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const trimmed = name.trim();

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed) onSave({ name: trimmed, avatar });
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="grid size-24 place-items-center rounded-full bg-night-3 text-5xl">{avatar}</div>
        <span className="text-sm text-muted">เลือกหน้าตาของคุณ</span>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {AVATARS.map((a) => (
          <button
            key={a}
            type="button"
            aria-label={`เลือก ${a}`}
            aria-pressed={a === avatar}
            onClick={() => setAvatar(a)}
            className={`grid aspect-square place-items-center rounded-2xl text-2xl transition ${
              a === avatar ? "bg-lilac/30 ring-2 ring-lilac" : "bg-night-3 hover:bg-night-3/70"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">ชื่อเล่น</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME}
          autoFocus
          placeholder="เพื่อน ๆ จะเห็นชื่อนี้"
          className="rounded-2xl bg-night-3 px-4 py-3 text-lg outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-lilac"
        />
      </label>

      <button
        type="submit"
        disabled={!trimmed}
        className="rounded-2xl bg-sun px-4 py-3 text-lg font-semibold text-night transition hover:brightness-105 disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useProfile } from "@/lib/profile";
import type { RoomSummary } from "@/lib/room-meta";
import { MAX_ROOM_SIZE } from "@/lib/room-meta";
import { ROOM_TINT } from "./colors";
import { CreateRoom } from "./create-room";
import { ProfileForm } from "./profile-form";

const REFRESH_MS = 8000;

export function Lobby() {
  const { profile, save } = useProfile();
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (alive) {
          setRooms(data.rooms);
          setError("");
        }
      } catch {
        if (alive) setError("โหลดรายชื่อห้องไม่ได้ เดี๋ยวจะลองใหม่ให้");
      }
    }
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (profile === undefined) return null;

  if (!profile || editing) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
        <header className="text-center">
          <h1 className="text-4xl font-semibold">คุยกัน</h1>
          <p className="mt-2 text-muted">เปิดห้อง ชวนเพื่อน แล้วคุยด้วยเสียงได้เลย</p>
        </header>
        <ProfileForm
          initial={profile}
          submitLabel={profile ? "บันทึก" : "เริ่มเลย"}
          onSave={(p) => {
            save(p);
            setEditing(false);
          }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 pt-6 pb-28">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">คุยกัน</h1>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-2 rounded-full bg-night-2 py-1.5 pr-4 pl-1.5 hover:bg-night-3"
        >
          <span className="grid size-8 place-items-center rounded-full bg-night-3 text-lg">{profile.avatar}</span>
          <span className="max-w-32 truncate text-sm">{profile.name}</span>
        </button>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm text-muted">ห้องที่กำลังคุยกันอยู่</h2>
        {error && <p className="text-sm text-coral">{error}</p>}
        {rooms === null && !error && <p className="text-muted">กำลังโหลด…</p>}
        {rooms?.length === 0 && (
          <div className="rounded-3xl border border-dashed border-night-3 p-8 text-center text-muted">
            ยังไม่มีใครเปิดห้องเลย เปิดห้องแรกกันเถอะ
          </div>
        )}
        {rooms?.map((room) => (
          <Link
            key={room.id}
            href={`/room/${room.id}`}
            className={`flex items-center gap-4 rounded-3xl bg-gradient-to-r ${ROOM_TINT[room.color]} to-night-2 to-60% p-4 transition hover:brightness-110`}
          >
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-night/40 text-3xl">{room.emoji}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-lg font-medium">{room.title}</span>
              {room.topic && <span className="truncate text-sm text-muted">{room.topic}</span>}
            </span>
            <span className="shrink-0 rounded-full bg-night/40 px-3 py-1 text-sm">
              {room.listeners >= MAX_ROOM_SIZE ? "เต็ม" : `${room.listeners} คน`}
            </span>
          </Link>
        ))}
      </section>

      <button
        onClick={() => setCreating(true)}
        className="fixed inset-x-4 bottom-6 mx-auto max-w-md rounded-full bg-sun px-6 py-4 text-lg font-semibold text-night shadow-lg shadow-black/40"
      >
        ＋ เปิดห้องใหม่
      </button>

      {creating && <CreateRoom onClose={() => setCreating(false)} />}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { useProfile } from "@/lib/profile";
import {
  MAX_ROOM_SIZE,
  MAX_TITLE,
  ROOM_COLORS,
  ROOM_EMOJIS,
  pickQuickRoom,
  randomItem,
  type RoomSummary,
} from "@/lib/room-meta";
import { Avatar } from "./avatar";
import { ROOM_CARD } from "./colors";
import { CreateRoom } from "./create-room";
import { ProfileForm } from "./profile-form";

const REFRESH_MS = 8000;

export function Lobby() {
  const { profile, save } = useProfile();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [error, setError] = useState("");
  const [quick, setQuick] = useState<"idle" | "busy">("idle");
  const [active, setActive] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);

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

  // Track which card is centred so the dots below can follow the swipe.
  function onRailScroll() {
    const rail = railRef.current;
    if (!rail || !rail.firstElementChild) return;
    const step = (rail.firstElementChild as HTMLElement).offsetWidth + 16;
    setActive(Math.round(rail.scrollLeft / step));
  }

  /** Drop straight into the liveliest room, or open one if nobody is around. */
  async function playNow() {
    if (!profile) return;
    haptic("tap");
    setQuick("busy");
    setError("");
    try {
      const res = await fetch("/api/rooms", { cache: "no-store" });
      const data = res.ok ? await res.json() : { rooms: [] };
      const pick = pickQuickRoom(data.rooms);
      if (pick) return router.push(`/room/${pick.id}`);

      const created = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `ห้องของ ${profile.name}`.slice(0, MAX_TITLE),
          topic: "เข้ามาคุยกันได้เลย",
          emoji: randomItem(ROOM_EMOJIS),
          color: randomItem(ROOM_COLORS),
        }),
      });
      const room = await created.json().catch(() => ({}));
      if (!created.ok) throw new Error(room.error || "เปิดห้องไม่สำเร็จ ลองใหม่อีกครั้ง");
      router.push(`/room/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setQuick("idle");
    }
  }

  if (profile === undefined) return null;

  if (!profile || editing) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
        <header className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight">
            สนุก<span className="text-sun">.</span>
          </h1>
          <p className="mt-2 text-muted">เลือกหน้าตา ตั้งชื่อ แล้วกระโดดเข้าห้องได้เลย</p>
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

  const live = rooms?.reduce((sum, r) => sum + r.listeners, 0) ?? 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 pt-6 pb-36">
      <header className="flex items-center justify-between px-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            สนุก<span className="text-sun">.</span>
          </h1>
          <p className="text-sm text-muted">
            {rooms === null ? "กำลังดูว่ามีใครอยู่บ้าง…" : live > 0 ? `${live} คนกำลังคุยกันอยู่ตอนนี้` : "ยังเงียบอยู่ เปิดวงแรกกันเลย"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="glass flex h-12 items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 transition hover:brightness-125"
          >
            <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-night-3 text-xl">
              <span className="grid size-full place-items-center overflow-hidden rounded-full">
                <Avatar emoji={profile.avatar} photo={profile.photo} />
              </span>
            </span>
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <span className="max-w-24 truncate text-sm font-medium">{profile.name}</span>
            </span>
          </button>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between px-4">
          <h2 className="font-semibold">ห้องที่กำลังคุยกัน</h2>
          {rooms && rooms.length > 1 && <span className="text-xs text-muted">ปัดเพื่อดูห้องอื่น →</span>}
        </div>
        {error && <p className="px-4 text-sm text-coral">{error}</p>}

        {rooms === null && !error && (
          <div className="mx-4 h-[min(60dvh,32rem)] animate-pulse rounded-[2rem] bg-night-2" aria-label="กำลังโหลด" />
        )}

        {rooms?.length === 0 && (
          <div className="glass mx-4 flex h-[min(60dvh,32rem)] flex-col items-center justify-center gap-3 rounded-[2rem] p-8 text-center">
            <span className="bob text-6xl">🎤</span>
            <p className="text-lg font-semibold">ยังไม่มีใครเปิดห้องเลย</p>
            <p className="text-sm text-muted">กด Play Now แล้วเราจะเปิดห้องให้คุณทันที ส่งลิงก์ชวนเพื่อนได้เลย</p>
          </div>
        )}

        {rooms && rooms.length > 0 && (
          <>
            <div
              ref={railRef}
              onScroll={onRailScroll}
              className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2"
            >
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
            {rooms.length > 1 && (
              <div className="flex justify-center gap-1.5" aria-hidden>
                {rooms.map((r, i) => (
                  <span
                    key={r.id}
                    className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-sun" : "w-1.5 bg-ink/25"}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Thumb zone: the two things you came here to do. */}
      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-night via-night/90 to-transparent px-4 pt-10 pb-6">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            onClick={playNow}
            disabled={quick === "busy"}
            className="neon flex h-16 flex-1 items-center justify-center gap-2 rounded-full bg-sun text-xl font-extrabold text-night transition active:scale-95 disabled:opacity-60"
          >
            {quick === "busy" ? "กำลังหาวงให้…" : "▶ Play Now"}
          </button>
          <button
            onClick={() => {
              haptic("tick");
              setCreating(true);
            }}
            aria-label="เปิดห้องใหม่"
            className="glass grid size-16 shrink-0 place-items-center rounded-full text-2xl transition active:scale-95"
          >
            ＋
          </button>
        </div>
      </div>

      {creating && <CreateRoom onClose={() => setCreating(false)} />}
    </main>
  );
}

function RoomCard({ room }: { room: RoomSummary }) {
  const full = room.listeners >= MAX_ROOM_SIZE;
  return (
    <Link
      href={full ? "#" : `/room/${room.id}`}
      aria-disabled={full}
      onClick={(e) => {
        if (full) e.preventDefault();
        else haptic("tick");
      }}
      className={`relative flex h-[min(60dvh,32rem)] w-[82%] max-w-sm shrink-0 snap-center flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br ${ROOM_CARD[room.color]} to-night-2 p-5 transition active:scale-[0.98] ${full ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between">
        {room.listeners > 0 ? (
          <span className="flex items-center gap-1.5 rounded-full bg-night/50 px-2.5 py-1 text-xs font-bold tracking-wide">
            <span className="live-dot size-2 rounded-full bg-pink" /> LIVE
          </span>
        ) : (
          <span className="rounded-full bg-night/50 px-2.5 py-1 text-xs font-bold">✨ ห้องใหม่ รอคนแรก</span>
        )}
        <span className="rounded-full bg-night/50 px-2.5 py-1 text-xs">{full ? "เต็มแล้ว" : `${room.listeners}/${MAX_ROOM_SIZE} คน`}</span>
      </div>

      <span className="bob m-auto text-9xl drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]">{room.emoji}</span>

      <div className="flex flex-col gap-2">
        <span className="line-clamp-2 text-2xl leading-tight font-bold">{room.title}</span>
        {room.topic && <span className="truncate text-sm text-ink/75">{room.topic}</span>}
        {/* One dot per seat: lit seats are taken. */}
        <span className="mt-1 flex gap-1" aria-hidden>
          {Array.from({ length: MAX_ROOM_SIZE }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < room.listeners ? "bg-ink" : "bg-ink/20"}`} />
          ))}
        </span>
      </div>
    </Link>
  );
}

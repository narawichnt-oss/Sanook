"use client";

import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { DisconnectReason } from "livekit-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProfile, type Profile } from "@/lib/profile";
import type { RoomMeta } from "@/lib/room-meta";
import { ProfileForm } from "../profile-form";
import { RoomStage } from "./room-stage";

type Session = { token: string; serverUrl: string; room: RoomMeta };

/** Makes sure the visitor has a nickname, fetches a join token, then connects. */
export function RoomGate({ roomId }: { roomId: string }) {
  const { profile, save } = useProfile();

  if (profile === undefined) return null;
  if (!profile) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
        <header className="text-center">
          <h1 className="text-2xl font-semibold">มีคนชวนคุณมาคุยกัน</h1>
          <p className="mt-2 text-muted">ตั้งชื่อเล่นก่อนเข้าห้อง</p>
        </header>
        <ProfileForm submitLabel="เข้าห้อง" onSave={save} />
      </main>
    );
  }
  return <Connect roomId={roomId} profile={profile} />;
}

function Connect({ roomId, profile }: { roomId: string; profile: Profile }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [left, setLeft] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, name: profile.name, avatar: profile.avatar }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "เข้าห้องไม่สำเร็จ");
        if (alive) setSession(data);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      alive = false;
    };
  }, [roomId, profile.name, profile.avatar]);

  if (error || left) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-lg">{error || "หลุดออกจากห้องแล้ว (ห้องอาจปิด หรือเน็ตหลุด)"}</p>
        <Link href="/" className="rounded-2xl bg-sun px-6 py-3 font-semibold text-night">
          กลับไปหน้าห้องทั้งหมด
        </Link>
      </main>
    );
  }

  if (!session) {
    return <main className="grid min-h-dvh place-items-center text-muted">กำลังเข้าห้อง…</main>;
  }

  return (
    <LiveKitRoom
      serverUrl={session.serverUrl}
      token={session.token}
      connect
      audio={false}
      video={false}
      onDisconnected={(reason) => {
        // Pressing "leave" goes straight home; anything else explains what happened.
        if (reason === DisconnectReason.CLIENT_INITIATED) router.push("/");
        else setLeft(true);
      }}
      className="min-h-dvh"
    >
      <RoomAudioRenderer />
      <RoomStage roomId={roomId} meta={session.room} />
    </LiveKitRoom>
  );
}

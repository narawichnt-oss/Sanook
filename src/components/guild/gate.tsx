"use client";

import Link from "next/link";
import { useGuildMe } from "@/lib/guild/client";
import { useProfile } from "@/lib/profile";
import { ProfileForm } from "../profile-form";

export type Session = ReturnType<typeof useGuildMe> & { me: NonNullable<ReturnType<typeof useGuildMe>["me"]> };

/** Makes sure the visitor has a nickname and a guild player token before showing guild pages. */
export function GuildGate({ children }: { children: (session: Session) => React.ReactNode }) {
  const { profile, save } = useProfile();
  const session = useGuildMe(profile);

  if (profile === undefined) return null;

  if (!profile) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
        <header className="text-center">
          <p className="text-5xl">🏝️</p>
          <h1 className="mt-2 text-3xl font-extrabold">ตั้งชื่อก่อนเข้ากิลด์</h1>
          <p className="mt-2 text-muted">ชื่อกับหน้าตานี้จะเดินอยู่บนเกาะกิลด์ของคุณ</p>
        </header>
        <ProfileForm initial={null} submitLabel="ไปเกาะกิลด์" onSave={save} />
      </main>
    );
  }

  if (session.error && !session.me) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="text-5xl">🌧️</span>
        <p className="font-semibold">{session.error}</p>
        <div className="flex gap-2">
          <button onClick={() => location.reload()} className="rounded-full bg-sun px-5 py-2 font-bold text-night">
            ลองใหม่
          </button>
          <Link href="/" className="glass rounded-full px-5 py-2">
            กลับล็อบบี้
          </Link>
        </div>
      </main>
    );
  }

  if (!session.me) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 pt-6">
        <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-night-2" />
        <div className="aspect-[3/2] animate-pulse rounded-[2rem] bg-night-2" aria-label="กำลังโหลด" />
      </main>
    );
  }

  return <>{children(session as Session)}</>;
}

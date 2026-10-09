"use client";

import { useRef, useState } from "react";
import { NAME_FRAMES, NAME_STYLES, NAME_SYMBOLS, applyFrame, applyStyle, type NameStyleId } from "@/lib/fancy-name";
import { haptic } from "@/lib/haptics";
import { photoFromFile } from "@/lib/photo";
import type { Profile } from "@/lib/profile";
import { AVATARS, MAX_NAME, cleanName, graphemes, randomItem, truncateGraphemes } from "@/lib/room-meta";
import { Avatar } from "./avatar";

// For people who just want in: one tap and they have a name.
const NICKNAMES = [
  "หมูกรอบ",
  "ชาไทย",
  "ข้าวเหนียว",
  "มะม่วง",
  "ทองหยิบ",
  "บิงซู",
  "โกโก้",
  "ปลาทู",
  "ขนมครก",
  "น้ำแข็งใส",
  "ส้มตำ",
  "ลูกชิ้น",
];

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
  const [avatar, setAvatar] = useState(() => initial?.avatar ?? randomItem(AVATARS));
  const [photo, setPhoto] = useState(initial?.photo);
  const [photoError, setPhotoError] = useState("");
  const [busy, setBusy] = useState(false);
  const [decorating, setDecorating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cleaned = cleanName(name);
  const length = graphemes(name).length;

  /** Only accept a decoration if the result still fits. */
  function tryName(next: string) {
    if (graphemes(next).length > MAX_NAME) {
      haptic("nudge");
      return;
    }
    haptic("tick");
    setName(next);
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setPhotoError("");
    try {
      setPhoto(await photoFromFile(file));
      haptic("tap");
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!cleaned) return;
        haptic("tap");
        onSave({ name: cleaned, avatar, ...(photo ? { photo } : {}) });
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="เปลี่ยนรูปโปรไฟล์"
          className="relative grid size-28 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-lilac/40 to-pink/30 text-6xl ring-4 ring-white/10"
        >
          <span key={photo ?? avatar} className="mood-wow grid size-full place-items-center rounded-full">
            <Avatar emoji={avatar} photo={photo} />
          </span>
          <span className="absolute right-1 bottom-1 grid size-8 place-items-center rounded-full bg-night text-base ring-2 ring-white/20">
            📷
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => pickPhoto(e.target.files?.[0])}
        />
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="glass rounded-full px-4 py-1.5 transition active:scale-95 disabled:opacity-50"
          >
            {busy ? "กำลังย่อรูป…" : photo ? "เปลี่ยนรูป" : "📷 ใช้รูปตัวเอง"}
          </button>
          {photo && (
            <button
              type="button"
              onClick={() => setPhoto(undefined)}
              className="rounded-full px-4 py-1.5 text-muted transition hover:text-coral"
            >
              ลบรูป
            </button>
          )}
        </div>
        {photoError && <p className="text-sm text-coral">{photoError}</p>}
        {!photo && <span className="text-xs text-muted">หรือเลือกตัวการ์ตูนด้านล่าง</span>}
      </div>

      <div className="grid grid-cols-6 gap-2">
        {AVATARS.map((a) => (
          <button
            key={a}
            type="button"
            aria-label={`เลือก ${a}`}
            aria-pressed={!photo && a === avatar}
            onClick={() => {
              haptic("tick");
              setAvatar(a);
              setPhoto(undefined);
            }}
            className={`grid aspect-square place-items-center rounded-2xl text-2xl transition active:scale-90 ${
              !photo && a === avatar ? "bg-lilac/30 ring-2 ring-lilac" : "glass hover:brightness-125"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nickname" className="flex justify-between text-sm text-muted">
          <span>ชื่อเล่น</span>
          <span className={length >= MAX_NAME ? "text-sun" : ""}>
            {length}/{MAX_NAME}
          </span>
        </label>
        <span className="flex gap-2">
          <input
            id="nickname"
            value={name}
            // Count by visible characters, not code units, so 𝓯𝓪𝓷𝓬𝔂 letters and emoji aren't cut in half.
            onChange={(e) => setName(truncateGraphemes(e.target.value, MAX_NAME))}
            autoFocus
            placeholder="เพื่อน ๆ จะเห็นชื่อนี้"
            className="glass min-w-0 flex-1 rounded-2xl px-4 py-3 text-lg outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-lilac"
          />
          <button
            type="button"
            aria-label="สุ่มชื่อเล่น"
            title="สุ่มชื่อเล่น"
            onClick={() => {
              haptic("tick");
              setName(randomItem(NICKNAMES.filter((n) => n !== name)));
            }}
            className="glass grid w-14 shrink-0 place-items-center rounded-2xl text-2xl transition active:scale-90"
          >
            🎲
          </button>
        </span>

        <button
          type="button"
          aria-expanded={decorating}
          onClick={() => setDecorating((v) => !v)}
          className="self-start rounded-full px-1 py-1 text-sm text-lilac"
        >
          ✨ แต่งชื่อด้วยตัวอักษรพิเศษ {decorating ? "▴" : "▾"}
        </button>

        {decorating && (
          <div className="glass flex flex-col gap-3 rounded-2xl p-3">
            <Row label="ฟอนต์ (ใช้กับ A–Z และตัวเลข)">
              {NAME_STYLES.map((s) => (
                <Chip key={s.id} onClick={() => tryName(applyStyle(name, s.id as NameStyleId))}>
                  {s.label}
                </Chip>
              ))}
            </Row>
            <Row label="กรอบชื่อ">
              <Chip onClick={() => tryName(applyFrame(name, null))}>ไม่มีกรอบ</Chip>
              {NAME_FRAMES.map((f) => (
                <Chip key={f[0]} onClick={() => tryName(applyFrame(name, f))}>
                  {f[0]}ชื่อ{f[1]}
                </Chip>
              ))}
            </Row>
            <Row label="แตะเพื่อเติมสัญลักษณ์ท้ายชื่อ">
              {NAME_SYMBOLS.map((sym) => (
                <Chip key={sym} onClick={() => tryName(name + sym)}>
                  {sym}
                </Chip>
              ))}
            </Row>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={!cleaned || busy}
        className="neon rounded-full bg-sun px-4 py-4 text-lg font-extrabold text-night transition active:scale-95 disabled:opacity-40 disabled:shadow-none"
      >
        {submitLabel}
      </button>
    </form>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">{children}</div>
    </div>
  );
}

function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full bg-night-3 px-3 py-1.5 text-sm whitespace-nowrap transition hover:bg-lilac/30 active:scale-95"
    >
      {children}
    </button>
  );
}

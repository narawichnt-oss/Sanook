"use client";

import { useCallback, useSyncExternalStore } from "react";
import { AVATARS, isPhotoDataUrl } from "./room-meta";

/** `photo` is an optional small data URL; `avatar` (emoji) is always kept as the fallback. */
export type Profile = { name: string; avatar: string; photo?: string };

const KEY = "kuikan.profile";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: Profile | null = null;
// Used when localStorage is blocked (some private modes), so the tab still works.
let memoryRaw: string | null = null;

function read(): Profile | null {
  let raw = memoryRaw;
  try {
    raw = localStorage.getItem(KEY) ?? memoryRaw;
  } catch {
    // storage blocked — fall back to memory
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const data = raw ? JSON.parse(raw) : null;
      cached = data?.name
        ? {
            name: String(data.name),
            avatar: String(data.avatar || AVATARS[0]),
            ...(isPhotoDataUrl(data.photo) ? { photo: data.photo } : {}),
          }
        : null;
    } catch {
      cached = null;
    }
  }
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The visitor's nickname and avatar, kept in this browser only. `undefined` until hydrated. */
export function useProfile() {
  const profile = useSyncExternalStore(subscribe, read, () => undefined);

  const save = useCallback((next: Profile) => {
    memoryRaw = JSON.stringify(next);
    try {
      localStorage.setItem(KEY, memoryRaw);
    } catch {
      // memoryRaw keeps it for this tab
    }
    listeners.forEach((l) => l());
  }, []);

  return { profile, save };
}

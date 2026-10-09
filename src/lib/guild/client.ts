"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/profile";
import type { MeView } from "./types";

// The signed player token for guild features. Lives next to the profile in
// localStorage; losing it just means this device starts as a new player.
const KEY = "kuikan.guild.token";

function readToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // private mode: the token lives only for this page
  }
  memoryToken = token;
}

let memoryToken: string | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Calls a guild API with the player token attached. Throws ApiError with a friendly message. */
export async function guildApi<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = memoryToken ?? readToken();
  const res = await fetch(path, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", ...(token ? { "x-player": token } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง", res.status);
  return data as T;
}

// One sign-in per page load, shared by every component that asks.
let pending: { key: string; promise: Promise<MeView> } | null = null;

function signIn(profile: Profile): Promise<MeView> {
  const key = `${profile.name}|${profile.avatar}`;
  if (pending?.key !== key) {
    const promise = guildApi<{ token: string; me: MeView }>("/api/guild/me", {
      body: { name: profile.name, avatar: profile.avatar },
    }).then(({ token, me }) => {
      writeToken(token);
      return me;
    });
    promise.catch(() => {
      if (pending?.promise === promise) pending = null;
    });
    pending = { key, promise };
  }
  return pending.promise;
}

/** Signs this device into the guild system with its local profile and keeps `me` fresh. */
export function useGuildMe(profile: Profile | null | undefined) {
  const [me, setMe] = useState<MeView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    signIn(profile)
      .then((m) => alive && (setMe(m), setError("")))
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      alive = false;
    };
  }, [profile]);

  const refresh = useCallback(async () => {
    const m = await guildApi<MeView>("/api/guild/me");
    setMe(m);
    return m;
  }, []);

  /** Runs a guild action and swaps in the MeView it returns. */
  const act = useCallback(async (body: Record<string, unknown>) => {
    const m = await guildApi<MeView>("/api/guild/action", { body });
    setMe(m);
    return m;
  }, []);

  return { me, setMe, error, refresh, act };
}

/**
 * Calls `fn` every `ms` while the tab is visible. The latest `fn` is always
 * used, so callers don't need to memoise it.
 */
export function usePoll(fn: () => unknown, ms: number, { enabled = true, immediate = true } = {}) {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          await latest.current();
        } catch {
          // keep polling; the page shows the last good state
        }
      }
      if (alive) timer = setTimeout(tick, ms);
    };
    timer = setTimeout(tick, immediate ? 0 : ms);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ms, enabled, immediate]);
}

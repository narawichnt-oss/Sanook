// Signed tokens, so nobody needs an account. A player token proves "I'm the
// device that registered as player X"; a round token proves "the server handed
// me this round at this time". Both are HMAC'd with a server secret.

import { createHmac, timingSafeEqual } from "node:crypto";
import { isGameId, type GameId } from "./games";

function sign(text: string, secret: string): string {
  return createHmac("sha256", secret).update(text).digest("base64url").slice(0, 32);
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const PLAYER_ID = /^[a-z0-9]{12}$/;

export function playerToken(id: string, secret: string): string {
  return `${id}.${sign(`player:${id}`, secret)}`;
}

/** The player id inside a valid token, or null. */
export function readPlayerToken(token: string | null | undefined, secret: string): string | null {
  const [id, mac] = (token ?? "").split(".");
  if (!id || !mac || !PLAYER_ID.test(id)) return null;
  return same(mac, sign(`player:${id}`, secret)) ? id : null;
}

export function isPlayerId(id: string): boolean {
  return PLAYER_ID.test(id);
}

export type RoundTicket = { war: string; stage: number; game: GameId; player: string; seed: number; startedAt: number };

export function roundToken(ticket: RoundTicket, secret: string): string {
  const body = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return `${body}.${sign(`round:${body}`, secret)}`;
}

export function readRoundToken(token: unknown, secret: string): RoundTicket | null {
  if (typeof token !== "string") return null;
  const [body, mac] = token.split(".");
  if (!body || !mac || !same(mac, sign(`round:${body}`, secret))) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof t.war !== "string" || typeof t.player !== "string" || !isGameId(t.game)) return null;
    if (![t.stage, t.seed, t.startedAt].every(Number.isFinite)) return null;
    return t as RoundTicket;
  } catch {
    return null;
  }
}

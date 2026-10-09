// The five stages that sit between two islands. This file is safe for the
// browser: names, icons, time limits, and the shape of a round. Answers live
// in rounds.ts, which only the server imports.

export const GAME_IDS = ["emoji", "memory", "math", "trivia", "pairs"] as const;
export type GameId = (typeof GAME_IDS)[number];

export type GameMeta = {
  name: string;
  icon: string;
  blurb: string;
  limitSec: number;
  /** A solid-but-not-perfect score; the AI guards play around this. */
  par: number;
};

export const GAMES: Record<GameId, GameMeta> = {
  emoji: { name: "ด่านทายภาพอีโมจิ", icon: "🖼️", blurb: "ดูอีโมจิ แล้วเดาว่าหมายถึงอะไร", limitSec: 60, par: 560 },
  memory: { name: "ด่านความจำเทพ", icon: "🧠", blurb: "จำลำดับไฟที่กะพริบ แล้วกดตามให้ถูก", limitSec: 150, par: 450 },
  math: { name: "ด่านคิดเลขไว", icon: "➗", blurb: "บวก ลบ คูณ ให้ไวที่สุด", limitSec: 45, par: 520 },
  trivia: { name: "ด่านรอบรู้รอบตัว", icon: "💡", blurb: "คำถามความรู้รอบตัว ตอบได้ทุกวัย", limitSec: 75, par: 500 },
  pairs: { name: "ด่านจับคู่ภาพ", icon: "🃏", blurb: "เปิดการ์ดหาคู่ให้ครบด้วยจำนวนครั้งน้อยที่สุด", limitSec: 90, par: 600 },
};

export const MAX_SCORE = 1000;

export type QuizQuestion = { prompt: string; choices: string[] };

/** What the player's device receives when a round starts. */
export type RoundView =
  | { game: "emoji" | "trivia" | "math"; questions: QuizQuestion[] }
  | { game: "memory"; sequence: number[] }
  | { game: "pairs"; cards: string[] };

/** What the device sends back when the round ends. */
export type RoundAnswers =
  | { game: "emoji" | "trivia" | "math"; picks: number[] }
  | { game: "memory"; level: number }
  | { game: "pairs"; flips: number[] };

export function isGameId(value: unknown): value is GameId {
  return typeof value === "string" && (GAME_IDS as readonly string[]).includes(value);
}

export const MEMORY_LENGTH = 20;
export const MEMORY_POINTS = MAX_SCORE / MEMORY_LENGTH;

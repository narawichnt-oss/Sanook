// Builds a round from a seed and scores it on the server. The answer key is
// rebuilt from the same seed at submit time, so it never leaves the server.

import { EMOJI_RIDDLES, PAIR_FACES, TRIVIA, type Question } from "./content";
import { GAMES, MAX_SCORE, MEMORY_LENGTH, MEMORY_POINTS, type GameId, type RoundAnswers, type RoundView } from "./games";
import { seeded, shuffle, type Rand } from "./rng";

const QUIZ_LENGTH = { emoji: 8, trivia: 8, math: 12 } as const;
const PAIR_COUNT = 6;

type Built = { view: RoundView; key: number[] };

function quizFrom(bank: readonly Question[], count: number, rand: Rand): Built {
  const picked = shuffle(bank, rand).slice(0, count);
  const key: number[] = [];
  const questions = picked.map((q) => {
    const choices = shuffle([q.answer, ...q.wrong], rand);
    key.push(choices.indexOf(q.answer));
    return { prompt: q.prompt, choices };
  });
  return { view: { game: "emoji", questions }, key };
}

function mathRound(rand: Rand): Built {
  const key: number[] = [];
  const questions = Array.from({ length: QUIZ_LENGTH.math }, (_, i) => {
    // Gets a little harder as the round goes on.
    const hard = i >= 6;
    const op = Math.floor(rand() * 3);
    let a: number, b: number, answer: number, sign: string;
    if (op === 0) {
      a = 2 + Math.floor(rand() * (hard ? 80 : 20));
      b = 2 + Math.floor(rand() * (hard ? 80 : 20));
      answer = a + b;
      sign = "+";
    } else if (op === 1) {
      a = 5 + Math.floor(rand() * (hard ? 90 : 25));
      b = 1 + Math.floor(rand() * a);
      answer = a - b;
      sign = "−";
    } else {
      a = 2 + Math.floor(rand() * (hard ? 11 : 8));
      b = 2 + Math.floor(rand() * 8);
      answer = a * b;
      sign = "×";
    }
    const options = new Set([answer]);
    while (options.size < 4) {
      const off = (1 + Math.floor(rand() * 10)) * (rand() < 0.5 ? -1 : 1);
      if (answer + off >= 0) options.add(answer + off);
    }
    const choices = shuffle([...options], rand);
    key.push(choices.indexOf(answer));
    return { prompt: `${a} ${sign} ${b} = ?`, choices: choices.map(String) };
  });
  return { view: { game: "math", questions }, key };
}

export function buildRound(game: GameId, seed: number): Built {
  const rand = seeded(seed);
  switch (game) {
    case "emoji":
      return quizFrom(EMOJI_RIDDLES, QUIZ_LENGTH.emoji, rand);
    case "trivia": {
      const built = quizFrom(TRIVIA, QUIZ_LENGTH.trivia, rand);
      return { view: { ...built.view, game: "trivia" } as RoundView, key: built.key };
    }
    case "math":
      return mathRound(rand);
    case "memory":
      return { view: { game: "memory", sequence: Array.from({ length: MEMORY_LENGTH }, () => Math.floor(rand() * 4)) }, key: [] };
    case "pairs": {
      const faces = shuffle(PAIR_FACES, rand).slice(0, PAIR_COUNT);
      return { view: { game: "pairs", cards: shuffle([...faces, ...faces], rand) }, key: [] };
    }
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export type Scored = { score: number; detail: string };

/**
 * Scores a finished round. `elapsedMs` is measured by the server from when it
 * handed the round out, so a device can't claim it answered faster than it did.
 */
export function scoreRound(game: GameId, seed: number, answers: RoundAnswers, elapsedMs: number): Scored {
  const { view, key } = buildRound(game, seed);
  const limitMs = GAMES[game].limitSec * 1000;

  if (view.game === "memory") {
    let level = answers.game === "memory" ? Math.floor(Number(answers.level)) : 0;
    level = clamp(Number.isFinite(level) ? level : 0, 0, MEMORY_LENGTH);
    // Watching and repeating level k takes real time; drop levels no human could have reached.
    while (level > 0 && elapsedMs < 300 * ((level * (level + 1)) / 2)) level--;
    return { score: Math.round(level * MEMORY_POINTS), detail: `จำได้ ${level} ลำดับ` };
  }

  if (view.game === "pairs") {
    const flips = answers.game === "pairs" && Array.isArray(answers.flips) ? answers.flips.slice(0, 200) : [];
    const matched = new Set<number>();
    let open: number[] = [];
    let moves = 0;
    for (const raw of flips) {
      const i = Number(raw);
      if (!Number.isInteger(i) || i < 0 || i >= view.cards.length || matched.has(i) || open.includes(i)) continue;
      open.push(i);
      if (open.length === 2) {
        moves++;
        if (view.cards[open[0]] === view.cards[open[1]]) open.forEach((m) => matched.add(m));
        open = [];
      }
    }
    if (flips.length * 120 > elapsedMs + 1000) return { score: 0, detail: "เร็วเกินกว่ามนุษย์จะทำได้" };
    const pairs = matched.size / 2;
    if (pairs < PAIR_COUNT) return { score: pairs * 70, detail: `จับคู่ได้ ${pairs}/${PAIR_COUNT} คู่` };
    const seconds = elapsedMs / 1000;
    const score = clamp(Math.round(MAX_SCORE - (moves - PAIR_COUNT) * 45 - Math.max(0, seconds - 20) * 8), 250, MAX_SCORE);
    return { score, detail: `ครบ ${PAIR_COUNT} คู่ใน ${moves} ครั้ง` };
  }

  const picks = answers.game === view.game && Array.isArray(answers.picks) ? answers.picks : [];
  const total = view.questions.length;
  const correct = key.filter((k, i) => Number(picks[i]) === k).length;
  const speed = clamp(1 - elapsedMs / limitMs, 0, 1);
  const score = Math.round((800 * correct) / total + ((200 * correct) / total) * speed);
  return { score: clamp(score, 0, MAX_SCORE), detail: `ตอบถูก ${correct}/${total} ข้อ` };
}

/** Which answer was right for each question, revealed only after the round is scored. */
export function answerKey(game: GameId, seed: number): number[] {
  return buildRound(game, seed).key;
}

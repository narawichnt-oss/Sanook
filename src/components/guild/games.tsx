"use client";

import { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { MEMORY_LENGTH, MEMORY_POINTS, type RoundAnswers, type RoundView } from "@/lib/guild/games";

type GameProps<V extends RoundView> = {
  view: V;
  deadline: number;
  onProgress: (text: string, score: number) => void;
  onDone: (answers: RoundAnswers) => void;
};

/** Ends the round when the clock runs out. */
function useDeadline(deadline: number, onTimeout: () => void) {
  const latest = useRef(onTimeout);
  useEffect(() => {
    latest.current = onTimeout;
  });
  useEffect(() => {
    const t = setTimeout(() => latest.current(), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(t);
  }, [deadline]);
}

export function TimerBar({ deadline, total }: { deadline: number; total: number }) {
  const [left, setLeft] = useState(() => deadline - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(deadline - Date.now()), 200);
    return () => clearInterval(t);
  }, [deadline]);
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  const low = left < 10_000;
  return (
    <div className="flex items-center gap-2">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-night-3">
        <div className={`h-full rounded-full transition-[width] duration-200 ${low ? "bg-coral" : "bg-mint"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-10 text-right text-sm font-bold tabular-nums ${low ? "text-coral" : ""}`}>{Math.max(0, Math.ceil(left / 1000))}</span>
    </div>
  );
}

// ---- Quiz: emoji riddles, trivia, quick maths ----------------------------------------

const CHOICE_COLORS = ["bg-sky/25 ring-sky/60", "bg-pink/25 ring-pink/60", "bg-mint/25 ring-mint/60", "bg-sun/25 ring-sun/60"];

export function QuizGame({ view, deadline, onProgress, onDone }: GameProps<Extract<RoundView, { questions: unknown }>>) {
  const [index, setIndex] = useState(0);
  const picks = useRef<number[]>([]);
  const finished = useRef(false);
  const total = view.questions.length;

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone({ game: view.game, picks: Array.from({ length: total }, (_, i) => picks.current[i] ?? -1) });
  };
  useDeadline(deadline, finish);

  function choose(k: number) {
    if (finished.current) return;
    haptic("tick");
    picks.current[index] = k;
    if (index + 1 >= total) return finish();
    setIndex(index + 1);
    onProgress(`ข้อ ${index + 2}/${total}`, 0);
  }

  const q = view.questions[index];
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex justify-center gap-1.5" aria-hidden>
        {view.questions.map((_, i) => (
          <span key={i} className={`h-1.5 w-5 rounded-full ${i < index ? "bg-lilac" : i === index ? "bg-ink" : "bg-ink/20"}`} />
        ))}
      </div>
      <div className="glass grid min-h-44 place-items-center rounded-[2rem] p-6 text-center">
        <span
          key={index}
          className={`guild-drop ${view.game === "emoji" ? "text-7xl tracking-widest" : view.game === "math" ? "text-5xl font-extrabold tabular-nums" : "text-2xl leading-snug font-semibold"}`}
        >
          {q.prompt}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {q.choices.map((choice, k) => (
          <button
            key={`${index}-${k}`}
            onClick={() => choose(k)}
            className={`min-h-20 rounded-3xl px-3 py-4 text-lg font-bold ring-2 transition active:scale-95 ${CHOICE_COLORS[k]}`}
          >
            {choice}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Memory: repeat the flashing sequence -------------------------------------------

const PADS = [
  { color: "var(--color-mint)", tone: 329.6, label: "เขียว" },
  { color: "var(--color-sky)", tone: 392, label: "ฟ้า" },
  { color: "var(--color-pink)", tone: 493.9, label: "ชมพู" },
  { color: "var(--color-sun)", tone: 587.3, label: "เหลือง" },
];

function useTones() {
  const ctx = useRef<AudioContext | null>(null);
  useEffect(() => () => void ctx.current?.close(), []);
  return (freq: number, ms = 260) => {
    try {
      ctx.current ??= new AudioContext();
      const ac = ctx.current;
      if (ac.state === "suspended") void ac.resume();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + ms / 1000);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + ms / 1000);
    } catch {
      // no audio here — the lights are enough
    }
  };
}

export function MemoryGame({ view, deadline, onProgress, onDone }: GameProps<Extract<RoundView, { game: "memory" }>>) {
  const [level, setLevel] = useState(0);
  const [phase, setPhase] = useState<"watch" | "input" | "oops">("watch");
  const [lit, setLit] = useState<number | null>(null);
  const pos = useRef(0);
  const finished = useRef(false);
  const tone = useTones();

  const finish = (reached: number) => {
    if (finished.current) return;
    finished.current = true;
    onDone({ game: "memory", level: reached });
  };
  useDeadline(deadline, () => finish(level));

  // Play the first level+1 steps, then hand over to the player.
  useEffect(() => {
    if (phase !== "watch") return;
    const steps = view.sequence.slice(0, level + 1);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const speed = Math.max(260, 480 - level * 12);
    steps.forEach((pad, j) => {
      timers.push(
        setTimeout(() => {
          setLit(pad);
          tone(PADS[pad].tone);
        }, 700 + j * (speed + 160)),
      );
      timers.push(setTimeout(() => setLit(null), 700 + j * (speed + 160) + speed));
    });
    timers.push(
      setTimeout(
        () => {
          pos.current = 0;
          setPhase("input");
        },
        700 + steps.length * (speed + 160),
      ),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- replays only when the level changes
  }, [phase, level]);

  function tap(pad: number) {
    if (phase !== "input" || finished.current) return;
    tone(PADS[pad].tone, 180);
    setLit(pad);
    setTimeout(() => setLit((l) => (l === pad ? null : l)), 160);
    if (pad !== view.sequence[pos.current]) {
      haptic("nudge");
      setPhase("oops");
      tone(150, 500);
      setTimeout(() => finish(level), 900);
      return;
    }
    haptic("tick");
    pos.current++;
    if (pos.current === level + 1) {
      const reached = level + 1;
      onProgress(`จำได้ ${reached} ลำดับ`, reached * MEMORY_POINTS);
      if (reached >= MEMORY_LENGTH) return finish(reached);
      setLevel(reached);
      setPhase("watch");
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-5">
      <p className="text-center text-lg font-bold">
        {phase === "watch" ? "👀 ดูให้ดี…" : phase === "input" ? "👆 กดตามลำดับ!" : "😵 อุ๊ย ผิดลำดับ"}
      </p>
      <p className="text-sm text-muted">
        ลำดับที่ {level + 1} · ผ่านแล้ว {level} ลำดับ ({level * MEMORY_POINTS} แต้ม)
      </p>
      <div className="grid w-full max-w-sm grid-cols-2 gap-4">
        {PADS.map((p, i) => (
          <button
            key={i}
            aria-label={p.label}
            onClick={() => tap(i)}
            disabled={phase !== "input"}
            className="aspect-square rounded-[2rem] transition-all duration-100 disabled:cursor-default"
            style={{
              background: p.color,
              opacity: lit === i ? 1 : 0.35,
              transform: lit === i ? "scale(1.04)" : undefined,
              boxShadow: lit === i ? `0 0 40px 6px ${p.color}` : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ---- Pairs: flip and match ----------------------------------------------------------

export function PairsGame({ view, deadline, onProgress, onDone }: GameProps<Extract<RoundView, { game: "pairs" }>>) {
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const flips = useRef<number[]>([]);
  const busy = useRef(false);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone({ game: "pairs", flips: flips.current });
  };
  useDeadline(deadline, finish);

  function flip(i: number) {
    if (busy.current || finished.current || matched.has(i) || open.includes(i)) return;
    haptic("tick");
    flips.current.push(i);
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = next;
    if (view.cards[a] === view.cards[b]) {
      const done = new Set(matched).add(a).add(b);
      setMatched(done);
      setOpen([]);
      onProgress(`จับคู่ได้ ${done.size / 2}/${view.cards.length / 2} คู่`, (done.size / 2) * 70);
      if (done.size === view.cards.length) setTimeout(finish, 450);
    } else {
      busy.current = true;
      setTimeout(() => {
        setOpen([]);
        busy.current = false;
      }, 650);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4">
      <p className="text-sm text-muted">
        เปิดไปแล้ว {moves} ครั้ง · จับคู่ได้ {matched.size / 2}/{view.cards.length / 2} คู่
      </p>
      <div className="grid w-full max-w-sm grid-cols-3 gap-3 [perspective:800px] sm:grid-cols-4">
        {view.cards.map((face, i) => {
          const shown = open.includes(i) || matched.has(i);
          return (
            <button key={i} onClick={() => flip(i)} aria-label={shown ? face : `การ์ดใบที่ ${i + 1}`} className="aspect-[3/4]">
              <span data-open={shown} className="guild-card relative block size-full">
                <span className="absolute inset-0 grid place-items-center rounded-2xl bg-gradient-to-br from-lilac to-pink text-3xl shadow-lg">❔</span>
                <span
                  className={`guild-card-front absolute inset-0 grid place-items-center rounded-2xl text-5xl shadow-lg ${matched.has(i) ? "bg-mint/40 ring-2 ring-mint" : "bg-ink"}`}
                >
                  {face}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

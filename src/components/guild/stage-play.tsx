"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { guildApi, usePoll } from "@/lib/guild/client";
import { GAMES, type GameId, type RoundAnswers, type RoundView } from "@/lib/guild/games";
import type { LiveView, WarView } from "@/lib/guild/types";
import type { Session } from "./gate";
import { MemoryGame, PairsGame, QuizGame, TimerBar } from "./games";
import { ErrorNote, fmt, message } from "./ui";

type Round = { token: string; stage: number; game: GameId; limitSec: number; view: RoundView };
type Result = {
  score: number;
  detail: string;
  improved: boolean;
  best: number;
  previous: number;
  stage: number;
  game: GameId;
  key: number[] | null;
};

type Phase =
  | { kind: "intro" }
  | { kind: "starting" }
  | { kind: "countdown"; round: Round; n: number }
  | { kind: "playing"; round: Round; deadline: number }
  | { kind: "sending"; round: Round; answers: RoundAnswers }
  | { kind: "result"; round: Round; answers: RoundAnswers; result: Result };

const PROGRESS_MS = 3000;

/** One run at one stage: intro → 3-2-1 → mini-game → score. Friends' cheers float in while you play. */
export function StagePlay({ id, stage, session }: { id: string; stage: string; session: Session }) {
  const router = useRouter();
  const [war, setWar] = useState<WarView | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [error, setError] = useState("");
  const [cheers, setCheers] = useState<LiveView["cheers"]>([]);
  const progress = useRef({ text: "เพิ่งเริ่ม", score: 0 });
  const seenCheers = useRef(new Set<string>());
  const fixed = stage === "auto" ? null : Number(stage);

  useEffect(() => {
    guildApi<WarView>(`/api/war/${id}`)
      .then(setWar)
      .catch((e) => setError(message(e)));
  }, [id]);

  // While playing, report progress so friends can watch, and pick up their cheers.
  usePoll(
    async () => {
      const live = await guildApi<LiveView>(`/api/war/${id}/live`, {
        body: { progress: progress.current.text, score: progress.current.score },
      });
      const mine = live.cheers.filter((c) => c.to === session.me.player.id && !seenCheers.current.has(c.id));
      if (!mine.length) return;
      mine.forEach((c) => seenCheers.current.add(c.id));
      haptic("tick");
      setCheers((prev) => [...prev.slice(-8), ...mine]);
      // Drop them once the float-up animation is over.
      setTimeout(() => setCheers((prev) => prev.filter((c) => !mine.includes(c))), 3000);
    },
    PROGRESS_MS,
    { enabled: phase.kind === "playing", immediate: false },
  );

  async function start(target: number | "auto") {
    haptic("tap");
    setError("");
    setPhase({ kind: "starting" });
    try {
      const round = await guildApi<Round>(`/api/war/${id}/round`, { body: { stage: target } });
      progress.current = { text: "เพิ่งเริ่ม", score: 0 };
      setPhase({ kind: "countdown", round, n: 3 });
    } catch (e) {
      setError(message(e));
      setPhase({ kind: "intro" });
    }
  }

  // 3, 2, 1, go!
  useEffect(() => {
    if (phase.kind !== "countdown") return;
    const t = setTimeout(() => {
      haptic("tick");
      if (phase.n > 1) setPhase({ ...phase, n: phase.n - 1 });
      else setPhase({ kind: "playing", round: phase.round, deadline: Date.now() + phase.round.limitSec * 1000 });
    }, 800);
    return () => clearTimeout(t);
  }, [phase]);

  async function submit(round: Round, answers: RoundAnswers) {
    setPhase({ kind: "sending", round, answers });
    try {
      const result = await guildApi<Result>(`/api/war/${id}/round`, { body: { token: round.token, answers } });
      haptic(result.improved ? "nudge" : "tap");
      setPhase({ kind: "result", round, answers, result });
      guildApi<WarView>(`/api/war/${id}`).then(setWar).catch(() => {});
    } catch (e) {
      setError(message(e));
      setPhase({ kind: "intro" });
    }
  }

  const known = phase.kind === "intro" || phase.kind === "starting" ? fixed : phase.round.stage;
  const game = known !== null && war ? war.stages[known]?.game : phase.kind !== "intro" && phase.kind !== "starting" ? phase.round.game : null;
  const meta = game ? GAMES[game] : null;
  const stageView = known !== null ? war?.stages[known] : undefined;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-4 pt-4 pb-10">
      <header className="flex items-center gap-3">
        <Link href={`/guild/war/${id}`} aria-label="กลับแผนที่" className="glass grid size-10 shrink-0 place-items-center rounded-full">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{war ? `${war.sides.attacker.name} ⚔️ ${war.sides.defender.name}` : "สงครามกิลด์"}</p>
          <h1 className="truncate text-lg font-extrabold">{meta ? `${meta.icon} ${meta.name}` : "🎲 สุ่มด่านที่ยังยึดไม่ได้"}</h1>
        </div>
      </header>

      <ErrorNote text={error} />

      {(phase.kind === "intro" || phase.kind === "starting") && (
        <section className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <span className="bob text-8xl">{meta?.icon ?? "🎲"}</span>
          <p className="max-w-xs text-ink/85">{meta?.blurb ?? "ระบบจะเลือกด่านที่ฝั่งเรายังตามอยู่ให้ ช่วยกันพลิกเกมเลย!"}</p>
          {meta && <p className="text-sm text-muted">มีเวลา {meta.limitSec} วินาที · คะแนนเต็ม 1,000</p>}
          {stageView && (
            <p className="text-sm text-muted">
              สถิติของคุณ {fmt(stageView.myBest)} · เหลือสิทธิ์ {stageView.attemptsLeft} ครั้ง
            </p>
          )}
          <button
            disabled={phase.kind === "starting" || (stageView ? stageView.attemptsLeft <= 0 : false)}
            onClick={() => start(fixed ?? "auto")}
            className="neon mt-2 h-16 w-full max-w-xs rounded-full bg-sun text-2xl font-extrabold text-night transition active:scale-95 disabled:opacity-50"
          >
            {phase.kind === "starting" ? "กำลังเตรียมด่าน…" : "เริ่ม!"}
          </button>
        </section>
      )}

      {phase.kind === "countdown" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-muted">{GAMES[phase.round.game].name}</p>
          <span key={phase.n} className="guild-drop text-9xl font-extrabold text-sun">
            {phase.n}
          </span>
        </section>
      )}

      {phase.kind === "playing" && (
        <section className="flex flex-1 flex-col gap-4">
          <TimerBar deadline={phase.deadline} total={phase.round.limitSec * 1000} />
          <GameFor
            round={phase.round}
            deadline={phase.deadline}
            onProgress={(text, score) => (progress.current = { text, score })}
            onDone={(answers) => submit(phase.round, answers)}
          />
        </section>
      )}

      {phase.kind === "sending" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-3">
          <span className="bob text-6xl">🧮</span>
          <p className="text-muted">กำลังนับคะแนน…</p>
        </section>
      )}

      {phase.kind === "result" && (
        <ResultView
          round={phase.round}
          answers={phase.answers}
          result={phase.result}
          war={war}
          onAgain={() => start(phase.round.stage)}
          onNext={() => start("auto")}
          onMap={() => router.push(`/guild/war/${id}`)}
        />
      )}

      {/* Cheers from guild mates drift up the right edge. */}
      <div aria-live="polite" className="pointer-events-none fixed right-3 bottom-24 z-30 flex flex-col items-end">
        {cheers.map((c) => (
          <span key={c.id} className="guild-cheer absolute right-0 bottom-0 flex items-center gap-1 rounded-full bg-night/85 px-2.5 py-1 text-sm whitespace-nowrap shadow-lg">
            <span className="text-2xl">{c.emoji}</span>
            <span>{c.fromAvatar} {c.fromName}</span>
          </span>
        ))}
      </div>
    </main>
  );
}

function GameFor({
  round,
  deadline,
  onProgress,
  onDone,
}: {
  round: Round;
  deadline: number;
  onProgress: (text: string, score: number) => void;
  onDone: (answers: RoundAnswers) => void;
}) {
  const v = round.view;
  if (v.game === "memory") return <MemoryGame view={v} deadline={deadline} onProgress={onProgress} onDone={onDone} />;
  if (v.game === "pairs") return <PairsGame view={v} deadline={deadline} onProgress={onProgress} onDone={onDone} />;
  return <QuizGame view={v} deadline={deadline} onProgress={onProgress} onDone={onDone} />;
}

function ResultView({
  round,
  answers,
  result,
  war,
  onAgain,
  onNext,
  onMap,
}: {
  round: Round;
  answers: RoundAnswers;
  result: Result;
  war: WarView | null;
  onAgain: () => void;
  onNext: () => void;
  onMap: () => void;
}) {
  const stage = war?.stages[result.stage];
  const us = war?.us;
  const them = us === "attacker" ? "defender" : "attacker";
  const left = stage?.attemptsLeft ?? 0;
  const anyLeft = war?.stages.some((s) => s.attemptsLeft > 0);
  const quiz = round.view.game !== "memory" && round.view.game !== "pairs" ? round.view : null;
  const picks = answers.game !== "memory" && answers.game !== "pairs" ? answers.picks : [];

  return (
    <section className="flex flex-1 flex-col items-center gap-4 text-center">
      <span className="guild-drop text-7xl">{result.improved ? "🎉" : "👍"}</span>
      <p className="text-6xl font-extrabold text-sun tabular-nums">{fmt(result.score)}</p>
      <p className="text-ink/85">{result.detail}</p>
      <p className={`rounded-full px-4 py-1.5 text-sm font-bold ${result.improved ? "bg-mint/20 text-mint" : "bg-night-3 text-muted"}`}>
        {result.improved
          ? result.previous
            ? `ทำลายสถิติตัวเอง! (เดิม ${fmt(result.previous)})`
            : "ลงสนามครั้งแรก นับให้กิลด์แล้ว!"
          : result.best === 0
            ? "รอบนี้ยังไม่ได้แต้ม ลองอีกทีนะ สู้ ๆ!"
            : `สถิติเดิม ${fmt(result.best)} ยังดีกว่า รอบนี้ไม่ทับ`}
      </p>

      {stage && us && (
        <div
          className="w-full rounded-2xl px-4 py-2 text-sm font-bold"
          style={{ background: `color-mix(in srgb, ${stage.leader === us ? "var(--color-sky)" : "var(--color-coral)"} 20%, transparent)` }}
        >
          {stage.leader === us ? "🚩 ด่านนี้เป็นของฝั่งเรา" : "🏴 ฝั่งเขายังนำด่านนี้"} · {fmt(stage.scores[us])} : {fmt(stage.scores[them])}
        </div>
      )}

      {quiz && result.key && (
        <details className="glass w-full rounded-2xl p-3 text-left text-sm">
          <summary className="cursor-pointer font-semibold">ดูเฉลย</summary>
          <ol className="mt-2 flex flex-col gap-1.5">
            {quiz.questions.map((q, i) => {
              const right = picks[i] === result.key![i];
              return (
                <li key={i} className="flex gap-2">
                  <span>{right ? "✅" : "❌"}</span>
                  <span className="min-w-0">
                    <span className="text-muted">{q.prompt}</span> → <b>{q.choices[result.key![i]]}</b>
                  </span>
                </li>
              );
            })}
          </ol>
        </details>
      )}

      <div className="mt-auto flex w-full flex-col gap-2 pt-4">
        {left > 0 && (
          <button onClick={onAgain} className="neon h-14 rounded-full bg-sun text-lg font-extrabold text-night">
            🔁 เล่นด่านนี้อีกครั้ง (เหลือ {left})
          </button>
        )}
        {anyLeft && (
          <button onClick={onNext} className="glass h-12 rounded-full font-bold">
            🎲 สุ่มด่านต่อไป
          </button>
        )}
        <button onClick={onMap} className="h-12 rounded-full text-muted">
          กลับแผนที่สงคราม
        </button>
      </div>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { QuizBlockData } from "@/lib/actions/content-blocks";

export type QuizPlayerDict = {
  submitCta: string;
  retryCta: string;
  scoreLabel: string;
  passLabel: string;
  failLabel: string;
  correctLabel: string;
  incorrectLabel: string;
  yourAnswerLabel: string;
  correctAnswerLabel: string;
  explanationLabel: string;
  pickAnswerHint: string;
  thresholdLabel: string;
};

type Status = "answering" | "submitted";

export function QuizPlayer({
  data,
  dict,
}: {
  data: QuizBlockData;
  dict: QuizPlayerDict;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("answering");

  const allAnswered = useMemo(
    () => data.questions.every((q) => typeof answers[q.id] === "string"),
    [answers, data.questions],
  );

  const score = useMemo(() => {
    if (status !== "submitted") return { correct: 0, total: data.questions.length, percent: 0 };
    const correct = data.questions.reduce(
      (acc, q) => (answers[q.id] === q.correctOptionId ? acc + 1 : acc),
      0,
    );
    const total = data.questions.length;
    const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
    return { correct, total, percent };
  }, [answers, data.questions, status]);

  const passed = score.percent >= data.passThresholdPercent;

  function selectAnswer(qid: string, oid: string) {
    if (status === "submitted") return;
    setAnswers((prev) => ({ ...prev, [qid]: oid }));
  }

  function submit() {
    if (!allAnswered) return;
    setStatus("submitted");
  }

  function retry() {
    setAnswers({});
    setStatus("answering");
  }

  return (
    <section
      className="flex flex-col gap-6 rounded-lg border border-black/10 p-5 dark:border-white/15"
      aria-labelledby={data.title ? "quiz-title" : undefined}
    >
      {data.title ? (
        <h3 id="quiz-title" className="text-xl font-semibold tracking-tight">
          {data.title}
        </h3>
      ) : null}
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        {dict.thresholdLabel.replace("{n}", String(data.passThresholdPercent))}
      </p>

      {status === "submitted" ? (
        <div
          role="status"
          aria-live="polite"
          className={
            passed
              ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-900 dark:border-emerald-400/30 dark:text-emerald-200"
              : "rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-900 dark:border-amber-400/30 dark:text-amber-200"
          }
        >
          <p className="text-base font-semibold">
            {passed ? dict.passLabel : dict.failLabel}
          </p>
          <p className="text-sm">
            {dict.scoreLabel
              .replace("{correct}", String(score.correct))
              .replace("{total}", String(score.total))
              .replace("{percent}", String(score.percent))}
          </p>
        </div>
      ) : null}

      <ol className="flex flex-col gap-6">
        {data.questions.map((q, qIndex) => {
          const selected = answers[q.id];
          const isCorrect = status === "submitted" && selected === q.correctOptionId;
          const groupName = `quiz-answer-${q.id}`;
          return (
            <li
              key={q.id}
              className="rounded-md border border-black/10 p-4 dark:border-white/15"
            >
              <fieldset className="flex flex-col gap-3">
                <legend className="text-base font-semibold">
                  {`${qIndex + 1}. ${q.text}`}
                </legend>
                <ul className="flex flex-col gap-2">
                  {q.options.map((o, oIndex) => {
                    const radioId = `${groupName}-${o.id}`;
                    const isSelected = selected === o.id;
                    const isRight = o.id === q.correctOptionId;
                    let stateClass =
                      "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5";
                    if (status === "submitted") {
                      if (isRight) {
                        stateClass =
                          "border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:border-emerald-400/40 dark:text-emerald-200";
                      } else if (isSelected) {
                        stateClass =
                          "border-red-500/50 bg-red-500/10 text-red-900 dark:border-red-400/40 dark:text-red-200";
                      } else {
                        stateClass =
                          "border-black/10 text-zinc-600 dark:border-white/15 dark:text-zinc-400";
                      }
                    } else if (isSelected) {
                      stateClass =
                        "border-foreground bg-foreground/5 dark:border-white dark:bg-white/10";
                    }
                    return (
                      <li key={o.id}>
                        <label
                          htmlFor={radioId}
                          className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-base focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-current ${stateClass}`}
                        >
                          <input
                            id={radioId}
                            type="radio"
                            name={groupName}
                            checked={isSelected}
                            onChange={() => selectAnswer(q.id, o.id)}
                            disabled={status === "submitted"}
                            className="h-5 w-5"
                          />
                          <span className="text-sm font-mono">
                            {String.fromCharCode(65 + oIndex)}.
                          </span>
                          <span className="flex-1">{o.text}</span>
                          {status === "submitted" && isRight ? (
                            <span className="text-xs font-semibold uppercase tracking-wide">
                              {dict.correctAnswerLabel}
                            </span>
                          ) : null}
                          {status === "submitted" && !isRight && isSelected ? (
                            <span className="text-xs font-semibold uppercase tracking-wide">
                              {dict.yourAnswerLabel}
                            </span>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {status === "submitted" ? (
                  <div className="flex flex-col gap-2 text-sm">
                    <p
                      className={
                        isCorrect
                          ? "font-semibold text-emerald-700 dark:text-emerald-300"
                          : "font-semibold text-red-700 dark:text-red-300"
                      }
                    >
                      {isCorrect ? dict.correctLabel : dict.incorrectLabel}
                    </p>
                    {q.explanation ? (
                      <p className="text-zinc-700 dark:text-zinc-300">
                        <span className="font-semibold">{dict.explanationLabel}</span>{" "}
                        {q.explanation}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </fieldset>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {status === "submitted" ? (
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.retryCta}
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!allAnswered}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
          >
            {dict.submitCta}
          </button>
        )}
        {status === "answering" && !allAnswered ? (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {dict.pickAnswerHint}
          </p>
        ) : null}
      </div>
    </section>
  );
}
